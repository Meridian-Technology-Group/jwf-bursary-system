import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  canCreateFirstYearApplication,
  createFirstYearApplicationFromSource,
  restartApplicationFromRejection,
  type FirstYearApplicationSource,
  type RejectedApplicationSource,
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

describe("restartApplicationFromRejection (Full Rejection void + recreate)", () => {
  const rejected: RejectedApplicationSource = {
    id: "old-app-1",
    reference: "WS-20262027-0007",
    roundId: "round-1",
    leadApplicantId: "lead-1",
    school: "WHITGIFT",
    childName: "Daniel Adeyemi",
    childDob: null,
    entryYear: 2026,
    entryYearGroup: "Y7",
    contactId: "contact-1",
    isReassessment: false,
    applicationType: "NEW",
    bursaryAccountId: null,
    custodyArrangement: "SOLE",
  };

  function makeRestartTx(opts: {
    onDelete: (arg: unknown) => void;
    onCreate: (data: unknown) => void;
  }) {
    return {
      application: {
        delete: vi.fn(async (arg: unknown) => {
          opts.onDelete(arg);
          return { id: "old-app-1" };
        }),
        create: vi.fn(async ({ data }: { data: unknown }) => {
          opts.onCreate(data);
          return { id: "new-app-1" };
        }),
      },
    } as never;
  }

  beforeEach(() => {
    vi.mocked(ensurePrimaryContributor).mockClear();
  });

  it("deletes the old application, recreates it blank reusing the reference, and ensures a PRIMARY contributor", async () => {
    let deletedArg: unknown = null;
    let created: Record<string, unknown> | null = null;
    const tx = makeRestartTx({
      onDelete: (arg) => {
        deletedArg = arg;
      },
      onCreate: (data) => {
        created = data as Record<string, unknown>;
      },
    });

    const newId = await restartApplicationFromRejection(tx, rejected);

    expect(newId).toBe("new-app-1");
    // Old row hard-deleted by id.
    expect(deletedArg).toEqual({ where: { id: "old-app-1" } });
    // New row reuses the freed reference + carries the child/round identity,
    // starts blank (CREATED), and keeps the application type.
    expect(created).toMatchObject({
      reference: "WS-20262027-0007",
      roundId: "round-1",
      leadApplicantId: "lead-1",
      school: "WHITGIFT",
      childName: "Daniel Adeyemi",
      childDob: null,
      entryYear: 2026,
      contactId: "contact-1",
      isReassessment: false,
      bursaryAccountId: null,
      custodyArrangement: "SOLE",
      formStatus: "CREATED",
      applicationType: "NEW",
    });
    // PRIMARY contributor created for the NEW application.
    expect(ensurePrimaryContributor).toHaveBeenCalledWith(
      tx,
      "new-app-1",
      "lead-1"
    );
  });

  it("carries the bursary account + ROLLING_OVER type for a re-assessment restart", async () => {
    let created: Record<string, unknown> | null = null;
    const tx = makeRestartTx({
      onDelete: () => {},
      onCreate: (data) => {
        created = data as Record<string, unknown>;
      },
    });

    await restartApplicationFromRejection(tx, {
      ...rejected,
      isReassessment: true,
      applicationType: "ROLLING_OVER",
      bursaryAccountId: "acct-9",
    });

    expect(created).toMatchObject({
      isReassessment: true,
      applicationType: "ROLLING_OVER",
      bursaryAccountId: "acct-9",
      formStatus: "CREATED",
    });
  });
});
