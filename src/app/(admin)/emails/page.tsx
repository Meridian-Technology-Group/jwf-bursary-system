/**
 * Sent Emails — Epic 15 X1 (CI-02).
 *
 * Charlotte's "where do I go to see my sent emails?" — a reverse-chron log of
 * every message the SYSTEM has sent (invitations, confirmations,
 * missing-docs requests, bulk sends…), written by the mailer from
 * 21 Aug 2026 onward. This is a send log, not a mailbox: parent REPLIES go
 * to the reply-to address (fees@ when configured), never here.
 *
 * Filter by recipient email; simple offset pagination (audit-page pattern).
 */

import Link from "next/link";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { formatLondonDateTime } from "@/lib/datetime";
import { emailTemplateLabel } from "@/lib/email/template-labels";
import type { EmailTemplateType } from "@prisma/client";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sent Emails" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const STATUS_BADGE: Record<string, string> = {
  SENT: "bg-green-50 border-green-300 text-green-700",
  FAILED: "bg-rose-50 border-rose-300 text-rose-700",
  SKIPPED: "bg-slate-50 border-slate-300 text-slate-500",
};

function templateLabel(type: EmailTemplateType | null): string {
  if (!type) return "One-off message";
  return emailTemplateLabel({ isSystem: true, type, name: null });
}

export default async function SentEmailsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const where = q
    ? { toEmail: { contains: q, mode: "insensitive" as const } }
    : {};

  const { rows, total } = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const [rows, total] = await Promise.all([
        tx.emailLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        tx.emailLog.count({ where }),
      ]);
      return { rows, total };
    }
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) =>
    `/emails?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Sent Emails</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every message the system has sent, newest first — recorded from
          21&nbsp;August&nbsp;2026 onward. Replies from parents go to the
          Bursary Office reply-to address, not here.
        </p>
      </div>

      <form method="get" action="/emails" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Filter by recipient email…"
          className="h-9 w-80 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-accent-600 focus:outline-none"
          aria-label="Filter by recipient email"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary-800 px-4 text-sm font-medium text-white hover:bg-primary-700"
        >
          Filter
        </button>
        {q && (
          <Link href="/emails" className="text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Sent</th>
              <th className="px-4 py-2.5">To</th>
              <th className="px-4 py-2.5">Template</th>
              <th className="px-4 py-2.5">Subject</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                  {formatLondonDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{row.toEmail}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {templateLabel(row.templateType)}
                </td>
                <td className="max-w-md truncate px-4 py-2.5 text-slate-600" title={row.subject}>
                  {row.subject}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold",
                      STATUS_BADGE[row.status] ?? STATUS_BADGE.SKIPPED
                    )}
                    title={row.error ?? undefined}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  {q
                    ? `No sent emails match “${q}”.`
                    : "Nothing sent yet — messages appear here as the system sends them."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="hover:underline">
              ← Newer
            </Link>
          )}
          <span>
            Page {page} of {totalPages} · {total} messages
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="hover:underline">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
