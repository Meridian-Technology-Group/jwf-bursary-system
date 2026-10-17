/**
 * Export Section 1 — assessment workload (Epic 23 T6, her decision 13).
 *
 * Rows (D-13): one per application in the round, plus every sent invitation
 * for that round with no application yet ("Not yet started"), so a
 * mid-window check sees every family. % completion (D-14) is the parent's own
 * figure (`draftCompletion`, the function My Bursary Application(s) shows),
 * computed only for unsubmitted forms (a submitted form is 100%) in chunks
 * under the admin context, as the round watchlist does.
 *
 * Her filters apply after the rows are built (a round is a few hundred rows):
 * the mapping and the filter are pure and unit-tested.
 */

import { z } from "zod";
import type {
  ApplicationFormStatus,
  ApplicationType,
  AssessmentStatus,
  BursaryAccountStatus,
  EntryYearGroup,
  InvitationSituation,
  School,
} from "@prisma/client";
import { withAdminContext, type Tx } from "@/lib/db/prisma";
import type { ExportRecord } from "@/lib/export/columns";
import { getActiveRound } from "@/lib/db/queries/reports";
import { draftCompletion } from "@/lib/portal/draft-completion";
import { resolveChildNameParts } from "@/lib/applications/child-name";
import {
  DEADLINE_ROUND_SELECT,
  effectiveSubmissionDeadline,
  roundSubmissionDeadline,
  type SubmissionDeadlineRound,
} from "@/lib/rounds/submission-deadline";
import {
  accountState,
  accountStateLabel,
  applicationTypeLabel,
  assessmentStatusLabel,
  endOfDay,
  schoolLabel,
  schoolYearNumber,
  startOfDay,
  submissionStatus,
  type AccountState,
  type SubmissionStatus,
} from "@/lib/export/fields";
import { ACCOUNT_VALUES, APPLICATION_TYPE_VALUES, parseWith, type ParseResult } from "./filters";

// ─── Filters ──────────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const optional = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (v === "" || v === "__all__" || v == null ? undefined : v), t.optional());
const date = optional(z.string().regex(ISO_DATE, "Dates must be YYYY-MM-DD."));

export const SUBMISSION_STATUS_VALUES = ["NOT_YET_STARTED", "STARTED", "SUBMITTED"] as const;
const STATUS_LABEL: Record<(typeof SUBMISSION_STATUS_VALUES)[number], SubmissionStatus> = {
  NOT_YET_STARTED: "Not yet started",
  STARTED: "Started",
  SUBMITTED: "Submitted",
};

export const WorkloadFiltersSchema = z
  .object({
    roundId: optional(z.string().uuid("Unknown round.")),
    account: optional(z.enum(ACCOUNT_VALUES)),
    dueFrom: date,
    dueTo: date,
    submittedFrom: date,
    submittedTo: date,
    submissionStatus: optional(z.enum(SUBMISSION_STATUS_VALUES)),
    completionBelow: optional(z.coerce.number().min(0, "% completion must be 0–100.").max(100, "% completion must be 0–100.")),
    applicationType: optional(z.enum(APPLICATION_TYPE_VALUES)),
  })
  .refine((f) => !f.dueFrom || !f.dueTo || f.dueFrom <= f.dueTo, { message: "The submit-by range ends before it starts." })
  .refine((f) => !f.submittedFrom || !f.submittedTo || f.submittedFrom <= f.submittedTo, {
    message: "The submission date range ends before it starts.",
  });

export type WorkloadFilters = z.infer<typeof WorkloadFiltersSchema>;

export function parseWorkloadFilters(params: URLSearchParams): ParseResult<WorkloadFilters> {
  return parseWith(WorkloadFiltersSchema, params);
}

// ─── Row model ────────────────────────────────────────────────────────────────

/** What the filters read, beside the printed record. */
export interface WorkloadRow {
  record: ExportRecord;
  account: AccountState;
  applicationType: ApplicationType;
  dueBy: Date | null;
  submittedAt: Date | null;
  status: SubmissionStatus;
  completion: number;
}

export interface WorkloadRound extends SubmissionDeadlineRound {
  academicYear: string;
}

