"use client";

/**
 * ExportButton — client component that triggers a file download via the
 * /api/exports/recommendations route.
 *
 * Props:
 *   roundId  — UUID of the selected round (required)
 *   school   — optional school filter ("TRINITY" | "WHITGIFT" | "")
 *   format   — "xlsx" | "csv"
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportButtonProps {
  roundId: string;
  school?: string;
  format: "xlsx" | "csv";
}

export function ExportButton({ roundId, school, format }: ExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  function handleDownload() {
    if (!roundId || isDownloading) return;

    setIsDownloading(true);

    const params = new URLSearchParams({ roundId, format });
    if (school) params.set("school", school);

    // Trigger download via navigation — the browser will handle the
    // Content-Disposition: attachment response without leaving the page.
    window.location.href = `/api/exports/recommendations?${params.toString()}`;

    // Reset loading state after a short delay — we can't know when the
    // download actually completes since we're not using fetch here.
    setTimeout(() => {
      setIsDownloading(false);
    }, 3000);
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={!roundId || isDownloading}
      className="gap-2"
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {isDownloading ? "Preparing download..." : `Download ${format.toUpperCase()}`}
    </Button>
  );
}
