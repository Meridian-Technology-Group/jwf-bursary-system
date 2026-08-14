"use client";

/**
 * Unsaved-changes registry + prompt — the wiring around
 * `@/lib/portal/unsaved-changes` (Epic 13 / WP B1).
 *
 * WHY A PROVIDER (the React-tree constraint, same one `stepper-data-context`
 * documents): the section form lives in the CONTENT branch, while the stepper
 * that navigates away from it lives in the RAIL — an ancestor-side sibling.
 * Data cannot flow between them, so the "does this section hold unsaved work,
 * and how do I save it" registration has to live in a store mounted ABOVE both.
 * The Provider therefore sits in `(portal)/layout.tsx` and `(contribute)/layout.tsx`.
 *
 * THE REGISTRATION IS HELD IN A REF, ON PURPOSE. The rail only needs to know
 * whether the form is dirty at the instant a link is clicked. Publishing dirty
 * state through context would re-render the whole rail on the applicant's first
 * keystroke in every section, for no visible benefit.
 *
 * WP B2 (autosave) is expected to read the SAME registration — `isDirty()` to
 * decide whether a debounced write is worth making, `save()` to make it — rather
 * than standing up a second, competing "is there work in here" signal.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  resolveUnsavedChoice,
  shouldPromptBeforeNavigation,
  type UnsavedChoice,
} from "@/lib/portal/unsaved-changes";

/**
 * What a section form publishes to the guard.
 *
 * `save()` must persist WITHOUT navigating (the applicant already told us where
 * they want to go) and must resolve `false` rather than throw when the write
 * did not land.
 */
export interface UnsavedSectionRegistration {
  /** Read the live dirty flag. Called at click time, never during render. */
  isDirty: () => boolean;
  /**
   * False when this form has no in-place save wired up, so the prompt offers
   * only "stay" and "discard" rather than a Save button that cannot work.
   */
  canSave: boolean;
  /** Persist the section in place. Resolves true only when the write landed. */
  save: () => Promise<boolean>;
}

interface UnsavedChangesApi {
  /**
   * Ask permission to navigate to `href`.
   *
   * Returns true when the caller should let its own navigation proceed (nothing
   * to lose), and false when the guard has taken over — the prompt is open and
   * the guard will perform the navigation itself once the applicant chooses.
   */
  requestNavigation: (href: string) => boolean;
  /**
   * Same contract as `requestNavigation`, for a navigation that has no href —
   * the wizard footer's history Back. The guard replays `navigate` itself once
   * the applicant has chosen.
   */
  requestUnroutedNavigation: (navigate: () => void) => boolean;
  /**
   * Best-effort persist of whatever is currently in the form, used by callers
   * that cannot be cancelled (the idle-logout watcher). Resolves true when
   * there was nothing to save or the save landed.
   */
  flush: () => Promise<boolean>;
  /** Register the mounted section form. Returns an unregister function. */
  register: (registration: UnsavedSectionRegistration) => () => void;
}

const NOOP_API: UnsavedChangesApi = {
  requestNavigation: () => true,
  requestUnroutedNavigation: () => true,
  flush: async () => true,
  register: () => () => {},
};

const UnsavedChangesContext = React.createContext<UnsavedChangesApi>(NOOP_API);

/**
 * Copy for the prompt. Kept here (not in the pure module) because it is chrome,
 * not logic.
 */
const PROMPT_TITLE = "You have unsaved changes";
const PROMPT_BODY =
  "You've entered information on this page that hasn't been saved yet. Save it before you move on, or discard it and lose what you've typed.";
