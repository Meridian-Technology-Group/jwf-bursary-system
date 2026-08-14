import { describe, it, expect } from "vitest";
import {
  RESOLVABLE_BULK_FIELDS,
  isBulkResolvable,
  buildBulkMergeData,
  type BulkMergeDataApplication,
} from "../bulk-merge-data";

function makeApp(
  overrides: Partial<BulkMergeDataApplication> = {}
): BulkMergeDataApplication {
  return {
    reference: "TRI-2026-0001",
    childName: "Jamie Smith",
    school: "TRINITY",
    submissionDeadlineAt: null,
    applicationType: "NEW",
    round: {
      academicYear: "2026/27",
      closeDate: new Date("2026-09-30T00:00:00.000Z"),
      defaultSubmissionDeadlineNew: null,
      defaultSubmissionDeadlineRolling: null,
    },
    leadApplicant: { firstName: "Pat", lastName: "Smith", email: "pat@example.test" },
    ...overrides,
  };
}

describe("isBulkResolvable", () => {
  it("accepts a template using only fields in RESOLVABLE_BULK_FIELDS", () => {
    expect(isBulkResolvable(["applicant_name", "child_name", "reference"])).toBe(true);
    expect(isBulkResolvable([...RESOLVABLE_BULK_FIELDS])).toBe(true);
  });

  it("accepts an empty merge field list", () => {
    expect(isBulkResolvable([])).toBe(true);
  });

  it("rejects a template using registration_link (invite-only field)", () => {
    expect(isBulkResolvable(["applicant_name", "registration_link"])).toBe(false);
  });

  it("rejects a template using any field outside the resolvable set", () => {
    expect(isBulkResolvable(["round_year"])).toBe(false);
  });
});

describe("buildBulkMergeData", () => {
  it("resolves applicant_name from first/last name", () => {
    const data = buildBulkMergeData(makeApp());
    expect(data.applicant_name).toBe("Pat Smith");
  });

  it("falls back to email when both name parts are missing", () => {
    const data = buildBulkMergeData(
      makeApp({ leadApplicant: { firstName: null, lastName: null, email: "pat@example.test" } })
    );
    expect(data.applicant_name).toBe("pat@example.test");
  });

  it("renders school as a full label", () => {
    expect(buildBulkMergeData(makeApp({ school: "TRINITY" })).school).toBe("Trinity School");
    expect(buildBulkMergeData(makeApp({ school: "WHITGIFT" })).school).toBe("Whitgift School");
  });

  it("passes through reference, child_name, and academic_year verbatim", () => {
    const data = buildBulkMergeData(makeApp());
    expect(data.reference).toBe("TRI-2026-0001");
    expect(data.child_name).toBe("Jamie Smith");
    expect(data.academic_year).toBe("2026/27");
  });

  it("uses the round close date (end of day) when there is no per-application override", () => {
    const data = buildBulkMergeData(
      makeApp({
        submissionDeadlineAt: null,
        round: {
          academicYear: "2026/27",
          closeDate: new Date(2026, 8, 30),
          defaultSubmissionDeadlineNew: null,
      defaultSubmissionDeadlineRolling: null,
        },
      })
    );
    expect(data.deadline).toBe("30/09/2026");
  });

  it("prefers the per-application submissionDeadlineAt override over the round close date", () => {
    const data = buildBulkMergeData(
      makeApp({
        submissionDeadlineAt: new Date(2026, 10, 15),
        round: {
          academicYear: "2026/27",
          closeDate: new Date(2026, 8, 30),
          defaultSubmissionDeadlineNew: null,
      defaultSubmissionDeadlineRolling: null,
        },
      })
    );
    expect(data.deadline).toBe("15/11/2026");
  });
});
