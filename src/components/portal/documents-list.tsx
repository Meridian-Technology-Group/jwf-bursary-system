"use client";

/**
 * Per-document Download control for the first-class `/documents` portal area
 * (PR-8). One row per uploaded document; each row has a Download button that
 * fetches a fresh signed attachment URL from the EXISTING signed-URL route
 * (`/api/documents/[id]/url?download=true`) and navigates to it.
 *
 * No new API: this reuses the same route the admin document viewer downloads
 * through (`document-viewer.tsx:82-101`). The route signs a 5-minute
 * Content-Disposition: attachment URL and returns `{ url, filename, expiresIn }`;
 * authorization (incl. cross-contributor scoping) is enforced there, so a
 * secondary parent's document can never be downloaded by the lead applicant
 * even if its id leaked into this list.
 */

import React from "react";
import { Download, FileText, Loader2 } from "lucide-react";

export interface DocumentRow {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string; // ISO
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

function DownloadButton({ documentId }: { documentId: string }) {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = React.useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/url?download=true`);
      if (!res.ok) return;
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url);
      }
    } finally {
      setDownloading(false);
    }
  }, [documentId, downloading]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {downloading ? "Preparing…" : "Download"}
    </button>
  );
}

/**
 * A single group of documents under one humanised slot heading.
 */
export function DocumentsList({ documents }: { documents: DocumentRow[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((doc) => {
        const meta = [formatFileSize(doc.fileSize), formatUploadedAt(doc.uploadedAt)]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={doc.id}
            className="flex items-center gap-4 px-4 py-3 sm:px-6"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-medium text-slate-800"
                title={doc.filename}
              >
                {doc.filename}
              </p>
              {meta && <p className="mt-0.5 text-xs text-slate-400">{meta}</p>}
            </div>
            <DownloadButton documentId={doc.id} />
          </li>
        );
      })}
    </ul>
  );
}

export default DocumentsList;