const SAVE_FAILED =
  "Your changes could not be saved, so you're still on this page. Please check the form for anything that needs fixing and try again.";

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const registrationRef = React.useRef<UnsavedSectionRegistration | null>(null);
  /** The navigation the applicant asked for, replayed once they have chosen. */
  const pendingNavigateRef = React.useRef<(() => void) | null>(null);

  const [promptOpen, setPromptOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [saveFailed, setSaveFailed] = React.useState(false);
  const [canSave, setCanSave] = React.useState(true);

  const register = React.useCallback(
    (registration: UnsavedSectionRegistration) => {
      registrationRef.current = registration;
      return () => {
        // Only clear the slot if it is still ours — during a soft navigation the
        // next section can register before the previous one unmounts, and
        // clearing then would leave the guard blind on the new page.
        if (registrationRef.current === registration) {
          registrationRef.current = null;
        }
      };
    },
    []
  );

  const isDirtyNow = React.useCallback(() => {
    try {
      return registrationRef.current?.isDirty() ?? false;
    } catch {
      // A guard that throws must not become a navigation blocker.
      return false;
    }
  }, []);

  const openPrompt = React.useCallback((navigate: () => void) => {
    pendingNavigateRef.current = navigate;
    setSaveFailed(false);
    setCanSave(registrationRef.current?.canSave ?? false);
    setPromptOpen(true);
  }, []);

  const requestNavigation = React.useCallback(
    (href: string) => {
      const prompt = shouldPromptBeforeNavigation({
        isDirty: isDirtyNow(),
        targetHref: href,
        currentPath: pathname,
      });
      if (!prompt) return true;

      openPrompt(() => router.push(href));
      return false;
    },
    [isDirtyNow, openPrompt, pathname, router]
  );

  const requestUnroutedNavigation = React.useCallback(
    (navigate: () => void) => {
      if (!isDirtyNow()) return true;
      openPrompt(navigate);
      return false;
    },
    [isDirtyNow, openPrompt]
  );

  const flush = React.useCallback(async () => {
    if (!isDirtyNow()) return true;
    try {
      return await (registrationRef.current?.save() ?? Promise.resolve(true));
    } catch {
      return false;
    }
  }, [isDirtyNow]);

  const answer = React.useCallback(async (choice: UnsavedChoice) => {
    const navigate = pendingNavigateRef.current;
    setBusy(choice === "save");
    setSaveFailed(false);

    const outcome = await resolveUnsavedChoice(choice, {
      save: async () => (await registrationRef.current?.save()) ?? false,
      navigate: () => navigate?.(),
    });

    setBusy(false);

    if (outcome === "save-failed") {
      // Stay open so the applicant can see what happened and choose again —
      // silently letting the navigation through is the data loss we are fixing.
      setSaveFailed(true);
      return;
    }

    pendingNavigateRef.current = null;
    setPromptOpen(false);
  }, []);

  // Hard navigation / tab close. The in-app prompt cannot cover a typed URL, a
  // bookmark or a closed tab, so fall back to the browser's own confirmation.
  // Registered once and gated on the live ref, so it costs nothing while clean.
  React.useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyNow()) return;
      event.preventDefault();
      // Legacy browsers require a return value to raise the dialog; the string
      // itself is ignored by every current browser.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirtyNow]);

  const api = React.useMemo<UnsavedChangesApi>(
    () => ({ requestNavigation, requestUnroutedNavigation, flush, register }),
    [requestNavigation, requestUnroutedNavigation, flush, register]
  );

  return (
    <UnsavedChangesContext.Provider value={api}>
      {children}
      <Dialog
        open={promptOpen}
        onOpenChange={(open) => {
          // Dismissing the dialog (Esc / overlay / X) means "stay here".
          if (!open && !busy) {
            pendingNavigateRef.current = null;
            setSaveFailed(false);
            setPromptOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{PROMPT_TITLE}</DialogTitle>
            <DialogDescription>{PROMPT_BODY}</DialogDescription>
          </DialogHeader>

          {saveFailed ? (
            <p role="alert" className="text-sm text-error-700">
              {SAVE_FAILED}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("cancel")}
            >
              Stay on this page
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("discard")}
            >
              Discard changes
            </Button>
            {canSave ? (
              <Button disabled={busy} onClick={() => void answer("save")}>
                {busy ? (
                  <>
                    <Loader2
                      className="mr-1.5 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Save and continue"
                )}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnsavedChangesContext.Provider>
  );
}

/**
 * Publish the mounted section form's dirty state + in-place save to the guard.
 * Safe outside a Provider (registers into an inert default).
 */
export function useRegisterUnsavedSection(
  registration: UnsavedSectionRegistration
): void {
  const { register } = React.useContext(UnsavedChangesContext);
  const { canSave } = registration;

  // Hold the latest closure in a ref so a re-render of the form does not churn
  // the registration; the guard always calls through to the current one.
  const latest = React.useRef(registration);
  latest.current = registration;

  React.useEffect(
    () =>
      register({
        isDirty: () => latest.current.isDirty(),
        canSave,
        save: () => latest.current.save(),
      }),
    // Registers once per mount (and again only if the save capability changes):
    // `latest` keeps the behaviour current, so re-registering on every render
    // would be pure churn.
    [register, canSave]
  );
}

/** Read the guard API (navigation interception + flush). Inert outside a Provider. */
export function useUnsavedChanges(): UnsavedChangesApi {
  return React.useContext(UnsavedChangesContext);
}
