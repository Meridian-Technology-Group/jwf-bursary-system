"use client";

/**
 * Document panel for the assessment workspace.
 *
 * Replaces the old modal-based viewer: the selected document renders
 * inline in the left pane, so assessors can keep the document visible
 * while entering data on the right.
 *
 * Controls:
 *  - Dropdown selector listing every document (slot + filename + verified badge)
 *  - Prev/Next buttons with a position counter
 *  - Keyboard shortcuts: [ = previous, ] = next (suppressed while typing)
 *
 * Presigned URLs are cached per-document to avoid re-fetching when
 * hopping between docs.
 */

import * as React from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentViewer } from "@/components/admin/document-viewer";
import { humaniseSlot } from "@/lib/documents/slots";
import type { Document } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentListClientProps {
  documents: Document[];
  /**
   * Dual-parent (PR 5): optional contributor grouping. When the application
   * has a SECONDARY contributor, each document is tagged with the short label
   * of the contributor that uploaded it ("Parent 1" / "Parent 2") so the
   * assessor can tell whose document they are viewing. The primary contributor
   * id is used to resolve NULL-uploader (legacy) documents to "Parent 1".
   * Omit this prop (single-parent applications) to render exactly as before.
   */
  contributorGroups?: {
    /** uploadedByContributorId → short label ("Parent 1" / "Parent 2"). */
    labelByContributorId: Record<string, string>;
    /** Contributor id treated as the owner of NULL-uploader documents. */
    primaryContributorId: string | null;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentListClient({
  documents,
  contributorGroups,
}: DocumentListClientProps) {
  // Resolve a document's contributor group label, or null when not grouping.
  const labelForDoc = React.useCallback(
    (doc: Document): string | null => {
      if (!contributorGroups) return null;
      const { labelByContributorId, primaryContributorId } = contributorGroups;
      const cid = doc.uploadedByContributorId ?? primaryContributorId;
      if (cid && labelByContributorId[cid]) return labelByContributorId[cid];
      // Unknown / unmatched uploader → treat as primary group.
      return primaryContributorId
        ? labelByContributorId[primaryContributorId] ?? null
        : null;
    },
    [contributorGroups]
  );

  // Stable order: group by contributor label (Parent 1 before Parent 2), then
  // alphabetical-by-slot within each group, so prev/next walks one parent's
  // documents then the other. Without grouping this is the prior slot order.
  const sortedDocs = React.useMemo(
    () =>
      [...documents].sort((a, b) => {
        const la = labelForDoc(a);
        const lb = labelForDoc(b);
        if (la && lb && la !== lb) return la.localeCompare(lb);
        return a.slot.localeCompare(b.slot);
      }),
    [documents, labelForDoc]
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(
    sortedDocs[0]?.id ?? null
  );
  const [urlCache, setUrlCache] = React.useState<
    Record<string, string | null>
  >({});
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(new Set());

  const selectedIndex = selectedId
    ? sortedDocs.findIndex((d) => d.id === selectedId)
    : -1;
  const selectedDoc = selectedIndex >= 0 ? sortedDocs[selectedIndex] : null;

  // ── Fetch presigned URL on selection change (cached) ─────────────────────
  React.useEffect(() => {
    if (!selectedId) return;
    if (urlCache[selectedId] !== undefined) return;

    let cancelled = false;
    setLoadingIds((s) => {
      const next = new Set(s);
      next.add(selectedId);
      return next;
    });

    fetch(`/api/documents/${selectedId}/url`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string } | null) => {
        if (cancelled) return;
        setUrlCache((c) => ({ ...c, [selectedId]: data?.url ?? null }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to get presigned URL:", err);
        setUrlCache((c) => ({ ...c, [selectedId]: null }));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingIds((s) => {
          const next = new Set(s);
          next.delete(selectedId);
          return next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, urlCache]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goPrev = React.useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedId(sortedDocs[selectedIndex - 1].id);
    }
  }, [selectedIndex, sortedDocs]);

  const goNext = React.useCallback(() => {
    if (selectedIndex >= 0 && selectedIndex < sortedDocs.length - 1) {
      setSelectedId(sortedDocs[selectedIndex + 1].id);
    }
  }, [selectedIndex, sortedDocs]);

  // Keyboard shortcuts: [ previous, ] next. Skipped while typing.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "[") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "]") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (sortedDocs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <FileText className="h-10 w-10 text-slate-200" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-slate-400">
            No documents uploaded
          </p>
          <p className="mt-0.5 text-xs text-slate-300">
            Documents uploaded by the applicant will appear here
          </p>
        </div>
      </div>
    );
  }

  const presignedUrl = selectedId ? urlCache[selectedId] ?? null : null;
  const isLoading = selectedId ? loadingIds.has(selectedId) : false;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Toolbar: selector + prev/next + counter */}
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2 shrink-0">
        <Select
          value={selectedId ?? undefined}
          onValueChange={(v) => setSelectedId(v)}
        >
          <SelectTrigger
            className="h-8 min-w-0 flex-1 bg-white text-xs"
            aria-label="Select document to view"
          >
            <SelectValue placeholder="Select a document…">
              {selectedDoc && (
                <span className="flex min-w-0 items-center gap-2 text-left">
                  {selectedDoc.isVerified ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-green-500"
                      aria-label="Verified"
                    />
                  ) : (
                    <Circle
                      className="h-3.5 w-3.5 shrink-0 text-slate-300"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate font-medium text-slate-800">
                    {humaniseSlot(selectedDoc.slot)}
                  </span>
                  {labelForDoc(selectedDoc) && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {labelForDoc(selectedDoc)}
                    </span>
                  )}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sortedDocs.map((doc) => (
              <SelectItem key={doc.id} value={doc.id} className="text-xs">
                <span className="flex items-center gap-2">
                  {doc.isVerified ? (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-green-500"
                      aria-label="Verified"
                    />
                  ) : (
                    <Circle
                      className="h-3.5 w-3.5 shrink-0 text-slate-300"
                      aria-hidden="true"
                    />
                  )}
                  <span className="font-medium">{humaniseSlot(doc.slot)}</span>
                  {labelForDoc(doc) && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {labelForDoc(doc)}
                    </span>
                  )}
                  <span className="truncate text-slate-400">
                    · {doc.filename}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={goPrev}
            disabled={selectedIndex <= 0}
            aria-label="Previous document"
            title="Previous document ( [ )"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span
            className="min-w-[44px] text-center text-xs tabular-nums text-slate-500"
            aria-live="polite"
          >
            {selectedIndex + 1} / {sortedDocs.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={goNext}
            disabled={
              selectedIndex < 0 || selectedIndex >= sortedDocs.length - 1
            }
            aria-label="Next document"
            title="Next document ( ] )"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Inline viewer */}
      <div className="flex min-h-0 flex-1">
        {selectedDoc ? (
          <DocumentViewer
            key={selectedDoc.id}
            document={{
              id: selectedDoc.id,
              filename: selectedDoc.filename,
              mimeType: selectedDoc.mimeType,
              storagePath: selectedDoc.storagePath,
              fileSize: selectedDoc.fileSize,
            }}
            presignedUrl={presignedUrl}
            isLoading={isLoading}
            className="h-full w-full rounded-none border-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            Select a document to view
          </div>
        )}
      </div>
    </div>
  );
}
