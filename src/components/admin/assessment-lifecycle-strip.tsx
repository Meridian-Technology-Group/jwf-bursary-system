/**
 * Four-state lifecycle strip — Epic 15 W1 (CH-05, `ch-image007`).
 *
 * NOT STARTED · PAUSED · COMPLETE · LOCKED as a row of chips with exactly ONE
 * green (the current state), the rest grey — Charlotte's mock. The strip is
 * an INDICATOR (LA15-2): transitions keep their existing verbs (Save / Pause /
 * Complete on the form banner, outcome recording on the award tab).
 *
 * CH-35 — the inactive chips were previously drawn with a border and a filled
 * background, which read as a row of buttons: Charlotte clicked COMPLETE here,
 * nothing happened (correctly — it is a status readout), and she reported the
 * button as unresponsive. The inactive states are now plain text so the strip
 * cannot be mistaken for a control, and the current state keeps the solid
 * green pill it needs to stay legible at a glance.
 *
 * Pure presentational server component — state is derived by the caller via
 * `deriveAssessmentLifecycleState`.
 */

import {
  ASSESSMENT_LIFECYCLE_LABELS,
  lifecycleStripSlots,
  type AssessmentLifecycleState,
} from "@/lib/assessments/lifecycle-state";
import { cn } from "@/lib/utils";

/**
 * CH-35 — the chip's appearance, lifted out so the "must not look like a
 * button" rule is unit-testable (this repo has no jsdom/RTL, so component
 * behaviour is tested through the pure logic extracted from it — same
 * convention as `section-form` and `lifecycle-badges`).
 *
 * The current state keeps a solid green pill so it stays readable at a glance.
 * Every OTHER state must render as plain text: no border, no background. Those
 * two properties are what stopped the strip reading as a row of controls.
 */
export function lifecycleChipClass(isCurrent: boolean): string {
  return cn(
    "inline-flex items-center rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
    isCurrent ? "bg-success-600 text-white" : "text-slate-400"
  );
}

export function AssessmentLifecycleStrip({
  state,
  className,
}: {
  state: AssessmentLifecycleState;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="status"
      aria-label={`Assessment status: ${ASSESSMENT_LIFECYCLE_LABELS[state]}`}
    >
      {/* Epic 18 — the fourth slot shows the specific final state (NEW AWARD /
          WAITING LIST / CLOSED & ARCHIVED) once one is reached; LOCKED remains
          the generic label for legacy outcome locks. */}
      {lifecycleStripSlots(state).map((slot) => (
        <span
          key={slot.key}
          data-state={slot.key}
          data-current={slot.current || undefined}
          className={lifecycleChipClass(slot.current)}
        >
          {slot.label}
        </span>
      ))}
    </div>
  );
}
