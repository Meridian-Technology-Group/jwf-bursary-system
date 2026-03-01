"use client";

/**
 * Document viewer — inline viewer for PDFs and images.
 *
 * - PDFs: rendered in an <iframe> using the pre-signed URL
 * - Images: rendered with <img> and object-fit contain
 * - Zoom controls: fit-to-width, zoom in/out
 * - Download button
 */

import * as React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Loader2,
  FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ViewableDocument {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  fileSize?: number;
}

interface DocumentViewerProps {
  document: ViewableDocument;
  /** Pre-signed URL — fetch from /api/documents/[id]/url before rendering */
  presignedUrl: string | null;
  isLoading?: boolean;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentViewer({
  document,
  presignedUrl,
  isLoading = false,
  className,
}: DocumentViewerProps) {
  const [zoomIndex, setZoomIndex] = React.useState(2); // Default 100%
  const zoom = ZOOM_LEVELS[zoomIndex] ?? 100;

  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1;
  const canZoomOut = zoomIndex > 0;

  const handleFitToWidth = () => setZoomIndex(2); // 100%
  const handleZoomIn = () => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  const handleZoomOut = () => setZoomIndex((i) => Math.max(i - 1, 0));

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-neutral-200 bg-white overflow-hidden",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
        {/* File info */}
        <div className="min-w-0">
          <p
            className="truncate text-sm font-medium text-slate-700"
            title={document.filename}
          >
            {document.filename}
          </p>
          {document.fileSize && (
            <p className="text-xs text-slate-400">{formatFileSize(document.fileSize)}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom controls — only for images */}
          {isImage(document.mimeType) && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleZoomOut}
                disabled={!canZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-[40px] text-center text-xs text-slate-500 tabular-nums">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleZoomIn}
                disabled={!canZoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleFitToWidth}
                aria-label="Fit to width"
              >
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <div className="mx-1 h-5 w-px bg-neutral-200" aria-hidden="true" />
            </>
          )}

          {/* Download */}
          {presignedUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              asChild
            >
              <a
                href={presignedUrl}
                download={document.filename}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Download
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Viewer area */}
      <div className="relative min-h-[400px] flex-1 overflow-auto bg-neutral-100">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className="h-8 w-8 animate-spin text-slate-400"
              aria-hidden="true"
            />
          </div>
        )}

        {!isLoading && !presignedUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
            <FileX className="h-10 w-10" aria-hidden="true" />
            <p className="text-sm">Document not available</p>
          </div>
        )}

        {!isLoading && presignedUrl && isPdf(document.mimeType) && (
          <iframe
            src={presignedUrl}
            title={document.filename}
            className="h-full w-full min-h-[600px]"
            style={{ border: "none" }}
          />
        )}

        {!isLoading && presignedUrl && isImage(document.mimeType) && (
          <div className="flex min-h-[400px] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={presignedUrl}
              alt={document.filename}
              className="max-w-none rounded shadow-sm transition-transform"
              style={{
                width: `${zoom}%`,
                objectFit: "contain",
              }}
            />
          </div>
        )}

        {!isLoading &&
          presignedUrl &&
          !isPdf(document.mimeType) &&
          !isImage(document.mimeType) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
              <FileX className="h-10 w-10" aria-hidden="true" />
              <p className="text-sm">Preview not available for this file type</p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={presignedUrl}
                  download={document.filename}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download file
                </a>
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}
