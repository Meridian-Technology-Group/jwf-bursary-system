"use client";

/**
 * WP-10: Document List Client
 *
 * Client component used inside the split-screen document panel.
 * Handles click-to-view: fetches a pre-signed URL and opens the
 * DocumentViewer in a Dialog.
 */

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/admin/document-viewer";
import type { Document } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentListClientProps {
  documents: Document[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentListClient({ documents }: DocumentListClientProps) {
  const [viewerDocId, setViewerDocId] = React.useState<string | null>(null);
  const [presignedUrl, setPresignedUrl] = React.useState<string | null>(null);
  const [urlLoading, setUrlLoading] = React.useState(false);

  const handleView = async (documentId: string) => {
    setViewerDocId(documentId);
    setPresignedUrl(null);
    setUrlLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}/url`);
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        setPresignedUrl(data.url);
      }
    } catch (err) {
      console.error("Failed to get presigned URL:", err);
    } finally {
      setUrlLoading(false);
    }
  };

  const closeViewer = () => {
    setViewerDocId(null);
    setPresignedUrl(null);
  };

  const viewerDocument = documents.find((d) => d.id === viewerDocId);

  return (
    <>
      {/* Document list */}
      <div className="divide-y divide-neutral-100">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
          >
            {/* Verification indicator */}
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {doc.isVerified ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300" />
              )}
            </span>

            {/* Document info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">
                {doc.slot}
              </p>
              <p className="truncate text-[11px] text-slate-400">
                {doc.filename}
              </p>
              {doc.isVerified && (
                <p className="mt-0.5 text-[10px] font-medium text-green-600">
                  Verified
                </p>
              )}
            </div>

            {/* View button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-slate-500 hover:text-primary-700"
              onClick={() => handleView(doc.id)}
            >
              <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
              View
            </Button>
          </div>
        ))}
      </div>

      {/* Document viewer dialog */}
      <Dialog
        open={viewerDocId !== null}
        onOpenChange={(open) => {
          if (!open) closeViewer();
        }}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {viewerDocument?.filename ?? "Document Viewer"}
            </DialogTitle>
          </DialogHeader>

          {urlLoading && (
            <div className="flex h-48 items-center justify-center">
              <Loader2
                className="h-8 w-8 animate-spin text-slate-300"
                aria-hidden="true"
              />
            </div>
          )}

          {!urlLoading && viewerDocument && (
            <DocumentViewer
              document={{
                id: viewerDocument.id,
                filename: viewerDocument.filename,
                mimeType: viewerDocument.mimeType,
                storagePath: viewerDocument.storagePath,
                fileSize: viewerDocument.fileSize,
              }}
              presignedUrl={presignedUrl}
              isLoading={false}
              className="rounded-none border-0 min-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
