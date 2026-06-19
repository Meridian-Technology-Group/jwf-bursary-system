// scratchpad/fix-e2e-f2-calendar.ts
//
// Fix E2E test-data artifact so the F2 parent schedule calendar renders.
//
// parent2's bursary account 92d8cb60-… was seeded with a non-numeric
// `first_assessment_year` ("E2E 2026/27") and schedule-entry academic_year
// labels like "E2E 2026/27 +1". The portal calendar's buildPortalScheduleRows
// calls parseAcademicYearStart(firstAssessmentYear), whose regex /^(\d{4})/
// requires a LEADING 4-digit year — "E2E …" → null → [] → blank calendar.
//
// This makes the account's data NUMERIC, byte-identical to what the app writes
// for a real award round starting 2026:
//   - first_assessment_year = round.academicYear (account-promotion.ts:133).
//     The real nonprod "2026/27" round uses the "YYYY/YY" slash form, so we set
//     exactly "2026/27". parseAcademicYearStart("2026/27") → 2026. ✓
//   - schedule entry academic_year = formatAcademicYearLabel(start+i)
//     (schedule.ts planSchedule), i.e. the "YYYY-YY" hyphen form: 2026-27 …
//     We compute these via the APP's own formatAcademicYearLabel so they are
//     byte-identical (no hard-coded guesses).
//
// Also re-activates the account (a prior F1 withdrawal test set status=CLOSED /
// closed_at) so the F2 re-test can run; we'll withdraw it again in the browser.
//
// Scope: ONLY this one e2e account + its 7 schedule entries. show_on_portal is
// left untouched (already true for years 1–2, false for 3–7). Everything else
// (the COMPLETED/AWARDED assessment, dates, etc.) is left as-is.
//
// Connects as the RLS-enforced `app_user`; all writes run inside
// withAdminContext (service_role claim RLS treats as bypass) — same as the app.
//
// Idempotent: re-running yields the same numeric values.
//
// Run: tsx scratchpad/fix-e2e-f2-calendar.ts   (from repo root)

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { BursaryAccountStatus } from "@prisma/client";
import { prisma, withAdminContext } from "@/lib/db/prisma";
import { formatAcademicYearLabel } from "@/lib/assessment/fee-year";

// ── Target (parent2's bursary account) ───────────────────────────────────────
const ACCOUNT_ID = "92d8cb60-90c7-4e3f-ba14-e39db0099a5a";

// Award-year start the real "2026/27" round anchors on.
const AWARD_START_YEAR = 2026;

// first_assessment_year is set to round.academicYear by promotion; the real
// nonprod 2026 round is "2026/27" (slash form). Match it exactly.
const FIRST_ASSESSMENT_YEAR = "2026/27";

const EXPECTED = "lmkmgoqezgeeyjodbvzn";

function assertNonprod() {
  const ref =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ??
    "unknown";
  const dbUser =
    (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").match(
      /\/\/([^:]+):/
    )?.[1] ?? "unknown";
  console.log(`[fix-e2e-f2] Supabase project ref : ${ref}`);
  console.log(`[fix-e2e-f2] DB connection user   : ${dbUser}`);
  if (ref !== EXPECTED || !dbUser.includes(EXPECTED)) {
    throw new Error(
      `Refusing to run: target is not nonprod (${EXPECTED}). ref=${ref}, dbUser=${dbUser}`
    );
  }
  console.log(`[fix-e2e-f2] target confirmed nonprod (${EXPECTED})\n`);
}

async function main() {
  assertNonprod();

  await withAdminContext(async (tx) => {
    const account = await tx.bursaryAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: {
        id: true,
        status: true,
        closedAt: true,
        firstAssessmentYear: true,
      },
    });
    if (!account) throw new Error(`account ${ACCOUNT_ID} not found`);
    console.log(
      `[fix-e2e-f2] before: status=${account.status} closed_at=${account.closedAt?.toISOString() ?? "null"} first_assessment_year="${account.firstAssessmentYear}"`
    );

    // 1) Re-activate + numeric first_assessment_year.
    await tx.bursaryAccount.update({
      where: { id: ACCOUNT_ID },
      data: {
        status: BursaryAccountStatus.ACTIVE,
        closedAt: null,
        firstAssessmentYear: FIRST_ASSESSMENT_YEAR,
      },
    });
    console.log(
      `[fix-e2e-f2] account -> ACTIVE, closed_at=null, first_assessment_year="${FIRST_ASSESSMENT_YEAR}"`
    );

    // 2) Numeric schedule labels: schedule_year N -> formatAcademicYearLabel(2026 + N-1).
    //    Computed via the app's own helper => byte-identical to planSchedule.
    const entries = await tx.bursaryScheduleEntry.findMany({
      where: { bursaryAccountId: ACCOUNT_ID },
      select: { id: true, scheduleYear: true, academicYear: true },
      orderBy: { scheduleYear: "asc" },
    });
    for (const e of entries) {
      const label = formatAcademicYearLabel(AWARD_START_YEAR + (e.scheduleYear - 1));
      if (e.academicYear === label) {
        console.log(
          `[fix-e2e-f2] entry year ${e.scheduleYear} already "${label}" — skip`
        );
        continue;
      }
      await tx.bursaryScheduleEntry.update({
        where: { id: e.id },
        data: { academicYear: label },
      });
      console.log(
        `[fix-e2e-f2] entry year ${e.scheduleYear}: "${e.academicYear}" -> "${label}"`
      );
    }
  });
}

main()
  .then(() => console.log("\n[fix-e2e-f2] done"))
  .catch((err) => {
    console.error("[fix-e2e-f2] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
