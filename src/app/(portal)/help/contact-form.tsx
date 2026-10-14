"use client";

/**
 * Epic 22 P2 — the "Contact us by email" form. "From" is the lead applicant's
 * login email, read-only. On send: the confirmation (D-7), or in test mode the
 * exact email that would have gone (D-6).
 */

import * as React from "react";
import { Loader2, Send, CheckCircle2, Eye } from "lucide-react";
import { sendEnquiryAction, type SendEnquiryResult } from "./actions";
import {
  ENQUIRY_BODY_MAX,
  ENQUIRY_SUBJECT_MAX,
  GENERAL_ENQUIRY_KEY,
} from "@/lib/portal/enquiry";

export interface ContactChildOption {
  key: string;
  childName: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600";

export function ContactForm({
  fromEmail,
  childOptions,
}: {
  fromEmail: string;
  childOptions: ContactChildOption[];
}) {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<SendEnquiryResult | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // One child: preselect them. Several: make the parent choose.
  const defaultChild = childOptions.length === 1 ? childOptions[0].key : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    const outcome = await sendEnquiryAction(new FormData(e.currentTarget));
    setResult(outcome);
    setPending(false);
    if (outcome.status !== "error") formRef.current?.reset();
  }

  if (result?.status === "sent") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-700" aria-hidden="true" />
        <div>
          <p className="font-semibold">Sent to the bursary team.</p>
          <p className="mt-1">Our reply will come to {result.replyTo}.</p>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-3 font-medium text-green-800 underline underline-offset-2"
          >
            Ask another question
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="block text-sm font-medium text-slate-700">From</span>
        <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {fromEmail}
        </p>
      </div>

      <div>
        <label htmlFor="childKey" className="block text-sm font-medium text-slate-700">
          Which child is this about?
        </label>
        <select
          id="childKey"
          name="childKey"
          required
          defaultValue={defaultChild}
          className={`mt-1 ${inputClass}`}
        >
          {childOptions.length !== 1 && (
            <option value="" disabled>
              Choose…
            </option>
          )}
          {childOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.childName}
            </option>
          ))}
          <option value={GENERAL_ENQUIRY_KEY}>General question</option>
        </select>
      </div>

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
          Subject <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          maxLength={ENQUIRY_SUBJECT_MAX}
          className={`mt-1 ${inputClass}`}
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-slate-700">
          Your question
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={7}
          maxLength={ENQUIRY_BODY_MAX}
          className={`mt-1 ${inputClass}`}
        />
      </div>

      {result?.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
        >
          {result.error}
        </p>
      )}

      {result?.status === "preview" && (
        <div role="status" className="rounded-xl border border-accent-300 bg-accent-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-accent-900">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Test mode — nothing was sent
          </p>
          <p className="mt-1 text-slate-700">
            On the live portal this email would go to {result.to}, and the reply
            would come to {result.replyTo}.
          </p>
          <p className="mt-3 font-medium text-slate-800">Subject: {result.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-sans text-xs text-slate-700">
            {result.text}
          </pre>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-70"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        Send
      </button>
    </form>
  );
}
