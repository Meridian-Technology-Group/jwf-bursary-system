/**
 * Documents — first-class portal area (PR-8).
 *
 * The "Documents" nav item shipped in PR-7 (Decision 2) pointing at an
 * empty-state stub; this PR turns it into the real area: an aggregation query
 * (`getAllDocumentsForApplication`) + this page listing every document the lead
 * applicant has uploaded for their CURRENT rolling application, grouped by
 * humanised slot, each with a Download button.
 *
 * First-class + always-resolves (Decision 2, locked): the route is NEVER
 * hidden, disabled, or redirected. It renders one of three states —
 *   1. documents present  → grouped list + downloads (+ paused action card),
 *   2. application but no uploads → friendly "nothing uploaded yet" empty state,
 *   3. no application at all → gentle "you don't have any documents yet" empty
 *      state with a link Home.
 *
 * Data-leak guard (dual-parent): documents are scoped to the lead applicant's
 * PRIMARY contributor via `ownerContributorId` so the secondary parent's
 * uploads are NEVER listed here, and the fetch runs under `withUserContext`
 * (RLS applies) — the contributor filter is defence-in-depth on top of RLS,
 * never run under admin context.
 *
 * Re-assessment: the query returns documents for the current rolling
 * application only; prior-year identity documents live on the prior
 * application and are intentionally not shown here ("already on file").
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, Upload, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import {
  withUserContext,
  withAdminContext,
  type RlsRole,
} from "@/lib/db/prisma";
import {
  getCurrentApplicationForUser,
  getAllDocumentsForApplication,
  type DocumentMeta,
} from "@/lib/db/queries/applications";
import {
  ensurePrimaryContributor,
  resolveOwningContributorId,
} from "@/lib/db/queries/contributors";
import { humaniseSlot } from "@/lib/documents/slots";
import { EmptyState } from "@/components/shared/empty-state";
import { DocumentsList } from "@/components/portal/documents-list";

export const metadata = { title: "Documents" };

/** Group documents by humanised slot, preserving the query's slot order
 *  (Open Q3, recommendation (b): group by humanised slot only — no slot→section
 *  map; simplest and correct for this first cut). */
function groupBySlot(
  documents: DocumentMeta[]
): { label: string; documents: DocumentMeta[] }[] {
  const groups: { label: string; documents: DocumentMeta[] }[] = [];
  const indexByLabel = new Map<string, number>();
  for (const doc of documents) {
    const label = humaniseSlot(doc.slot);
    const existing = indexByLabel.get(label);
    if (existing === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, documents: [doc] });
    } else {
      groups[existing].documents.push(doc);
    }
  }
  return groups;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          The documents you upload as part of your bursary application.
        </p>
      </div>
      {children}
    </div>
  );
}

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Resolve the lead applicant's current application (any status, most recently
  // updated) and the assessment status the paused card keys on. Under the
  // applicant's RLS context.
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getCurrentApplicationForUser(tx, user.id)
  );

  // State 3 — no application at all (invited-not-started, or no invitation):
  // friendly empty state + a link Home. Never hide / disable / redirect.
  if (!application) {
    return (
      <PageShell>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<FolderOpen />}
            title="You don't have any documents yet"
            description="Once you start your application, anything you upload will appear here."
          />
          <div className="border-t border-slate-100 px-6 py-4 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
            >
              Go to your portal home
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  // Resolve the lead applicant's PRIMARY contributor with a SELECT (created at
  // application creation). Never upsert under the applicant's RLS context — the
  // contributor write policy is admin-only (would throw P2025). Self-heal under
  // admin context only for the should-be-impossible missing case. Identical to
  // the apply/review pattern (`apply/[section]/page.tsx:151-159`).
  let ownerContributorId = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => resolveOwningContributorId(tx, application.id, user.id)
  );
  if (!ownerContributorId) {
    ownerContributorId = await withAdminContext((tx) =>
      ensurePrimaryContributor(tx, application.id, user.id)
    );
  }

  // Fetch the application's documents SCOPED to the PRIMARY contributor so the
  // secondary parent's uploads are never listed. RLS applies (withUserContext);
  // the ownerContributorId filter is defence-in-depth on top.
  const documents = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      getAllDocumentsForApplication(tx, application.id, ownerContributorId!)
  );

  const isPaused = application.assessment?.status === "PAUSED";

  // State 2 — application exists but no uploads (by this contributor) yet.
  if (documents.length === 0) {
    return (
      <PageShell>
        {/* Paused action card still surfaces even with nothing uploaded — the
            request is exactly why they're here. */}
        {isPaused && <ActionNeededCard />}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<FolderOpen />}
            title="No documents uploaded yet"
            description="You'll add documents as you complete your application."
          />
        </div>
      </PageShell>
    );
  }

  // State 1 — documents present: grouped list + downloads.
  const groups = groupBySlot(documents);

  return (
    <PageShell>
      {isPaused && <ActionNeededCard />}

      <div className="space-y-6">
        {groups.map((group) => (
          <section
            key={group.label}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-primary-900 sm:px-6">
              {group.label}
            </h2>
            <DocumentsList documents={group.documents} />
          </section>
        ))}
      </div>
    </PageShell>
  );
}

/**
 * "Action needed: upload requested documents" card shown when the assessment is
 * PAUSED. Links to /respond. Mirrors the dashboard paused-card markup
 * (`(portal)/page.tsx:340-362`) — a parent-safe action, never the internal
 * "Paused" status.
 */
function ActionNeededCard() {
  return (
    <Link
      href="/respond"
      className="group flex items-start gap-4 rounded-xl border border-yellow-300 bg-yellow-50 p-6 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100">
        <Upload className="h-6 w-6 text-yellow-700" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-yellow-900">
          Action needed: upload requested documents
        </p>
        <p className="mt-1 text-sm text-yellow-800">
          An assessor has asked for more documents. Upload them to get your
          assessment moving again.
        </p>
      </div>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-yellow-500 group-hover:text-yellow-700 transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
}
