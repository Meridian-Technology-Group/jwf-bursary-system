/**
 * Epic 22 P4 (L2) — the three guidance sections, always visible on every home
 * page (her sheet: "always visible, not collapsed"). How to Apply and the
 * Checklist open their tab on Contact us by email (`/help?tab=…`, D-17); the
 * Terms & Conditions open the PDF.
 *
 * No state — works in server components.
 */

import Link from "next/link";
import { BookOpen, ListChecks, FileText, ArrowRight } from "lucide-react";
import {
  TERMS_AND_CONDITIONS_PATH,
  TERMS_AND_CONDITIONS_LABEL,
} from "@/lib/portal/terms";

const cardClass =
  "group flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

function CardBody({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-primary-900 group-hover:text-primary-800">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
      </span>
      <ArrowRight
        className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary-600"
        aria-hidden="true"
      />
    </>
  );
}

export function PortalHelpCards() {
  return (
    <section aria-labelledby="need-help-heading">
      <h2
        id="need-help-heading"
        className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400"
      >
        Need help?
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3" role="list">
        <li>
          <Link href="/help?tab=how-to-apply#guidance" className={cardClass}>
            <CardBody
              icon={BookOpen}
              title="Section 1 — How to Apply"
              text="Who can apply, the FAQs and the guidance notes."
            />
          </Link>
        </li>
        <li>
          <Link href="/help?tab=checklist#guidance" className={cardClass}>
            <CardBody
              icon={ListChecks}
              title="Section 2 — Checklist"
              text="The documents to have ready before you start."
            />
          </Link>
        </li>
        <li>
          <a
            href={TERMS_AND_CONDITIONS_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className={cardClass}
          >
            <CardBody
              icon={FileText}
              title="Section 3 — Terms & Conditions"
              text={`${TERMS_AND_CONDITIONS_LABEL} (PDF, opens in a new tab).`}
            />
          </a>
        </li>
      </ul>
    </section>
  );
}
