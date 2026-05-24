/**
 * Secondary-parent thank-you page — /contribute/submitted.
 *
 * Shown after the second parent submits their contribution. Read-only: the
 * contributor row is now SUBMITTED so the section pages redirect here. A
 * non-secondary user is sent to the portal home.
 */

import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getSecondaryContributorContext } from "@/lib/db/queries/contributors";

export const metadata = { title: "Contribution Received" };

export default async function ContributeSubmittedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    getSecondaryContributorContext(tx, user.id)
  );

  if (!ctx) redirect("/");

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle2 className="h-9 w-9 text-green-600" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-primary-900">
        Thank you — your contribution has been received
      </h1>
      <p className="text-sm text-slate-600">
        We have received your financial details for the bursary application for{" "}
        <span className="font-semibold">{ctx.childName}</span>. Your information
        will be considered confidentially as part of the assessment.
      </p>
      <p className="text-sm text-slate-500">
        There is nothing further you need to do at this stage. We have also sent
        you a confirmation by email. If your circumstances change or you have any
        questions, please contact the Bursary Office.
      </p>
    </div>
  );
}
