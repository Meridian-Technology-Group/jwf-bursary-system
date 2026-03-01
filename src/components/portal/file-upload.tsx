"use client";

/**
 * FileUpload — reusable document upload widget for applicant portal form sections.
 *
 * States:
 *   empty      — dashed drop-zone with "Choose file" button
 *   uploading  — progress bar within card
 *   uploaded   — green success card with filename, size, View / Remove actions
 *   error      — red error card with message and "Try again" button
 *
 * Drag-and-drop uses native HTML5 drag events — no external library.
 */

import * as React from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExistingDocument {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
}

export interface UploadedDocument {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
  applicationId: string;
  slot: string;
}

export interface FileUploadProps {
  /** Document slot identifier (e.g. "BIRTH_CERTIFICATE", "P60_PARENT_1") */
  slot: string;
  /** Human-readable label */
  label: string;
  /** Additional help text shown below the label */
  hint?: string;
  /** The application this document belongs to */
  applicationId: string;
  /** Pre-existing document (from a previous upload) */
  existingDocument?: ExistingDocument;
  /** Called after a successful upload */
  onUploadComplete?: (doc: UploadedDocument) => void;
  /** Called after the document is successfully removed */
  onRemove?: (docId: string) => void;
  /** When true, upload and remove actions are disabled */
  disabled?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
const ACCEPTED_EXTENSIONS = ".pdf, .jpg, .jpeg, .png";
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) {
    return "File too large — maximum 20 MB";
  }
  if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
    return "Unsupported file type — please upload PDF, JPG, or PNG";
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileUpload({
  slot,
  label,
  hint,
  applicationId,
  existingDocument,
  onUploadComplete,
  onRemove,
  disabled = false,
}: FileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  type UploadState = "empty" | "uploading" | "uploaded" | "error";
  const [uploadState, setUploadState] = React.useState<UploadState>(
    existingDocument ? "uploaded" : "empty"
  );
  const [uploadedDoc, setUploadedDoc] = React.useState<
    ExistingDocument | undefined
  >(existingDocument);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [removing, setRemoving] = React.useState(false);

  // Sync external existingDocument prop (e.g. pre-fetched from server)
  React.useEffect(() => {
    if (existingDocument) {
      setUploadedDoc(existingDocument);
      setUploadState("uploaded");
    }
  }, [existingDocument]);

  // ── Upload pipeline ────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      setUploadState("error");
      return;
    }

    setUploadState("uploading");
    setUploadProgress(0);
    setErrorMessage("");

    // Simulate early progress while the request is in-flight
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 85));
    }, 150);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("applicationId", applicationId);
      formData.append("slot", slot);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Upload failed (${response.status})`
        );
      }

      const doc = (await response.json()) as UploadedDocument;
      setUploadedDoc({
        id: doc.id,
        filename: doc.filename,
        fileSize: doc.fileSize,
        uploadedAt: doc.uploadedAt,
      });
      setUploadState("uploaded");
      onUploadComplete?.(doc);
    } catch (err) {
      clearInterval(progressInterval);
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setErrorMessage(message);
      setUploadState("error");
    }
  }

  // ── Remove pipeline ────────────────────────────────────────────────────────

  async function handleRemove() {
    if (!uploadedDoc) return;
    setRemoving(true);

    try {
      const response = await fetch(`/api/documents/${uploadedDoc.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Remove failed (${response.status})`
        );
      }

      onRemove?.(uploadedDoc.id);
      setUploadedDoc(undefined);
      setUploadState("empty");
      // Reset file input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not remove the file.";
      setErrorMessage(message);
      setUploadState("error");
    } finally {
      setRemoving(false);
    }
  }

  // ── View document ──────────────────────────────────────────────────────────

  async function handleView() {
    if (!uploadedDoc) return;
    const response = await fetch(`/api/documents/${uploadedDoc.id}/url`);
    if (response.ok) {
      const { url } = (await response.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  // ── File input handlers ────────────────────────────────────────────────────

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function openFilePicker() {
    if (!disabled) inputRef.current?.click();
  }

  // ── Unique IDs for accessibility ───────────────────────────────────────────

  const inputId = `file-upload-${slot}`;
  const descId = `file-upload-desc-${slot}`;

  // ── Render states ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      {/* Hint */}
      {hint && (
        <p id={descId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}

      {/* Hidden native file input */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        aria-describedby={hint ? descId : undefined}
        disabled={disabled}
        onChange={handleInputChange}
      />

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {uploadState === "empty" && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Upload ${label}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          className={cn(
            "rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 text-center",
            "transition-colors duration-150",
            !disabled &&
              "hover:border-accent-400 hover:bg-accent-50 cursor-pointer",
            isDragOver && "border-accent-400 bg-accent-50",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <UploadCloud
            className="mx-auto mb-3 h-8 w-8 text-neutral-400"
            aria-hidden="true"
          />

          {/* Hide drag-and-drop text on mobile */}
          <p className="hidden text-sm text-slate-500 sm:block">
            Drag and drop your file here, or
          </p>

          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled}
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white",
              "hover:bg-primary-800 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
              "disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            Choose file
          </button>

          <p className="mt-2 text-xs text-slate-400">
            PDF, JPG, or PNG — max 20 MB
          </p>
        </div>
      )}

      {/* ── Uploading state ───────────────────────────────────────────────── */}
      {uploadState === "uploading" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 shrink-0 animate-spin text-accent-600"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700">
                Uploading…
              </p>
              <div
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-accent-600 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {uploadProgress}%
            </span>
          </div>
        </div>
      )}

      {/* ── Uploaded state ────────────────────────────────────────────────── */}
      {uploadState === "uploaded" && uploadedDoc && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <CheckCircle2
            className="h-5 w-5 shrink-0 text-green-600"
            aria-hidden="true"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText
                className="h-4 w-4 shrink-0 text-green-700"
                aria-hidden="true"
              />
              <p
                className="text-sm font-medium text-green-900 truncate"
                title={uploadedDoc.filename}
              >
                {uploadedDoc.filename}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-green-700">
              {formatBytes(uploadedDoc.fileSize)} &middot; Uploaded{" "}
              {new Date(uploadedDoc.uploadedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleView}
              className={cn(
                "flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800",
                "hover:bg-green-100 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              )}
              aria-label={`View ${uploadedDoc.filename}`}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              View
            </button>

            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className={cn(
                  "flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700",
                  "hover:bg-red-50 transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
                  "disabled:pointer-events-none disabled:opacity-60"
                )}
                aria-label={`Remove ${uploadedDoc.filename}`}
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────────── */}
      {uploadState === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3"
        >
          <AlertCircle
            className="h-5 w-5 shrink-0 text-red-600"
            aria-hidden="true"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-900">Upload failed</p>
            {errorMessage && (
              <p className="mt-0.5 text-xs text-red-700">{errorMessage}</p>
            )}
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setUploadState("empty");
                setErrorMessage("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className={cn(
                "shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700",
                "hover:bg-red-100 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              )}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