export interface WorkloadApplicationSource {
  id: string;
  reference: string;
  childName: string | null;
  childFirstName: string | null;
  childLastName: string | null;
  school: School;
  entryYearGroup: EntryYearGroup | null;
  applicationType: ApplicationType;
  isReassessment: boolean;
  formStatus: ApplicationFormStatus;
  submittedAt: Date | null;
  submissionDeadlineAt: Date | null;
  leadApplicantId: string;
  leadApplicant: { firstName: string | null; lastName: string | null; email: string; phone: string | null };
  contact: { phone: string | null } | null;
  bursaryAccount: { status: BursaryAccountStatus } | null;
  assessment: { status: AssessmentStatus; completedAt: Date | null } | null;
}

export interface WorkloadInvitationSource {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  childName: string | null;
  childFirstName: string | null;
  childLastName: string | null;
  school: School | null;
  entryYearGroup: EntryYearGroup | null;
  situation: InvitationSituation | null;
  submissionDeadlineAt: Date | null;
  createdAt: Date;
  contact: { phone: string | null } | null;
  bursaryAccount: { status: BursaryAccountStatus } | null;
}

const fullName = (first: string | null | undefined, last: string | null | undefined) =>
  [first, last].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");

const childFullName = (s: { childName: string | null; childFirstName?: string | null; childLastName?: string | null }) => {
  const p = resolveChildNameParts(s);
  return fullName(p.firstName, p.lastName);
};

/** An application → its Section 1 row. `completion` is the parent's figure (unused once submitted). */
export function mapWorkloadApplication(app: WorkloadApplicationSource, round: WorkloadRound, completion: number): WorkloadRow {
  const status = submissionStatus(app.formStatus);
  const pct = status === "Submitted" ? 100 : completion;
  const dueBy = effectiveSubmissionDeadline(
    { submissionDeadlineAt: app.submissionDeadlineAt, applicationType: app.applicationType },
    round,
  ).deadline;
  const account = accountState(app.bursaryAccount?.status);
  return {
    account,
    applicationType: app.applicationType,
    dueBy,
    submittedAt: app.submittedAt,
    status,
    completion: pct,
    record: {
      bursaryStatus: app.bursaryAccount ? accountStateLabel(app.bursaryAccount.status) : "",
      toBeSubmittedBy: dueBy,
      submittedAt: app.submittedAt,
      submissionStatus: status,
      completion: pct,
      applicationType: applicationTypeLabel(app.applicationType),
      reference: app.reference,
      leadName: fullName(app.leadApplicant.firstName, app.leadApplicant.lastName),
      leadEmail: app.leadApplicant.email,
      leadMobile: (app.leadApplicant.phone || app.contact?.phone || "").trim(),
      childName: childFullName(app),
      childSchool: schoolLabel(app.school),
      childSchoolYear: schoolYearNumber(app.entryYearGroup),
      round: round.academicYear,
      assessmentStatus: app.assessment ? assessmentStatusLabel(app.assessment.status) : "",
      bursaryAccount: accountStateLabel(app.bursaryAccount?.status),
      assessmentCompletedAt: app.assessment?.completedAt ?? null,
    },
  };
}

export function invitationApplicationType(situation: InvitationSituation | null): ApplicationType {
  return situation === "ROLLING_OVER" ? "ROLLING_OVER" : "NEW";
}

/** A sent invitation with no application yet → a "Not yet started" row (D-13). */
export function mapWorkloadInvitation(inv: WorkloadInvitationSource, round: WorkloadRound): WorkloadRow {
  const type = invitationApplicationType(inv.situation);
  const dueBy = inv.submissionDeadlineAt ?? roundSubmissionDeadline(round, type);
  const account = accountState(inv.bursaryAccount?.status);
  return {
    account,
    applicationType: type,
    dueBy,
    submittedAt: null,
    status: "Not yet started",
    completion: 0,
    record: {
      bursaryStatus: inv.bursaryAccount ? accountStateLabel(inv.bursaryAccount.status) : "",
      toBeSubmittedBy: dueBy,
      submittedAt: null,
      submissionStatus: "Not yet started",
      completion: 0,
      applicationType: applicationTypeLabel(type),
      reference: "",
      leadName: fullName(inv.firstName, inv.lastName),
      leadEmail: inv.email,
      leadMobile: (inv.contact?.phone ?? "").trim(),
      childName: childFullName(inv),
      childSchool: schoolLabel(inv.school),
      childSchoolYear: schoolYearNumber(inv.entryYearGroup),
      round: round.academicYear,
      assessmentStatus: "",
      bursaryAccount: accountStateLabel(inv.bursaryAccount?.status),
      assessmentCompletedAt: null,
    },
  };
}

/**
 * A family re-sent an invitation has several rows for one child: keep the
 * latest per (email, child), and drop any whose child already has an
 * application in the round (the invitation was used under another row).
 */
