/**
 * Epic 09 — Household decision aid.
 *
 * A compact, always-visible panel on the assessment workspace that states the
 * DERIVED household scenario (from the rules engine) and the EXPECTED handling
 * from plan 09 §3.1: who is assessed, who is the lead, what evidence is
 * required, and any policy gate.
 *
 * For H7 (cannot support) and H9 (may defer) it shows a prominent FLAG. It
 * ADVISES — it never auto-decides. The assessor remains the decision-maker
 * (final outcome terminology is Epic 08). This is a pure presentational
 * component: it receives the already-derived `HouseholdHandling` from the
 * server (see deriveHouseholdFromSources) so the form and assessor read
 * identical logic.
 */

import {
  AlertTriangle,
  Info,
  ShieldAlert,
  Users,
  User,
  FileCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVIDENCE_LABELS,
  type HouseholdHandling,
} from "@/lib/household/rules";

const ASSESSEE_COPY: Record<HouseholdHandling["assessees"], string> = {
  SOLE: "Single resident parent / guardian",
  TWO_PARENT: "Both natural parents",
  HOUSEHOLD_PLUS_ABSENT:
    "Resident household (parent + new spouse) plus the absent natural parent (via maintenance)",
};

const LEAD_COPY: Record<HouseholdHandling["leadRule"], string> = {
  RESIDENT: "Resident parent / guardian",
  MAIN_CUSTODY: "Main-custody parent",
  BOTH: "Both natural parents (either may hold the account)",
};

export interface HouseholdDecisionAidProps {
  handling: HouseholdHandling;
}

export function HouseholdDecisionAid({ handling }: HouseholdDecisionAidProps) {
  const gated = handling.gate !== "NONE";
  const isCannotSupport = handling.gate === "CANNOT_SUPPORT";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white shadow-sm",
        gated
          ? isCannotSupport
            ? "border-rose-300"
            : "border-amber-300"
          : "border-slate-200"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-t-lg border-b px-4 py-2.5",
          gated
            ? isCannotSupport
              ? "border-rose-200 bg-rose-50"
              : "border-amber-200 bg-amber-50"
            : "border-slate-100 bg-slate-50"
        )}
      >
        {handling.assessees === "SOLE" ? (
          <User className="h-4 w-4 text-slate-500" aria-hidden="true" />
        ) : (
          <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
        )}
        <h3 className="text-sm font-semibold text-slate-800">
          Household: {handling.label}
        </h3>
        <span className="ml-auto rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {handling.scenario}
        </span>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        {/* Policy gate banner (H7 / H9) — advisory flag, never auto-decline. */}
        {gated && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs",
              isCannotSupport
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
            role="status"
          >
            {isCannotSupport ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold">
                {isCannotSupport
                  ? "Cannot support — assessor decision required"
                  : "May decline or defer — assessor decision required"}
              </p>
              <p className="mt-1 leading-relaxed">{handling.assessorNote}</p>
              <p className="mt-1 italic text-[11px] opacity-90">
                This is an advisory flag, not an automatic outcome. Record the
                outcome on the recommendation step.
              </p>
            </div>
          </div>
        )}

        {!gated && (
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{handling.assessorNote}</p>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Who is assessed
            </dt>
            <dd className="text-slate-700">{ASSESSEE_COPY[handling.assessees]}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Lead applicant
            </dt>
            <dd className="text-slate-700">{LEAD_COPY[handling.leadRule]}</dd>
          </div>
        </dl>

        {handling.requiredEvidence.length > 0 && (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Evidence expected
            </dt>
            <ul className="mt-1 space-y-1">
              {handling.requiredEvidence.map((e) => (
                <li key={e} className="flex items-center gap-2 text-slate-700">
                  <FileCheck2
                    className="h-3.5 w-3.5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  {EVIDENCE_LABELS[e]}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
