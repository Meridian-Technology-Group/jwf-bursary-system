"use client";

/**
 * SubmissionDownloadOffer — Epic 05 (plan §3.3; canonical-status note).
 *
 * The submission-summary PDF download is OFFERED at submission and "goes away if
 * the applicant presses no" — modelled here as a prominent dismissible offer
 * that does not block. Once dismissed (persisted per application in
 * localStorage) it collapses to a small, always-available "Download PDF" link,
 * so the PDF remains reachable from the history view indefinitely.
 */

import * as React from "react";
import { Download, X } from "lucide-react";

interface SubmissionDownloadOfferProps {
  applicationId: string;
}

export function SubmissionDownloadOffer({
  applicationId,
}: SubmissionDownloadOfferProps) {
  const storageKey = `jwf:submission-pdf-offer-dismissed:${applicationId}`;
  const pdfHref = `/api/pdf/submission/${applicationId}`;

  // Start dismissed=false on the server render; reconcile from localStorage on
  // mount so the prominent offer never flashes for someone who dismissed it.
  const [dismissed, setDismissed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // localStorage unavailable (private mode) — keep the offer shown.
    }
    setHydrated(true);
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore — UI state still updates for this session.
    }
  }

  // Before hydration, render the compact link so SSR + first paint are stable.
  if (!hydrated || dismissed) {
    return (
      <a
        href={pdfHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download submission (PDF)
      </a>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
          <Download className="h-5 w-5 text-primary-700" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-900">
            Download a copy of your submission?
          </p>
          <p className="mt-0.5 text-sm text-primary-800">
            We can give you a PDF of everything you submitted, for your records.
            You can always download it later from your application history.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <a
          href={pdfHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Yes, download
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-800 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          No thanks
        </button>
      </div>
    </div>
  );
}