export function latestOpenInvitations<T extends WorkloadInvitationSource>(
  invitations: readonly T[],
  applications: readonly { leadApplicant: { email: string }; childName: string | null }[],
): T[] {
  const key = (email: string, child: string | null) => `${email.trim().toLowerCase()}|${(child ?? "").trim().toLowerCase()}`;
  const applied = new Set(applications.map((a) => key(a.leadApplicant.email, a.childName)));
  const latest = new Map<string, T>();
  for (const inv of invitations) {
    const k = key(inv.email, inv.childName ?? fullName(inv.childFirstName, inv.childLastName));
    if (applied.has(k)) continue;
    const seen = latest.get(k);
    if (!seen || inv.createdAt > seen.createdAt) latest.set(k, inv);
  }
  return Array.from(latest.values());
}

/** Her filters (Section 1). Date ranges are whole days; % completion is strictly less than. */
export function filterWorkloadRows(rows: readonly WorkloadRow[], f: WorkloadFilters): WorkloadRow[] {
  const inRange = (d: Date | null, from?: string, to?: string) => {
    if (!from && !to) return true;
    if (!d) return false;
    if (from && d < startOfDay(from)) return false;
    if (to && d > endOfDay(to)) return false;
    return true;
  };
  return rows.filter(
    (r) =>
      (!f.account || r.account === f.account) &&
      (!f.applicationType || r.applicationType === f.applicationType) &&
      (!f.submissionStatus || r.status === STATUS_LABEL[f.submissionStatus]) &&
      (f.completionBelow == null || r.completion < f.completionBelow) &&
      inRange(r.dueBy, f.dueFrom, f.dueTo) &&
      inRange(r.submittedAt, f.submittedFrom, f.submittedTo),
  );
}

// ─── Query ────────────────────────────────────────────────────────────────────

const COMPLETION_CHUNK = 20;

export async function buildWorkloadRows(tx: Tx, filters: WorkloadFilters): Promise<ExportRecord[]> {
  const roundId = filters.roundId ?? (await getActiveRound(tx))?.id;
  if (!roundId) return [];
  const round = await tx.round.findUnique({
    where: { id: roundId },
    select: { academicYear: true, ...DEADLINE_ROUND_SELECT },
  });
  if (!round) return [];

  const applications: WorkloadApplicationSource[] = await tx.application.findMany({
    where: { roundId },
    select: {
      id: true,
      reference: true,
      childName: true,
      childFirstName: true,
      childLastName: true,
      school: true,
      entryYearGroup: true,
      applicationType: true,
      isReassessment: true,
      formStatus: true,
      submittedAt: true,
      submissionDeadlineAt: true,
      leadApplicantId: true,
      leadApplicant: { select: { firstName: true, lastName: true, email: true, phone: true } },
      contact: { select: { phone: true } },
      bursaryAccount: { select: { status: true } },
      assessment: { select: { status: true, completedAt: true } },
    },
    orderBy: [{ reference: "asc" }, { id: "asc" }],
  });

  const invitations: WorkloadInvitationSource[] = await tx.invitation.findMany({
    where: { roundId, applicationId: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      childName: true,
      childFirstName: true,
      childLastName: true,
      school: true,
      entryYearGroup: true,
      situation: true,
      submissionDeadlineAt: true,
      createdAt: true,
      contact: { select: { phone: true } },
      bursaryAccount: { select: { status: true } },
    },
  });

  // D-14: the parent's figure, only for forms not yet submitted.
  const pending = applications.filter((a) => a.formStatus !== "SUBMITTED");
  const completion = new Map<string, number>();
  for (let i = 0; i < pending.length; i += COMPLETION_CHUNK) {
    const chunk = pending.slice(i, i + COMPLETION_CHUNK);
    const results = await withAdminContext((adminTx) =>
      Promise.all(chunk.map(async (a) => [a.id, (await draftCompletion(adminTx, a, a.leadApplicantId)).percent] as const)),
    );
    for (const [id, pct] of results) completion.set(id, pct);
  }

  const rows = [
    ...applications.map((a) => mapWorkloadApplication(a, round, completion.get(a.id) ?? 0)),
    ...latestOpenInvitations(invitations, applications)
      .sort((x, y) => (x.childName ?? "").localeCompare(y.childName ?? ""))
      .map((inv) => mapWorkloadInvitation(inv, round)),
  ];
  return filterWorkloadRows(rows, filters).map((r) => r.record);
}
