import { describe, it, expect } from "vitest";
import {
  ACCEPTED_MIME,
  ACCEPTED_EXTENSIONS,
  ACCEPTED_FORMATS_LABEL,
  EXTENSION_TO_MIME,
  MAX_SIZE_MB,
  MAX_SIZE_BYTES,
  isWordDocument,
  UNSUPPORTED_TYPE_MESSAGE,
  WORD_DOCUMENT_MESSAGE,
} from "../accepted-types";

describe("isWordDocument (item 14, Story 14.1/14.2)", () => {
  it("detects .doc and .docx extensions, case-insensitively", () => {
    expect(isWordDocument("cv.doc", "application/octet-stream")).toBe(true);
    expect(isWordDocument("cv.DOC", "application/octet-stream")).toBe(true);
    expect(isWordDocument("cv.docx", "application/octet-stream")).toBe(true);
    expect(isWordDocument("cv.DOCX", "application/octet-stream")).toBe(true);
  });

  it("detects both Word MIME types regardless of filename/extension", () => {
    expect(isWordDocument("payslip.pdf", "application/msword")).toBe(true);
    expect(
      isWordDocument(
        "payslip.pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
  });

  it("detects a renamed file by MIME type alone when the extension doesn't match", () => {
    // A .docx renamed to look like a PDF, but the browser still reports the
    // real Word MIME type (the un-spoofed case client validation relies on).
    expect(isWordDocument("bank-statement.pdf", "application/msword")).toBe(
      true
    );
  });

  it("does not flag accepted formats as Word documents", () => {
    expect(isWordDocument("payslip.pdf", "application/pdf")).toBe(false);
    expect(isWordDocument("photo.jpg", "image/jpeg")).toBe(false);
    expect(isWordDocument("photo.png", "image/png")).toBe(false);
  });

  it("is best-effort only: a Word file renamed AND MIME-spoofed to .pdf is not caught (relies on the server sniff instead)", () => {
    expect(isWordDocument("bank-statement.pdf", "application/pdf")).toBe(
      false
    );
  });
});

describe("accepted-types module exports (extensions <-> MIME parity, Story 14.4)", () => {
  it("ACCEPTED_MIME contains exactly the distinct values of EXTENSION_TO_MIME", () => {
    const fromMap = new Set(Object.values(EXTENSION_TO_MIME));
    expect(new Set(ACCEPTED_MIME)).toEqual(fromMap);
  });

  it("ACCEPTED_EXTENSIONS lists every extension key in EXTENSION_TO_MIME", () => {
    for (const ext of Object.keys(EXTENSION_TO_MIME)) {
      expect(ACCEPTED_EXTENSIONS).toContain(`.${ext}`);
    }
  });

  it("every extension maps to a MIME type present in ACCEPTED_MIME", () => {
    for (const mime of Object.values(EXTENSION_TO_MIME)) {
      expect(ACCEPTED_MIME).toContain(mime);
    }
  });

  it("MAX_SIZE_BYTES is derived from MAX_SIZE_MB", () => {
    expect(MAX_SIZE_BYTES).toBe(MAX_SIZE_MB * 1024 * 1024);
  });

  it("the generic message names the accepted formats", () => {
    expect(UNSUPPORTED_TYPE_MESSAGE).toContain(ACCEPTED_FORMATS_LABEL);
  });

  it("the Word message gives convert-to-PDF guidance and names accepted formats (Story 14.3)", () => {
    expect(WORD_DOCUMENT_MESSAGE).toMatch(/save as/i);
    expect(WORD_DOCUMENT_MESSAGE).toMatch(/pdf/i);
    expect(WORD_DOCUMENT_MESSAGE).toMatch(/print/i);
    expect(WORD_DOCUMENT_MESSAGE).toMatch(/jpg|png/i);
  });
});
