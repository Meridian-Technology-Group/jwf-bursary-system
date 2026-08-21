/**
 * Four-state lifecycle strip — Epic 15 W1 (CH-05, `ch-image007`).
 *
 * NOT STARTED · PAUSED · COMPLETE · LOCKED as a row of chips with exactly ONE
 * green (the current state), the rest grey — Charlotte's mock. The strip is
 * an INDICATOR (LA15-2): transitions keep their existing verbs (Save / Pause /
 * Complete on the form banner, outcome recording on the award tab).
 *
 * Pure presentational server component — state is derived by the caller via
 * `deriveAssessmentLifecycleState`.
 */

import {
  ASSESSMENT_LIFECYCLE_LABELS,
  ASSESSMENT_LIFECYCLE_ORDER,
  type AssessmentLifecycleState,
} from "@/lib/assessments/lifecycle-state";
import { cn } from "@/lib/utils";

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
      {ASSESSMENT_LIFECYCLE_ORDER.map((s) => (
        <span
          key={s}
          data-state={s}
          data-current={s === state || undefined}
          className={cn(
            "inline-flex items-center rounded border px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
            s === state
              ? "border-success-600 bg-success-600 text-white"
              : "border-slate-300 bg-slate-100 text-slate-500"
          )}
        >
          {ASSESSMENT_LIFECYCLE_LABELS[s]}
        </span>
      ))}
    </div>
  );
}
