import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A1 — `POST /api/documents/sign`, step 1 of the presigned upload flow.
 *
 * This leg carries every authorisation the old multipart route did, so the
 * tests are aimed at the things that would silently weaken if it drifted:
 * unauthenticated callers, the declared-MIME/size allowlist, and — the one
 * that is easy to get wrong — resolving the SECONDARY namespace from the
 * session rather than from the request.
 *
 * Boundary mocks follow the repo pattern: auth, the RLS context runners and
 * Supabase Storage are mocked; the slot/MIME/size validation and the
 * contributor resolution in `authorizeDocumentUpload` run for real.
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

const uploadDocumentSignedMock = vi.fn(
  async (
    filename: string,
    applicationId: string,
    slot: string,
    options?: { subNamespace?: string }
  ) => {
    const prefix = options?.subNamespace
      ? `documents/${applicationId}/${options.subNamespace}/${slot}`
      : `documents/${applicationId}/${slot}`;
    return {
      target: {
        storagePath: `${prefix}/uuid_${filename}`,
        signedUrl: `https://storage.test/object/upload/sign/${prefix}?token=t`,
        token: "storage-token",
      },
    };
  }
);
vi.mock("@/lib/storage/documents", () => ({
  uploadDocumentSigned: (...args: unknown[]) =>
    (uploadDocumentSignedMock as (...a: unknown[]) => unknown)(...args),
}));

import { POST } from "../sign/route";
import { verifyUploadTicket } from "@/lib/uploads/upload-ticket";
import type { NextRequest } from "next/server";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeFakeTx(
  overrides: {
    formStatus?: string;
    leadApplicantId?: string;
    contributor?: { id: string; role: string } | null;
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
  };
}

function signRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/documents/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_BODY = {
  applicationId: "app-1",
  slot: "BIRTH_CERTIFICATE",
  filename: "birth-certificate.pdf",
  contentType: "application/pdf",
  size: 12_000_000, // 12 MB — well past Vercel's ~4.5 MB body cap
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  getCurrentUserMock.mockResolvedValue(LEAD);
  fakeTx = makeFakeTx();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/documents/sign", () => {
  it("rejects an unauthenticated caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await POST(signRequest(VALID_BODY));

    expect(response.status).toBe(401);
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });

  it("signs a 12 MB PDF — the size the old multipart route could not accept", async () => {
    const response = await POST(signRequest(VALID_BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.signedUrl).toContain("https://storage.test/");
    expect(body.contentType).toBe("application/pdf");
    expect(body.storagePath).toBe(
      "documents/app-1/BIRTH_CERTIFICATE/uuid_birth-certificate.pdf"
    );
  });

  it("seals the server's decisions into the ticket", async () => {
    const response = await POST(signRequest(VALID_BODY));
    const { uploadTicket, storagePath } = await response.json();

    const verified = verifyUploadTicket(uploadTicket);
    expect(verified).toEqual({
      ok: true,
      claims: {
        sub: "parent-1",
        applicationId: "app-1",
        slot: "BIRTH_CERTIFICATE",
        storagePath,
        filename: "birth-certificate.pdf",
        mime: "application/pdf",
        ns: "primary",
      },
    });
  });

  it("puts a SECONDARY contributor's upload in the secondary namespace", async () => {
    // The second parent is not the lead applicant; their role is resolved from
    // their own contributor row, never from the request body.
    getCurrentUserMock.mockResolvedValue(SECOND_PARENT);
    fakeTx = makeFakeTx({
      leadApplicantId: "parent-1",
      contributor: { id: "contributor-secondary", role: "SECONDARY" },
    });

    const response = await POST(signRequest(VALID_BODY));
    const { storagePath, uploadTicket } = await response.json();

    expect(response.status).toBe(200);
    expect(storagePath).toBe(
      "documents/app-1/secondary/BIRTH_CERTIFICATE/uuid_birth-certificate.pdf"
    );
    expect(uploadDocumentSignedMock).toHaveBeenCalledWith(
      "birth-certificate.pdf",
      "app-1",
      "BIRTH_CERTIFICATE",
      { subNamespace: "secondary" }
    );

    const verified = verifyUploadTicket(uploadTicket);
    expect(verified.ok && verified.claims.ns).toBe("secondary");
  });

  it("forbids an applicant who is neither contributor", async () => {
    getCurrentUserMock.mockResolvedValue(SECOND_PARENT);
    fakeTx = makeFakeTx({ leadApplicantId: "parent-1", contributor: null });

    const response = await POST(signRequest(VALID_BODY));

    expect(response.status).toBe(403);
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });

  it("refuses uploads to a submitted application", async () => {
    fakeTx = makeFakeTx({ formStatus: "SUBMITTED" });

    const response = await POST(signRequest(VALID_BODY));

    expect(response.status).toBe(409);
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });

  it("rejects a declared MIME outside the allowlist", async () => {
    const response = await POST(
      signRequest({
        ...VALID_BODY,
        filename: "notes.txt",
        contentType: "text/plain",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/Unsupported file type/);
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });

  it("gives Word documents the convert-to-PDF guidance", async () => {
    const response = await POST(
      signRequest({
        ...VALID_BODY,
        filename: "statement.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toMatch(/Word documents can't be accepted here/);
  });

  it("rejects a declared size over 20 MB with plain copy and a 413", async () => {
    const response = await POST(
      signRequest({ ...VALID_BODY, size: 21 * 1024 * 1024 })
    );
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe(
      "That file couldn't be uploaded — it may be too large. Maximum 20 MB."
    );
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });

  it.each([
    ["../../escape", "path traversal"],
    ["lower_case", "lower case"],
    ["", "empty"],
  ])("rejects the slot %o (%s)", async (slot) => {
    const response = await POST(signRequest({ ...VALID_BODY, slot }));

    expect(response.status).toBe(400);
    expect(uploadDocumentSignedMock).not.toHaveBeenCalled();
  });
});
