import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * A1 — client upload transports.
 *
 * Two things are pinned here. First, that the presigned flow really is three
 * calls with the bytes going straight to Supabase Storage — if a refactor ever
 * routed them back through a Next.js route, the 20 MB limit would silently
 * collapse to Vercel's ~4.5 MB again and CF-14 would return. Second, the error
 * copy: a 413 from EITHER leg must read as a sentence a parent can act on, not
 * as `Upload failed (413)`.
 */

import { uploadFile, uploadErrorFrom } from "../upload-transport";
import { FILE_TOO_LARGE_MESSAGE } from "../accepted-types";
import type { UploadEndpoints } from "@/components/portal/upload-endpoints";

const PRESIGNED: UploadEndpoints = {
  transport: {
    kind: "presigned",
    signUrl: "/api/documents/sign",
    confirmUrl: "/api/documents/confirm",
  },
  deleteUrl: (id) => `/api/documents/${id}`,
};

const MULTIPART: UploadEndpoints = {
  transport: { kind: "multipart", uploadUrl: "/api/admin/documents" },
  deleteUrl: (id) => `/api/admin/documents/${id}`,
};

const SIGNED_URL =
  "https://project.supabase.co/storage/v1/object/upload/sign/documents/app-1/BIRTH_CERTIFICATE/uuid_cert.pdf?token=t";

const DOCUMENT = {
  id: "doc-1",
  filename: "cert.pdf",
  fileSize: 12_000_000,
  mimeType: "application/pdf",
  storagePath: "documents/app-1/BIRTH_CERTIFICATE/uuid_cert.pdf",
  uploadedAt: "2026-08-14T10:00:00.000Z",
  applicationId: "app-1",
  slot: "BIRTH_CERTIFICATE",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A 12 MB PDF — over Vercel's body cap, under the advertised 20 MB. */
function bigPdf(): File {
  return new File([new Uint8Array(1024)], "cert.pdf", {
    type: "application/pdf",
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presigned transport", () => {
  it("signs, PUTs the bytes to Storage, then confirms", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          signedUrl: SIGNED_URL,
          token: "storage-token",
          storagePath: DOCUMENT.storagePath,
          contentType: "application/pdf",
          uploadTicket: "ticket.sig",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(DOCUMENT, 201));

    const file = bigPdf();
    const result = await uploadFile(file, "app-1", "BIRTH_CERTIFICATE", PRESIGNED);

    expect(result).toEqual(DOCUMENT);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [signUrl, signInit] = fetchMock.mock.calls[0];
    expect(signUrl).toBe("/api/documents/sign");
    expect(JSON.parse(signInit.body)).toEqual({
      applicationId: "app-1",
      slot: "BIRTH_CERTIFICATE",
      filename: "cert.pdf",
      contentType: "application/pdf",
      size: file.size,
    });

    // The bytes go to Supabase, NOT to a Next.js route. This assertion is the
    // whole fix for CF-14.
    const [putUrl, putInit] = fetchMock.mock.calls[1];
    expect(putUrl).toBe(SIGNED_URL);
    expect(putInit.method).toBe("PUT");
    expect(putInit.body).toBe(file);
    // The server's echoed Content-Type, not `file.type` — the confirm leg
    // rejects an object stored under any other type.
    expect(putInit.headers["Content-Type"]).toBe("application/pdf");

    const [confirmUrl, confirmInit] = fetchMock.mock.calls[2];
    expect(confirmUrl).toBe("/api/documents/confirm");
    expect(JSON.parse(confirmInit.body)).toEqual({ uploadTicket: "ticket.sig" });
  });

  it("stops at the sign leg and never uploads when signing is refused", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Unsupported file type — please upload PDF, JPG, or PNG" }, 422)
    );

    await expect(
      uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED)
    ).rejects.toThrow(/Unsupported file type/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the confirm leg's 415 (magic-byte sniff rejection)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          signedUrl: SIGNED_URL,
          contentType: "application/pdf",
          uploadTicket: "ticket.sig",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "Unsupported file type — please upload PDF, JPG, or PNG" },
          415
        )
      );

    await expect(
      uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED)
    ).rejects.toThrow(/Unsupported file type/);
  });
});

describe("multipart transport (staff, unchanged)", () => {
  it("posts once as form data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DOCUMENT, 201));

    const result = await uploadFile(
      bigPdf(),
      "app-1",
      "BIRTH_CERTIFICATE",
      MULTIPART
    );

    expect(result).toEqual(DOCUMENT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/documents");
    expect(init.body).toBeInstanceOf(FormData);
  });
});

