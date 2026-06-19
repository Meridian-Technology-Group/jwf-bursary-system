import { describe, it, expect } from "vitest";
import {
  consolidateSynopsis,
  CHECKLIST_TAB_ORDER,
  CHECKLIST_TAB_HEADINGS,
  type ChecklistRow,
} from "@/lib/assessment/synopsis";

describe("consolidateSynopsis — Epic 06 backfill / consolidation logic", () => {
  it("returns null when there is no content at all", () => {
    expect(consolidateSynopsis([], null, null)).toBeNull();
    expect(
      consolidateSynopsis(
        [{ tab: "DEBT", notes: "   " }],
        "",
        "  \n "
      )
    ).toBeNull();
  });

  it("emits checklist tabs in canonical order with their headings", () => {
    // Provide rows out of order; expect canonical ordering in output.
    const checklists: ChecklistRow[] = [
      { tab: "FINANCIAL_PROFILE", notes: "fin notes" },
      { tab: "BURSARY_DETAILS", notes: "bursary notes" },
      { tab: "DEBT", notes: "debt notes" },
    ];
    const out = consolidateSynopsis(checklists, null, null);
    expect(out).toBe(
      [
        `## ${CHECKLIST_TAB_HEADINGS.BURSARY_DETAILS}\nbursary notes`,
        `## ${CHECKLIST_TAB_HEADINGS.DEBT}\ndebt notes`,
        `## ${CHECKLIST_TAB_HEADINGS.FINANCIAL_PROFILE}\nfin notes`,
      ].join("\n\n")
    );
  });

  it("preserves ALL non-empty assessor text (no data loss)", () => {
    const checklists: ChecklistRow[] = CHECKLIST_TAB_ORDER.map((tab) => ({
      tab,
      notes: `notes for ${tab}`,
    }));
    const out = consolidateSynopsis(checklists, "fam syn", "rec summary") ?? "";
    // Every distinct source string survives the consolidation.
    for (const tab of CHECKLIST_TAB_ORDER) {
      expect(out).toContain(`notes for ${tab}`);
      expect(out).toContain(CHECKLIST_TAB_HEADINGS[tab]);
    }
    expect(out).toContain("fam syn");
    expect(out).toContain("rec summary");
    expect(out).toContain("## Family Synopsis");
    expect(out).toContain("## Recommendation Summary");
  });

  it("skips blank / whitespace-only checklist notes", () => {
    const checklists: ChecklistRow[] = [
      { tab: "BURSARY_DETAILS", notes: "kept" },
      { tab: "DEBT", notes: "" },
      { tab: "STAFF", notes: "   \n  " },
      { tab: "OTHER_FEES", notes: null },
    ];
    const out = consolidateSynopsis(checklists, null, null);
    expect(out).toBe(`## ${CHECKLIST_TAB_HEADINGS.BURSARY_DETAILS}\nkept`);
  });

  it("ignores unknown tab keys defensively", () => {
    const checklists: ChecklistRow[] = [
      { tab: "BURSARY_DETAILS", notes: "kept" },
      { tab: "SOMETHING_NEW", notes: "should not appear" },
    ];
    const out = consolidateSynopsis(checklists, null, null) ?? "";
    expect(out).toContain("kept");
    expect(out).not.toContain("should not appear");
  });

  it("appends family synopsis then summary after the checklist blocks", () => {
    const checklists: ChecklistRow[] = [
      { tab: "BURSARY_DETAILS", notes: "details" },
    ];
    const out = consolidateSynopsis(checklists, "the family", "the summary");
    expect(out).toBe(
      [
        `## ${CHECKLIST_TAB_HEADINGS.BURSARY_DETAILS}\ndetails`,
        "## Family Synopsis\nthe family",
        "## Recommendation Summary\nthe summary",
      ].join("\n\n")
    );
  });

  it("de-dupes summary when identical to family synopsis", () => {
    const out = consolidateSynopsis([], "same text", "same text");
    expect(out).toBe("## Family Synopsis\nsame text");
    expect(out).not.toContain("Recommendation Summary");
  });

  it("keeps summary when it differs from family synopsis", () => {
    const out = consolidateSynopsis([], "fam", "different");
    expect(out).toContain("## Family Synopsis\nfam");
    expect(out).toContain("## Recommendation Summary\ndifferent");
  });

  it("works with only a recommendation summary (no checklists, no synopsis)", () => {
    const out = consolidateSynopsis([], null, "just a summary");
    expect(out).toBe("## Recommendation Summary\njust a summary");
  });

  it("is idempotent in spirit — re-consolidating its own output is stable shape", () => {
    // Running the helper twice on identical inputs yields identical output.
    const checklists: ChecklistRow[] = [
      { tab: "DEBT", notes: "d" },
      { tab: "STAFF", notes: "s" },
    ];
    const a = consolidateSynopsis(checklists, "f", "su");
    const b = consolidateSynopsis(checklists, "f", "su");
    expect(a).toBe(b);
  });
});
