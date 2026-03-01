"use client";

/**
 * Assessment Document Panel.
 *
 * Displays uploaded documents as tabs. Overflow tabs collapse into a
 * "More" dropdown. Uses the existing DocumentViewer component.
 * Fetches pre-signed URLs on demand from /api/documents/[id]/url.
 */

import * as React from "react";
import { ChevronDown, FileText } from "lucide-react";
import { DocumentViewer } from "@/components/admin/document-viewer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssessmentDocument {
  id: string;
  slot: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  fileSize: number;
}

interface AssessmentDocPanelProps {
  documents: AssessmentDocument[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a slot key like "p60_parent_1" to a readable label "P60 — Parent 1". */
function formatSlotLabel(slot: string): string {
  return slot
    .split("_")
    .map((part) => {
      // Common abbreviations to keep uppercase
      const upper = ["p60", "p45", "p11d", "isa", "pep", "dla", "esa", "pip"];
      if (upper.includes(part.toLowerCase())) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ")
    .replace(/(\d+)/, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

const MAX_VISIBLE_TABS = 4;

export function AssessmentDocPanel({
  documents,
  className,
}: AssessmentDocPanelProps) {
  const [activeId, setActiveId] = React.useState<string | null>(
    documents[0]?.id ?? null
  );
  const [presignedUrls, setPresignedUrls] = React.useState<
    Record<string, string | null>
  >({});
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const activeDoc = documents.find((d) => d.id === activeId) ?? null;

  // Fetch pre-signed URL when active document changes
  React.useEffect(() => {
    if (!activeId) return;
    if (presignedUrls[activeId] !== undefined) return; // Already fetched or fetching

    let cancelled = false;
    setLoadingId(activeId);
    setPresignedUrls((prev) => ({ ...prev, [activeId]: null }));

    fetch(`/api/documents/${activeId}/url`)
      .then((res) => res.json())
      .then((data: { url?: string }) => {
        if (!cancelled) {
          setPresignedUrls((prev) => ({
            ...prev,
            [activeId]: data.url ?? null,
          }));
          setLoadingId(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPresignedUrls((prev) => ({ ...prev, [activeId]: null }));
          setLoadingId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, presignedUrls]);

  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-slate-200 bg-white text-slate-400",
          className
        )}
      >
        <FileText className="h-12 w-12" aria-hidden="true" />
        <p className="text-sm">No documents uploaded</p>
      </div>
    );
  }

  const visibleDocs = documents.slice(0, MAX_VISIBLE_TABS);
  const overflowDocs = documents.slice(MAX_VISIBLE_TABS);
  const overflowContainsActive =
    activeId !== null && overflowDocs.some((d) => d.id === activeId);

  return (
    <div className={cn("flex h-full flex-col bg-white", className)}>
      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-slate-200 px-2 pt-2 shrink-0 overflow-x-auto">
        {visibleDocs.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setActiveId(doc.id)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              activeId === doc.id
                ? "border-primary-700 text-primary-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            )}
            title={doc.filename}
          >
            {formatSlotLabel(doc.slot)}
          </button>
        ))}

        {/* Overflow dropdown */}
        {overflowDocs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 shrink-0 gap-1 px-2 text-xs font-medium border-b-2 rounded-none",
                  overflowContainsActive
                    ? "border-primary-700 text-primary-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                More
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {overflowDocs.map((doc) => (
                <DropdownMenuItem
                  key={doc.id}
                  onClick={() => setActiveId(doc.id)}
                  className={cn(
                    "text-xs",
                    activeId === doc.id && "font-semibold text-primary-700"
                  )}
                >
                  {formatSlotLabel(doc.slot)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Document viewer */}
      <div className="flex-1 overflow-hidden p-3">
        {activeDoc ? (
          <DocumentViewer
            key={activeDoc.id}
            document={{
              id: activeDoc.id,
              filename: activeDoc.filename,
              mimeType: activeDoc.mimeType,
              storagePath: activeDoc.storagePath,
              fileSize: activeDoc.fileSize,
            }}
            presignedUrl={presignedUrls[activeDoc.id] ?? null}
            isLoading={loadingId === activeDoc.id}
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Select a document to view
          </div>
        )}
      </div>
    </div>
  );
}
