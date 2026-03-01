"use client";

/**
 * Document checklist — lists all uploaded documents for an application.
 *
 * - Shows document slot name as label
 * - Green check if verified, grey circle if not
 * - Click Checkbox to toggle verification (calls POST /api/documents/[id]/verify)
 * - Opens inline DocumentViewer on click
 */

import * as React from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

interface DocumentChecklistProps {
  applicationId: string;
  documents: Document[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentChecklist({
  applicationId: _applicationId,
  documents,
}: DocumentChecklistProps) {
  const [verifiedMap, setVerifiedMap] = React.useState<Map<string, boolean>>(
    new Map(documents.map((d) => [d.id, d.isVerified]))
  );
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Viewer state
  const [viewerDocId, setViewerDocId] = React.useState<string | null>(null);
  const [presignedUrl, setPresignedUrl] = React.useState<string | null>(null);
  const [urlLoading, setUrlLoading] = React.useState(false);

  const handleToggleVerified = async (documentId: string) => {
    setTogglingId(documentId);
    try {
      const res = await fetch(`/api/documents/${documentId}/verify`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { isVerified: boolean };
        setVerifiedMap((prev) => {
          const next = new Map(prev);
          next.set(documentId, data.isVerified);
          return next;
        });
      } else {
        console.error("Failed to toggle document verification");
      }
    } catch (err) {
      console.error("Document verify error:", err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleViewDocument = async (documentId: string) => {
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

  const viewerDocument = documents.find((d) => d.id === viewerDocId);

  if (documents.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
          <CardTitle className="text-sm font-semibold text-slate-700">
            Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-neutral-100 p-0">
          {documents.map((doc) => {
            const isVerified = verifiedMap.get(doc.id) ?? doc.isVerified;
            const isToggling = togglingId === doc.id;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 transition-colors"
              >
                {/* Verification status icon */}
                <div className="shrink-0" aria-hidden="true">
                  {isVerified ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                </div>

                {/* Verification checkbox */}
                <div className="shrink-0">
                  {isToggling ? (
                    <Loader2
                      className="h-4 w-4 animate-spin text-slate-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Checkbox
                      checked={isVerified}
                      onCheckedChange={() => handleToggleVerified(doc.id)}
                      aria-label={`Mark ${doc.slot} as ${isVerified ? "unverified" : "verified"}`}
                      className={
                        isVerified
                          ? "border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                          : ""
                      }
                    />
                  )}
                </div>

                {/* Document info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {doc.slot}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {doc.filename}
                  </p>
                </div>

                {/* View button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs text-slate-500 hover:text-primary-700"
                  onClick={() => handleViewDocument(doc.id)}
                >
                  <ExternalLink className="mr-1 h-3 w-3" aria-hidden="true" />
                  View
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Document viewer dialog */}
      <Dialog
        open={viewerDocId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewerDocId(null);
            setPresignedUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {viewerDocument?.filename ?? "Document viewer"}
            </DialogTitle>
          </DialogHeader>
          {viewerDocument && (
            <DocumentViewer
              document={{
                id: viewerDocument.id,
                filename: viewerDocument.filename,
                mimeType: viewerDocument.mimeType,
                storagePath: viewerDocument.storagePath,
                fileSize: viewerDocument.fileSize,
              }}
              presignedUrl={presignedUrl}
              isLoading={urlLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
