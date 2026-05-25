/**
 * Secondary-parent contribute landing — /contribute.
 *
 * The entry point a second parent lands on after accepting their invitation.
 * Introduces the restricted flow (three sections + documents), shows the child
 * READ-ONLY (name only), and links to the first section. If they have already
 * submitted, they are sent to the thank-you page.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { ApplicationContributorStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getSecondaryContributorContext } from "@/lib/db/queries/contributors";

export const metadata = { title: "Your Contribution" };

export default async function ContributeLandingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    getSecondaryContributorContext(tx, user.id)
  );

  // Not a secondary contributor → portal home (which routes appropriately).
  if (!ctx) redirect("/");

  if (ctx.status === ApplicationContributorStatus.SUBMITTED) {
    redirect("/contribute/submitted");
  }

  const firstName = user.firstName ?? "there";
  const schoolLabel = ctx.school === "TRINITY" ? "Trinity School" : "Whitgift School";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
          Welcome, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You have been invited to provide your financial details for a bursary
          application.
        </p>
      </div>

      {/* Child context — read-only, name only */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Application for
        </p>
        <p className="mt-1 text-lg font-semibold text-primary-900">
          {ctx.childName}
        </p>
        <p className="mt-1 text-sm text-slate-500">{schoolLabel}</p>
      </div>

      {/* Confidentiality reassurance */}
      <div className="flex items-start gap-3 rounded-xl border border-info-200 bg-info-50 p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-info-600" aria-hidden="true" />
        <div className="text-sm text-info-800">
          <p className="font-semibold">Your information is confidential</p>
          <p className="mt-1">
            The Foundation assesses each parent&rsquo;s circumstances
            independently. The other parent cannot see what you submit, and you
            cannot see their details. You only need to provide your own income,
            assets, and supporting documents.
          </p>
        </div>
      </div>

      {/* What you'll provide */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          What we&rsquo;ll ask for
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
              1
            </span>
            Your details (contact &amp; employment)
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
              2
            </span>
            Your income
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
              3
            </span>
            Your assets &amp; liabilities (with supporting documents)
          </li>
        </ul>
      </div>

      {/* Start CTA */}
      <Link
        href="/contribute/parent-details"
        className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-900 text-white">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900 group-hover:text-primary-900">
            {ctx.status === ApplicationContributorStatus.IN_PROGRESS
              ? "Continue your contribution"
              : "Start your contribution"}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            Provide your financial details for {ctx.childName}
          </p>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary-600"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
