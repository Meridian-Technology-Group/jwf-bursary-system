/**
 * Epic 22 P2 (CR-002 Phase 5 #4) — "Contact us by email".
 *
 * A parent's question goes to the bursary team's inbox with the bursary
 * reference in the subject; the team's reply goes to the lead applicant's
 * login email (the email's Reply-To). This module is the pure half: which
 * children the form offers, the email it composes, the throttle, the escaping.
 * The server action (`(portal)/help/actions.ts`) does the reading and sending.
 *
 * Decisions (plan §2): D-6 inbox env var + test-mode preview, D-7 no copy to
 * the parent, D-14 "Which child is this about?", D-15 5/hour and 20/day,
 * D-16 an optional typed subject after the system-added reference.
 */

import { parseAcademicYearStart } from "@/lib/assessment/fee-year";
import { formatLondonDateTime } from "@/lib/datetime";

// ─── Limits ───────────────────────────────────────────────────────────────────

export const ENQUIRY_SUBJECT_MAX = 120;
export const ENQUIRY_BODY_MIN = 10;
export const ENQUIRY_BODY_MAX = 5000;
export const ENQUIRY_LIMIT_PER_HOUR = 5;
export const ENQUIRY_LIMIT_PER_DAY = 20;

export const GENERAL_ENQUIRY_KEY = "general";

/** The nav label and page title (her tab name, 13 Oct 2026). */
export const CONTACT_US_LABEL = "Contact us by email";

/** Her heading, verbatim (13 Oct 2026). */
export const CONTACT_US_HEADING =
  "If you want to ask the bursary team a question as you are filling in the form or if you need any of your details amended, please email us directly using the section below.";

// ─── Which child is this about? (D-14) ────────────────────────────────────────

export interface EnquiryAccountInput {
  id: string;
  childName: string;
}

export interface EnquiryApplicationInput {
  id: string;
  childName: string;
  reference: string;
  bursaryAccountId: string | null;
  academicYear: string | null;
  updatedAt: Date;
}

export interface EnquiryChildOption {
  /** Opaque form value; the server re-derives the options and matches it. */
  key: string;
  childName: string;
  /** The child's latest application reference, or null when none exists. */
  reference: string | null;
  /** The application the reference belongs to (for the admin link). */
  applicationId: string | null;
}

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function newer(a: EnquiryApplicationInput, b: EnquiryApplicationInput): boolean {
  const ya = parseAcademicYearStart(a.academicYear) ?? -Infinity;
  const yb = parseAcademicYearStart(b.academicYear) ?? -Infinity;
  return ya > yb || (ya === yb && a.updatedAt > b.updatedAt);
}

/**
 * One option per child: each ACTIVE account, plus any child with an
 * application but no account (matched by name, as elsewhere in the portal).
 * Migrated applications count here — their reference is the family's fees
 * code, which is exactly what the team wants in the subject.
 */
export function enquiryChildOptions(
  accounts: readonly EnquiryAccountInput[],
  applications: readonly EnquiryApplicationInput[]
): EnquiryChildOption[] {
  interface Group {
    key: string;
    childName: string;
    latest: EnquiryApplicationInput | null;
  }
  const groups: Group[] = accounts.map((a) => ({
    key: `account:${a.id}`,
    childName: a.childName,
    latest: null,
  }));
  const accountGroup = new Map(accounts.map((a, i) => [a.id, groups[i]]));

  for (const app of applications) {
    const group =
      (app.bursaryAccountId ? accountGroup.get(app.bursaryAccountId) : undefined) ??
      groups.find((g) => nameKey(g.childName) === nameKey(app.childName)) ??
      (() => {
        const g: Group = {
          key: `application:${app.id}`,
          childName: app.childName.trim(),
          latest: null,
        };
        groups.push(g);
        return g;
      })();
    if (!group.latest || newer(app, group.latest)) group.latest = app;
  }

  return groups.map((g) => ({
    key: g.key,
    childName: g.childName,
    reference: g.latest?.reference ?? null,
    applicationId: g.latest?.id ?? null,
  }));
}

// ─── The email (D-16) ─────────────────────────────────────────────────────────

/** One line, no control characters, at most `max` characters. */
export function cleanSubject(raw: string | null | undefined, max = ENQUIRY_SUBJECT_MAX): string {
  return (raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export interface ComposeEnquiryParams {
  parent: { firstName: string | null; lastName: string | null; email: string };
  /** Null for "General question". */
  child: EnquiryChildOption | null;
  subject?: string | null;
  body: string;
  sentAt: Date;
  /** Base URL for the admin link to the application. */
  appUrl: string;
}

export interface ComposedEnquiry {
  subject: string;
  text: string;
}

export function composeEnquiry(params: ComposeEnquiryParams): ComposedEnquiry {
  const { parent, child, body, sentAt, appUrl } = params;
  const typed = cleanSubject(params.subject);

  const about = child
    ? child.reference
      ? child.reference
      : `${child.childName} (no application yet)`
    : "general question";
  const subject = cleanSubject(
    `Bursary portal question — ${about}${typed ? ` — ${typed}` : ""}`,
    300
  );

  const parentName = [parent.firstName, parent.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const lines = [
    "A question sent from the bursary portal's \"Contact us by email\" page.",
    "",
    `From: ${parentName ? `${parentName} <${parent.email}>` : parent.email}`,
    `Child: ${child ? child.childName : "General question"}`,
    `Bursary reference: ${child?.reference ?? "—"}`,
    ...(typed ? [`Subject: ${typed}`] : []),
    `Sent: ${formatLondonDateTime(sentAt)}`,
    "",
    "Question:",
    body.trim(),
    "",
    `Replying to this email answers ${parentName || "the family"} at ${parent.email}.`,
    ...(child?.applicationId
      ? [`Application: ${appUrl.replace(/\/$/, "")}/applications/${child.applicationId}`]
      : []),
  ];
  return { subject, text: lines.join("\n") };
}

/**
 * The shared email wrapper turns plain text into HTML without escaping, so a
 * parent's typed `<a href>` would otherwise render in the team's inbox.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Throttle (D-15) ──────────────────────────────────────────────────────────

export type ThrottleResult = { allowed: true } | { allowed: false };

/** `recent` = this login's enquiries in the last 24 hours. */
export function enquiryThrottle(recent: readonly Date[], now: Date): ThrottleResult {
  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const lastHour = recent.filter((d) => d.getTime() > hourAgo).length;
  const lastDay = recent.filter((d) => d.getTime() > dayAgo).length;
  return lastHour >= ENQUIRY_LIMIT_PER_HOUR || lastDay >= ENQUIRY_LIMIT_PER_DAY
    ? { allowed: false }
    : { allowed: true };
}