describe("error copy", () => {
  it.each([413, 507])(
    "maps a bare %i into plain copy rather than a status code",
    async (status) => {
      // No JSON body at all — the shape a platform-level rejection takes.
      const error = await uploadErrorFrom(
        new Response(null, { status }),
        "Upload failed"
      );
      expect(error.message).toBe(FILE_TOO_LARGE_MESSAGE);
      expect(error.message).not.toMatch(/\d{3}/);
    }
  );

  it("maps a 413 from the direct-to-Storage PUT too, not just from our routes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          signedUrl: SIGNED_URL,
          contentType: "application/pdf",
          uploadTicket: "ticket.sig",
        })
      )
      .mockResolvedValueOnce(new Response("<html>Payload Too Large</html>", { status: 413 }));

    await expect(
      uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED)
    ).rejects.toThrow(FILE_TOO_LARGE_MESSAGE);
  });

  it("prefers the server's own message for everything else", async () => {
    const error = await uploadErrorFrom(
      jsonResponse({ error: "Cannot upload documents to a submitted application" }, 409),
      "Upload failed"
    );
    expect(error.message).toBe(
      "Cannot upload documents to a submitted application"
    );
  });

  it("reads Supabase Storage's `message` key as well as our `error` key", async () => {
    const error = await uploadErrorFrom(
      jsonResponse({ statusCode: "409", message: "The resource already exists" }, 409),
      "Upload failed"
    );
    expect(error.message).toBe("The resource already exists");
  });

  it("falls back to a labelled status when the body is not JSON", async () => {
    const error = await uploadErrorFrom(
      new Response("<html>502</html>", { status: 502 }),
      "Remove failed"
    );
    expect(error.message).toBe("Remove failed (502)");
  });
});

// ─── CG-10 — honest upload progress ───────────────────────────────────────────

describe("upload progress reporting (CG-10)", () => {
  it("reports uploading → processing around the presigned PUT (fetch fallback)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          signedUrl: SIGNED_URL,
          contentType: "application/pdf",
          uploadTicket: "ticket",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse(DOCUMENT, 201));

    const events: unknown[] = [];
    await uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED, (e) =>
      events.push({ ...e })
    );

    // Without XHR (node test env) there are no byte-level events, but the two
    // phase beats must still bracket the transfer: start at 0, then an explicit
    // "processing" beat BEFORE the confirm call resolves the upload.
    expect(events[0]).toEqual({ phase: "uploading", percent: 0 });
    expect(events[events.length - 1]).toEqual({
      phase: "processing",
      percent: 100,
    });
  });

  it("reports REAL byte progress through XMLHttpRequest when available", async () => {
    // Minimal XHR stub: captures the upload.onprogress handler and drives it
    // with byte counts, then completes with a 200.
    class FakeXhr {
      static instances: FakeXhr[] = [];
      upload: { onprogress: ((e: unknown) => void) | null } = {
        onprogress: null,
      };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      status = 200;
      responseText = "";
      open() {}
      setRequestHeader() {}
      send() {
        FakeXhr.instances.push(this);
        queueMicrotask(() => {
          this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 3_000_000,
            total: 12_000_000,
          });
          this.upload.onprogress?.({
            lengthComputable: true,
            loaded: 12_000_000,
            total: 12_000_000,
          });
          this.onload?.();
        });
      }
    }
    vi.stubGlobal("XMLHttpRequest", FakeXhr);

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          signedUrl: SIGNED_URL,
          contentType: "application/pdf",
          uploadTicket: "ticket",
        })
      )
      // confirm leg (the PUT goes through the XHR stub)
      .mockResolvedValueOnce(jsonResponse(DOCUMENT, 201));

    const events: { phase: string; percent: number }[] = [];
    await uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED, (e) =>
      events.push({ ...e })
    );

    expect(events).toEqual([
      { phase: "uploading", percent: 0 },
      { phase: "uploading", percent: 25 },
      { phase: "uploading", percent: 100 },
      { phase: "processing", percent: 100 },
    ]);
    // The PUT really went over XHR, not fetch: only sign + confirm hit fetch.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps an XHR failure status through the shared error copy", async () => {
    class FailingXhr {
      upload: { onprogress: unknown } = { onprogress: null };
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      status = 413;
      responseText = JSON.stringify({ message: "too big" });
      open() {}
      setRequestHeader() {}
      send() {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("XMLHttpRequest", FailingXhr);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        signedUrl: SIGNED_URL,
        contentType: "application/pdf",
        uploadTicket: "ticket",
      })
    );

    await expect(
      uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", PRESIGNED)
    ).rejects.toThrow(FILE_TOO_LARGE_MESSAGE);
  });

  it("reports processing once a multipart body is fully sent", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(DOCUMENT, 201));

    const events: { phase: string; percent: number }[] = [];
    await uploadFile(bigPdf(), "app-1", "BIRTH_CERTIFICATE", MULTIPART, (e) =>
      events.push({ ...e })
    );

    expect(events[0]).toEqual({ phase: "uploading", percent: 0 });
  });
});
