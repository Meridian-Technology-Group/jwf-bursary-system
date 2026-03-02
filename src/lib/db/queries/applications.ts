/**
 * Application database queries for the admin queue and detail views.
 */

import { prisma } from "@/lib/db/prisma";
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

  const applications = await prisma.application.findMany({
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
  applicationIds: string[]
): Promise<ApplicationNameResult[]> {
  const applications = await prisma.application.findMany({
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

export type ApplicationWithDetails = Application & {
  round: Round;
  sections: ApplicationSection[];
  documents: Document[];
  assessment: Assessment | null;
  leadApplicant: Pick<Profile, "id" | "firstName" | "lastName" | "email">;
};

/**
 * Returns the full application with all related data for the detail view.
 */
export async function getApplicationWithDetails(
  applicationId: string
): Promise<ApplicationWithDetails | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      round: true,
      sections: {
        orderBy: { section: "asc" },
      },
      documents: {
        orderBy: { uploadedAt: "asc" },
      },
      assessment: true,
      leadApplicant: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return application;
}

// ─── Round list (for filter dropdown) ────────────────────────────────────────

export async function listRounds(): Promise<
  Pick<Round, "id" | "academicYear" | "status">[]
> {
  return prisma.round.findMany({
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
 */
export async function getApplicationForUser(userId: string) {
  return prisma.application.findFirst({
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
 * Returns completion status for all sections of an application.
 */
export async function getSectionStatusList(
  applicationId: string
): Promise<SectionStatusResult[]> {
  const rows = await prisma.applicationSection.findMany({
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
  applicationId: string,
  section: ApplicationSectionType,
  data: unknown,
  isComplete: boolean
) {
  const jsonData = data as Prisma.InputJsonValue;
  return prisma.applicationSection.upsert({
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
  applicationId: string,
  section: ApplicationSectionType
) {
  return prisma.applicationSection.findUnique({
    where: {
      applicationId_section: {
        applicationId,
        section,
      },
    },
    select: { data: true, isComplete: true, updatedAt: true },
  });
}
