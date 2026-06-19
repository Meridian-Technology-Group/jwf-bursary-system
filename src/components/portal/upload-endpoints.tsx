"use client";

/**
 * UploadEndpoints — React context that lets the admin edit-on-behalf layout
 * point the portal FileUpload widget at the staff document endpoints (CR-001).
 *
 * Without a provider, FileUpload falls back to the applicant-facing
 * /api/documents routes, so portal behaviour is unchanged.
 */

import * as React from "react";

export interface UploadEndpoints {
  /** POST target for new document uploads (multipart/form-data). */
  uploadUrl: string;
  /** Builds the DELETE target for an uploaded document. */
  deleteUrl: (docId: string) => string;
}

const DEFAULT_ENDPOINTS: UploadEndpoints = {
  uploadUrl: "/api/documents",
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
 * the applicant-facing /api/documents routes when no provider is present.
 */
export function useUploadEndpoints(): UploadEndpoints {
  return React.useContext(UploadEndpointContext);
}
