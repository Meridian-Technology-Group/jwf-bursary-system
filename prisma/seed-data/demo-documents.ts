// prisma/seed-data/demo-documents.ts
// Demo document records and Supabase Storage uploads for all seed applications.
//
// Each application gets a realistic set of documents (birth cert, passports,
// P60s, bank statements, etc.) so that the admin assessment split-view shows
// a populated document checklist.

import {
  APP_OKAFOR_ID,
  APP_PATEL_ID,
  APP_WILLIAMS_M_ID,
  APP_WILLIAMS_A_ID,
  APP_CHEN_ID,
} from "./demo-applications";

import {
  APPLICANT_1_ID,
  APPLICANT_2_ID,
  APPLICANT_3_ID,
  APPLICANT_4_ID,
} from "./demo-users";

// ─── Document slot definitions per application ───────────────────────────────

interface SeedDocument {
  id: string;
  applicationId: string;
  slot: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  isVerified: boolean;
  uploadedBy: string;
}

// Deterministic UUIDs for documents: 00000000-0000-4000-d100-XXXXXXXXXXXX
let docCounter = 0;
function docId(): string {
  docCounter++;
  return `00000000-0000-4000-d100-${String(docCounter).padStart(12, "0")}`;
}

function buildStoragePath(appId: string, slot: string, filename: string): string {
  return `documents/${appId}/${slot}/${filename}`;
}

// ─── Per-application document sets ───────────────────────────────────────────

function buildAppDocuments(
  appId: string,
  uploadedBy: string,
  childName: string,
  opts: {
    hasParent2?: boolean;
    isSelfEmployed?: boolean;
  } = {}
): SeedDocument[] {
  const { hasParent2 = true, isSelfEmployed = false } = opts;

  const docs: SeedDocument[] = [];

  // 1. Birth certificate
  const bcFile = `${childName.replace(/\s/g, "_")}_birth_certificate.png`;
  docs.push({
    id: docId(),
    applicationId: appId,
    slot: "BIRTH_CERTIFICATE",
    filename: bcFile,
    mimeType: "image/png",
    fileSize: 245_320,
    storagePath: buildStoragePath(appId, "BIRTH_CERTIFICATE", bcFile),
    isVerified: false,
    uploadedBy,
  });

  // 2. UK Passport — Parent 1
  const p1PassFile = "parent1_uk_passport.png";
  docs.push({
    id: docId(),
    applicationId: appId,
    slot: "UK_PASSPORT_PARENT_1",
    filename: p1PassFile,
    mimeType: "image/png",
    fileSize: 312_456,
    storagePath: buildStoragePath(appId, "UK_PASSPORT_PARENT_1", p1PassFile),
    isVerified: false,
    uploadedBy,
  });

  // 3. P60 — Parent 1
  const p1P60File = "parent1_p60_2024_25.png";
  docs.push({
    id: docId(),
    applicationId: appId,
    slot: "P60_PARENT_1",
    filename: p1P60File,
    mimeType: "image/png",
    fileSize: 198_720,
    storagePath: buildStoragePath(appId, "P60_PARENT_1", p1P60File),
    isVerified: false,
    uploadedBy,
  });

  // 4. Bank statement — Parent 1
  const p1BankFile = "parent1_bank_statement_jan2025.png";
  docs.push({
    id: docId(),
    applicationId: appId,
    slot: "BANK_STATEMENT_PARENT_1",
    filename: p1BankFile,
    mimeType: "image/png",
    fileSize: 156_890,
    storagePath: buildStoragePath(appId, "BANK_STATEMENT_PARENT_1", p1BankFile),
    isVerified: false,
    uploadedBy,
  });

  // Self-employed: certified accounts instead of P60
  if (isSelfEmployed) {
    const caFile = "parent1_certified_accounts_2024.png";
    docs.push({
      id: docId(),
      applicationId: appId,
      slot: "CERTIFIED_ACCOUNTS_PARENT_1",
      filename: caFile,
      mimeType: "image/png",
      fileSize: 287_450,
      storagePath: buildStoragePath(appId, "CERTIFIED_ACCOUNTS_PARENT_1", caFile),
      isVerified: false,
      uploadedBy,
    });

    const saFile = "parent1_self_assessment_2024.png";
    docs.push({
      id: docId(),
      applicationId: appId,
      slot: "SELF_ASSESSMENT_PARENT_1",
      filename: saFile,
      mimeType: "image/png",
      fileSize: 234_560,
      storagePath: buildStoragePath(appId, "SELF_ASSESSMENT_PARENT_1", saFile),
      isVerified: false,
      uploadedBy,
    });
  }

  // Parent 2 documents (if applicable)
  if (hasParent2) {
    const p2PassFile = "parent2_uk_passport.png";
    docs.push({
      id: docId(),
      applicationId: appId,
      slot: "UK_PASSPORT_PARENT_2",
      filename: p2PassFile,
      mimeType: "image/png",
      fileSize: 298_340,
      storagePath: buildStoragePath(appId, "UK_PASSPORT_PARENT_2", p2PassFile),
      isVerified: false,
      uploadedBy,
    });

    const p2P60File = "parent2_p60_2024_25.png";
    docs.push({
      id: docId(),
      applicationId: appId,
      slot: "P60_PARENT_2",
      filename: p2P60File,
      mimeType: "image/png",
      fileSize: 201_150,
      storagePath: buildStoragePath(appId, "P60_PARENT_2", p2P60File),
      isVerified: false,
      uploadedBy,
    });

    const p2BankFile = "parent2_bank_statement_jan2025.png";
    docs.push({
      id: docId(),
      applicationId: appId,
      slot: "BANK_STATEMENT_PARENT_2",
      filename: p2BankFile,
      mimeType: "image/png",
      fileSize: 167_230,
      storagePath: buildStoragePath(appId, "BANK_STATEMENT_PARENT_2", p2BankFile),
      isVerified: false,
      uploadedBy,
    });
  }

  return docs;
}

// ─── All demo documents ─────────────────────────────────────────────────────

export const demoDocuments: SeedDocument[] = [
  // Okafor family — two parents, employed
  ...buildAppDocuments(APP_OKAFOR_ID, APPLICANT_1_ID, "Emeka Okafor", {
    hasParent2: true,
  }),
  // Patel family — two parents, self-employed
  ...buildAppDocuments(APP_PATEL_ID, APPLICANT_2_ID, "Arjun Patel", {
    hasParent2: true,
    isSelfEmployed: true,
  }),
  // Williams Marcus — re-assessment, two parents
  ...buildAppDocuments(APP_WILLIAMS_M_ID, APPLICANT_3_ID, "Marcus Williams", {
    hasParent2: true,
  }),
  // Williams Amara — new application, two parents
  ...buildAppDocuments(APP_WILLIAMS_A_ID, APPLICANT_3_ID, "Amara Williams", {
    hasParent2: true,
  }),
  // Chen family — sole parent
  ...buildAppDocuments(APP_CHEN_ID, APPLICANT_4_ID, "Lily Chen", {
    hasParent2: false,
  }),
];
