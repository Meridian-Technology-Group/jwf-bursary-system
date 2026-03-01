// prisma/seed.ts
// JWF Bursary Assessment System — database seed
// Run via: npx prisma db seed
// Requires tsx (already configured in package.json prisma.seed)

import { PrismaClient } from "@prisma/client";

import { councilTaxDefaults, familyTypeConfigs, schoolFees } from "./seed-data/reference";
import { reasonCodes } from "./seed-data/reason-codes";
import { emailTemplates } from "./seed-data/email-templates";
import { demoUsers } from "./seed-data/demo-users";
import {
  bursaryAccounts,
  applications,
  applicationSections,
  assessments,
  assessmentEarners,
  assessmentProperties,
  assessmentChecklists,
  recommendations,
  recommendationReasonCodes,
  siblingLinks,
  ACCOUNT_OKAFOR_ID,
  ACCOUNT_PATEL_ID,
  ACCOUNT_WILLIAMS_M_ID,
  ACCOUNT_WILLIAMS_A_ID,
} from "./seed-data/demo-applications";

const prisma = new PrismaClient({
  log: ["warn", "error"],
});

// ─── Round ────────────────────────────────────────────────────────────────────

const ROUND_ID = "00000000-0000-4000-0000-000000000001";

const round = {
  id: ROUND_ID,
  academicYear: "2026/27",
  openDate: new Date("2026-01-15"),
  closeDate: new Date("2026-04-30"),
  decisionDate: new Date("2026-06-30"),
  status: "OPEN" as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(message: string): void {
  console.log(`  ${message}`);
}

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

// ─── Clear ────────────────────────────────────────────────────────────────────
// Delete in reverse FK dependency order to avoid constraint violations.

async function clearAll(): Promise<void> {
  section("Clearing existing data");

  // Audit logs first (reference profiles)
  const al = await prisma.auditLog.deleteMany({});
  log(`Deleted ${al.count} audit logs`);

  // Recommendation reason codes
  const rrc = await prisma.recommendationReasonCode.deleteMany({});
  log(`Deleted ${rrc.count} recommendation reason codes`);

  // Recommendations (reference assessments + bursary accounts + rounds)
  const rec = await prisma.recommendation.deleteMany({});
  log(`Deleted ${rec.count} recommendations`);

  // Sibling links
  const sl = await prisma.siblingLink.deleteMany({});
  log(`Deleted ${sl.count} sibling links`);

  // Assessment checklists
  const ac = await prisma.assessmentChecklist.deleteMany({});
  log(`Deleted ${ac.count} assessment checklists`);

  // Assessment properties
  const ap = await prisma.assessmentProperty.deleteMany({});
  log(`Deleted ${ap.count} assessment properties`);

  // Assessment earners
  const ae = await prisma.assessmentEarner.deleteMany({});
  log(`Deleted ${ae.count} assessment earners`);

  // Assessments (cascade deletes earners/property/checklists but explicit above is fine)
  const ass = await prisma.assessment.deleteMany({});
  log(`Deleted ${ass.count} assessments`);

  // Documents
  const doc = await prisma.document.deleteMany({});
  log(`Deleted ${doc.count} documents`);

  // Application sections (cascade from application, but delete explicitly)
  const aps = await prisma.applicationSection.deleteMany({});
  log(`Deleted ${aps.count} application sections`);

  // Applications
  const app = await prisma.application.deleteMany({});
  log(`Deleted ${app.count} applications`);

  // Invitations (reference rounds + bursary accounts + profiles)
  const inv = await prisma.invitation.deleteMany({});
  log(`Deleted ${inv.count} invitations`);

  // Bursary accounts
  const ba = await prisma.bursaryAccount.deleteMany({});
  log(`Deleted ${ba.count} bursary accounts`);

  // Rounds
  const ro = await prisma.round.deleteMany({});
  log(`Deleted ${ro.count} rounds`);

  // Email templates
  const et = await prisma.emailTemplate.deleteMany({});
  log(`Deleted ${et.count} email templates`);

  // Profiles (after all FK references cleared)
  const pr = await prisma.profile.deleteMany({});
  log(`Deleted ${pr.count} profiles`);

  // Reference tables
  const ft = await prisma.familyTypeConfig.deleteMany({});
  log(`Deleted ${ft.count} family type configs`);

  const sf = await prisma.schoolFees.deleteMany({});
  log(`Deleted ${sf.count} school fees`);

  const ct = await prisma.councilTaxDefault.deleteMany({});
  log(`Deleted ${ct.count} council tax defaults`);

  const rc = await prisma.reasonCode.deleteMany({});
  log(`Deleted ${rc.count} reason codes`);
}

// ─── Reference Data ───────────────────────────────────────────────────────────

async function seedReference(): Promise<void> {
  section("Seeding reference data");

  const ft = await prisma.familyTypeConfig.createMany({ data: familyTypeConfigs });
  log(`Created ${ft.count} family type configs`);

  const sf = await prisma.schoolFees.createMany({ data: schoolFees });
  log(`Created ${sf.count} school fee records`);

  const ct = await prisma.councilTaxDefault.createMany({ data: councilTaxDefaults });
  log(`Created ${ct.count} council tax defaults`);

  const rc = await prisma.reasonCode.createMany({ data: reasonCodes });
  log(`Created ${rc.count} reason codes`);
}

// ─── Email Templates ──────────────────────────────────────────────────────────

async function seedEmailTemplates(): Promise<void> {
  section("Seeding email templates");

  for (const tmpl of emailTemplates) {
    await prisma.emailTemplate.create({
      data: {
        type: tmpl.type,
        subject: tmpl.subject,
        body: tmpl.body,
        mergeFields: tmpl.mergeFields,
        // updatedBy intentionally null for seed — no assessor profile exists yet
      },
    });
  }
  log(`Created ${emailTemplates.length} email templates`);
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

async function seedProfiles(): Promise<void> {
  section("Seeding demo profiles");

  for (const user of demoUsers) {
    await prisma.profile.create({
      data: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
    });
  }
  log(`Created ${demoUsers.length} profiles`);
}

// ─── Round ────────────────────────────────────────────────────────────────────

async function seedRound(): Promise<void> {
  section("Seeding round");

  await prisma.round.create({ data: round });
  log(`Created round: ${round.academicYear} (${round.status})`);
}

// ─── Bursary Accounts ─────────────────────────────────────────────────────────

async function seedBursaryAccounts(): Promise<void> {
  section("Seeding bursary accounts");

  for (const account of bursaryAccounts) {
    await prisma.bursaryAccount.create({ data: account });
  }
  log(`Created ${bursaryAccounts.length} bursary accounts`);
}

// ─── Applications ─────────────────────────────────────────────────────────────

async function seedApplications(): Promise<void> {
  section("Seeding applications");

  for (const app of applications) {
    await prisma.application.create({
      data: {
        ...app,
        roundId: ROUND_ID,
      },
    });
  }
  log(`Created ${applications.length} applications`);
}

// ─── Application Sections ─────────────────────────────────────────────────────

async function seedApplicationSections(): Promise<void> {
  section("Seeding application sections");

  await prisma.applicationSection.createMany({
    data: applicationSections.map((s) => ({
      applicationId: s.applicationId,
      section: s.section,
      data: s.data,
      isComplete: s.isComplete,
    })),
  });
  log(`Created ${applicationSections.length} application sections`);
}

// ─── Assessments ──────────────────────────────────────────────────────────────

async function seedAssessments(): Promise<void> {
  section("Seeding assessments");

  for (const assessment of assessments) {
    await prisma.assessment.create({ data: assessment });
  }
  log(`Created ${assessments.length} assessments`);
}

// ─── Assessment Earners ───────────────────────────────────────────────────────

async function seedAssessmentEarners(): Promise<void> {
  section("Seeding assessment earners");

  await prisma.assessmentEarner.createMany({ data: assessmentEarners });
  log(`Created ${assessmentEarners.length} assessment earners`);
}

// ─── Assessment Properties ────────────────────────────────────────────────────

async function seedAssessmentProperties(): Promise<void> {
  section("Seeding assessment properties");

  await prisma.assessmentProperty.createMany({ data: assessmentProperties });
  log(`Created ${assessmentProperties.length} assessment property records`);
}

// ─── Assessment Checklists ────────────────────────────────────────────────────

async function seedAssessmentChecklists(): Promise<void> {
  section("Seeding assessment checklists");

  await prisma.assessmentChecklist.createMany({ data: assessmentChecklists });
  log(`Created ${assessmentChecklists.length} assessment checklist entries`);
}

// ─── Recommendations ──────────────────────────────────────────────────────────

async function seedRecommendations(): Promise<void> {
  section("Seeding recommendations");

  for (const rec of recommendations) {
    await prisma.recommendation.create({
      data: {
        ...rec,
        roundId: ROUND_ID,
      },
    });
  }
  log(`Created ${recommendations.length} recommendations`);
}

// ─── Recommendation Reason Codes ──────────────────────────────────────────────

async function seedRecommendationReasonCodes(): Promise<void> {
  section("Seeding recommendation reason codes");

  // Resolve reason code IDs from code numbers
  let count = 0;
  for (const entry of recommendationReasonCodes) {
    const rc = await prisma.reasonCode.findUnique({
      where: { code: entry.reasonCodeCode },
    });
    if (!rc) {
      throw new Error(`Reason code ${entry.reasonCodeCode} not found`);
    }
    await prisma.recommendationReasonCode.create({
      data: {
        recommendationId: entry.recommendationId,
        reasonCodeId: rc.id,
      },
    });
    count++;
  }
  log(`Created ${count} recommendation reason code links`);
}

// ─── Sibling Links ────────────────────────────────────────────────────────────

async function seedSiblingLinks(): Promise<void> {
  section("Seeding sibling links");

  await prisma.siblingLink.createMany({ data: siblingLinks });
  log(`Created ${siblingLinks.length} sibling links (Williams family group)`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────

async function printSummary(): Promise<void> {
  section("Seed summary");

  // Run counts sequentially to avoid Supabase pgBouncer prepared-statement limits
  const rows: Array<[string, number]> = [
    ["Profiles",                     await prisma.profile.count()],
    ["Rounds",                       await prisma.round.count()],
    ["Bursary accounts",             await prisma.bursaryAccount.count()],
    ["Applications",                 await prisma.application.count()],
    ["Application sections",         await prisma.applicationSection.count()],
    ["Assessments",                  await prisma.assessment.count()],
    ["Assessment earners",           await prisma.assessmentEarner.count()],
    ["Assessment properties",        await prisma.assessmentProperty.count()],
    ["Assessment checklists",        await prisma.assessmentChecklist.count()],
    ["Recommendations",              await prisma.recommendation.count()],
    ["Recommendation reason codes",  await prisma.recommendationReasonCode.count()],
    ["Sibling links",                await prisma.siblingLink.count()],
    ["Family type configs",          await prisma.familyTypeConfig.count()],
    ["School fee records",           await prisma.schoolFees.count()],
    ["Council tax defaults",         await prisma.councilTaxDefault.count()],
    ["Reason codes",                 await prisma.reasonCode.count()],
    ["Email templates",              await prisma.emailTemplate.count()],
  ];

  console.log("");
  for (const [label, count] of rows) {
    console.log(`  ${label.padEnd(30)} ${String(count).padStart(3)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\nJWF Bursary Assessment System — database seed");
  console.log("=".repeat(52));

  await clearAll();
  await seedReference();
  await seedEmailTemplates();
  await seedProfiles();
  await seedRound();
  await seedBursaryAccounts();
  await seedApplications();
  await seedApplicationSections();
  await seedAssessments();
  await seedAssessmentEarners();
  await seedAssessmentProperties();
  await seedAssessmentChecklists();
  await seedRecommendations();
  await seedRecommendationReasonCodes();
  await seedSiblingLinks();
  await printSummary();

  console.log("\n  Seed completed successfully.\n");
}

main()
  .catch((err: unknown) => {
    console.error("\nSeed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
