"use client";

/**
 * UploadEndpoints — React context that lets the admin edit-on-behalf layout
 * point the portal FileUpload widget at the staff document endpoints (CR-001).
 *
 * Two transports exist, and the widget supports both:
 *
 *   - **presigned** (the applicant portal default, A1) — three steps:
 *     `POST {signUrl}` → client PUTs the bytes straight to Supabase Storage →
 *     `POST {confirmUrl}`. The file bytes never transit a Next.js route, which
 *     is what lifts the effective limit off Vercel's ~4.5 MB request-body cap
 *     up to the advertised 20 MB (CF-14).
 *   - **multipart** (the staff edit-on-behalf path) — a single
 *     `POST {uploadUrl}` with `multipart/form-data`. `/api/admin/documents` is
 *     out of A1's scope and still 4.5 MB-capped; staff upload small scans on
 *     the parent's behalf.
 *
 * Without a provider, FileUpload uses the applicant-facing presigned routes, so
 * portal behaviour is unchanged.
 */

import * as React from "react";

export type UploadTransport =
  | {
      kind: "presigned";
      /** POST target that mints a signed upload URL + ticket. */
      signUrl: string;
      /** POST target that verifies the stored bytes and creates the row. */
      confirmUrl: string;
    }
  | {
      kind: "multipart";
      /** POST target for a single multipart/form-data upload. */
      uploadUrl: string;
    };

export interface UploadEndpoints {
  /** How this widget instance moves file bytes to the server. */
  transport: UploadTransport;
  /** Builds the DELETE target for an uploaded document. */
  deleteUrl: (docId: string) => string;
}

const DEFAULT_ENDPOINTS: UploadEndpoints = {
  transport: {
    kind: "presigned",
    signUrl: "/api/documents/sign",
    confirmUrl: "/api/documents/confirm",
  },
  deleteUrl: (id) => `/api/documents/${id}`,
};

const UploadEndpointContext =
  React.createContext<UploadEndpoints>(DEFAULT_ENDPOINTS);

export function UploadEndpointProvider({
  value,
  children,
}: {
  value: UploadEndpoints;
  children: React.ReactNode;
}) {
  return (
    <UploadEndpointContext.Provider value={value}>
      {children}
    </UploadEndpointContext.Provider>
  );
}

/**
 * Returns the upload/delete endpoints FileUpload should target. Defaults to
 * the applicant-facing presigned /api/documents routes when no provider is
 * present.
 */
export function useUploadEndpoints(): UploadEndpoints {
  return React.useContext(UploadEndpointContext);
}
