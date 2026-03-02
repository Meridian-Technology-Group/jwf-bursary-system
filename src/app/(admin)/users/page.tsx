/**
 * User Management page.
 *
 * Server component — requires ADMIN role.
 * Shows the Staff Invite form and a table of all staff users.
 */

export const dynamic = "force-dynamic";

import { requireRole, Role } from "@/lib/auth/roles";
import { listStaffUsers } from "@/lib/db/queries/profiles";
import { StaffInviteForm } from "@/components/admin/staff-invite-form";
import { StaffTable } from "@/components/admin/staff-table";

export const metadata = {
  title: "User Management",
};

export default async function UsersPage() {
  const currentUser = await requireRole([Role.ADMIN]);
  const staffUsers = await listStaffUsers();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          User Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Invite and manage staff accounts (assessors, viewers, and admins).
        </p>
      </div>

      {/* Invite form */}
      <StaffInviteForm />

      {/* Staff table */}
      <section aria-label="Staff users">
        <h2 className="mb-3 text-base font-medium text-slate-700">
          Staff Users
        </h2>
        <StaffTable users={staffUsers} currentUserId={currentUser.id} />
      </section>
    </div>
  );
}
