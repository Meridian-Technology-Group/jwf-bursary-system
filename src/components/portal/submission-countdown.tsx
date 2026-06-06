"use client";

/**
 * SubmissionCountdown — Epic 05 (plan §3.2, §5.3).
 *
 * Parent-facing banner showing time remaining to submit, keyed on the effective
 * per-application deadline (resolved server-side via the Epic-03 helper and
 * passed in as an ISO string). It re-computes every minute so a long-lived tab
 * stays accurate, switches to an amber "closing soon" tone near the cut-off, and
 * renders a clear "deadline passed" lockout state once the time is up.
 *
 * This is presentation only — the authoritative lockout is the server-side
 * submit guard in apply/actions.ts. Rendered on the dashboard card and at the
 * top of the wizard.
 */

import * as React from "react";
import { Clock, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CLOSING_SOON_HOURS,
  formatTimeRemaining,
} from "@/lib/portal/deadline";
import { LONDON_TIME_ZONE } from "@/lib/datetime";

interface SubmissionCountdownProps {
  /** Effective submit-by instant as an ISO string. */
  deadlineIso: string;
  className?: string;
}

function formatDeadlineLondon(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function SubmissionCountdown({
  deadlineIso,
  className,
}: SubmissionCountdownProps) {
  const deadline = React.useMemo(
    () => new Date(deadlineIso),
    [deadlineIso]
  );

  const [now, setNow] = React.useState<Date>(() => new Date());

  React.useEffect(() => {
    // Tick once a minute — a coarse countdown does not need per-second updates.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const msRemaining = Math.max(0, deadline.getTime() - now.getTime());
  const isPast = now.getTime() > deadline.getTime();
  const isClosingSoon =
    !isPast && msRemaining <= CLOSING_SOON_HOURS * 60 * 60 * 1000;

  const deadlineLabel = formatDeadlineLondon(deadline);

  if (isPast) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4",
          className
        )}
      >
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-rose-900">
            The submission deadline has passed
          </p>
          <p className="mt-0.5 text-sm text-rose-800">
            The deadline was {deadlineLabel}. This application can no longer be
            edited or submitted — forms submitted late cannot be assessed. If you
            believe this is an error, please contact the Foundation.
          </p>
        </div>
      </div>
    );
  }

  const tone = isClosingSoon
    ? {
        container: "border-amber-300 bg-amber-50",
        icon: "text-amber-600",
        title: "text-amber-900",
        body: "text-amber-800",
      }
    : {
        container: "border-blue-200 bg-blue-50",
        icon: "text-blue-500",
        title: "text-blue-900",
        body: "text-blue-800",
      };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        tone.container,
        className
      )}
    >
      {isClosingSoon ? (
        <AlertTriangle
          className={cn("mt-0.5 h-5 w-5 shrink-0", tone.icon)}
          aria-hidden="true"
        />
      ) : (
        <Clock
          className={cn("mt-0.5 h-5 w-5 shrink-0", tone.icon)}
          aria-hidden="true"
        />
      )}
      <div>
        <p className={cn("text-sm font-semibold", tone.title)}>
          {isClosingSoon
            ? `Closing soon — ${formatTimeRemaining(msRemaining)} left to submit`
            : `${formatTimeRemaining(msRemaining)} left to submit`}
        </p>
        <p className={cn("mt-0.5 text-sm", tone.body)}>
          You can save and return any time before the deadline:{" "}
          <span className="font-medium">{deadlineLabel}</span>. Forms submitted
          late cannot be assessed.
        </p>
      </div>
    </div>
  );
}
