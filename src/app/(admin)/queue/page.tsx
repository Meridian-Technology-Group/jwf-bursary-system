/**
 * Application Queue — admin page.
 *
 * Server component. Requires ASSESSOR or VIEWER role.
 * Fetches the full application list and passes it to the client-side
 * ApplicationTable component for filtering/sorting.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { listApplications, listRounds } from "@/lib/db/queries/applications";
import { ApplicationTable } from "@/components/admin/application-table";
import { InternalRequestDialog } from "@/components/admin/internal-request-dialog";

export const metadata = {
  title: "Applications",
};

export default async function QueuePage() {
  await requireRole([Role.ASSESSOR, Role.VIEWER]);

  const [applications, rounds] = await Promise.all([
    listApplications(),
    listRounds(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Applications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and assess submitted bursary applications.
          </p>
        </div>
        <InternalRequestDialog rounds={rounds} />
      </div>

      {/* Data table */}
      <ApplicationTable applications={applications} rounds={rounds} />
    </div>
  );
}
