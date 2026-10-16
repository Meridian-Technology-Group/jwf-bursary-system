/**
 * Export Section 1 — "ASSESSMENT WORKLOAD MANAGEMENT" (EXPORTS.xlsx rows
 * 5–23). Columns in her order, her wording. Client-safe.
 */

import type { ColumnDef } from "@/lib/export/columns";

export const WORKLOAD_COLUMNS: ColumnDef[] = [
  { key: "bursaryStatus", header: "Bursary Status", group: "Submission", width: 14 },
  { key: "toBeSubmittedBy", header: "To be submitted by", group: "Submission", kind: "date" },
  { key: "submittedAt", header: "Application Submission Date", group: "Submission", kind: "date" },
  { key: "submissionStatus", header: "Submission Status", group: "Submission", width: 16 },
  { key: "completion", header: "% Completion", group: "Submission", kind: "percent", width: 14 },
  { key: "applicationType", header: "Application Type", group: "Submission", width: 24 },
  { key: "reference", header: "Bursary reference", group: "Family", width: 36 },
  { key: "leadName", header: "Lead Applicant First name and Surname", group: "Family", width: 30 },
  { key: "leadEmail", header: "Lead applicant's email address", group: "Family", width: 32 },
  { key: "leadMobile", header: "Lead applicant's mobile number", group: "Family", width: 18 },
  { key: "childName", header: "Bursary recipient's name ('Child')", group: "Family", width: 26 },
  { key: "childSchool", header: "Bursary recipient's school", group: "Family", width: 14 },
  { key: "childSchoolYear", header: "Bursary recipient's school year", group: "Family", kind: "number" },
  { key: "round", header: "Round", group: "Assessment", width: 10 },
  { key: "assessmentStatus", header: "Assessment status", group: "Assessment", width: 18 },
  { key: "bursaryAccount", header: "Bursary account", group: "Assessment", width: 16 },
  { key: "assessmentCompletedAt", header: "Assessment Completion Date", group: "Assessment", kind: "date" },
];

/** Her Section 1 "Search Selection", in her order (the round is always one round). */
export const WORKLOAD_FILTER_KEYS = [
  "roundRequired",
  "account",
  "dueRange",
  "submittedRange",
  "submissionStatus",
  "completionBelow",
  "applicationType",
] as const;
