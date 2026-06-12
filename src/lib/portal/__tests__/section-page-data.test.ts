import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Boundary mocks ───────────────────────────────────────────────────────────

// queries/applications imports the prisma module (client construction +
// withAdminContext); stub it so the loader runs purely against the fake tx.
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: vi.fn(),
  withAdminContext: vi.fn(),
}));

import type { ApplicationSectionType } from "@prisma/client";
import { loadSectionPageData } from "../section-page-data";

const APP_ID = "app-1";
const OWNER_ID = "contrib-1";
const UPLOADED_AT = new Date("2026-06-01T10:00:00.000Z");

// Canned section rows keyed by section type, in the { data, isComplete,
// updatedAt } shape getSectionData selects. The fake tx resolves
// applicationSection.findUnique from this map via the composite where.
function makeFakeTx(rows: Partial<Record<ApplicationSectionType, unknown>>) {
  return {
    applicationSection: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            applicationId_section_ownerContributorId: {
              applicationId: string;
              section: ApplicationSectionType;
              ownerContributorId: string;
            };
          };
        }) => {
          const key = where.applicationId_section_ownerContributorId;
          if (key.applicationId !== APP_ID || key.ownerContributorId !== OWNER_ID) {
            return null;
          }
          const data = rows[key.section];
          if (data === undefined) return null;
          return { data, isComplete: true, updatedAt: new Date("2026-06-02") };
        }
      ),
    },
    document: {
      findMany: vi.fn(async () => [
        {
          id: "doc-1",
          slot: "P1_PAYSLIP",
          filename: "payslip.pdf",
          fileSize: 1024,
          uploadedAt: UPLOADED_AT,
        },
      ]),
    },
  };
}

const PARENT_DETAILS_DATA = {
  isSoleParent: false,
  relationshipStatus: "MARRIED",
  parent1Employment: { status: "EMPLOYED" },
  parent2Employment: { status: "SELF_EMPLOYED" },
  parent1Contact: {
    addressLine1: "1 High Street",
    addressLine2: "Flat 2",
    city: "Croydon",
    postcode: "CR0 1AA",
    country: "United Kingdom",
  },
};

describe("loadSectionPageData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PARENTS_INCOME pulls sole-parent/relationship/employment statuses from PARENT_DETAILS", async () => {
    const tx = makeFakeTx({
      PARENTS_INCOME: { parent1Income: {} },
      PARENT_DETAILS: PARENT_DETAILS_DATA,
    });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "PARENTS_INCOME",
      OWNER_ID
    );
    expect(result.existingSection?.data).toEqual({ parent1Income: {} });
    expect(result.isSoleParent).toBe(false);
    expect(result.relationshipStatus).toBe("MARRIED");
    expect(result.parent1Status).toBe("EMPLOYED");
    expect(result.parent2Status).toBe("SELF_EMPLOYED");
    // Cross-reads not owned by this section stay unset.
    expect(result.childFullName).toBeUndefined();
    expect(result.parent1Address).toBeUndefined();
  });

  it("DEPENDENT_CHILDREN pulls childFullName from CHILD_DETAILS", async () => {
    const tx = makeFakeTx({
      DEPENDENT_CHILDREN: { children: [] },
      CHILD_DETAILS: { childFullName: "Tom Smith" },
    });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "DEPENDENT_CHILDREN",
      OWNER_ID
    );
    expect(result.childFullName).toBe("Tom Smith");
    expect(result.existingSection?.data).toEqual({ children: [] });
  });

  it("CHILD_DETAILS pulls the parent1Contact address from PARENT_DETAILS", async () => {
    const tx = makeFakeTx({
      CHILD_DETAILS: { childFullName: "Tom Smith" },
      PARENT_DETAILS: PARENT_DETAILS_DATA,
    });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "CHILD_DETAILS",
      OWNER_ID
    );
    expect(result.parent1Address).toEqual(PARENT_DETAILS_DATA.parent1Contact);
    expect(result.isSoleParent).toBeUndefined();
  });

  it("DECLARATION pulls isSoleParent from PARENT_DETAILS", async () => {
    const tx = makeFakeTx({
      DECLARATION: { agreed: false },
      PARENT_DETAILS: { ...PARENT_DETAILS_DATA, isSoleParent: true },
    });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "DECLARATION",
      OWNER_ID
    );
    expect(result.isSoleParent).toBe(true);
    // DECLARATION reads only the flag — no employment/relationship spill-over.
    expect(result.relationshipStatus).toBeUndefined();
    expect(result.parent1Status).toBeUndefined();
  });

  it("a plain section returns its own data and the document map, no cross-reads", async () => {
    const tx = makeFakeTx({
      ADDITIONAL_INFO: { additionalNarrative: "hello" },
    });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "ADDITIONAL_INFO",
      OWNER_ID
    );
    expect(result.existingSection?.data).toEqual({
      additionalNarrative: "hello",
    });
    expect(result.documentMap).toEqual({
      "doc-1": {
        id: "doc-1",
        slot: "P1_PAYSLIP",
        filename: "payslip.pdf",
        fileSize: 1024,
        uploadedAt: UPLOADED_AT.toISOString(),
      },
    });
    expect(result.childFullName).toBeUndefined();
    expect(result.isSoleParent).toBeUndefined();
    expect(result.parent1Address).toBeUndefined();
    // Exactly one section read — no cross-section fetch for a plain section.
    expect(tx.applicationSection.findUnique).toHaveBeenCalledTimes(1);
  });

  it("missing cross-section rows degrade to undefined (no throw)", async () => {
    const tx = makeFakeTx({ PARENTS_INCOME: { parent1Income: {} } });
    const result = await loadSectionPageData(
      tx as never,
      APP_ID,
      "PARENTS_INCOME",
      OWNER_ID
    );
    expect(result.isSoleParent).toBeUndefined();
    expect(result.relationshipStatus).toBeUndefined();
    expect(result.parent1Status).toBeUndefined();
    expect(result.parent2Status).toBeUndefined();
  });
});
