import { describe, it, expect, vi } from "vitest";
import { findDuplicateContact } from "../contacts";
import type { Tx } from "@/lib/db/prisma";

/**
 * 14 Nov 2026: the contact identity key is child (name + DOB) AND destination
 * (school + entry year). An Old Palace partner pupil re-applying to Trinity for
 * sixth form is a NEW contact, not a duplicate — so the friendly guard must
 * scope its match to the same school and entry year as the DB unique key.
 */
describe("findDuplicateContact — destination-aware", () => {
  it("matches on child name + DOB + school + entry year", async () => {
    const findFirst = vi.fn(async () => null);
    const tx = { contact: { findFirst } } as unknown as Tx;
    const dob = new Date("2010-11-30");

    await findDuplicateContact(tx, {
      createdBy: "admin-1",
      childName: "A Child",
      childDob: dob,
      school: "TRINITY",
      entryYear: 2027,
      excludeId: "c-1",
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        createdBy: "admin-1",
        childName: "A Child",
        childDob: dob,
        school: "TRINITY",
        entryYear: 2027,
        archivedAt: null,
        id: { not: "c-1" },
      },
    });
  });
});
