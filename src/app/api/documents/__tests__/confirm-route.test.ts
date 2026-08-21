import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A1 — `POST /api/documents/confirm`, step 3 of the presigned upload flow.
 *
 * This is where the magic-byte sniff lives now (docs/security-audit.md §2.10 —
 * a standing requirement). Moving the file bytes off the API route must not
 * lose that property, so the tests that matter most here are the rejection
 * paths: a spoofed file must be refused AND its orphaned Storage object
 * deleted, because with the presigned transport the bytes are already in the
 * bucket by the time we get to look at them.
 *
 * Boundary mocks: auth, the RLS context runners and the Storage helpers.
 * Ticket verification, `authorizeDocumentUpload` and `sniffContentType` all run
 * for real.
 */

// ─── Boundary mocks ───────────────────────────────────────────────────────────

const LEAD = {
  id: "parent-1",
  role: "APPLICANT",
  email: "lead@example.test",
  firstName: "Pat",
  lastName: "Parent",
  phone: null,
};

const SECOND_PARENT = { ...LEAD, id: "parent-2", email: "second@example.test" };

const getCurrentUserMock = vi.fn(async (): Promise<unknown> => LEAD);
vi.mock("@/lib/auth/roles", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth/roles")>("@/lib/auth/roles");
  return { ...actual, getCurrentUser: () => getCurrentUserMock() };
});

let fakeTx: ReturnType<typeof makeFakeTx>;
vi.mock("@/lib/db/prisma", () => ({
  withUserContext: (_u: string, _r: string, fn: (tx: unknown) => unknown) =>
    fn(fakeTx),
  withAdminContext: (fn: (tx: unknown) => unknown) => fn(fakeTx),
}));

vi.mock("@/lib/db/queries/contributors", () => ({
  ensurePrimaryContributor: vi.fn(async () => "contributor-primary"),
}));

const deleteDocumentMock = vi.fn(async () => undefined);
const getStoredObjectInfoMock = vi.fn(async () => ({
  size: 12_000_000 as number | null,
  contentType: "application/pdf" as string | null,
  error: undefined as string | undefined,
}));
const readObjectHeadMock = vi.fn(async () => ({
  bytes: PDF_HEAD as Buffer | null,
  error: undefined as string | undefined,
}));

vi.mock("@/lib/storage/documents", () => ({
  deleteDocument: (...a: unknown[]) =>
    (deleteDocumentMock as (...a: unknown[]) => unknown)(...a),
  getStoredObjectInfo: (...a: unknown[]) =>
    (getStoredObjectInfoMock as (...a: unknown[]) => unknown)(...a),
  readObjectHead: (...a: unknown[]) =>
    (readObjectHeadMock as (...a: unknown[]) => unknown)(...a),
}));

import { POST } from "../confirm/route";
import {
  DIGEST_SAMPLE_BYTES,
  computeContentDigest,
  duplicateUcMessage,
} from "@/lib/documents/content-digest";
import {
  issueUploadTicket,
  type UploadTicketClaims,
} from "@/lib/uploads/upload-ticket";
import type { NextRequest } from "next/server";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** "%PDF-1.7" — a real PDF signature. */
const PDF_HEAD = Buffer.from("%PDF-1.7\n");
/** "<!doctype html…" — an HTML payload, the masquerade the sniff exists to stop. */
const HTML_HEAD = Buffer.from("<!doctype html><script>alert(1)</script>");

const PRIMARY_PATH = "documents/app-1/BIRTH_CERTIFICATE/uuid_cert.pdf";
const SECONDARY_PATH =
  "documents/app-1/secondary/BIRTH_CERTIFICATE/uuid_cert.pdf";

const PRIMARY_CLAIMS: UploadTicketClaims = {
  sub: "parent-1",
  applicationId: "app-1",
  slot: "BIRTH_CERTIFICATE",
  storagePath: PRIMARY_PATH,
  filename: "cert.pdf",
  mime: "application/pdf",
  ns: "primary",
};

