"use client";

/**
 * FileUpload — reusable document upload widget for applicant portal form sections.
 *
 * Two modes:
 *   - Single-file (default): one upload slot. Value contract is a single
 *     document ID surfaced via `onUploadComplete` / `onRemove`.
 *   - Multi-file (`multiple={true}`): renders a drop-zone PLUS a list of every
 *     successfully uploaded doc, each with its own delete button. New files
 *     are appended to the array of `existingDocuments`. Concurrent uploads
 *     are capped at `MAX_CONCURRENT_UPLOADS`.
 *
 * Single-file states:
 *   empty      — dashed drop-zone with "Choose file" button
 *   uploading  — progress bar within card
 *   uploaded   — green success card with filename, size, View / Remove
 *   error      — red error card with message and "Try again" button
 *
 * Multi-file rendering:
 *   - Always renders the drop-zone (so the user can keep adding files).
 *   - Below the drop-zone: one row per already-uploaded doc (View / Remove).
 *   - Below that: in-flight uploads with per-file progress and per-file errors.
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

interface FileUploadBaseProps {
  /** Document slot identifier (e.g. "BIRTH_CERTIFICATE", "P60_PARENT_1") */
  slot: string;
  /** Human-readable label */
  label: string;
  /** Additional help text shown below the label */
  hint?: string;
  /** The application this document belongs to */
  applicationId: string;
  /** When true, upload and remove actions are disabled */
  disabled?: boolean;
}

export interface SingleFileUploadProps extends FileUploadBaseProps {
  multiple?: false;
  /** Pre-existing document (from a previous upload) */
  existingDocument?: ExistingDocument;
  /** Called after a successful upload */
  onUploadComplete?: (doc: UploadedDocument) => void;
  /** Called after the document is successfully removed */
  onRemove?: (docId: string) => void;
}

export interface MultiFileUploadProps extends FileUploadBaseProps {
  multiple: true;
  /** Pre-existing documents (from previous uploads) */
  existingDocuments?: ExistingDocument[];
  /** Called after each successful upload */
  onUploadComplete?: (doc: UploadedDocument) => void;
  /** Called after a document is successfully removed */
  onRemove?: (docId: string) => void;
}

export type FileUploadProps = SingleFileUploadProps | MultiFileUploadProps;

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
const ACCEPTED_EXTENSIONS = ".pdf, .jpg, .jpeg, .png";
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_CONCURRENT_UPLOADS = 5;

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

async function uploadFile(
  file: File,
  applicationId: string,
  slot: string
): Promise<UploadedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("applicationId", applicationId);
  formData.append("slot", slot);

  const response = await fetch("/api/documents", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Upload failed (${response.status})`
    );
  }

  return (await response.json()) as UploadedDocument;
}

async function deleteDocument(docId: string): Promise<void> {
  const response = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Remove failed (${response.status})`
    );
  }
}

