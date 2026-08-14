"use client";

/**
 * SubmissionDownloadOffer — Epic 13 D1 (decision D13-4), replacing the Epic 05
 * dismissible-offer behaviour.
 *
 * The submission PDF is now a ONE-SHOT: downloadable once, at submission, and
 * never again (CF-27 — applicants must not be able to re-read everything they
 * submitted). The old component collapsed into a small permanent "Download PDF"
 * link once dismissed, and the History page offered the same link indefinitely;
 * both are gone.
 *
 * Because there is no second chance, this must be unmissable rather than
 * polite. There is no "No thanks" dismissal and no localStorage state: the
 * offer is either live (server says the download is unspent) or spent, and it
 * says so in plain words including the consequence — email the bursary team.
 *
 * The download is a plain anchor, not a `fetch` + blob: the browser's native
 * save is the most reliable way for a parent to actually end up with the file,
 * and reliability outranks richer client-side error handling when the shot is
 * single. Clicking flips the panel optimistically — the copy is careful to
 * claim only that the download *started*, and tells the parent that reloading
 * brings the offer back if it did not, which is exactly true: the server stamps
 * the consumed-flag only after the PDF renders.
 */

import * as React from "react";
import { AlertTriangle, Download, Info } from "lucide-react";

const BURSARY_EMAIL = "fees@johnwhitgiftfoundation.org";

interface SubmissionDownloadOfferProps {
  applicationId: string;
  /**
   * Formatted date the single download was taken, or null while it is still
   * available. Server-rendered from `Application.submissionPdfDownloadedAt`.
   */
  downloadedAt: string | null;
}

export function SubmissionDownloadOffer({
  applicationId,
  downloadedAt,
}: SubmissionDownloadOfferProps) {
  const pdfHref = `/api/pdf/submission/${applicationId}`;
  const [justDownloaded, setJustDownloaded] = React.useState(false);

  // Already spent on a previous visit — no link, just the explanation.
  if (downloadedAt) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-800">
            You downloaded your copy on {downloadedAt}.
          </p>
          <p className="mt-1">
            A copy of your application can only be downloaded once, so it is no
            longer available here. If you no longer have the file, email the
            bursary team at{" "}
            <a
              className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-600"
              href={`mailto:${BURSARY_EMAIL}`}
            >
              {BURSARY_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  // Spent in this session — optimistic, so claim only that it started.
  if (justDownloaded) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-800">
            Your download has started. That was your one copy — please keep it
            somewhere safe.
          </p>
          <p className="mt-1">
            If the file did not arrive, reload this page: the offer will still
            be here if the download failed. Otherwise, email the bursary team at{" "}
            <a
              className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-600"
              href={`mailto:${BURSARY_EMAIL}`}
            >
              {BURSARY_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-accent-400 bg-accent-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
            <AlertTriangle
              className="h-5 w-5 text-accent-700"
              aria-hidden="true"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-900">
              Download your copy now — this is your only chance
            </p>
            <p className="mt-1 text-sm text-primary-800">
              This PDF contains everything you submitted.{" "}
              <strong className="font-semibold">
                You can download it once, and once only.
              </strong>{" "}
              Save it somewhere safe: afterwards it is no longer available from
              your account, and you will need to email the bursary team at{" "}
              <a
                className="font-medium underline underline-offset-2"
                href={`mailto:${BURSARY_EMAIL}`}
              >
                {BURSARY_EMAIL}
              </a>{" "}
              if you need another copy.
            </p>
          </div>
        </div>
        <a
          href={pdfHref}
          onClick={() => setJustDownloaded(true)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download my copy (one time only)
        </a>
      </div>
    </div>
  );
}
