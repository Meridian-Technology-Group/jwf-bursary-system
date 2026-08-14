import { describe, it, expect } from "vitest";
import {
  FAMILY_ID_DOCUMENT_KINDS,
  familyIdDocuments,
  familyIdSlot,
  ilrDocumentIdOf,
  passportDocumentIdOf,
} from "@/lib/portal/family-id-documents";
import { evaluateRules } from "@/lib/portal/document-rules";
import { SECTION_RULES } from "@/lib/portal/section-rules";

/** Gap ids the FAMILY_ID rule set reports for a saved section blob. */
function familyIdGaps(blob: Record<string, unknown>, slots = new Set<string>()) {
  return evaluateRules(
    "FAMILY_ID",
    SECTION_RULES.FAMILY_ID ?? [],
    blob,
    slots
  ).map((g) => g.id);
}

// ─── The regression this file exists for (F2) ─────────────────────────────────
//
// The form used to point the "UK Passport" and "Passport" uploads at ONE slot,
// `FAMILY_ID_PASSPORT_<index>`, while writing two different fields. Because
// `FileUpload` derives its DOM ids from the slot and `ConditionalField` hides
// with CSS rather than unmounting, both controls sat in the DOM with the same
// `id` — and a `<label for>` binds to the FIRST match, so a non-British
// member's passport upload was captured by the hidden UK-passport control and
// disappeared. Two documents that mean different things must never share a slot.

describe("family identity document slots", () => {
  it("gives every document kind its own slot for a given member", () => {
    for (let index = 0; index < 8; index++) {
      const slots = FAMILY_ID_DOCUMENT_KINDS.map((kind) =>
        familyIdSlot(kind, index)
      );
      expect(new Set(slots).size).toBe(FAMILY_ID_DOCUMENT_KINDS.length);
    }
  });

  it("never reuses a slot across members or kinds", () => {
    const slots: string[] = [];
    for (let index = 0; index < 8; index++) {
      for (const kind of FAMILY_ID_DOCUMENT_KINDS) {
        slots.push(familyIdSlot(kind, index));
      }
    }
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("keeps the slot keys already written to storage", () => {
    expect(familyIdSlot("PASSPORT", 0)).toBe("FAMILY_ID_PASSPORT_0");
    expect(familyIdSlot("ILR", 3)).toBe("FAMILY_ID_ILR_3");
  });
});

describe("a non-British family member keeps both identity documents", () => {
  // Levi Amoah: not a British citizen, so he supplies a passport AND evidence
  // of Indefinite Leave to Remain. Both must survive — neither may be swallowed
  // by the other's control.
  const levi = {
    familyMemberName: "Levi Amoah",
    role: "CHILD" as const,
    isBritishCitizen: false,
    passportDocumentId: "doc-passport",
    ilrDocumentId: "doc-ilr",
  };

  it("resolves both documents, distinctly", () => {
    expect(familyIdDocuments(levi)).toEqual({
      PASSPORT: "doc-passport",
      ILR: "doc-ilr",
    });
    expect(passportDocumentIdOf(levi)).toBe("doc-passport");
    expect(ilrDocumentIdOf(levi)).toBe("doc-ilr");
  });

  it("stores them under different slots, so one cannot overwrite the other", () => {
    expect(familyIdSlot("PASSPORT", 0)).not.toBe(familyIdSlot("ILR", 0));
  });

  it("satisfies the submission gate with no gaps left", () => {
    expect(
      familyIdGaps({
        familyMembers: [
          levi,
          {
            familyMemberName: "Ama Amoah",
            role: "GUARDIAN",
            isBritishCitizen: false,
            passportDocumentId: "doc-passport-2",
            ilrDocumentId: "doc-ilr-2",
          },
        ],
      })
    ).toEqual([]);
  });

  it("does not accept the ILR document as a substitute for the passport", () => {
    expect(
      familyIdGaps({
        familyMembers: [{ ...levi, passportDocumentId: undefined }],
      })
    ).toContain("FAMILY_ID:MEMBER_IDENTITY");
  });
});

describe("passports saved before the fix stay reachable", () => {
  it("resolves a passport filed under the legacy ukPassportDocumentId", () => {
    const member = { isBritishCitizen: true, ukPassportDocumentId: "doc-uk" };
    expect(passportDocumentIdOf(member)).toBe("doc-uk");
    expect(familyIdDocuments(member)).toEqual({ PASSPORT: "doc-uk" });
  });

  it("survives a change of citizenship answer", () => {
    // The old form hid the UK-passport control the moment this flipped to
    // false, stranding the document. It must still resolve.
    const member = { isBritishCitizen: false, ukPassportDocumentId: "doc-uk" };
    expect(passportDocumentIdOf(member)).toBe("doc-uk");
  });

  it("prefers the current field once a passport is uploaded through it", () => {
    const member = {
      isBritishCitizen: true,
      ukPassportDocumentId: "doc-uk",
      passportDocumentId: "doc-new",
    };
    expect(passportDocumentIdOf(member)).toBe("doc-new");
  });

  it("still clears the submission gate for a legacy British member", () => {
    expect(
      familyIdGaps({
        familyMembers: [
          { role: "CHILD", isBritishCitizen: true, ukPassportDocumentId: "a" },
          { role: "GUARDIAN", isBritishCitizen: true, ukPassportDocumentId: "b" },
        ],
      })
    ).toEqual([]);
  });

  it("clears it for a British member documented through the single control", () => {
    expect(
      familyIdGaps({
        familyMembers: [
          { role: "CHILD", isBritishCitizen: true, passportDocumentId: "a" },
          { role: "GUARDIAN", isBritishCitizen: true, passportDocumentId: "b" },
        ],
      })
    ).toEqual([]);
  });

  it("ignores empty and non-string values", () => {
    expect(passportDocumentIdOf({ passportDocumentId: "" })).toBeUndefined();
    expect(passportDocumentIdOf({ passportDocumentId: 42 })).toBeUndefined();
    expect(passportDocumentIdOf(null)).toBeUndefined();
    expect(passportDocumentIdOf(undefined)).toBeUndefined();
    expect(familyIdDocuments({})).toEqual({});
  });
});
