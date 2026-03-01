"use client";

/**
 * AdminUpload — WP-15
 *
 * Allows ASSESSOR users to upload documents on behalf of applicants directly
 * from the application detail view. Calls POST /api/admin/documents which
 * performs a role-gated upload without requiring the user to be the lead
 * applicant on the application.
 *
 * Features:
 *   - Dropdown to select the target document slot
 *   - File picker filtered to PDF / JPEG / PNG, max 20 MB
 *   - Client-side validation before upload
 *   - Progress indicator
 *   - Success / error feedback
 *   - Refreshes the page on success so the DocumentChecklist updates
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_DOCUMENT_SLOTS, humaniseSlot } from "@/lib/documents/slots";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AdminUploadProps {
  applicationId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminUpload({ applicationId }: AdminUploadProps) {
  const router = useRouter();

  const [selectedSlot, setSelectedSlot] = React.useState<string>("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setUploadError(null);
    setUploadSuccess(null);

    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Client-side validation
    if (!ACCEPTED_MIME.includes(file.type)) {
      setFileError("Only PDF, JPEG, and PNG files are accepted.");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setFileError(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedSlot) {
      setUploadError("Please select a document slot.");
      return;
    }
    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("applicationId", applicationId);
      formData.set("slot", selectedSlot);

      const response = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { error?: string; slot?: string };

      if (!response.ok) {
        setUploadError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      // Success
      setUploadSuccess(
        `${humaniseSlot(selectedSlot)} uploaded successfully.`
      );
      setSelectedFile(null);
      setSelectedSlot("");

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh the page to reflect the new document in the checklist
      router.refresh();
    } catch (err) {
      console.error("[AdminUpload] Upload error:", err);
      setUploadError("A network error occurred. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const canUpload = selectedSlot.length > 0 && selectedFile !== null && !isUploading;

  return (
    <Card>
      <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Upload Document (Assessor)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-5 space-y-4">
        <p className="text-xs text-slate-500">
          Upload documents on behalf of the applicant. These will appear in the
          document checklist above.
        </p>

        {/* Slot selector */}
        <div className="space-y-1.5">
          <Label
            htmlFor="admin-upload-slot"
            className="text-xs font-medium text-slate-600"
          >
            Document slot
          </Label>
          <Select
            value={selectedSlot}
            onValueChange={setSelectedSlot}
            disabled={isUploading}
          >
            <SelectTrigger id="admin-upload-slot" className="text-sm">
              <SelectValue placeholder="Select document type..." />
            </SelectTrigger>
            <SelectContent>
              {ALL_DOCUMENT_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot} className="text-sm">
                  {humaniseSlot(slot)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File picker */}
        <div className="space-y-1.5">
          <Label
            htmlFor="admin-upload-file"
            className="text-xs font-medium text-slate-600"
          >
            File
          </Label>
          <input
            ref={fileInputRef}
            id="admin-upload-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm text-slate-600
              file:mr-3 file:cursor-pointer file:rounded-md file:border-0
              file:bg-primary-50 file:px-3 file:py-1.5 file:text-xs
              file:font-medium file:text-primary-700
              hover:file:bg-primary-100
              disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-slate-400">
            PDF, JPEG, or PNG — max {MAX_SIZE_MB} MB
          </p>
        </div>

        {/* Selected file preview */}
        {selectedFile && !fileError && (
          <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        )}

        {/* File validation error */}
        {fileError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{fileError}</p>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{uploadError}</p>
          </div>
        )}

        {/* Success message */}
        {uploadSuccess && (
          <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <p className="text-xs text-green-700">{uploadSuccess}</p>
          </div>
        )}

        {/* Upload button */}
        <Button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload}
          size="sm"
          className="w-full gap-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload Document
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
