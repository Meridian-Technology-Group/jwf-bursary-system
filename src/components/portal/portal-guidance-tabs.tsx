"use client";

/**
 * PortalGuidanceTabs — home-page guidance rail (Epic 05, feedback ask #2 + #3).
 *
 * Renders the two static guidance tabs the Foundation asked for:
 *   - Section 1 — How to Apply   (intro + FAQs + guidance notes)
 *   - Section 2 — Checklist      (upload guidance + document checklist)
 * plus a Terms & Conditions tab that displays the supplied T&Cs PDF inline
 * (ask #3 / Decision D10) with a download link.
 *
 * Content is static reference material lifted from the application-form
 * workbook (`guidance-content.ts`). It is always reachable — before, during and
 * after an application — and identical for new and rolling-over applicants,
 * except the Checklist's identity-documents block, which is flagged
 * "first application only" and de-emphasised for rolling-over accounts.
 */

import * as React from "react";
import { FileText, Download, ExternalLink } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  HOW_TO_APPLY_INTRO,
  HOW_TO_APPLY_FAQS,
  HOW_TO_APPLY_GUIDANCE_NOTES,
  CHECKLIST_UPLOAD_NOTES,
  CHECKLIST_ITEMS,
  BURSARIES_CONTACT_EMAIL,
} from "@/lib/portal/guidance-content";
import {
  TERMS_AND_CONDITIONS_PATH,
  TERMS_AND_CONDITIONS_LABEL,
} from "@/lib/portal/terms";

interface PortalGuidanceTabsProps {
  /**
   * When true, the identity-documents checklist block is shown as
   * "already on file" for rolling-over re-assessments (it is only required on a
   * first application). Defaults to false (new application).
   */
  isRollingOver?: boolean;
}

export function PortalGuidanceTabs({
  isRollingOver = false,
}: PortalGuidanceTabsProps) {
  return (
    <section
      aria-label="How to apply, checklist and terms"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <Tabs defaultValue="how-to-apply">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabsTrigger value="how-to-apply" className="flex-1 sm:flex-none">
            Section 1 — How to Apply
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex-1 sm:flex-none">
            Section 2 — Checklist
          </TabsTrigger>
          <TabsTrigger value="terms" className="flex-1 sm:flex-none">
            Terms &amp; Conditions
          </TabsTrigger>
        </TabsList>

        {/* ── Section 1 — How to Apply ───────────────────────────────────── */}
        <TabsContent value="how-to-apply" className="mt-5 space-y-6">
          <div className="space-y-3">
            {HOW_TO_APPLY_INTRO.map((para) => (
              <p key={para} className="text-sm leading-relaxed text-slate-600">
                {para}
              </p>
            ))}
            <p className="text-sm text-slate-600">
              The bursaries team can be reached at{" "}
              <a
                href={`mailto:${BURSARIES_CONTACT_EMAIL}`}
                className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
              >
                {BURSARIES_CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Frequently asked questions
            </h3>
            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {HOW_TO_APPLY_FAQS.map((faq) => (
                <details key={faq.question} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600">
                    <span>{faq.question}</span>
                    <span
                      aria-hidden="true"
                      className="text-slate-400 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Guidance notes
            </h3>
            <ul className="mt-3 space-y-2">
              {HOW_TO_APPLY_GUIDANCE_NOTES.map((note) => (
                <li
                  key={note}
                  className="flex gap-2 text-sm leading-relaxed text-slate-600"
                >
                  <span aria-hidden="true" className="mt-1 text-accent-500">
                    •
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* ── Section 2 — Checklist ──────────────────────────────────────── */}
        <TabsContent value="checklist" className="mt-5 space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              How to upload your documents
            </h3>
            <ul className="mt-3 space-y-2">
              {CHECKLIST_UPLOAD_NOTES.map((note) => (
                <li
                  key={note}
                  className="flex gap-2 text-sm leading-relaxed text-slate-600"
                >
                  <span aria-hidden="true" className="mt-1 text-accent-500">
                    •
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Document checklist
            </h3>
            <ul className="mt-3 space-y-3">
              {CHECKLIST_ITEMS.map((item) => {
                const deEmphasised = item.firstApplicationOnly && isRollingOver;
                return (
                  <li
                    key={item.title}
                    className={cn(
                      "rounded-lg border p-4",
                      deEmphasised
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          deEmphasised ? "text-slate-500" : "text-slate-900"
                        )}
                      >
                        {item.title}
                      </p>
                      {item.firstApplicationOnly && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            deEmphasised
                              ? "border-slate-300 bg-white text-slate-500"
                              : "border-amber-300 bg-amber-50 text-amber-700"
                          )}
                        >
                          {deEmphasised
                            ? "Already on file"
                            : "First application only"}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-sm leading-relaxed",
                        deEmphasised ? "text-slate-400" : "text-slate-600"
                      )}
                    >
                      {deEmphasised
                        ? "Identity documents you provided on your first application are already held — you do not need to re-upload them for a re-assessment."
                        : item.detail}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </TabsContent>

        {/* ── Terms & Conditions (D10) ───────────────────────────────────── */}
        <TabsContent value="terms" className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FileText
                className="mt-0.5 h-5 w-5 shrink-0 text-primary-700"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {TERMS_AND_CONDITIONS_LABEL}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  These terms apply when you accept a bursary award. You will be
                  asked to confirm them when you submit your application.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={TERMS_AND_CONDITIONS_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open
              </a>
              <a
                href={TERMS_AND_CONDITIONS_PATH}
                download
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download
              </a>
            </div>
          </div>

          <object
            data={TERMS_AND_CONDITIONS_PATH}
            type="application/pdf"
            aria-label={TERMS_AND_CONDITIONS_LABEL}
            className="h-[28rem] w-full rounded-lg border border-slate-200"
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-slate-600">
                Your browser cannot display the PDF inline.
              </p>
              <a
                href={TERMS_AND_CONDITIONS_PATH}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent-700 underline underline-offset-2"
              >
                Open the Terms &amp; Conditions in a new tab
              </a>
            </div>
          </object>
        </TabsContent>
      </Tabs>
    </section>
  );
}
