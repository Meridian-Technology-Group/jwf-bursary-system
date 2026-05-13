/**
 * Server-side magic-byte sniffing for uploaded documents.
 *
 * `file.type` is the browser-supplied Content-Type and is trivially spoofable
 * by a malicious client. To defend against masquerade attacks (e.g. an HTML or
 * SVG payload labelled `application/pdf`), we inspect the first few bytes of
 * the file body and confirm it matches one of the allowed magic signatures.
 *
 * See docs/security-audit.md §2.10.
 */

export type SniffedContentType = "application/pdf" | "image/jpeg" | "image/png";

export interface SniffResult {
  /** Server-verified MIME type, or null when no signature matched. */
  contentType: SniffedContentType | null;
}

/**
 * Inspect the leading bytes of a buffer for a recognised file signature.
 * Returns the matching MIME type or null if the file does not look like any
 * of the allowed types (PDF / JPEG / PNG).
 */
export function sniffContentType(buf: Buffer | Uint8Array): SniffResult {
  if (buf.length < 4) return { contentType: null };

  // PDF: starts with "%PDF-"
  if (
    buf.length >= 5 &&
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 && // F
    buf[4] === 0x2d //   -
  ) {
    return { contentType: "application/pdf" };
  }

  // JPEG: starts with FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { contentType: "image/png" };
  }

  return { contentType: null };
}