async function openDocumentUrl(docId: string): Promise<void> {
  const response = await fetch(`/api/documents/${docId}/url`);
  if (response.ok) {
    const { url } = (await response.json()) as { url: string };
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileUpload(props: FileUploadProps) {
  if (props.multiple) {
    return <MultiFileUpload {...props} />;
  }
  return <SingleFileUpload {...props} />;
}

// ─── Single-file implementation (unchanged behaviour) ─────────────────────────

function SingleFileUpload({
  slot,
  label,
  hint,
  applicationId,
  existingDocument,
  onUploadComplete,
  onRemove,
  disabled = false,
}: SingleFileUploadProps) {
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

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 85));
    }, 150);

    try {
      const doc = await uploadFile(file, applicationId, slot);
      clearInterval(progressInterval);
      setUploadProgress(100);
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

  async function handleRemove() {
    if (!uploadedDoc) return;
    setRemoving(true);
    try {
      await deleteDocument(uploadedDoc.id);
      onRemove?.(uploadedDoc.id);
      setUploadedDoc(undefined);
      setUploadState("empty");
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

  const inputId = `file-upload-${slot}`;
  const descId = `file-upload-desc-${slot}`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      {hint && (
        <p id={descId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}

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

      {uploadState === "empty" && (
        <DropZone
          label={label}
          disabled={disabled}
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPick={openFilePicker}
        />
      )}

      {uploadState === "uploading" && (
        <UploadingRow progress={uploadProgress} />
      )}

      {uploadState === "uploaded" && uploadedDoc && (
        <UploadedRow
          doc={uploadedDoc}
          disabled={disabled}
          removing={removing}
          onView={() => openDocumentUrl(uploadedDoc.id)}
          onRemove={handleRemove}
        />
      )}

      {uploadState === "error" && (
        <ErrorRow
          message={errorMessage}
          disabled={disabled}
          onRetry={() => {
            setUploadState("empty");
            setErrorMessage("");
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      )}
    </div>
  );
}

// ─── Multi-file implementation ────────────────────────────────────────────────

interface InflightUpload {
  /** Stable local key (not a server ID — the upload hasn't returned yet) */
  key: string;
  filename: string;
  progress: number;
  /** Set once the request resolves with a failure */
  error?: string;
}

function MultiFileUpload({
  slot,
  label,
  hint,
  applicationId,
  existingDocuments,
  onUploadComplete,
  onRemove,
  disabled = false,
}: MultiFileUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [uploadedDocs, setUploadedDocs] = React.useState<ExistingDocument[]>(
    existingDocuments ?? []
  );
  const [inflight, setInflight] = React.useState<InflightUpload[]>([]);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  // Sync external existingDocuments prop (e.g. when documentMap arrives later)
  React.useEffect(() => {
    if (existingDocuments && existingDocuments.length > 0) {
      setUploadedDocs((prev) => {
        // Merge — keep any uploads that aren't already represented externally
        const externalIds = new Set(existingDocuments.map((d) => d.id));
        const localOnly = prev.filter((d) => !externalIds.has(d.id));
        return [...existingDocuments, ...localOnly];
      });
    }
  }, [existingDocuments]);

  async function uploadOne(file: File, key: string) {
    try {
      const doc = await uploadFile(file, applicationId, slot);
      setInflight((prev) => prev.filter((u) => u.key !== key));
      setUploadedDocs((prev) => [
        ...prev,
        {
          id: doc.id,
          filename: doc.filename,
          fileSize: doc.fileSize,
          uploadedAt: doc.uploadedAt,
        },
      ]);
      onUploadComplete?.(doc);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setInflight((prev) =>
        prev.map((u) =>
          u.key === key ? { ...u, error: message, progress: 0 } : u
        )
      );
    }
  }

  async function handleFiles(files: FileList) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // Split into valid and invalid (validation errors surface as in-flight error rows
    // so the user sees which filename failed).
    const accepted: { file: File; key: string }[] = [];
    const rejected: InflightUpload[] = [];

    for (const file of fileList) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const validationError = validateFile(file);
      if (validationError) {
        rejected.push({
          key,
          filename: file.name,
          progress: 0,
          error: validationError,
        });
      } else {
        accepted.push({ file, key });
      }
    }

    if (rejected.length > 0) {
      setInflight((prev) => [...prev, ...rejected]);
    }

    if (accepted.length === 0) return;

    // Register all accepted files in flight before kicking them off so the UI
    // immediately reflects them.
    setInflight((prev) => [
      ...prev,
      ...accepted.map(({ file, key }) => ({
        key,
        filename: file.name,
        progress: 0,
      })),
    ]);

    // Cap concurrency by chunking
    for (let i = 0; i < accepted.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = accepted.slice(i, i + MAX_CONCURRENT_UPLOADS);

      // Animate progress for the batch until requests resolve
      const interval = setInterval(() => {
        setInflight((prev) =>
          prev.map((u) =>
            batch.some((b) => b.key === u.key) && !u.error
              ? { ...u, progress: Math.min(u.progress + 10, 85) }
              : u
          )
        );
      }, 150);

      await Promise.all(batch.map(({ file, key }) => uploadOne(file, key)));
      clearInterval(interval);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove(docId: string) {
    setRemovingId(docId);
    try {
      await deleteDocument(docId);
      setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
      onRemove?.(docId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not remove the file.";
      // Surface as a transient in-flight error row
      setInflight((prev) => [
        ...prev,
        {
          key: `remove-${docId}-${Date.now()}`,
          filename: "Remove failed",
          progress: 0,
          error: message,
        },
      ]);
    } finally {
      setRemovingId(null);
    }
  }

  function dismissInflight(key: string) {
    setInflight((prev) => prev.filter((u) => u.key !== key));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
    }
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  }

  function openFilePicker() {
    if (!disabled) inputRef.current?.click();
  }

  const inputId = `file-upload-${slot}`;
  const descId = `file-upload-desc-${slot}`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      {hint && (
        <p id={descId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        className="sr-only"
        aria-describedby={hint ? descId : undefined}
        disabled={disabled}
        onChange={handleInputChange}
      />

      <DropZone
        label={label}
        disabled={disabled}
        isDragOver={isDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPick={openFilePicker}
        multiple
      />

      {(uploadedDocs.length > 0 || inflight.length > 0) && (
        <ul className="space-y-2 pt-1" aria-label={`${label} — uploaded files`}>
          {uploadedDocs.map((doc) => (
            <li key={doc.id}>
              <UploadedRow
                doc={doc}
                disabled={disabled}
                removing={removingId === doc.id}
                onView={() => openDocumentUrl(doc.id)}
                onRemove={() => handleRemove(doc.id)}
              />
            </li>
          ))}
          {inflight.map((u) =>
            u.error ? (
              <li key={u.key}>
                <ErrorRow
                  message={`${u.filename} — ${u.error}`}
                  disabled={disabled}
                  onRetry={() => dismissInflight(u.key)}
                  retryLabel="Dismiss"
                />
              </li>
            ) : (
              <li key={u.key}>
                <UploadingRow progress={u.progress} filename={u.filename} />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

interface DropZoneProps {
  label: string;
  disabled: boolean;
  isDragOver: boolean;
  multiple?: boolean;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onPick: () => void;
}

function DropZone({
  label,
  disabled,
  isDragOver,
  multiple,
  onDragOver,
  onDragLeave,
  onDrop,
  onPick,
}: DropZoneProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Upload ${label}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
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

      <p className="hidden text-sm text-slate-500 sm:block">
        {multiple
          ? "Drag and drop your files here, or"
          : "Drag and drop your file here, or"}
      </p>

      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className={cn(
          "mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white",
          "hover:bg-primary-800 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          "disabled:pointer-events-none disabled:opacity-60"
        )}
      >
        {multiple ? "Choose files" : "Choose file"}
      </button>

      <p className="mt-2 text-xs text-slate-400">
        PDF, JPG, or PNG — max 20 MB
        {multiple ? " each" : ""}
      </p>
    </div>
  );
}

function UploadingRow({
  progress,
  filename,
}: {
  progress: number;
  filename?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-accent-600"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">
            {filename ? `Uploading ${filename}…` : "Uploading…"}
          </p>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-accent-600 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{progress}%</span>
      </div>
    </div>
  );
}

interface UploadedRowProps {
  doc: ExistingDocument;
  disabled: boolean;
  removing: boolean;
  onView: () => void;
  onRemove: () => void;
}

function UploadedRow({
  doc,
  disabled,
  removing,
  onView,
  onRemove,
}: UploadedRowProps) {
  return (
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
            title={doc.filename}
          >
            {doc.filename}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-green-700">
          {formatBytes(doc.fileSize)} &middot; Uploaded{" "}
          {new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onView}
          className={cn(
            "flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800",
            "hover:bg-green-100 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          )}
          aria-label={`View ${doc.filename}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </button>

        {!disabled && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className={cn(
              "flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700",
              "hover:bg-red-50 transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
              "disabled:pointer-events-none disabled:opacity-60"
            )}
            aria-label={`Remove ${doc.filename}`}
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
  );
}

interface ErrorRowProps {
  message: string;
  disabled: boolean;
  onRetry: () => void;
  retryLabel?: string;
}

function ErrorRow({
  message,
  disabled,
  onRetry,
  retryLabel = "Try again",
}: ErrorRowProps) {
  return (
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
        {message && (
          <p className="mt-0.5 text-xs text-red-700">{message}</p>
        )}
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "shrink-0 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700",
            "hover:bg-red-100 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          )}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
