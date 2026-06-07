/**
 * Documents — first-class portal area (PR-7 shell; full page lands in PR-8).
 *
 * Documents is a first-class nav item from PR-7 (Decision 2) — never hidden or
 * disabled — so the route must always resolve to something sensible. This is the
 * minimal EMPTY-STATE-only page that satisfies that contract: it renders a
 * friendly empty state and NO aggregation query (the `getAllDocumentsFor
 * Application` query + the with-uploads and paused-action variants are PR-8).
 *
 * Kept a server component; heading/subhead match the `/help` page. The
 * `@stepper` parallel slot resolves to null on `/documents`, so the rail is
 * nav-only here.
 */

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-500">
          The documents you upload as part of your bursary application.
        </p>
      </div>

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
    </div>
  );
}
