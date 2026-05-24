/**
 * Application database queries for the admin queue and detail views.
 */

import type { Tx } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/audit/log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit/actions";
import type {
  ApplicationStatus,
  School,
  Application,
  Round,
  ApplicationSection,
  ApplicationSectionType,
  Document,
  Assessment,
  Profile,
  Prisma,
} from "@prisma/client";

// ─── List Applications ────────────────────────────────────────────────────────

export interface ApplicationListItem {
  id: string;
  reference: string;
  school: School;
  status: ApplicationStatus;
  entryYear: number | null;
  submittedAt: Date | null;
  isReassessment: boolean;
  assignedToId: string | null;
  round: Pick<Round, "id" | "academicYear">;
}

export interface ListApplicationsFilters {
  roundId?: string;
  status?: ApplicationStatus;
  school?: School;
  search?: string;
  assignedToId?: string;
}

/**
 * Returns a list of applications matching the given filters.
 * Names are excluded by default — use getApplicationNames() separately.
 */
export async function listApplications(
  tx: Tx,
  filters: ListApplicationsFilters = {}
): Promise<ApplicationListItem[]> {
  const where: Prisma.ApplicationWhereInput = {};

  if (filters.roundId) {
    where.roundId = filters.roundId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.school) {
    where.school = filters.school;
  }

  if (filters.search) {
    where.reference = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  if (filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  const applications = await tx.application.findMany({
    where,
    select: {
      id: true,
      reference: true,
      school: true,
      status: true,
      entryYear: true,
      submittedAt: true,
      isReassessment: true,
      assignedToId: true,
      round: {
        select: { id: true, academicYear: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  return applications;
}

// ─── Application Names ────────────────────────────────────────────────────────

export interface ApplicationNameResult {
  id: string;
  childName: string;
  leadApplicant: Pick<Profile, "id" | "firstName" | "lastName" | "email">;
}

/**
 * Returns child names and lead applicant names for the given application IDs.
 * Keep this in a separate query — call only when names have been explicitly revealed.
 */
export async function getApplicationNames(
  tx: Tx,
  applicationIds: string[]
): Promise<ApplicationNameResult[]> {
  const applications = await tx.application.findMany({
    where: { id: { in: applicationIds } },
    select: {
      id: true,
      childName: true,
      leadApplicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return applications;
}

// ─── Application Detail ───────────────────────────────────────────────────────

/**
 * Default application detail shape — DOES NOT include `childName` or any
 * applicant name fields. Per finding 2.18 / NM-01..05, the SSR payload for
 * the application-detail pages must not carry names unless they have been
 * explicitly revealed via the audit-logged path (`getApplicationNamesForReveal`).
 */
export type ApplicationWithDetails = Omit<Application, "childName"> & {
  round: Round;
  sections: ApplicationSection[];
  documents: Document[];
  assessment: Assessment | null;
  leadApplicant: Pick<Profile, "id">;
};

/**
 * Returns the full application with all related data for the detail view —
 * EXCLUDING applicant names (childName, firstName, lastName, email). Use
 * `getApplicationNamesForReveal()` to fetch names on the explicit reveal path.
 */
export async function getApplicationWithDetails(
  tx: Tx,
  applicationId: string
): Promise<ApplicationWithDetails | null> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      roundId: true,
      bursaryAccountId: true,
      leadApplicantId: true,
      school: true,
      // childName: intentionally omitted — see getApplicationNamesForReveal.
      childDob: true,
      entryYear: true,
      entryYearGroup: true,
      isReassessment: true,
      isInternal: true,
      assignedToId: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      round: true,
      sections: {
        orderBy: { section: "asc" },
      },
      documents: {
        orderBy: { uploadedAt: "asc" },
      },
      assessment: true,
      leadApplicant: {
        select: { id: true },
      },
    },
  });

  return application as ApplicationWithDetails | null;
}

// ─── Application Names (audit-logged reveal) ──────────────────────────────────

export interface ApplicationNamesForReveal {
  childName: string;
  leadApplicant: Pick<Profile, "id" | "firstName" | "lastName" | "email">;
}

/**
 * Fetches the applicant + child names for a single application and writes a
 * NAME_REVEAL audit log entry. Call this only from server pages/actions that
 * legitimately need to render names (e.g. the recommendation reveal step or
 * the Applicant Data review tab). The Assessment tab MUST NOT call this.
 *
 * Mirrors the pattern in /api/applications/names/route.ts.
 */
export async function getApplicationNamesForReveal(
  tx: Tx,
  applicationId: string,
  userId: string
): Promise<ApplicationNamesForReveal | null> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    select: {
      childName: true,
      leadApplicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!application) return null;

  await createAuditLog(tx, {
    userId,
    action: AUDIT_ACTIONS.NAME_REVEAL,
    entityType: AUDIT_ENTITY_TYPES.Application,
    entityId: applicationId,
    context: "Application detail name reveal",
    metadata: { applicationId },
  });

  return application;
}

// ─── Round list (for filter dropdown) ────────────────────────────────────────

export async function listRounds(
  tx: Tx
): Promise<Pick<Round, "id" | "academicYear" | "status">[]> {
  return tx.round.findMany({
    select: { id: true, academicYear: true, status: true },
    orderBy: { openDate: "desc" },
  });
}

// ─── Portal applicant queries ─────────────────────────────────────────────────

export interface SectionStatusResult {
  section: ApplicationSectionType;
  isComplete: boolean;
  updatedAt: Date;
}

/**
 * Returns the applicant's current active application (most recently updated
 * with PRE_SUBMISSION status), or null if none exists.
 *
 * Use this for the editable apply flow, which only operates on the draft.
 * For the dashboard's "current application whatever its status" need, use
 * getCurrentApplicationForUser instead.
 */
export async function getApplicationForUser(tx: Tx, userId: string) {
  return tx.application.findFirst({
    where: {
      leadApplicantId: userId,
      status: "PRE_SUBMISSION",
    },
    orderBy: { updatedAt: "desc" },
    include: {
      round: {
        select: { academicYear: true, status: true },
      },
    },
  });
}

/**
 * Returns the applicant's most recent application of any status (most
 * recently updated), or null if none exists. Unlike getApplicationForUser
 * this does not filter to PRE_SUBMISSION, so a submitted/under-review/
 * decided application is still returned — which the dashboard needs so it
 * reflects the real state instead of falling back to onboarding.
 */
export async function getCurrentApplicationForUser(tx: Tx, userId: string) {
  return tx.application.findFirst({
    where: {
      leadApplicantId: userId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      round: {
        select: { academicYear: true, status: true },
      },
    },
  });
}

/**
 * Returns completion status for all sections of an application.
 */
export async function getSectionStatusList(
  tx: Tx,
  applicationId: string
): Promise<SectionStatusResult[]> {
  const rows = await tx.applicationSection.findMany({
    where: { applicationId },
    select: { section: true, isComplete: true, updatedAt: true },
  });

  return rows.map((row) => ({
    section: row.section,
    isComplete: row.isComplete,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Upserts a single ApplicationSection row.
 */
export async function upsertSection(
  tx: Tx,
  applicationId: string,
  section: ApplicationSectionType,
  data: unknown,
  isComplete: boolean
) {
  const jsonData = data as Prisma.InputJsonValue;
  return tx.applicationSection.upsert({
    where: {
      applicationId_section: {
        applicationId,
        section,
      },
    },
    update: {
      data: jsonData,
      isComplete,
    },
    create: {
      applicationId,
      section,
      data: jsonData,
      isComplete,
    },
  });
}

/**
 * Loads a single section's data for an application.
 * Returns null if the section has not been saved yet.
 */
export async function getSectionData(
  tx: Tx,
  applicationId: string,
  section: ApplicationSectionType
) {
  return tx.applicationSection.findUnique({
    where: {
      applicationId_section: {
        applicationId,
        section,
      },
    },
    select: { data: true, isComplete: true, updatedAt: true },
  });
}

/**
 * Serialisable document metadata for the client (no storagePath / uploadedBy).
 */
export interface DocumentMeta {
  id: string;
  slot: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Returns all documents for an application as a map keyed by document ID.
 */
export async function getDocumentsForApplication(
  tx: Tx,
  applicationId: string
): Promise<Record<string, DocumentMeta>> {
  const rows = await tx.document.findMany({
    where: { applicationId },
    select: { id: true, slot: true, filename: true, fileSize: true, uploadedAt: true },
  });

  const map: Record<string, DocumentMeta> = {};
  for (const row of rows) {
    map[row.id] = {
      id: row.id,
      slot: row.slot,
      filename: row.filename,
      fileSize: row.fileSize,
      uploadedAt: row.uploadedAt.toISOString(),
    };
  }
  return map;
}
