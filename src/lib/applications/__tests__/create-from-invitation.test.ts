import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canCreateFirstYearApplication,
  createFirstYearApplicationFromSource,
  type FirstYearApplicationSource,
} from "../create-from-invitation";

// Mock the collaborators so the test exercises only the lock logic + create
// payload, not the DB.
vi.mock("@/lib/applications/reference", () => ({
  generateApplicationReference: vi.fn(async () => "REF-TEST-0001"),
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
  it("true when school + childName + roundId all present", () => {
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

  it("writes null entry-year when the source omits it (still locked to source)", async () => {
    const tx = makeTx((data) => {
      captured = data as Record<string, unknown>;
    });
    await createFirstYearApplicationFromSource(tx, {
      ...complete,
      entryYear: null,
      entryYearGroup: null,
    });
    expect(captured).toMatchObject({ entryYear: null, entryYearGroup: null });
  });

  it("throws if required locked fields are absent", async () => {
    const tx = makeTx(() => {});
    await expect(
      createFirstYearApplicationFromSource(tx, { ...complete, school: null })
    ).rejects.toThrow(/missing school/i);
  });
});
