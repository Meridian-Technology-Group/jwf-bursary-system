/**
 * POST /api/documents/sign — step 1 of 3 of the presigned upload flow (A1).
 *
 * Accepts a JSON body describing the file the client is about to upload:
 *   { applicationId, slot, filename, contentType, size }
 *
 * …and returns a single-use Supabase **signed upload URL** the browser PUTs the
 * bytes to directly:
 *   { signedUrl, token, storagePath, contentType, uploadTicket }
 *
 * Why: Vercel caps a serverless request body at ~4.5 MB, so the old multipart
 * `POST /api/documents` 413'd on anything larger while the app advertises
 * 20 MB (CF-14). No config fixes that — the bytes have to stop transiting the
 * route. See `docs/backlog/uat-aug-2026/sprint-01-implementation-plan.md` §5 A1.
 *
 * This leg carries ALL the authorisation the multipart route did — auth,
 * contributor resolution, the SECONDARY namespace rule (resolved server-side
 * from the session, never trusted from the request) — plus the *declared*
 * slot/MIME/size checks. What it cannot do is verify the file's contents,
 * because the bytes never arrive here. That is `/api/documents/confirm`'s job:
 * it reads the leading bytes back out of Storage and runs the magic-byte sniff
 * (docs/security-audit.md §2.10) before any Document row exists.
 *
 * Everything decided here is sealed into an HMAC-signed `uploadTicket` so the
 * confirm leg cannot be pointed at a different object, MIME or namespace.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { uploadDocumentSigned } from "@/lib/storage/documents";
import { authorizeDocumentUpload } from "@/lib/documents/upload-authorization";
import { isValidSlotIdentifier } from "@/lib/documents/slots";
import { issueUploadTicket } from "@/lib/uploads/upload-ticket";
import { logError } from "@/lib/log";
import {
  ACCEPTED_MIME,
  MAX_SIZE_BYTES,
  FILE_TOO_LARGE_MESSAGE,
  isWordDocument,
  UNSUPPORTED_TYPE_MESSAGE,
  WORD_DOCUMENT_MESSAGE,
} from "@/lib/uploads/accepted-types";

/** Guards the Document.filename column and keeps object keys sane. */
const MAX_FILENAME_LENGTH = 255;

interface SignRequestBody {
  applicationId?: unknown;
  slot?: unknown;
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: SignRequestBody;
  try {
    body = (await request.json()) as SignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { applicationId, slot, filename, contentType, size } = body ?? {};

  if (typeof applicationId !== "string" || !applicationId.trim()) {
    return NextResponse.json(
      { error: "applicationId is required" },
      { status: 400 }
    );
  }
  if (typeof slot !== "string" || !isValidSlotIdentifier(slot)) {
    return NextResponse.json({ error: "slot is required" }, { status: 400 });
  }
  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    filename.length > MAX_FILENAME_LENGTH
  ) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }
  if (typeof contentType !== "string" || !contentType.trim()) {
    return NextResponse.json(
      { error: "contentType is required" },
      { status: 400 }
    );
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "size is required" }, { status: 400 });
  }

  // ── Declared-file validation ───────────────────────────────────────────────
  // 413 (not the old route's 422) because this is a payload-size rejection and
  // the client maps 413 from EITHER leg — ours or Supabase's — to one plain
  // sentence. The authoritative size check is in the confirm leg, against the
  // bytes actually stored; this one just fails fast and cheaply.
  if (size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: FILE_TOO_LARGE_MESSAGE }, { status: 413 });
  }
  // Word (item 14, Story 14.2): checked BEFORE the generic allowlist rejection
  // so the parent gets the specific convert-to-PDF guidance rather than the
  // generic message.
  if (isWordDocument(filename, contentType)) {
    return NextResponse.json({ error: WORD_DOCUMENT_MESSAGE }, { status: 422 });
  }
  if (!ACCEPTED_MIME.includes(contentType)) {
    return NextResponse.json(
      { error: UNSUPPORTED_TYPE_MESSAGE },
      { status: 422 }
    );
  }

  // ── Authorization: resolve the caller's contributor role on this application ─
  const auth = await authorizeDocumentUpload(user, applicationId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ── Mint the signed upload target ──────────────────────────────────────────
  const { target, error: storageError } = await uploadDocumentSigned(
    filename,
    applicationId,
    slot,
    { subNamespace: auth.subNamespace }
  );

  if (storageError || !target) {
    logError("documents/sign", storageError ?? "No signed upload target");
    return NextResponse.json(
      { error: "Could not start the upload. Please try again." },
      { status: 500 }
    );
  }

  const uploadTicket = issueUploadTicket({
    sub: user.id,
    applicationId,
    slot,
    storagePath: target.storagePath,
    filename,
    mime: contentType,
    ns: auth.namespace,
  });

  return NextResponse.json(
    {
      signedUrl: target.signedUrl,
      token: target.token,
      storagePath: target.storagePath,
      // Echoed back so the client PUTs exactly the Content-Type we allowlisted.
      // The confirm leg rejects an object whose stored Content-Type differs.
      contentType,
      uploadTicket,
    },
    { status: 200 }
  );
}
