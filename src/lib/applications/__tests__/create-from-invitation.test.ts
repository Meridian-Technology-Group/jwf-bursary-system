import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canCreateFirstYearApplication,
  createFirstYearApplicationFromSource,
  type FirstYearApplicationSource,
} from "../create-from-invitation";
import { ensurePrimaryContributor } from "@/lib/db/queries/contributors";

// Mock the collaborators so the test exercises only the lock logic + create
// payload, not the DB.
// D13-1a: the generator is pure and synchronous — no `Tx`, no sequence count.
vi.mock("@/lib/applications/reference", () => ({
  generateApplicationReference: vi.fn(() => "REF-TEST-0001"),
}));
vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => undefined),
}));

const complete: FirstYearApplicationSource = {
  leadApplicantId: "lead-1",
  roundId: "round-1",
  school: "WHITGIFT",
  childName: "Daniel Adeyemi",
  entryYear: 2026,
  entryYearGroup: "Y7",
  contactId: "contact-1",
};

function makeTx(createdSpy: (data: unknown) => void) {
  return {
    round: { findUnique: vi.fn(async () => ({ academicYear: "2026/27" })) },
    application: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        createdSpy(data);
        return { id: "app-1" };
      }),
    },
  } as never;
}

describe("canCreateFirstYearApplication", () => {
  it("true when school + childName + roundId + entryYearGroup all present", () => {
    expect(canCreateFirstYearApplication(complete)).toBe(true);
  });

  it("false when school missing (falls back to onboarding card)", () => {
    expect(
      canCreateFirstYearApplication({ ...complete, school: null })
    ).toBe(false);
  });

  it("false when round missing", () => {
    expect(
      canCreateFirstYearApplication({ ...complete, roundId: null })
    ).toBe(false);
  });

  // Q1 (Brian, 2026-08-14): the applicant can no longer supply an entry
  // year-group anywhere, so the admin-set column is the SOLE source and an
  // application must never be created without one.
  it("false when the entry year group is missing", () => {
    expect(
      canCreateFirstYearApplication({ ...complete, entryYearGroup: null })
    ).toBe(false);
  });
});

describe("createFirstYearApplicationFromSource (D1 locked school/year)", () => {
  let captured: Record<string, unknown> | null;

  beforeEach(() => {
    captured = null;
  });

  it("stamps the LOCKED school, entry-year and contactId from the source", async () => {
    const tx = makeTx((data) => {
      captured = data as Record<string, unknown>;
    });

    const id = await createFirstYearApplicationFromSource(tx, complete);

    expect(id).toBe("app-1");
    expect(captured).toMatchObject({
      school: "WHITGIFT",
      childName: "Daniel Adeyemi",
      entryYear: 2026,
      entryYearGroup: "Y7",
      contactId: "contact-1",
      leadApplicantId: "lead-1",
      roundId: "round-1",
      isReassessment: false,
    });
    // applicationCreateData("NEW") spread → form CREATED, type NEW.
    expect(captured).toMatchObject({
      formStatus: "CREATED",
      applicationType: "NEW",
    });
  });

  // Epic 15 G2 (CH-09): the split child identity + DOB carry from the
  // invitation onto the application; legacy sources without them write null.
  it("carries the split child identity + DOB when the source has them", async () => {
    const tx = makeTx((data) => {
      captured = data as Record<string, unknown>;
    });
    const dob = new Date("2015-03-09T00:00:00.000Z");

    await createFirstYearApplicationFromSource(tx, {
      ...complete,
      childFirstName: "Daniel",
      childLastName: "Adeyemi",
      childDob: dob,
    });

    expect(captured).toMatchObject({
      childName: "Daniel Adeyemi",
      childFirstName: "Daniel",
      childLastName: "Adeyemi",
      childDob: dob,
    });
  });

  it("writes null split fields for a legacy source without them", async () => {
    const tx = makeTx((data) => {
      captured = data as Record<string, unknown>;
    });

    await createFirstYearApplicationFromSource(tx, complete);

    expect(captured).toMatchObject({
      childFirstName: null,
      childLastName: null,
      childDob: null,
    });
  });

  it("writes null entry calendar year when the source omits it (still locked to source)", async () => {
    const tx = makeTx((data) => {
      captured = data as Record<string, unknown>;
    });
    await createFirstYearApplicationFromSource(tx, {
      ...complete,
      entryYear: null,
    });
    expect(captured).toMatchObject({ entryYear: null, entryYearGroup: "Y7" });
  });

  it("throws if required locked fields are absent", async () => {
    const tx = makeTx(() => {});
    await expect(
      createFirstYearApplicationFromSource(tx, { ...complete, school: null })
    ).rejects.toThrow(/missing school/i);
  });

  // An admin-side create without an entry year group is REJECTED (Q1) — the
  // applicant has no way to supply one later, so a null column would silently
  // strip the assessment engine of its schooling-years input.
  it("rejects an admin-side create with no entry year group", async () => {
    const tx = makeTx(() => {});
    await expect(
      createFirstYearApplicationFromSource(tx, {
        ...complete,
        entryYearGroup: null,
      })
    ).rejects.toThrow(/entry year group/i);
  });
});
