"use client";

/**
 * Idle-logout watcher (Epic 11, D20).
 *
 * Mounted in the authenticated layouts (admin + portal). Listens for user
 * activity; after a configurable idle window it shows a short "you'll be signed
 * out" warning with a live countdown, then — if no activity is seen before the
 * countdown hits zero — POSTs to the existing `/api/auth/logout` route (which
 * already clears the Supabase cookies and 303-redirects to /login, with its own
 * CSRF Origin check). No new logout primitive is introduced.
 *
 * Optional: when `resolveIdleTimeoutConfig().enabled` is false (env flag) the
 * component renders nothing and registers no listeners.
 *
 * This is a UX convenience, not a hard security control — see
 * `src/lib/auth/idle-timeout.ts`. The authoritative session boundary is the
 * Supabase token expiry checked in middleware. That is what licenses the two
 * data-safety concessions below (Epic 13 / WP B1, CF-15):
 *
 *  1. **Never sign out a tab that cannot see the warning.** Background tabs get
 *     their timers throttled, so the whole warn→logout window could elapse
 *     unseen: the applicant switched away for half an hour, came back to the
 *     login page and lost everything typed since her last save. The warning is
 *     now deferred until the document is visible, so the countdown is always
 *     actually shown before anyone is signed out.
 *  2. **Flush unsaved form work before signing out.** The forced logout is a
 *     full-page form POST, which tears down the section form. It now asks the
 *     unsaved-changes guard to persist first (a draft save when the section does
 *     not yet validate), so being signed out costs the applicant their session,
 *     not their afternoon.
 *
 * Neither concession applies outside a portal/contribute layout: the admin shell
 * mounts this watcher with no `UnsavedChangesProvider` above it, so the flush is
 * an inert no-op there.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  resolveIdleTimeoutConfig,
  type IdleTimeoutConfig,
} from "@/lib/auth/idle-timeout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/components/portal/unsaved-changes-context";

/** Activity signals that reset the idle timer. Passive listeners, no preventDefault. */
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/** Throttle window for the high-frequency activity reset (avoids per-pixel work). */
const ACTIVITY_THROTTLE_MS = 1_000;

/**
 * How often to re-check whether the tab has come back to the foreground before
 * showing the sign-out warning. A hidden tab is never warned (and so never
 * signed out); `visibilitychange` normally reschedules the whole idle window the
 * moment it returns, so this poll is only the belt to that braces.
 */
const HIDDEN_RECHECK_MS = 15_000;

export function IdleLogoutWatcher({
  /** Override for tests; production resolves from NEXT_PUBLIC_* env. */
  config,
}: {
  config?: IdleTimeoutConfig;
}) {
  // Resolve once on mount. Env is build-time inlined for NEXT_PUBLIC_* vars, so
  // there is nothing to re-resolve on re-render.
  const resolved = useRef<IdleTimeoutConfig>(
    config ?? resolveIdleTimeoutConfig()
  );
  const { enabled, idleMs, warnMs } = resolved.current;

  // Inert outside an `UnsavedChangesProvider` (i.e. in the admin shell).
  const { flush: flushUnsavedChanges } = useUnsavedChanges();

  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(warnMs / 1000));

  // Timers held in refs so they survive re-renders without re-scheduling.
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivity = useRef<number>(0);
  const loggingOut = useRef<boolean>(false);

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    warnTimer.current = null;
    logoutTimer.current = null;
    countdownTimer.current = null;
  }, []);

  const doLogout = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    clearTimers();
    const submit = () => {
      // Reuse the existing same-origin logout route (clears cookies + redirects).
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/logout";
      document.body.appendChild(form);
      form.submit();
    };
    // Persist whatever is in the section form first (CF-15). `flush` resolves
    // true when there was nothing to save; either way the sign-out proceeds —
    // a failed write must not strand the user in a half-logged-out state.
    void flushUnsavedChanges().then(submit, submit);
  }, [clearTimers, flushUnsavedChanges]);

  const beginWarning = useCallback(() => {
    // A hidden tab cannot show a countdown, and its timers are throttled, so
    // warning it means signing it out with no warning at all. Wait for the tab
    // to come back instead (CF-15).
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      warnTimer.current = setTimeout(
        () => beginWarningRef.current(),
        HIDDEN_RECHECK_MS
      );
      return;
    }
    setWarning(true);
    setSecondsLeft(Math.round(warnMs / 1000));
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1_000);
    logoutTimer.current = setTimeout(doLogout, warnMs);
  }, [warnMs, doLogout]);

  // Self-reference for the deferred re-check above, kept in a ref so the
  // callback identity stays stable (the listener effect depends on it).
  const beginWarningRef = useRef(beginWarning);
  beginWarningRef.current = beginWarning;

  const scheduleIdle = useCallback(() => {
    clearTimers();
    setWarning(false);
    // Warning fires at (idle - warn); the logout fires `warnMs` after that.
    warnTimer.current = setTimeout(beginWarning, Math.max(0, idleMs - warnMs));
  }, [clearTimers, beginWarning, idleMs, warnMs]);

  /** "I'm still here" — dismiss the warning and restart the idle clock. */
  const stayActive = useCallback(() => {
    if (loggingOut.current) return;
    scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => {
      if (loggingOut.current) return;
      // While the warning is up, ignore the synthetic activity from the watcher's
      // own dialog; the user must explicitly choose "Stay signed in".
      if (warnTimer.current === null && logoutTimer.current !== null) return;
      const now = Date.now();
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return;
      lastActivity.current = now;
      scheduleIdle();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    scheduleIdle();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimers();
    };
    // `enabled`, `idleMs`, `warnMs` are stable for the component's lifetime
    // (resolved once); the memoised callbacks carry the live values.
  }, [enabled, scheduleIdle, clearTimers]);

  if (!enabled) return null;

  return (
    <Dialog open={warning} onOpenChange={(open) => !open && stayActive()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive for a while. For your security you&apos;ll
            be signed out in{" "}
            <span className="font-semibold tabular-nums">{secondsLeft}</span>{" "}
            second{secondsLeft === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={doLogout}>
            Sign out now
          </Button>
          <Button onClick={stayActive}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
