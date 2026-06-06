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
 * Supabase token expiry checked in middleware.
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
    // Reuse the existing same-origin logout route (clears cookies + redirects).
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  }, [clearTimers]);

  const beginWarning = useCallback(() => {
    setWarning(true);
    setSecondsLeft(Math.round(warnMs / 1000));
    countdownTimer.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1_000);
    logoutTimer.current = setTimeout(doLogout, warnMs);
  }, [warnMs, doLogout]);

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
