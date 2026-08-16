/**
 * content-digest.ts — the fingerprint that tells three different Universal
 * Credit documents from one document uploaded three times (CF-28).
 *
 * WHY A PREFIX DIGEST, NOT A WHOLE-FILE HASH
 * ------------------------------------------
 * The confirm leg of the presigned upload flow (A1) deliberately does NOT pull
 * the uploaded object back through the API route: the entire point of the
 * presigned transport is that a 20 MB file goes straight to Supabase Storage.
 * It reads only the leading bytes, over a Range request, to run the magic-byte
 * sniff. This module hashes THOSE SAME BYTES — the digest costs no extra read.
 *
 * So the fingerprint is:
 *
 *     sha256( "<exact stored byte length>:" || first DIGEST_SAMPLE_BYTES bytes )
 *
 * The stored length is folded in first, so two files that happen to share a
 * common header but differ in size can never collide, and a truncated re-upload
 * of the same document is not mistaken for the original. 64 KB of a typical
 * benefits PDF is already well into per-document content (page objects, the
 * claimant's figures), not just the generator's boilerplate header.
 *
 * This is a duplicate-detection heuristic, NOT a security control and NOT proof
 * of file identity: it is used to nudge (warn) and, for the UC slots only, to
 * refuse an upload. It is deliberately conservative in the direction that
 * matters — two genuinely different monthly statements would have to agree on
 * their exact byte length AND their first 64 KB to be wrongly refused.
 *
 * Digests are only ever compared WITHIN one application (see the index in
 * 20260814170000_document_content_digest): a fingerprint must never be able to
 * link one family's uploads to another's.
 *
 * Pure module — no DB, no storage, no server-only import — so it is directly
 * unit-testable.
 */

import { createHash } from "node:crypto";

/**
 * How many leading bytes the confirm leg reads. Also the sniff's input (the
 * sniff only ever looks at the first few bytes, so a larger read costs it
 * nothing). 64 KB keeps the Range request cheap while reaching real content.
 */
export const DIGEST_SAMPLE_BYTES = 64 * 1024;

/**
 * Computes the fingerprint for an uploaded object.
 *
 * @param head             The leading bytes already read for the sniff.
 * @param storedByteLength The authoritative object size from Storage metadata;
 *                         falls back to the sample length when unknown.
 */
export function computeContentDigest(
  head: Buffer | Uint8Array,
  storedByteLength: number | null
): string {
  const hash = createHash("sha256");
  hash.update(`${storedByteLength ?? head.length}:`);
  hash.update(head);
  return hash.digest("hex");
}

/**
 * True for the Universal Credit slots (`UC_STATEMENT…`, `UC_MONTHLY_1…`, …).
 *
 * These are the slots where a duplicate is REFUSED rather than merely flagged.
 * CF-28 is precisely this case: the applicant satisfied "3 monthly UC payment
 * documents" by uploading one file three times, and an assessor cannot assess a
 * household's UC income from a single month repeated. Everywhere else a
 * duplicate is plausible enough (one PDF that genuinely evidences two lines)
 * that refusing it would block honest applicants, so it only warns.
 */
export function isUniversalCreditSlot(slot: string): boolean {
  return /^UC_/.test(slot);
}

/**
 * Shown (as an upload error) when a duplicate is refused on a UC slot. Names
 * the clashing upload so the parent can see WHICH file they double-used
 * (CG-09 — the bare "already uploaded" message left Charlotte unsure what
 * clashed with what).
 */
export function duplicateUcMessage(existingFilename: string): string {
  return (
    `This is the same file you already uploaded as “${existingFilename}” ` +
    "for Universal Credit. Please upload three different monthly payment " +
    "documents (one per month), plus your 12-month statement."
  );
}

/** Shown (as a non-blocking notice) when a duplicate is accepted elsewhere. */
export function duplicateWarningMessage(existingFilename: string): string {
  return `This looks like the same file you already uploaded as “${existingFilename}”. That is fine if it genuinely evidences both — otherwise please replace it with the right document.`;
}
