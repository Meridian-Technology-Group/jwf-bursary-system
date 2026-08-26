import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F9 — `POST /api/admin/documents` stored a NULL `content_digest`.
 *
 * D2 computed the digest in the presigned **confirm** endpoint only, so the
 * staff edit-on-behalf path wrote nothing. That left the duplicate check blind
 * on one path in both directions, and the second direction is the one that
 * bites: an **applicant's** later upload could not be recognised as a duplicate
 * of a document an **assessor** had already uploaded for them, because the
 * assessor's row had no fingerprint to match against.
 *
 * CF-28 is exactly that shape — one file used to satisfy three monthly UC slots
 * — so a blind spot on either path weakens the only check that catches it.
 *
 * The invariant these tests exist for is **cross-path agreement**: the same
 * bytes at the same stored length must produce the SAME digest whichever route
 * uploaded them. If the two paths ever diverge on sample size or on which
 * length they fold in, duplicate detection fails silently — no error, just a
 * check that stops matching.
 *
 * Boundary mocks follow `confirm-route.test.ts`: auth, the RLS runner and the
 * Storage helper. `computeContentDigest` runs for real, which is the point.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const ADMIN = {
  id: "admin-1",
  role: "ADMIN",
  email: "admin@example.test",
  firstName: "Al",
  lastName: "Admin",
  phone: null,
};

const getCurrentUserMock = vi.fn(async (): Promise<unknown> => ADMIN);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>(
      "@/lib/auth/roles"
    );
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
    requireApplicationAccess: async () => undefined,
  };
});

interface CreatedDoc {
  data: Record<string, unknown>;
}
const created: CreatedDoc[] = [];

const fakeTx = {
  application: {
    findUnique: async () => ({ id: "app-1", reference: "WS-202627-0001" }),
  },
  document: {
    create: async (args: { data: Record<string, unknown> }) => {
      created.push({ data: args.data });
      return { id: "doc-1", ...args.data };
    },
  },
};

vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

vi.mock("@/lib/storage/documents", () => ({
  uploadDocument: async () => ({
    storagePath: "documents/app-1/BIRTH_CERTIFICATE.pdf",
    error: undefined,
  }),
}));

vi.mock("@/lib/audit/log", () => ({ createAuditLog: async () => undefined }));

// ─── Imports under test ───────────────────────────────────────────────────────

import { POST } from "../route";
import {
  DIGEST_SAMPLE_BYTES,
  computeContentDigest,
} from "@/lib/documents/content-digest";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A minimal payload the magic-byte sniff accepts as a PDF. */
function pdfBytes(totalLength: number): Uint8Array {
  const head = Buffer.from("%PDF-1.7\n");
  const buf = Buffer.alloc(totalLength, 0x20);
  head.copy(buf, 0);
  return new Uint8Array(buf);
}

function staffUploadRequest(bytes: Uint8Array, filename = "birth.pdf") {
  const form = new FormData();
  form.set(
    "file",
    new File([bytes as unknown as BlobPart], filename, {
      type: "application/pdf",
    })
  );
  form.set("applicationId", "app-1");
  form.set("slot", "BIRTH_CERTIFICATE");
  return new Request("http://localhost/api/admin/documents", {
    method: "POST",
    body: form,
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  created.length = 0;
  getCurrentUserMock.mockResolvedValue(ADMIN);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/admin/documents — F9: the digest is stored", () => {
  it("no longer writes NULL — a staff upload gets a fingerprint", async () => {
    const bytes = pdfBytes(5_000);
    const response = await POST(staffUploadRequest(bytes));

    expect(response.status).toBe(201);
    expect(created).toHaveLength(1);
    const digest = created[0].data.contentDigest;
    expect(digest, "contentDigest must not be null").toBeTruthy();
    expect(typeof digest).toBe("string");
    // sha256 hex
    expect(digest as string).toMatch(/^[0-9a-f]{64}$/);
  });

  it("agrees with the confirm leg for the same bytes and length", async () => {
    // THE invariant. If the two paths ever disagree on sample size or on which
    // length they fold in, duplicate detection stops matching across paths and
    // says nothing about it.
    const bytes = pdfBytes(5_000);
    await POST(staffUploadRequest(bytes));

    const asConfirmWouldCompute = computeContentDigest(
      Buffer.from(bytes.subarray(0, DIGEST_SAMPLE_BYTES)),
      5_000
    );
    expect(created[0].data.contentDigest).toBe(asConfirmWouldCompute);
  });

  it("gives the same file the same digest whatever it is named", async () => {
    const bytes = pdfBytes(5_000);
    await POST(staffUploadRequest(bytes, "one.pdf"));
    await POST(staffUploadRequest(bytes, "renamed-copy.pdf"));

    expect(created).toHaveLength(2);
    // Renaming is exactly how CF-28's single file satisfied three slots.
    expect(created[0].data.contentDigest).toBe(created[1].data.contentDigest);
  });

  it("distinguishes two files that differ only in length", async () => {
    await POST(staffUploadRequest(pdfBytes(5_000)));
    await POST(staffUploadRequest(pdfBytes(6_000)));

    expect(created).toHaveLength(2);
    // The stored length is folded in first precisely so a truncated re-upload
    // is not mistaken for the original.
    expect(created[0].data.contentDigest).not.toBe(
      created[1].data.contentDigest
    );
  });

  it("digests a file larger than the sample window from its first 64 KB", async () => {
    const bytes = pdfBytes(DIGEST_SAMPLE_BYTES + 10_000);
    await POST(staffUploadRequest(bytes));

    expect(created[0].data.contentDigest).toBe(
      computeContentDigest(
        Buffer.from(bytes.subarray(0, DIGEST_SAMPLE_BYTES)),
        DIGEST_SAMPLE_BYTES + 10_000
      )
    );
  });

  it("still refuses a spoofed file, so the wider 64 KB read did not cost the sniff", async () => {
    // The sniff read grew from 8 bytes to DIGEST_SAMPLE_BYTES so one read
    // serves both. It only ever inspects the leading bytes, so this must be
    // unchanged — a Word/HTML payload claiming to be a PDF is still rejected.
    const html = new Uint8Array(
      Buffer.from("<!doctype html><script>alert(1)</script>")
    );
    const response = await POST(staffUploadRequest(html));

    expect(response.status).toBe(422);
    expect(created).toHaveLength(0);
  });
});
