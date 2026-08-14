/**
 * autosave.ts — the pure scheduling + status logic behind the portal's
 * section autosave (Epic 13 / WP B2, CF-29, decision D13-7).
 *
 * The client asked for this by name after losing a fully-completed income
 * section twice: *"On the current application form, there is an autosave
 * functionality, can this be used for this form?"*. WP B1 stopped the wizard
 * throwing work away on a stepper click; this module stops it being lost to
 * everything B1 cannot intercept — a closed laptop, a dropped connection, a
 * browser crash, a session that ends somewhere other than a link click.
 *
 * ── What this module is, and is not ──────────────────────────────────────────
 * It holds ONLY the decisions: when a write is due, what the indicator should
 * say, and what happens when a write fails. No React, no DOM, no timers of its
 * own beyond injectable ones — the repo has no jsdom/RTL, so the branch table
 * has to be unit-testable directly. The wiring (the react-hook-form
 * subscription, the blur flush, the indicator component) lives in
 * `@/components/portal/section-form`.
 *
 * ── It does NOT own a notion of "dirty" ──────────────────────────────────────
 * WP B1 established the dirty signal for the portal and documented, at length,
 * why `formState.isDirty` is unusable here (subscribing to it makes RHF
 * re-derive it as a *value* difference against `defaultValues`, so the sections
 * that write to themselves on mount all report dirty). That signal — a deep
 * snapshot taken after mount, compared with `valuesEqual` — is the ONLY one.
 * This controller never inspects form values; the caller passes dirtiness in
 * (`noteChange`) and reports "nothing to do" out (`save` → `"skipped"`).
 *
 * ── The one rule the indicator must never break ──────────────────────────────
 * It must never claim "Saved" for a write that did not land. A false
 * reassurance is worse than no indicator at all, because it is exactly what an
 * applicant relies on before closing the tab. `savedAt` is therefore only ever
 * stamped from an outcome of `"saved"`, and the `failed` state carries the
 * PREVIOUS `savedAt` forward without re-labelling itself as saved.
 */

/** Where the section stands with respect to the server. */
export type AutosaveState =
  /** Nothing typed yet, nothing written yet. The indicator renders nothing. */
  | "idle"
  /** Applicant edits exist that have not been written. */
  | "unsaved"
  /** A write is in flight. */
  | "saving"
  /** Everything typed so far is on the server, as of `savedAt`. */
  | "saved"
  /** A write was attempted and did NOT land. Never renders as "Saved". */
  | "failed";

export interface AutosaveStatus {
  readonly state: AutosaveState;
  /**
   * Epoch ms of the last write that ACTUALLY landed, or null if none has.
   * Carried forward through `saving`/`unsaved`/`failed` so the indicator can
   * keep showing when the section was last genuinely safe.
   */
  readonly savedAt: number | null;
}

export const IDLE_STATUS: AutosaveStatus = { state: "idle", savedAt: null };

/**
 * What one attempted write did.
 *
 *  - `saved`    — it landed. The only outcome that stamps `savedAt`.
 *  - `failed`   — it was attempted and did not land (server error, offline,
 *                 rejected payload). Retried on a longer timer.
 *  - `skipped`  — the write did not happen and that is fine: either the form is
 *                 not dirty (typed, then undone) or the caller deliberately
 *                 waved it off. Not a failure, and not a success — if edits are
 *                 still outstanding the indicator says so rather than claiming
 *                 they are saved (see `settled`).
 *  - `deferred` — a manual save / the unsaved-changes guard is already writing
 *                 this section. Backing off avoids two concurrent upserts of
 *                 the same row; the change is not lost, just rescheduled.
 */
export type AutosaveOutcome = "saved" | "failed" | "skipped" | "deferred";

/** Opaque timer handle so the controller can be driven by fake timers in tests. */
export type TimerHandle = unknown;

/** Quiet period before an idle write. Long enough not to write mid-word. */
export const DEFAULT_IDLE_MS = 2_500;
/** Backoff after a failed write. The applicant typing again beats this. */
export const DEFAULT_RETRY_MS = 15_000;

export interface AutosaveOptions {
  /** Perform one write. Must resolve (not throw) with what happened. */
  save: () => Promise<AutosaveOutcome>;
  /**
   * Cheap synchronous "is there anything to write?" — B1's dirty signal.
   *
   * Checked BEFORE the indicator moves to "Saving…", so the blur flush on an
   * untouched field does not strobe the label at the applicant every time they
   * tab between inputs. Defaults to always-yes.
   */
  hasWork?: () => boolean;
  /** Called on every status CHANGE (never on a no-op republish). */
  onStatus: (status: AutosaveStatus) => void;
  idleMs?: number;
  retryMs?: number;
  now?: () => number;
  schedule?: (run: () => void, ms: number) => TimerHandle;
  unschedule?: (handle: TimerHandle) => void;
}

export interface AutosaveController {
  /**
   * The form changed. `dirty` is B1's signal, evaluated by the caller.
   *
   * Passing `false` is meaningful, not a no-op: it is how "the applicant undid
   * their edit" cancels a pending write and clears the "Unsaved changes"
   * warning, instead of leaving a scary label on a form that matches the server.
   */
  noteChange(dirty: boolean): void;
  /** Write now if anything is outstanding — the blur path. */
  flush(): void;
  /**
   * Record that a write landed by some other route (the Save and Continue
   * button, or the unsaved-changes guard's save). Cancels any pending autosave
   * and moves the indicator to "Saved", so the two paths cannot disagree.
   */
  markSaved(at?: number): void;
  /** Stop permanently (unmount). No further writes or status updates. */
  cancel(): void;
  getStatus(): AutosaveStatus;
}

