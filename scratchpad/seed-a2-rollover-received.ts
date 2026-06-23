// scratchpad/seed-a2-rollover-received.ts
//
// Seeds a SUBMITTED ROLLING_OVER application for parent2 so the A2 badge
// ("Received") can be proven in the browser.
//
// Path: call createReassessmentApplicationFromInvitation with the existing
// PENDING re-assessment invitation (the real app path) to create the
// ROLLING_OVER app, then stamp form_status=SUBMITTED + submitted_at=now().
// The CLOSED bursary account does NOT block the helper (it only reads
// school/childName/childDob/entryYear), so the preferred path works.
//
// Run: tsx scratchpad/seed-a2-rollover-received.ts (from repo root)

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { prisma, withAdminContext } from "@/lib/db/prisma";
import { createReassessmentApplicationFromInvitation } from "@/lib/db/queries/reassessment";

const PARENT2 = "8036354b-5cd4-4eec-a2af-ea5e20d9466c";
const INVITATION = "d3ffafa7-bea5-45be-8b82-86f49ac5cb4c";
const EXPECTED = "lmkmgoqezgeeyjodbvzn";

function assertNonprod() {
  const ref =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ??
    "unknown";
  const dbUser =
    (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "").match(
      /\/\/([^:]+):/
    )?.[1] ?? "unknown";
  console.log(`[seed-a2] Supabase project ref : ${ref}`);
  console.log(`[seed-a2] DB connection user   : ${dbUser}`);
  if (ref !== EXPECTED || !dbUser.includes(EXPECTED)) {
    throw new Error(
      `Refusing to run: target is not nonprod (${EXPECTED}). ref=${ref}, dbUser=${dbUser}`
    );
  }
  console.log(`[seed-a2] target confirmed nonprod (${EXPECTED})\n`);
}

async function main() {
  assertNonprod();

  const result = await withAdminContext(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { id: INVITATION },
      select: {
        authUserId: true,
        bursaryAccountId: true,
        roundId: true,
        school: true,
        childName: true,
        status: true,
      },
    });
    if (!invitation) throw new Error(`invitation ${INVITATION} not found`);
    if (!invitation.bursaryAccountId || !invitation.roundId) {
      throw new Error("invitation is not a re-assessment invite");
    }
    console.log(
      `[seed-a2] invitation ${INVITATION} status=${invitation.status} ` +
        `account=${invitation.bursaryAccountId} round=${invitation.roundId}`
    );

    const account = await tx.bursaryAccount.findUnique({
      where: { id: invitation.bursaryAccountId },
      select: { status: true },
    });
    console.log(`[seed-a2] bursary account status = ${account?.status}`);

    // Preferred path: create the ROLLING_OVER app the real way.
    const { id, created } =
      await createReassessmentApplicationFromInvitation(tx, {
        authUserId: invitation.authUserId,
        bursaryAccountId: invitation.bursaryAccountId,
        roundId: invitation.roundId,
        school: invitation.school,
        childName: invitation.childName,
      });
    console.log(
      `[seed-a2] createReassessmentApplicationFromInvitation -> app ${id} (created=${created})`
    );

    // Stamp SUBMITTED + submitted_at (write-once).
    const app = await tx.application.findUnique({
      where: { id },
      select: {
        formStatus: true,
        submittedAt: true,
        reference: true,
        applicationType: true,
      },
    });
    if (!app) throw new Error(`application ${id} not found after create`);

    if (app.formStatus !== "SUBMITTED" || !app.submittedAt) {
      await tx.application.update({
        where: { id },
        data: {
          formStatus: "SUBMITTED",
          ...(app.submittedAt ? {} : { submittedAt: new Date() }),
        },
      });
      console.log(
        `[seed-a2] ${app.reference} (${app.applicationType}) -> form_status=SUBMITTED, submitted_at stamped`
      );
    } else {
      console.log(
        `[seed-a2] ${app.reference} already SUBMITTED — skipping stamp`
      );
    }

    const final = await tx.application.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        applicationType: true,
        isReassessment: true,
        formStatus: true,
        submittedAt: true,
      },
    });
    return final;
  });

  console.log("\n[seed-a2] FINAL:", JSON.stringify(result, null, 2));
}

main()
  .then(() => console.log("\n[seed-a2] done"))
  .catch((err) => {
    console.error("[seed-a2] FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
