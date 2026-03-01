/**
 * Post-submission confirmation page.
 *
 * Shown immediately after submitApplication redirects here.
 * Displays: confirmation message, reference, submission date, next steps.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Clock, FileText, Mail } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export const metadata = {
  title: "Application Submitted",
};

export default async function SubmittedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load the most recently submitted application for this user
  const application = await prisma.application.findFirst({
    where: {
      leadApplicantId: user.id,
      status: "SUBMITTED",
    },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      reference: true,
      submittedAt: true,
      childName: true,
      round: {
        select: { academicYear: true, decisionDate: true },
      },
    },
  });

  if (!application) {
    // No submitted application — send back to dashboard
    redirect("/");
  }

  const submittedDate = application.submittedAt
    ? new Date(application.submittedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const decisionDate = application.round.decisionDate
    ? new Date(application.round.decisionDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-8">
      {/* Success banner */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2
              className="h-6 w-6 text-green-600"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-green-900">
              Your application has been submitted
            </h1>
            <p className="mt-1 text-sm text-green-700">
              Thank you for submitting your bursary application. You will
              receive a confirmation email shortly.
            </p>
          </div>
        </div>
      </div>

      {/* Application details card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Application details
        </h2>

        <dl className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <dt className="flex items-center gap-2 text-sm text-slate-500">
              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
              Reference number
            </dt>
            <dd className="text-sm font-semibold text-primary-900 font-mono">
              {application.reference}
            </dd>
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
            <dt className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              Submission date
            </dt>
            <dd className="text-sm font-medium text-slate-800">
              {submittedDate}
            </dd>
          </div>

          {application.childName && (
            <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-sm text-slate-500">Child&rsquo;s name</dt>
              <dd className="text-sm font-medium text-slate-800">
                {application.childName}
              </dd>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4">
            <dt className="text-sm text-slate-500">Assessment round</dt>
            <dd className="text-sm font-medium text-slate-800">
              {application.round.academicYear}
            </dd>
          </div>
        </dl>
      </div>

      {/* What happens next */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-primary-900">
          What happens next?
        </h2>

        <ol className="space-y-4">
          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Confirmation email
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                You will receive a confirmation email at{" "}
                <span className="font-medium">{user.email}</span> with your
                application reference.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Document review
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Our assessors will review your application and any supporting
                documents you have uploaded. You may be contacted if additional
                information is needed.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Financial assessment
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Your application will undergo a full financial assessment based
                on the information and documents provided.
              </p>
            </div>
          </li>

          <li className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
              4
            </span>
            <div>
              <p className="text-sm font-medium text-slate-800">
                Outcome notification
                {decisionDate && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (expected by {decisionDate})
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                You will be notified of the outcome by email. You can also
                check your application status at any time using the link below.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* Contact note */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Mail
          className="mt-0.5 h-5 w-5 shrink-0 text-blue-500"
          aria-hidden="true"
        />
        <p className="text-sm text-blue-800">
          If you have any questions about your application please contact the
          John Whitgift Foundation Bursaries team, quoting your reference
          number{" "}
          <span className="font-semibold font-mono">{application.reference}</span>.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/status"
          className="inline-flex items-center gap-2 rounded-md bg-primary-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        >
          View application status
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
