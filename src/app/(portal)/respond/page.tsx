/**
 * Respond to a missing-documents request — applicant-facing page.
 *
 * Walkthrough: docs/walkthroughs/applicants/24-respond-to-missing-documents-request.md
 *
 * When an assessor requests further documents, the application is paused and
 * the requested slots + optional message are recorded in the latest
 * `APPLICATION_PAUSED` audit-log row (see `getLatestMissingDocsRequest`).
 * This page reads that request and lists each requested item against its
 * original slot (e.g. "Bank Statement — Parent 1"), letting the applicant
 * re-upload via the same `FileUpload` mechanic used during the application.
 *
 * On submit the application transitions PAUSED → NOT_STARTED ("Under Review")
 * via the `submitMissingDocsResponse` server action.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getLatestMissingDocsRequest } from "@/lib/db/queries/missing-docs";
import { RespondMissingDocsClient } from "./respond-client";

export const metadata = {
  title: "Respond to Document Request",
};

export default async function RespondPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Load the applicant's own application under their RLS context. This
  // establishes ownership: `leadApplicantId: user.id` plus RLS guarantees the
  // returned row belongs to the logged-in applicant.
  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findFirst({
        where: { leadApplicantId: user.id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          childName: true,
          documents: {
            select: {
              id: true,
              slot: true,
              filename: true,
              fileSize: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: "desc" },
          },
        },
      })
  );

  if (!application) redirect("/");

  // Not paused → nothing to respond to. Send the applicant to the status page,
  // which explains the current state.
  if (application.status !== "PAUSED") {
    redirect("/status");
  }

  // Ownership + PAUSED confirmed above. Only now read the assessor-owned
  // `APPLICATION_PAUSED` audit row (service-role context) — see the security
  // note in `getLatestMissingDocsRequest`. The applicant can therefore only
  // ever surface the request for their own paused application.
  const request = await getLatestMissingDocsRequest(application.id);

  // Paused but no recorded request (e.g. a legacy pause). Show a gentle empty
  // state directing the applicant to the email they received.
  if (!request || request.requestedSlots.length === 0) {
    return (
      <div className="space-y-6">
        <Header reference={application.reference} childName={application.childName} />
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Inbox className="h-6 w-6 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            We couldn&rsquo;t find the request details
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Your application is paused while the bursary team waits for more
            information, but we couldn&rsquo;t load the list of documents here.
            Please follow the instructions in the email you received, or reply
            to it directly and the team will help.
          </p>
        </div>
        <BackLink />
      </div>
    );
  }

  // Build the per-slot existing-document map (most recent upload wins).
  const docsBySlot: Record<
    string,
    { id: string; filename: string; fileSize: number; uploadedAt: string }
  > = {};
  for (const doc of application.documents) {
    if (!docsBySlot[doc.slot]) {
      docsBySlot[doc.slot] = {
        id: doc.id,
        filename: doc.filename,
        fileSize: doc.fileSize,
        uploadedAt: doc.uploadedAt.toISOString(),
      };
    }
  }

  return (
    <div className="space-y-8">
      <Header reference={application.reference} childName={application.childName} />
      <RespondMissingDocsClient
        applicationId={application.id}
        requestedSlots={request.requestedSlots}
        customMessage={request.customMessage}
        existingBySlot={docsBySlot}
      />
    </div>
  );
}

function Header({
  reference,
  childName,
}: {
  reference: string;
  childName: string | null;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
        Document request
      </div>
      <h1 className="text-2xl font-semibold text-primary-900">
        Respond to a document request
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Reference{" "}
        <span className="font-mono font-medium text-slate-700">{reference}</span>
        {childName ? <> &middot; {childName}</> : null}
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/status"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to status
    </Link>
  );
}
