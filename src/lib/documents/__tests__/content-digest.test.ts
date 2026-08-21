/**
 * CF-28 — the upload fingerprint.
 *
 * What matters here is the direction of the errors: the digest must be stable
 * for the same file (or a re-upload is refused for no reason) and must differ
 * whenever the bytes or the size differ (or three distinct monthly statements
 * collapse into one).
 */
import { describe, it, expect } from "vitest";
import {
  DIGEST_SAMPLE_BYTES,
  duplicateUcMessage,
  computeContentDigest,
  duplicateWarningMessage,
  isUniversalCreditSlot,
} from "@/lib/documents/content-digest";

const head = Buffer.from("%PDF-1.7\nUniversal Credit payment statement\n");

describe("computeContentDigest", () => {
  it("is stable for the same bytes and size", () => {
    expect(computeContentDigest(head, 4096)).toBe(
      computeContentDigest(Buffer.from(head), 4096)
    );
  });

  it("is a hex sha-256", () => {
    expect(computeContentDigest(head, 4096)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when the bytes differ", () => {
    expect(computeContentDigest(head, 4096)).not.toBe(
      computeContentDigest(Buffer.from("%PDF-1.7\nA different month\n"), 4096)
    );
  });

  it("differs when only the stored size differs", () => {
    // Two documents from the same generator can share a long common header;
    // folding the exact object length in first keeps them apart.
    expect(computeContentDigest(head, 4096)).not.toBe(
      computeContentDigest(head, 4097)
    );
  });

  it("falls back to the sample length when Storage reports no size", () => {
    expect(computeContentDigest(head, null)).toBe(
      computeContentDigest(head, head.length)
    );
  });

  it("samples enough bytes to reach real content, not just a file header", () => {
    expect(DIGEST_SAMPLE_BYTES).toBeGreaterThanOrEqual(64 * 1024);
  });
});

describe("isUniversalCreditSlot", () => {
  it("covers the statement and every monthly repeat slot", () => {
    for (const slot of [
      "UC_STATEMENT_PARENT_1",
      "UC_MONTHLY_PARENT_2",
      "UC_MONTHLY_1_PARENT_1",
      "UC_MONTHLY_3_PARENT_2",
    ]) {
      expect(isUniversalCreditSlot(slot)).toBe(true);
    }
  });

  it("does not sweep in other benefits evidence", () => {
    for (const slot of [
      "HOUSING_BENEFIT_PARENT_1",
      "OTHER_BENEFITS_PARENT_1",
      "COUNCIL_TAX",
      "BANK_STATEMENT_CURRENT_PARENT_1",
    ]) {
      expect(isUniversalCreditSlot(slot)).toBe(false);
    }
  });
});

describe("applicant-facing copy", () => {
  it("tells the applicant what to do, not what the server found", () => {
    expect(duplicateUcMessage("Dec 2025 UC.pdf")).toMatch(
      /three different monthly/i
    );
    expect(duplicateUcMessage("Dec 2025 UC.pdf")).toContain("Dec 2025 UC.pdf");
    expect(duplicateWarningMessage("uc-march.pdf")).toContain("uc-march.pdf");
  });
});
