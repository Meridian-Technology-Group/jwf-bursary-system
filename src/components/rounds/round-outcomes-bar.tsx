/**
 * RoundOutcomesBar — the decided-outcomes split for the Round Cockpit (#18).
 *
 * A single horizontal two-segment bar: qualifies (green) vs does-not-qualify
 * (red), with a legend and tabular counts. When nothing is decided yet it shows
 * a calm muted empty state.
 *
 * Chosen approach: a CSS two-segment bar rather than a recharts stacked bar.
 * For one bar of two known values it is lighter (no client bundle, streams as a
 * Server Component), trivially accessible (an explicit `progressbar`-style
 * `aria-label` carries the split), and avoids recharts stacking quirks for a
 * single category. The existing `HorizontalBarChart` stays for the multi-bar
 * report surfaces.
 */

interface RoundOutcomesBarProps {
  outcomes: {
    qualifies: number;
    doesNotQualify: number;
  };
}

export function RoundOutcomesBar({ outcomes }: RoundOutcomesBarProps) {
  const { qualifies, doesNotQualify } = outcomes;
  const total = qualifies + doesNotQualify;

  const qualPct = total > 0 ? Math.round((qualifies / total) * 100) : 0;
  // Keep the two segments summing to 100 even with rounding.
  const dnqPct = total > 0 ? 100 - qualPct : 0;

  return (
    <section
      aria-labelledby="round-outcomes-heading"
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="round-outcomes-heading"
          className="text-base font-medium text-primary-900"
        >
          Outcomes
        </h2>
        {total > 0 && (
          <span className="text-xs text-slate-400">
            <span className="tabular-nums">{total}</span> decided
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          No decisions yet.
        </p>
      ) : (
        <>
          {/* Two-segment bar */}
          <div
            className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`${qualifies} qualify (${qualPct}%), ${doesNotQualify} do not qualify (${dnqPct}%)`}
          >
            {qualifies > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${qualPct}%` }}
              />
            )}
            {doesNotQualify > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${dnqPct}%` }}
              />
            )}
          </div>

          {/* Legend + counts */}
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <dt className="text-sm text-slate-600">Qualifies</dt>
              <dd className="ml-auto text-sm font-semibold tabular-nums text-primary-900">
                {qualifies}
                <span className="ml-1 font-normal text-slate-400">
                  ({qualPct}%)
                </span>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                aria-hidden="true"
              />
              <dt className="text-sm text-slate-600">Does not qualify</dt>
              <dd className="ml-auto text-sm font-semibold tabular-nums text-primary-900">
                {doesNotQualify}
                <span className="ml-1 font-normal text-slate-400">
                  ({dnqPct}%)
                </span>
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
