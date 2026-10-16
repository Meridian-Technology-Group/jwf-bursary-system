/**
 * "Returned to you for correction" (Epic 23 T7). Shown on My Bursary
 * Application(s), in the form (every section) and on the review page while
 * the latest rejection returned this application and it has not been
 * resubmitted (`returnNotice`). Presentational; the words are
 * `returnNoticeText`.
 */

import { RotateCcw } from "lucide-react";
import { returnNoticeText, type ReturnNotice } from "@/lib/applications/return-for-correction";

export function ReturnedForCorrectionBanner({ notice, className }: { notice: ReturnNotice; className?: string }) {
  const { headline, message } = returnNoticeText(notice);
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 ${className ?? ""}`}
    >
      <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{headline}</p>
        {message && <p className="whitespace-pre-line text-amber-900/90">{message}</p>}
      </div>
    </div>
  );
}
