/**
 * SubmittedSummary — read-only render of a submitted application (Epic 05 §3.3).
 *
 * Renders the section-by-section answers + uploaded documents + recorded T&Cs
 * acceptance for a submitted application, plus a (dismissible) "Download
 * submission (PDF)" offer. The same view backs each multi-round history entry.
 *
 * Pure presentation over the data built by `buildSubmittedSummary`; it never
 * exposes an editable form (the application is immutable post-submit).
 */

import { FileText, Paperclip } from "lucide-react";
import type { SubmittedSummary as SummaryData } from "@/lib/portal/application-summary";
import { SubmissionDownloadOffer } from "@/components/portal/submission-download-offer";

interface SubmittedSummaryProps {
  applicationId: string;
  reference: string;
  /** Parent-safe submitted label: "Received" (new) / "Submitted" (rolling). */
  submittedLabel: string;
  /** Localised submission date string (Europe/London). */
  submittedDate: string;
  childName: string | null;
  academicYear: string;
  summary: SummaryData;
  /** T&Cs acceptance recorded at submission, if present. */
  termsAccepted: { date: string; version: string | null } | null;
}

export function SubmittedSummary({
  applicationId,
  reference,
  submittedLabel,
  submittedDate,
  childName,
  academicYear,
  summary,
  termsAccepted,
}: SubmittedSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Header / meta */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {submittedLabel}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-primary-900">
              {reference}
            </p>
            {childName && (
              <p className="mt-1 text-sm text-slate-600">{childName}</p>
            )}
            <p className="text-xs text-slate-500">
              {academicYear} assessment round
            </p>
          </div>
          <dl className="text-right text-sm">
            <dt className="text-xs uppercase tracking-wider text-slate-400">
              Submitted
            </dt>
            <dd className="font-medium text-slate-800">{submittedDate}</dd>
          </dl>
        </div>
      </div>

      {/* Download offer (dismissible; PDF stays available from history) */}
      <SubmissionDownloadOffer applicationId={applicationId} />

      {/* Section-by-section answers */}
      <div className="space-y-4">
        {summary.sections.map((section) => (
          <section
            key={section.sectionType}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <FileText
                className="h-4 w-4 shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-slate-800">
                {section.title}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-4">
              {section.rows.length > 0 && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                  {section.rows.map((row) =>
                    row.value ? (
                      <div key={row.label} className="contents">
                        <dt className="whitespace-nowrap text-slate-500">
                          {row.label}
                        </dt>
                        <dd className="text-slate-800">{row.value}</dd>
                      </div>
                    ) : (
                      <dt
                        key={row.label}
                        className="col-span-2 italic text-slate-500"
                      >
                        {row.label}
                      </dt>
                    )
                  )}
                </dl>
              )}

              {section.tables?.map((table) => (
                <div key={table.caption} className="overflow-x-auto">
                  <p className="mb-1 text-xs font-medium text-slate-500">
                    {table.caption}
                  </p>
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {table.columns.map((col) => (
                          <th
                            key={col}
                            className="pb-1.5 pr-4 text-left font-medium text-slate-500"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {table.rows.map((cells, i) => (
                        <tr key={i}>
                          {cells.map((cell, j) => (
                            <td key={j} className="py-1.5 pr-4 text-slate-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {section.documents && section.documents.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
                    Documents
                  </p>
                  <ul className="space-y-1">
                    {section.documents.map((doc, i) => (
                      <li
                        key={`${doc.slot}-${i}`}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <Paperclip
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        <span className="text-slate-500">{doc.label}:</span>
                        <span className="truncate">{doc.filename}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Declaration / T&Cs acceptance */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-800">Declaration</h2>
        </div>
        <div className="px-5 py-4 text-sm text-slate-700">
          {termsAccepted ? (
            <p>
              You confirmed the bursary Terms &amp; Conditions when you submitted
              this application on{" "}
              <span className="font-medium">{termsAccepted.date}</span>
              {termsAccepted.version ? (
                <>
                  {" "}
                  (terms version{" "}
                  <span className="font-mono text-xs">
                    {termsAccepted.version}
                  </span>
                  )
                </>
              ) : null}
              .
            </p>
          ) : (
            <p className="text-slate-500">
              You confirmed the declaration and Terms &amp; Conditions when you
              submitted this application.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
