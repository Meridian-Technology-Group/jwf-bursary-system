import { describe, it, expect, vi } from "vitest";
import { getAllEmailTemplates } from "../reference-tables";
import type { Tx } from "@/lib/db/prisma";

function makeFakeTx(rows: unknown[]): Tx {
  return {
    emailTemplate: {
      findMany: vi.fn(async () => rows),
    },
  } as unknown as Tx;
}

const systemRow = {
  id: "sys-1",
  type: "CONFIRMATION",
  name: null,
  isSystem: true,
  subject: "Subject",
  body: "Body",
  enabled: true,
  mergeFields: ["applicant_name"],
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const customRow = {
  id: "custom-1",
  type: null,
  name: "Round Opening Reminder",
  isSystem: false,
  subject: "Custom subject",
  body: "Custom body",
  enabled: true,
  mergeFields: ["applicant_name", "child_name"],
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
};

describe("getAllEmailTemplates", () => {
  it("queries with deletedAt: null so soft-deleted custom templates are excluded (Story 9.4)", async () => {
    const tx = makeFakeTx([systemRow]);
    await getAllEmailTemplates(tx);

    expect(tx.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });

  it("maps both system and custom rows, preserving type/name/isSystem", async () => {
    const tx = makeFakeTx([systemRow, customRow]);
    const result = await getAllEmailTemplates(tx);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "sys-1",
      type: "CONFIRMATION",
      name: null,
      isSystem: true,
    });
    expect(result[1]).toMatchObject({
      id: "custom-1",
      type: null,
      name: "Round Opening Reminder",
      isSystem: false,
    });
  });

  it("defaults mergeFields to [] when the stored value isn't an array", async () => {
    const tx = makeFakeTx([{ ...customRow, mergeFields: null }]);
    const result = await getAllEmailTemplates(tx);

    expect(result[0].mergeFields).toEqual([]);
  });
});
