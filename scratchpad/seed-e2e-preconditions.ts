// scratchpad/seed-e2e-preconditions.ts
//
// Seeds E2E browser-run preconditions for parent2 and parent3, faithfully via
// the app's own helpers wherever cleanly callable from a script.
//
//   A. parent3 → SUBMITTED (precondition for the G1a assessment proof)
//   B. parent2 → SUBMITTED + COMPLETED/AWARDED assessment + ACTIVE bursary
//      account + forward schedule (preconditions for F1 withdrawal, F2 calendar)
//      via the SAME promoteToActiveAccount helper setApplicationOutcome calls.
//   C. parent2 → a PENDING re-assessment invitation against a future round
//      (precondition for the A2 "Received"/ROLLING_OVER proof).
//
// Connects as the RLS-enforced `app_user`; all writes run inside
// withAdminContext (service_role JWT claim that RLS treats as bypass) — exactly
// as the app's create-from-invitation / outcome paths do.
//
// Idempotent: re-running skips work already done (existing account, existing
// COMPLETED assessment, existing pending invitation, existing future round).
//
// Run: tsx scratchpad/seed-e2e-preconditions.ts   (from repo root)

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });

import {
  AssessmentStatus,
  AssessmentOutcome,
  InvitationStatus,
  RoundStatus,
  type School,
} from "@prisma/client";
import { prisma, withAdminContext } from "@/lib/db/prisma";
import { promoteToActiveAccount } from "@/lib/applications/account-promotion";
import { getTotalSchoolingYears } from "@/lib/assessment/schooling-years";
import { randomUUID } from "node:crypto";

// ── Targets ────────────────────────────────────────────────────────────────
const PARENT2 = "8036354b-5cd4-4eec-a2af-ea5e20d9466c";
const PARENT3 = "8e381816-770d-42ef-921c-9efc3df7c5b3";
const APP_P2 = "9e92fcad-813d-463c-b050-96be1d8e0aa6"; // TS-E2E 202627-0001, TRINITY, Y7
const APP_P3 = "ed8ca755-794c-4631-aa99-8e6aaeaab8fe"; // WS-E2E 202627-0009, WHITGIFT, Y12
const E2E_ROUND = "47333b59-b467-4cf2-8292-e8bbe0731c78"; // "E2E 2026/27"

// Dedicated e2e staff (used for assessor_id + invitation.created_by).
const E2E_ASSESSOR = "96bf764d-3afb-4a48-8148-ab7bbdcb1135"; // e2e.assessor@jwf-bursary.test
const E2E_ADMIN = "5091dea9-5706-4c14-a68a-26464f5740ab"; // e2e.admin@jwf-bursary.test

// Future round for the re-assessment invitation (created if missing).
const FUTURE_ROUND_YEAR = "E2E 2027/28";

const EXPECTED = "lmkmgoqezgeeyjodbvzn";

function assertNonprod() {
  const ref =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ??
    "unknown";
  const dbUser =
    (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").match(
      /\/\/([^:]+):/
    )?.[1] ?? "unknown";
  console.log(`[seed-e2e-pre] Supabase project ref : ${ref}`);
  console.log(`[seed-e2e-pre] DB connection user   : ${dbUser}`);
  if (ref !== EXPECTED || !dbUser.includes(EXPECTED)) {
    throw new Error(
      `Refusing to run: target is not nonprod (${EXPECTED}). ref=${ref}, dbUser=${dbUser}`
    );
  }
  console.log(`[seed-e2e-pre] target confirmed nonprod (${EXPECTED})\n`);
}

/**
 * Stamp an application SUBMITTED (form_status + submitted_at write-once).
 * Direct Prisma update of ONLY formStatus + submittedAt — submitApplicationCore
 * cannot be satisfied here because these CREATED forms have no completed
 * sections / documents (it would throw on the completeness + gap gates).
 */
async function ensureSubmitted(label: string, appId: string) {
  await withAdminContext(async (tx) => {
    const app = await tx.application.findUnique({
      where: { id: appId },
      select: { formStatus: true, submittedAt: true, reference: true },
    });
    if (!app) throw new Error(`[${label}] application ${appId} not found`);
    if (app.formStatus === "SUBMITTED" && app.submittedAt) {
      console.log(
        `[${label}] already SUBMITTED (submitted_at set) — skipping submit`
      );
      return;
    }
    await tx.application.update({
      where: { id: appId },
      data: {
        formStatus: "SUBMITTED",
        // write-once: only stamp if not already set
        ...(app.submittedAt ? {} : { submittedAt: new Date() }),
      },
    });
    console.log(
      `[${label}] ${app.reference} -> form_status=SUBMITTED (direct Prisma update; ` +
        `submitApplicationCore not callable — empty CREATED form fails section/gap gates)`
    );
  });
}

