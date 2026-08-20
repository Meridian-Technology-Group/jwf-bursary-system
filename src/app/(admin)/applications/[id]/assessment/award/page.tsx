/**
 * BURSARY AWARD CALCULATION (6) — Epic 14 C7 (CG-16/CG-14, US-C8).
 *
 * The workbook's award sheet as tab 4 of the assessment workspace:
 *
 *  - Header: CALCULATING BURSARY AWARD FOR (name, AUTO) · school (AUTO).
 *  - SILBINGS' FEES ALREADY AT A JWF SCHOOL — three manual rows with school
 *    selects; a picker fills a row from a linked sibling bursary account.
 *    Record cells (the engine's sibling absorption keeps reading the linked
 *    accounts — LA-8 №2, flagged inline).
 *  - ANNUAL SCHOOL FEES (AUTO) and ASSESSMENT COMPLETED ON (AUTO date).
 *  - The award/outcome surface itself is the SHARED RecommendationSurface
 *    (CALC-08): the three legs, min-of-three recommended payable fees, %
 *    scholarship, after-VAT bursary award + scholarship value, payable fees
 *    next year, school's bursary spend before VAT, GAP + the 9-code gap
 *    picker, last assessment's payable fees + the 36-code YoY picker, and
 *    the outcome actions — one implementation, one set of save/lock rules
 *    (CG-14: this is the outcome's explicit home; the Recommendation route
 *    renders the same surface). Completed assessments render their persisted
 *    snapshots — never recomputed; the reopen-after-outcome block (Epic 13
 *    C1) is enforced inside the shared surface's actions.
 */

import { notFound } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getAssessment } from "@/lib/db/queries/assessments";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import { formatLondonDate } from "@/lib/datetime";
import { RecommendationSurface } from "@/components/admin/recommendation-surface";
import {
  SiblingFeesBlock,
  type SiblingAccountOption,
} from "@/components/admin/sibling-fees-block";
import type { SiblingDetail } from "@/types/assessment-v2";

export const metadata = {
  title: "Assessment — Bursary Award Calculation",
};

interface Props {
  params: { id: string };
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = parseFloat(String(value));
  return isNaN(n) ? null : n;
}

export default async function AssessmentAwardPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const { application, assessment, childName, siblingOptions } =
    await withUserContext(user.id, user.role as RlsRole, async (tx) => {
      const app = await getApplicationWithDetails(tx, params.id);
      if (!app) {
        return {
          application: null,
          assessment: null,
          childName: null as string | null,
          siblingOptions: [] as SiblingAccountOption[],
        };
      }
      const a = await getAssessment(tx, params.id);
      // Name disclosure already audited by the detail layout's header reveal
      // for this same page view (see the model tab's identical note).
      const nameRow = await tx.application.findUnique({
        where: { id: params.id },
        select: { childName: true },
      });
      const links = app.bursaryAccountId
        ? await getSiblingLinks(tx, app.bursaryAccountId)
        : [];
      const opts: SiblingAccountOption[] = links
        .filter((l) => l.bursaryAccountId !== app.bursaryAccountId)
        .map((l) => ({
          bursaryAccountId: l.bursaryAccountId,
          childName: l.bursaryAccount.childName,
          school: l.bursaryAccount.school as "TRINITY" | "WHITGIFT",
          netPayableFees: l.bursaryAccount.latestPayableFees,
        }));
      return {
        application: app,
        assessment: a,
        childName: nameRow?.childName ?? null,
        siblingOptions: opts,
      };
    });
  if (!application) notFound();

  const isViewer = user.role === Role.VIEWER;
  // Epic 15 M6 (LA15-4): sibling rows stay editable until the OUTCOME is
  // recorded (previously frozen at COMPLETED) — Part 6 is workable while the
  // assessment is in progress; the outcome is what locks it.
  const siblingReadOnly =
    isViewer || !assessment || assessment.outcome != null;

  return (
    <div className="space-y-5">
      {/* Award-sheet header (AUTO): recipient + school. Part heading per
          Charlotte's layout (CI-12); numbering fixed at 6 by CH-25. */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-primary-900">
        PART 6 - BURSARY AWARD CALCULATION
      </h2>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          CALCULATING BURSARY AWARD FOR
        </span>
        <span className="text-lg font-semibold text-primary-900">
          {childName ?? application.reference}
        </span>
        <span className="text-sm text-slate-600">
          {application.school === "TRINITY" ? "Trinity" : "Whitgift"}
        </span>
        <span className="ml-auto flex items-baseline gap-4 text-sm text-slate-500">
          {assessment?.annualFees != null && (
            <span>
              ANNUAL SCHOOL FEES:{" "}
              <span className="font-mono font-semibold text-slate-700">
                {new Intl.NumberFormat("en-GB", {
                  style: "currency",
                  currency: "GBP",
                }).format(toNum(assessment.annualFees) ?? 0)}
              </span>
            </span>
          )}
          <span>
            ASSESSMENT COMPLETED ON:{" "}
            <span className="font-medium text-slate-700">
              {assessment?.completedAt
                ? formatLondonDate(assessment.completedAt)
                : "—"}
            </span>
          </span>
        </span>
      </div>

      {/* Siblings' fees block — editable while the assessment is open; a
          COMPLETED assessment shows its recorded snapshot. */}
      {assessment && (
        <SiblingFeesBlock
          assessmentId={assessment.id}
          applicationId={params.id}
          initial={(assessment.siblingDetails ?? null) as SiblingDetail[] | null}
          options={siblingOptions}
          readOnly={siblingReadOnly}
        />
      )}

      {/* The shared award/outcome surface (three legs, recommended payable
          fees, scholarship/bursary/VAT summary, gap + reason pickers, outcome
          actions) — identical to the Recommendation step, by construction. */}
      <RecommendationSurface
        applicationId={params.id}
        user={user}
        mode="workspace"
      />
    </div>
  );
}
