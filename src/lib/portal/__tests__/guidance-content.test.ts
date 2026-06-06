import { describe, it, expect } from "vitest";
import {
  HOW_TO_APPLY_INTRO,
  HOW_TO_APPLY_FAQS,
  HOW_TO_APPLY_GUIDANCE_NOTES,
  CHECKLIST_UPLOAD_NOTES,
  CHECKLIST_ITEMS,
  BURSARIES_CONTACT_EMAIL,
} from "@/lib/portal/guidance-content";
import {
  TERMS_AND_CONDITIONS_PATH,
  TERMS_AND_CONDITIONS_VERSION,
  TERMS_AND_CONDITIONS_LABEL,
} from "@/lib/portal/terms";

describe("home-page guidance content (Epic 05, feedback #2)", () => {
  it("provides Section 1 intro, FAQs and guidance notes", () => {
    expect(HOW_TO_APPLY_INTRO.length).toBeGreaterThan(0);
    expect(HOW_TO_APPLY_FAQS.length).toBeGreaterThan(0);
    expect(HOW_TO_APPLY_GUIDANCE_NOTES.length).toBeGreaterThan(0);
    for (const faq of HOW_TO_APPLY_FAQS) {
      expect(faq.question.trim().length).toBeGreaterThan(0);
      expect(faq.answer.trim().length).toBeGreaterThan(0);
    }
  });

  it("surfaces the bursaries contact email in the workbook intro", () => {
    expect(BURSARIES_CONTACT_EMAIL).toBe(
      "fees@johnwhitgiftfoundation.org"
    );
  });

  it("provides Section 2 upload notes and a document checklist", () => {
    expect(CHECKLIST_UPLOAD_NOTES.length).toBeGreaterThan(0);
    expect(CHECKLIST_ITEMS.length).toBeGreaterThan(0);
  });

  it("flags identity documents as first-application-only (new vs rolling)", () => {
    const identity = CHECKLIST_ITEMS.find((i) => i.firstApplicationOnly);
    expect(identity).toBeDefined();
    expect(identity?.title.toLowerCase()).toContain("identity");
    // exactly one block is first-application-only — the identity block
    expect(
      CHECKLIST_ITEMS.filter((i) => i.firstApplicationOnly).length
    ).toBe(1);
  });
});

describe("terms & conditions reference (Epic 05, D10)", () => {
  it("points at a static asset under public/legal", () => {
    expect(TERMS_AND_CONDITIONS_PATH).toBe(
      "/legal/terms-and-conditions.pdf"
    );
  });

  it("exposes a non-empty version marker stamped per submission", () => {
    expect(TERMS_AND_CONDITIONS_VERSION.trim().length).toBeGreaterThan(0);
  });

  it("exposes a human label", () => {
    expect(TERMS_AND_CONDITIONS_LABEL.trim().length).toBeGreaterThan(0);
  });
});