export function createAutosaveController(
  options: AutosaveOptions
): AutosaveController {
  const {
    save,
    hasWork = () => true,
    onStatus,
    idleMs = DEFAULT_IDLE_MS,
    retryMs = DEFAULT_RETRY_MS,
    now = () => Date.now(),
    schedule = (run, ms) => setTimeout(run, ms),
    unschedule = (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  let status: AutosaveStatus = IDLE_STATUS;
  let timer: TimerHandle | null = null;
  /** A write is in flight. */
  let running = false;
  /** A change arrived while a write was in flight, so another is owed. */
  let pending = false;
  let cancelled = false;

  function publish(next: AutosaveStatus): void {
    if (next.state === status.state && next.savedAt === status.savedAt) return;
    status = next;
    onStatus(status);
  }

  /**
   * Where the indicator rests when this controller has nothing further to do:
   * "Saved HH:MM" if a write has landed and the form matches it, otherwise
   * silent.
   *
   * `stillDirty` is passed in rather than assumed, because "I am not going to
   * write anything right now" and "everything you typed is safe" are different
   * claims. A write the caller waved off leaves real edits on the page, and
   * labelling those "Saved" would be the exact false reassurance this module
   * exists to prevent. Deliberately never "saved" with a null timestamp either.
   */
  function settled(stillDirty: boolean): AutosaveStatus {
    if (stillDirty) return { state: "unsaved", savedAt: status.savedAt };
    return status.savedAt === null
      ? IDLE_STATUS
      : { state: "saved", savedAt: status.savedAt };
  }

  function clearTimer(): void {
    if (timer !== null) {
      unschedule(timer);
      timer = null;
    }
  }

  function scheduleRun(ms: number): void {
    clearTimer();
    if (cancelled) return;
    timer = schedule(() => {
      timer = null;
      void run();
    }, ms);
  }

  async function run(): Promise<void> {
    if (cancelled) return;
    if (running) {
      // Never two writes to the same row at once; the in-flight one will pick
      // this up when it lands.
      pending = true;
      return;
    }

    if (!hasWork()) {
      pending = false;
      publish(settled(false));
      return;
    }

    running = true;
    publish({ state: "saving", savedAt: status.savedAt });

    let outcome: AutosaveOutcome;
    try {
      outcome = await save();
    } catch {
      // A throwing save is a failed save. It must never read as success.
      outcome = "failed";
    }

    running = false;
    if (cancelled) return;

    if (outcome === "saved") {
      publish({ state: "saved", savedAt: now() });
      if (pending) {
        pending = false;
        publish({ state: "unsaved", savedAt: status.savedAt });
        scheduleRun(idleMs);
      }
      return;
    }

    if (outcome === "failed") {
      pending = false;
      publish({ state: "failed", savedAt: status.savedAt });
      scheduleRun(retryMs);
      return;
    }

    if (outcome === "deferred") {
      // Someone else is writing this section right now. There is still work
      // outstanding from our point of view, so say so and come back.
      pending = false;
      publish({ state: "unsaved", savedAt: status.savedAt });
      scheduleRun(idleMs);
      return;
    }

    // "skipped" — no write happened, and that is fine. Whether the applicant
    // is safe depends on whether anything is still outstanding, so ask; do not
    // assume. No reschedule: the next keystroke or blur is what brings us back,
    // rather than a timer polling a decision that has not changed.
    if (pending) {
      pending = false;
      publish({ state: "unsaved", savedAt: status.savedAt });
      scheduleRun(idleMs);
      return;
    }
    publish(settled(hasWork()));
  }

  return {
    noteChange(dirty: boolean): void {
      if (cancelled) return;

      if (!dirty) {
        pending = false;
        clearTimer();
        if (status.state === "unsaved" || status.state === "failed") {
          publish(settled(false));
        }
        return;
      }

      if (running) {
        pending = true;
        return;
      }

      publish({ state: "unsaved", savedAt: status.savedAt });
      scheduleRun(idleMs);
    },

    flush(): void {
      if (cancelled) return;
      clearTimer();
      void run();
    },

    markSaved(at?: number): void {
      if (cancelled) return;
      pending = false;
      clearTimer();
      publish({ state: "saved", savedAt: at ?? now() });
    },

    cancel(): void {
      cancelled = true;
      clearTimer();
    },

    getStatus: () => status,
  };
}

// ─── Presentation helpers (pure, so the copy is testable) ────────────────────

/** Local wall-clock "HH:MM", zero-padded, 24-hour — the UK convention here. */
export function formatClockTime(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * The visible indicator text, or null when there is nothing worth saying.
 *
 * "Saved" appears for exactly one state. A failed write says so plainly and
 * says what happens next, because the applicant's decision ("can I close this
 * tab?") depends on it.
 */
export function autosaveLabel(status: AutosaveStatus): string | null {
  switch (status.state) {
    case "idle":
      return null;
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "saved":
      return status.savedAt === null
        ? "Saved"
        : `Saved ${formatClockTime(status.savedAt)}`;
    case "failed":
      return status.savedAt === null
        ? "Not saved — we'll keep trying"
        : `Not saved since ${formatClockTime(status.savedAt)} — we'll keep trying`;
  }
}

/**
 * What a screen reader should hear.
 *
 * Only the outcomes are announced. Piping "Saving…" and "Unsaved changes" into
 * a live region would interrupt the applicant every couple of seconds while
 * they type, which is worse than silence — the visible label still carries
 * those states for anyone watching it.
 */
export function autosaveAnnouncement(status: AutosaveStatus): string {
  if (status.state === "saved" || status.state === "failed") {
    return autosaveLabel(status) ?? "";
  }
  return "";
}