async function main() {
  assertNonprod();

  // ── A. parent3 → SUBMITTED ────────────────────────────────────────────────
  await ensureSubmitted("parent3", APP_P3);

  // ── B. parent2 → SUBMITTED + AWARDED assessment + ACTIVE account + schedule ─
  await ensureSubmitted("parent2", APP_P2);

  await withAdminContext(async (tx) => {
    // Load the shape promoteToActiveAccount needs.
    const application = await tx.application.findUnique({
      where: { id: APP_P2 },
      select: {
        id: true,
        school: true,
        childName: true,
        childDob: true,
        entryYear: true,
        entryYearGroup: true,
        bursaryAccountId: true,
        leadApplicantId: true,
        round: {
          select: { academicYear: true, openDate: true, closeDate: true },
        },
      },
    });
    if (!application) throw new Error("[parent2] application not found");

    // 1) Assessment: COMPLETED / AWARDED, schooling_years_remaining for Y7 = 7.
    const existingAssessment = await tx.assessment.findUnique({
      where: { applicationId: APP_P2 },
      select: { id: true, status: true, outcome: true, schoolingYearsRemaining: true },
    });
    const syr = getTotalSchoolingYears(7); // Y7 entrant → 7
    if (existingAssessment) {
      await tx.assessment.update({
        where: { id: existingAssessment.id },
        data: {
          status: AssessmentStatus.COMPLETED,
          outcome: AssessmentOutcome.AWARDED,
          completedAt: new Date(),
          schoolingYearsRemaining: syr,
          assessorId: E2E_ASSESSOR,
        },
      });
      console.log(
        `[parent2] assessment ${existingAssessment.id} -> COMPLETED/AWARDED, syr=${syr}`
      );
    } else {
      const created = await tx.assessment.create({
        data: {
          applicationId: APP_P2,
          assessorId: E2E_ASSESSOR, // NOT NULL
          status: AssessmentStatus.COMPLETED,
          outcome: AssessmentOutcome.AWARDED,
          completedAt: new Date(),
          schoolingYearsRemaining: syr,
          // boolean flags default false; numeric calc cols are nullable.
        },
        select: { id: true },
      });
      console.log(
        `[parent2] assessment ${created.id} created -> COMPLETED/AWARDED, syr=${syr}`
      );
    }

    // 2) Promote: the SAME helper setApplicationOutcome(AWARDED) calls. Creates
    //    the ACTIVE bursary_accounts row + generates the forward schedule
    //    (show_on_portal defaults from planSchedule; an admin toggles later).
    if (application.bursaryAccountId) {
      console.log(
        `[parent2] already linked to account ${application.bursaryAccountId} — promotion idempotent`
      );
    }
    const result = await promoteToActiveAccount(
      tx,
      {
        id: application.id,
        school: application.school,
        childName: application.childName,
        childDob: application.childDob,
        entryYear: application.entryYear,
        entryYearGroup: application.entryYearGroup,
        bursaryAccountId: application.bursaryAccountId,
        leadApplicantId: application.leadApplicantId,
        round: application.round,
        assessment: { yearlyPayableFees: null },
      },
      { bursaryAward: null, scholarshipAward: null }
    );
    console.log(
      `[parent2] promoteToActiveAccount -> account ${result.bursaryAccountId} (created=${result.created})`
    );
  });

  // ── C. parent2 → PENDING re-assessment invitation against a future round ───
  await withAdminContext(async (tx) => {
    // Resolve parent2's account id (just created/continued above).
    const app = await tx.application.findUnique({
      where: { id: APP_P2 },
      select: { bursaryAccountId: true, school: true, childName: true },
    });
    if (!app?.bursaryAccountId) {
      throw new Error("[parent2] no bursary account after promotion");
    }

    // Future round (create if missing) — distinct from the award round so the
    // re-assessment lands in a new year.
    let futureRound = await tx.round.findFirst({
      where: { academicYear: FUTURE_ROUND_YEAR },
      select: { id: true, academicYear: true, status: true },
    });
    if (!futureRound) {
      const created = await tx.round.create({
        data: {
          academicYear: FUTURE_ROUND_YEAR,
          openDate: new Date(Date.UTC(2027, 5, 1)), // 2027-06-01
          closeDate: new Date(Date.UTC(2027, 11, 31)), // 2027-12-31
          status: RoundStatus.OPEN,
        },
        select: { id: true, academicYear: true, status: true },
      });
      futureRound = created;
      console.log(
        `[parent2] created future round ${created.id} (${created.academicYear}, OPEN)`
      );
    } else {
      console.log(
        `[parent2] future round exists ${futureRound.id} (${futureRound.academicYear})`
      );
    }

    // Idempotency: a PENDING re-assessment invite (bursaryAccountId set) for
    // parent2 in the future round already satisfies beginReassessmentAction.
    const existingInvite = await tx.invitation.findFirst({
      where: {
        authUserId: PARENT2,
        roundId: futureRound.id,
        status: InvitationStatus.PENDING,
        bursaryAccountId: { not: null },
      },
      select: { id: true, bursaryAccountId: true },
    });
    if (existingInvite) {
      console.log(
        `[parent2] re-assessment invitation already exists ${existingInvite.id} ` +
          `(account ${existingInvite.bursaryAccountId}, round ${futureRound.id}) — skipping`
      );
      return;
    }

    // Look up parent2's email for invitation.email (NOT NULL).
    const profile = await tx.profile.findUnique({
      where: { id: PARENT2 },
      select: { email: true },
    });
    if (!profile?.email) throw new Error("[parent2] profile email not found");

    const invitation = await tx.invitation.create({
      data: {
        email: profile.email,
        authUserId: PARENT2,
        roundId: futureRound.id,
        bursaryAccountId: app.bursaryAccountId, // non-null = re-assessment invite
        applicationId: null, // not yet consumed
        school: app.school as School,
        childName: app.childName,
        status: InvitationStatus.PENDING,
        token: randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90), // 90 days
        createdBy: E2E_ADMIN, // NOT NULL
      },
      select: { id: true },
    });
    console.log(
      `[parent2] re-assessment invitation ${invitation.id} created ` +
        `(PENDING, account ${app.bursaryAccountId}, round ${futureRound.id})`
    );
  });
}

main()
  .then(() => console.log("\n[seed-e2e-pre] done"))
  .catch((err) => {
    console.error("[seed-e2e-pre] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