function makeFakeTx(
  overrides: {
    formStatus?: string;
    leadApplicantId?: string;
    contributor?: { id: string; role: string } | null;
    /** Rows the CF-28 digest lookup finds on this application. */
    digestMatches?: { id: string; slot: string; filename: string }[];
    /** Legacy NULL-digest UC rows the CG-09 heal query finds. */
    undigestedUcDocs?: {
      id: string;
      slot: string;
      filename: string;
      storagePath: string;
      fileSize: number;
    }[];
  } = {}
) {
  return {
    application: {
      findUnique: vi.fn(async () => ({
        id: "app-1",
        leadApplicantId: overrides.leadApplicantId ?? "parent-1",
        formStatus: overrides.formStatus ?? "IN_PROGRESS",
      })),
    },
    applicationContributor: {
      findUnique: vi.fn(async () =>
        overrides.contributor === undefined
          ? { id: "contributor-primary", role: "PRIMARY" }
          : overrides.contributor
      ),
    },
    // Epic 15 P1: the paused-window exemption reads these when the
    // application is SUBMITTED; defaults = no assessment / no request.
    assessment: {
      findUnique: vi.fn(async () => null),
    },
    auditLog: {
      findFirst: vi.fn(async () => null),
    },
    document: {
      // Two shapes of lookup share findMany: the digest-equality match and
      // the CG-09 heal query for legacy rows (`contentDigest: null`).
      findMany: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          where.contentDigest === null
            ? overrides.undigestedUcDocs ?? []
            : overrides.digestMatches ?? []
      ),
      update: vi.fn(
        async ({ data }: { data: Record<string, unknown> }) => data
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "doc-1",
        isVerified: false,
        uploadedAt: "2026-08-14T10:00:00.000Z",
        ...data,
      })),
    },
  };
}

