import { describe, it, expect } from "vitest";
import { uploadControlAccessibleName } from "@/components/portal/file-upload";

/**
 * F12 — the inline upload input had no accessible name.
 *
 * All three `FileUpload` variants render an `sr-only` `<input type="file">`,
 * but only the block and multi-file variants gave theirs a `<label htmlFor>`.
 * The **inline** variant's input had neither a label nor an `aria-label`: only
 * `InlineDropButton` beside it carried one, and a button next to an input does
 * not name the input. A screen-reader user reaching that input directly — by
 * form-controls navigation rather than by tabbing to the button — was told
 * nothing about what it uploads.
 *
 * Parent-facing, and it sits on the spreadsheet-style income grid, which is the
 * densest upload surface in the portal.
 *
 * The render is not testable here (no jsdom, no RTL), so the seam is the name
 * derivation — now shared by all three variants, which is what stops a fourth
 * from repeating the omission silently.
 */
describe("uploadControlAccessibleName — F12", () => {
  it("names the control after the document it uploads", () => {
    expect(uploadControlAccessibleName("Council tax letter")).toBe(
      "Upload Council tax letter"
    );
  });

  it("is never blank, whatever it is handed", () => {
    // `label` is typed `string`, but callers build it from slot metadata, so an
    // empty one is reachable without a type error — and an empty accessible
    // name is the very defect this WP closes.
    for (const label of ["", "   ", "\t\n"]) {
      const name = uploadControlAccessibleName(label);
      expect(name.trim().length, `label ${JSON.stringify(label)}`)
        .toBeGreaterThan(0);
    }
  });

  it("falls back to a generic but meaningful name for an empty label", () => {
    expect(uploadControlAccessibleName("")).toBe("Upload a file");
  });

  it("survives a non-string arriving from untyped JSONB-shaped data", () => {
    const bad = [null, undefined, 42, {}] as unknown[];
    for (const value of bad) {
      expect(() =>
        uploadControlAccessibleName(value as string)
      ).not.toThrow();
      expect(
        uploadControlAccessibleName(value as string).trim().length
      ).toBeGreaterThan(0);
    }
  });

  it("trims, so a padded label does not produce a ragged name", () => {
    expect(uploadControlAccessibleName("  P60 Parent 1  ")).toBe(
      "Upload P60 Parent 1"
    );
  });

  it("gives every variant the SAME name for the same label", () => {
    // The block variant's drop zone, the inline variant's button and the
    // inline variant's label all call this one function, so they cannot drift
    // — and no variant can end up with no name at all.
    const label = "Bank statement — current account";
    const fromDropZone = uploadControlAccessibleName(label);
    const fromInlineButton = uploadControlAccessibleName(label);
    const fromInlineLabel = uploadControlAccessibleName(label);
    expect(fromDropZone).toBe(fromInlineButton);
    expect(fromInlineButton).toBe(fromInlineLabel);
  });
});
