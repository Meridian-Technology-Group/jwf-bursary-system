/**
 * Single source of truth for the document-upload accepted-types allowlist
 * (item 14, Story 14.4). Client-side controls (file-upload.tsx, admin-upload.tsx)
 * and server-side validation (both /api/documents and /api/admin/documents
 * routes) all import from here, so there is exactly one place to update if the
 * allowlist ever changes.
 *
 * `src/lib/storage/sniff.ts` (the magic-byte content sniff) stays separate and
 * authoritative for what a file's BYTES actually are — it doesn't import this
 * module — but its allowed signature set (PDF/JPEG/PNG) must be kept in sync
 * with ACCEPTED_MIME here by hand; see the cross-reference comment there.
 *
 * Plain data/functions only — no "use client"/"use server" directive, no env
 * access — so this is safe to import from both client components and server
 * route handlers.
 */

/**
 * Extension → declared-MIME-type map. This is the actual source of truth:
 * ACCEPTED_MIME and ACCEPTED_EXTENSIONS are both derived from it below, so
 * the two can never drift apart from each other.
 */
export const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** Accepted MIME types, deduplicated in first-seen order. */
export const ACCEPTED_MIME: readonly string[] = Array.from(
  new Set(Object.values(EXTENSION_TO_MIME))
);

/** `accept` attribute value for `<input type="file">`. */
export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_TO_MIME)
  .map((ext) => `.${ext}`)
  .join(", ");

/** Human-readable list of accepted formats, for user-facing messages. */
export const ACCEPTED_FORMATS_LABEL = "PDF, JPG, or PNG";

export const MAX_SIZE_MB = 20;
export const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * Plain-English copy for a size/capacity rejection (A1, CF-14).
 *
 * The presigned upload flow has two legs that can fail on size — our own
 * `/api/documents/sign` (declared size) and Supabase Storage itself (actual
 * bytes) — and neither returns a message a parent can act on. Both 413 and 507,
 * from either leg, collapse to this one sentence so nobody ever sees
 * `Upload failed (413)` again.
 */
export const FILE_TOO_LARGE_MESSAGE = `That file couldn't be uploaded — it may be too large. Maximum ${MAX_SIZE_MB} MB.`;

// ─── Word-document detection (Story 14.1/14.2) ─────────────────────────────────

const WORD_MIME = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const WORD_EXTENSION_RE = /\.docx?$/i;

/**
 * True if a file — by its declared/claimed MIME type OR its filename
 * extension — looks like a Word document. Used to surface the specific
 * convert-to-PDF guidance (Story 14.3) instead of the generic
 * unsupported-type message.
 *
 * Best-effort only by design: a Word file renamed to `.pdf` with a spoofed
 * MIME type will NOT be caught here (nothing about it looks like Word) — it
 * instead falls through to the generic allowlist check and, if it slips past
 * that too, is caught by the server's magic-byte sniff (sniff.ts), which is
 * the authoritative check (Story 14.1's last acceptance criterion, Story 14.2
 * notes).
 */
export function isWordDocument(filename: string, mimeType: string): boolean {
  return WORD_MIME.includes(mimeType) || WORD_EXTENSION_RE.test(filename);
}

// ─── Shared user-facing messages ───────────────────────────────────────────────

/** Generic rejection message for anything outside the allowlist (Story 14.4). */
export const UNSUPPORTED_TYPE_MESSAGE = `Unsupported file type — please upload ${ACCEPTED_FORMATS_LABEL}`;

/**
 * Word-specific rejection + convert-to-PDF guidance (Story 14.3). Reused
 * verbatim for both client- and server-triggered rejections so the parent
 * sees the same instructions regardless of which layer caught it.
 */
export const WORD_DOCUMENT_MESSAGE =
  'Word documents can\'t be accepted here. In Word, use File → Save As (or Export) and choose PDF — or print the document and choose "Save as PDF" instead of a printer. Then upload the PDF (or a JPG/PNG photo) instead.';