function confirmRequest(uploadTicket: unknown): NextRequest {
  return new Request("http://localhost/api/documents/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadTicket }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  getCurrentUserMock.mockResolvedValue(LEAD);
  fakeTx = makeFakeTx();
  getStoredObjectInfoMock.mockResolvedValue({
    size: 12_000_000,
    contentType: "application/pdf",
    error: undefined,
  });
  readObjectHeadMock.mockResolvedValue({ bytes: PDF_HEAD, error: undefined });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/documents/confirm", () => {
  it("rejects an unauthenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(401);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("creates the Document row for a verified 12 MB PDF", async () => {
    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: "doc-1",
      applicationId: "app-1",
      slot: "BIRTH_CERTIFICATE",
      filename: "cert.pdf",
      mimeType: "application/pdf",
      fileSize: 12_000_000,
      storagePath: PRIMARY_PATH,
      uploadedBy: "parent-1",
      isVerified: false,
    });
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it("tags a SECONDARY contributor's document with their contributor id", async () => {
    getCurrentUserMock.mockResolvedValue(SECOND_PARENT);
    fakeTx = makeFakeTx({
      leadApplicantId: "parent-1",
      contributor: { id: "contributor-secondary", role: "SECONDARY" },
    });

    const response = await POST(
      confirmRequest(
        issueUploadTicket({
          ...PRIMARY_CLAIMS,
          sub: "parent-2",
          storagePath: SECONDARY_PATH,
          ns: "secondary",
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.storagePath).toBe(SECONDARY_PATH);
    expect(body.uploadedByContributorId).toBe("contributor-secondary");
  });

  it("415s a spoofed file and deletes the orphaned object", async () => {
    // An HTML payload uploaded as `application/pdf`. Nothing before this point
    // can see it: the filename, the declared MIME and the stored Content-Type
    // all say PDF. Only the bytes give it away.
    readObjectHeadMock.mockResolvedValue({ bytes: HTML_HEAD, error: undefined });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error).toMatch(/Unsupported file type/);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("415s when the bytes are a valid type OTHER than the declared one", async () => {
    // A real PNG declared as a PDF — sniffs fine on its own, but it is not what
    // was allowlisted, so the Document row would carry the wrong mimeType.
    readObjectHeadMock.mockResolvedValue({
      bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      error: undefined,
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(415);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
  });

  it("415s when the stored Content-Type is not the one declared at sign time", async () => {
    // The direct PUT lets the client choose this header, and documents are
    // served inline by default — a stored text/html would be a stored XSS.
    getStoredObjectInfoMock.mockResolvedValue({
      size: 1024,
      contentType: "text/html",
      error: undefined,
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(415);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("413s when the stored bytes exceed 20 MB despite a smaller declared size", async () => {
    getStoredObjectInfoMock.mockResolvedValue({
      size: 25 * 1024 * 1024,
      contentType: "application/pdf",
      error: undefined,
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe(
      "That file couldn't be uploaded — it may be too large. Maximum 20 MB."
    );
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
  });

  it("rejects a forged ticket without touching Storage", async () => {
    const response = await POST(confirmRequest("not.a.real.ticket"));

    expect(response.status).toBe(400);
    expect(getStoredObjectInfoMock).not.toHaveBeenCalled();
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("forbids presenting someone else's ticket", async () => {
    getCurrentUserMock.mockResolvedValue(SECOND_PARENT);
    fakeTx = makeFakeTx({
      leadApplicantId: "parent-1",
      contributor: { id: "contributor-secondary", role: "SECONDARY" },
    });

    // A valid ticket, but issued to parent-1.
    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(403);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("forbids confirming into a namespace the caller no longer owns", async () => {
    // The ticket claims the PRIMARY namespace, but the caller now resolves as
    // SECONDARY — their contributor role changed between sign and confirm.
    getCurrentUserMock.mockResolvedValue(LEAD);
    fakeTx = makeFakeTx({
      leadApplicantId: "someone-else",
      contributor: { id: "contributor-secondary", role: "SECONDARY" },
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(403);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("refuses to attach a document to an application submitted mid-upload", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED" });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(409);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("410s an expired ticket", async () => {
    const staleTicket = issueUploadTicket(
      PRIMARY_CLAIMS,
      Date.now() - 60 * 60 * 1000
    );

    const response = await POST(confirmRequest(staleTicket));

    expect(response.status).toBe(410);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("404s when the client never actually uploaded the bytes", async () => {
    getStoredObjectInfoMock.mockResolvedValue({
      size: null,
      contentType: null,
      error: "Object not found",
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(404);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("deletes the orphaned object when the Document row cannot be written", async () => {
    fakeTx.document.create.mockRejectedValue(new Error("db down"));

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(500);
    expect(deleteDocumentMock).toHaveBeenCalledWith(PRIMARY_PATH);
  });
});

// ─── CF-28 — duplicate detection ──────────────────────────────────────────────

/** A ticket for one of the three monthly Universal Credit slots. */
const UC_CLAIMS: UploadTicketClaims = {
  ...PRIMARY_CLAIMS,
  slot: "UC_MONTHLY_2_PARENT_1",
  storagePath: "documents/app-1/UC_MONTHLY_2_PARENT_1/uuid_uc.pdf",
  filename: "uc-march.pdf",
};

describe("POST /api/documents/confirm — duplicate detection (CF-28)", () => {
  it("stores a digest computed from the bytes the sniff already read", async () => {
    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.contentDigest).toBe(
      computeContentDigest(PDF_HEAD, 12_000_000)
    );

    // THE point of the design: the object is pulled back exactly once, and that
    // one read asks for the digest sample (not a second, larger download).
    expect(readObjectHeadMock).toHaveBeenCalledTimes(1);
    expect(readObjectHeadMock).toHaveBeenCalledWith(
      PRIMARY_PATH,
      DIGEST_SAMPLE_BYTES
    );
  });

  it("folds the stored size into the digest, so equal heads of different sizes differ", () => {
    expect(computeContentDigest(PDF_HEAD, 1_000)).not.toBe(
      computeContentDigest(PDF_HEAD, 2_000)
    );
  });

  it("409s the same file uploaded into a second UC slot, naming the clash, and deletes the orphan", async () => {
    // Exactly Charlotte's case: one UC payment PDF used for every month.
    fakeTx = makeFakeTx({
      digestMatches: [
        { id: "doc-earlier", slot: "UC_MONTHLY_1_PARENT_1", filename: "uc.pdf" },
      ],
    });

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(duplicateUcMessage("uc.pdf"));
    expect(body.duplicateOf).toEqual({
      slot: "UC_MONTHLY_1_PARENT_1",
      filename: "uc.pdf",
    });
    expect(deleteDocumentMock).toHaveBeenCalledWith(UC_CLAIMS.storagePath);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("409s when the duplicate hides behind a legacy NULL-digest UC document (CG-09)", async () => {
    // Charlotte's 16 Aug repro: "Dec 2025 UC.pdf" was uploaded before the
    // digest column existed (content_digest NULL, so digest equality can never
    // see it), then re-uploaded into a second UC slot and accepted. The heal
    // path must digest the legacy row on the fly, persist it, and refuse.
    const legacyPath = "documents/app-1/UC_MONTHLY_PARENT_1/uuid_legacy.pdf";
    fakeTx = makeFakeTx({
      undigestedUcDocs: [
        {
          id: "doc-legacy",
          slot: "UC_MONTHLY_PARENT_1",
          filename: "Dec 2025 UC.pdf",
          storagePath: legacyPath,
          fileSize: 12_000_000, // same size + same head bytes = same digest
        },
      ],
    });

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe(duplicateUcMessage("Dec 2025 UC.pdf"));
    // The legacy row is healed in place so this branch never runs again.
    expect(fakeTx.document.update).toHaveBeenCalledWith({
      where: { id: "doc-legacy" },
      data: { contentDigest: computeContentDigest(PDF_HEAD, 12_000_000) },
    });
    expect(deleteDocumentMock).toHaveBeenCalledWith(UC_CLAIMS.storagePath);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("heals a non-matching legacy UC row and still accepts the upload", async () => {
    fakeTx = makeFakeTx({
      undigestedUcDocs: [
        {
          id: "doc-legacy",
          slot: "UC_MONTHLY_1_PARENT_1",
          filename: "Nov 2025 UC.pdf",
          storagePath: "documents/app-1/UC_MONTHLY_1_PARENT_1/uuid_nov.pdf",
          fileSize: 5_000, // different size → different digest → no clash
        },
      ],
    });

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));

    expect(response.status).toBe(201);
    expect(fakeTx.document.update).toHaveBeenCalledWith({
      where: { id: "doc-legacy" },
      data: { contentDigest: computeContentDigest(PDF_HEAD, 5_000) },
    });
    expect(fakeTx.document.create).toHaveBeenCalled();
  });

  it("allows re-uploading the same file into the SAME UC slot (replace)", async () => {
    fakeTx = makeFakeTx({
      digestMatches: [
        // Same slot as UC_CLAIMS — a replace, not a month faked twice.
        { id: "doc-same", slot: "UC_MONTHLY_2_PARENT_1", filename: "uc.pdf" },
      ],
    });

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.duplicateWarning).toContain("uc.pdf");
    expect(fakeTx.document.create).toHaveBeenCalled();
  });

  it("fails closed when the duplicate lookup fails on a UC slot", async () => {
    // On the UC slots the check is a gate (CG-09): a broken lookup must not
    // silently accept — that is exactly the acceptance Charlotte reported.
    fakeTx = makeFakeTx();
    fakeTx.document.findMany.mockRejectedValue(new Error("lookup exploded"));

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));

    expect(response.status).toBe(500);
    expect(deleteDocumentMock).toHaveBeenCalledWith(UC_CLAIMS.storagePath);
    expect(fakeTx.document.create).not.toHaveBeenCalled();
  });

  it("only ever compares digests within the one application, never across", async () => {
    await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));

    // Equality on a non-null digest is also what makes legacy rows (content_digest
    // NULL, no backfill) inert: SQL equality never matches NULL, so a
    // pre-CF-28 document can neither block nor warn about a new upload.
    expect(fakeTx.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          applicationId: "app-1",
          contentDigest: computeContentDigest(PDF_HEAD, 12_000_000),
        },
      })
    );
  });

  it("accepts a UC upload whose only digest match sits outside the UC slots", async () => {
    // One benefits letter can genuinely evidence two lines — warn, never block.
    fakeTx = makeFakeTx({
      digestMatches: [
        {
          id: "doc-hb",
          slot: "HOUSING_BENEFIT_PARENT_1",
          filename: "benefits-letter.pdf",
        },
      ],
    });

    const response = await POST(confirmRequest(issueUploadTicket(UC_CLAIMS)));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.duplicateWarning).toContain("benefits-letter.pdf");
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it("warns but stores a duplicate outside the UC slots", async () => {
    fakeTx = makeFakeTx({
      digestMatches: [
        {
          id: "doc-earlier",
          slot: "COUNCIL_TAX",
          filename: "council-tax.pdf",
        },
      ],
    });

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("doc-1");
    expect(body.duplicateWarning).toContain("council-tax.pdf");
    expect(fakeTx.document.create).toHaveBeenCalled();
  });

  it("carries no warning when nothing matches", async () => {
    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.duplicateWarning).toBeNull();
  });

  it("still stores the document when the duplicate lookup itself fails", async () => {
    // Duplicate detection is a convenience; a failing lookup must not cost an
    // applicant a legitimate upload.
    fakeTx = makeFakeTx();
    fakeTx.document.findMany.mockRejectedValue(new Error("lookup exploded"));

    const response = await POST(
      confirmRequest(issueUploadTicket(PRIMARY_CLAIMS))
    );

    expect(response.status).toBe(201);
    expect(fakeTx.document.create).toHaveBeenCalled();
  });
});
