"use client";

/**
 * SubmissionDownloadOffer — Epic 14 A5 (CG-13/LA-1), amending the presentation
 * of Epic 13 D1 (D13-4).
 *
 * The flow is three bare beats: the page's "file sent" confirmation, then a
 * single `DOWNLOAD MY COPY` button with NO explanatory or scarcity text, then
 * `Continue` back to the portal home. Charlotte asked for exactly this
 * ("Please remove all the text, simply 'DOWNLOAD MY COPY' and then it is
 * gone") — the previous unmissable warning panel prompted parents to feel they
 * absolutely must save it.
 *
 * The one-successful-download rule is unchanged server-side: the PDF route
 * still stamps `submissionPdfDownloadedAt` and 410s afterwards. The offer is
 * shown only during the live post-submit beat (a sessionStorage flag written
 * by the submit path); downloading or continuing consumes the flag, and a
 * plain revisit to /submitted shows no download path and no explanation
 * (LA-1 — leaving without downloading forfeits the copy; the fallback route
 * to a copy is the bursary team, deliberately unadvertised here).
 *
 * The download stays a plain anchor, not fetch+blob: the browser's native
 * save is the most reliable way for a parent to end up with the file. The
 * server stamps the consumed-flag only after the PDF renders, so a failed
 * download does not burn the single shot.
 *
 * When the beat is over ("hidden") this component renders the page's normal
 * bottom navigation instead — during the live beat, `Continue` is the one
 * exit, so clicking past the offer is an explicit choice.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import {
  SUBMISSION_FLOW_KEY,
  resolveDownloadBeat,
  type DownloadBeat,
} from "@/lib/portal/submission-flow";

interface SubmissionDownloadOfferProps {
  applicationId: string;
  /**
   * Formatted date the single download was taken, or null while it is still
   * available. Server-rendered from `Application.submissionPdfDownloadedAt`.
   */
  downloadedAt: string | null;
}

function readFlowFlag(): string | null {
  try {
    return sessionStorage.getItem(SUBMISSION_FLOW_KEY);
  } catch {
    return null;
  }
}

function clearFlowFlag(): void {
  try {
    sessionStorage.removeItem(SUBMISSION_FLOW_KEY);
  } catch {
    // Ignore — worst case the flag lingers for this tab's session.
  }
}

export function SubmissionDownloadOffer({
  applicationId,
  downloadedAt,
}: SubmissionDownloadOfferProps) {
  const router = useRouter();
  const pdfHref = `/api/pdf/submission/${applicationId}`;
  const [downloadStarted, setDownloadStarted] = React.useState(false);
  // null until mounted — sessionStorage is client-only, so the beat resolves
  // after hydration to avoid a server/client markup mismatch.
  const [beat, setBeat] = React.useState<DownloadBeat | null>(null);

  React.useEffect(() => {
    setBeat(
      resolveDownloadBeat({
        downloadedAt,
        flowApplicationId: readFlowFlag(),
        applicationId,
        downloadStarted,
      })
    );
  }, [downloadedAt, applicationId, downloadStarted]);

  const handleDownload = () => {
    clearFlowFlag();
    setDownloadStarted(true);
  };

  const handleContinue = () => {
    clearFlowFlag();
    router.push("/");
  };

  if (beat === null) return null;

  if (beat === "hidden") {
    // Beat over (revisit or already downloaded): the page's normal navigation,
    // no download path, no explanation (CG-13).
    return (
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-primary-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <Link
          href="/status"
          className="inline-flex items-center gap-2 rounded-md bg-primary-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          View application status
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {beat === "offer" && (
        <a
          href={pdfHref}
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download my copy
        </a>
      )}
      <button
        type="button"
        onClick={handleContinue}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Continue
      </button>
    </div>
  );
}
