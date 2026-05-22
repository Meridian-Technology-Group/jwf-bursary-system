"use client";

/**
 * Staff Table
 *
 * Displays all staff users with inline role editing and deactivation.
 * Used on the /users page.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  updateStaffRoleAction,
  deactivateStaffAction,
} from "@/app/(admin)/users/actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StaffUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: Date;
  _count: { assignedApplications: number };
}

interface StaffTableProps {
  users: StaffUser[];
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_BADGE_STYLES: Record<string, string> = {
  ADMIN: "bg-green-50 text-green-700",
  ASSESSOR: "bg-blue-50 text-blue-700",
  VIEWER: "bg-slate-100 text-slate-600",
  DELETED: "bg-red-50 text-red-600",
};

function formatName(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return name || email;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Row component (handles its own transition for inline role editing)
// ---------------------------------------------------------------------------

function StaffRow({
  user,
  isSelf,
}: {
  user: StaffUser;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDeactivated = user.role === "DELETED";

  function handleRoleChange(newRole: string) {
    setError(null);
    const formData = new FormData();
    formData.set("userId", user.id);
    formData.set("newRole", newRole);

    startTransition(async () => {
      const result = await updateStaffRoleAction(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to update role");
      } else {
        router.refresh();
      }
    });
  }

  function handleDeactivate() {
    setError(null);
    const formData = new FormData();
    formData.set("userId", user.id);

    startTransition(async () => {
      const result = await deactivateStaffAction(formData);
      if (!result.success) {
        setError(result.error ?? "Failed to deactivate user");
      } else {
        setDeactivateOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <tr className={cn("hover:bg-slate-50", isDeactivated && "opacity-60")}>
        {/* Name */}
        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-700">
          {formatName(user.firstName, user.lastName, user.email)}
          {isSelf && (
            <span className="ml-2 text-xs text-slate-400">(you)</span>
          )}
        </td>

        {/* Email */}
        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
          {user.email}
        </td>

        {/* Role */}
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              ROLE_BADGE_STYLES[user.role] ?? "bg-slate-100 text-slate-600"
            )}
          >
            {user.role}
          </span>
        </td>

        {/* Assigned Apps */}
        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 text-center">
          {user._count.assignedApplications}
        </td>

        {/* Joined */}
        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
          {formatDate(user.createdAt)}
        </td>

        {/* Actions */}
        <td className="whitespace-nowrap px-4 py-3">
          {isSelf || isDeactivated ? (
            <span className="text-xs text-slate-400">
              {isDeactivated ? "Deactivated" : "—"}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              {/* Inline role select */}
              <Select
                value={user.role}
                onValueChange={handleRoleChange}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="ASSESSOR">Assessor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>

              {/* Deactivate button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeactivateOpen(true)}
                disabled={isPending}
                title="Deactivate user"
              >
                <UserX className="h-4 w-4" aria-hidden="true" />
              </Button>

              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
          )}
          {error && (
            <p className="mt-1 text-xs text-red-600">{error}</p>
          )}
        </td>
      </tr>

      {/* Deactivate confirmation dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{formatName(user.firstName, user.lastName, user.email)}</strong>?
              Their role will be set to DELETED and all assigned applications
              will be unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function StaffTable({ users, currentUserId }: StaffTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
        <p className="text-sm font-medium text-slate-500">No staff users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {["Name", "Email", "Role", "Assigned", "Joined", "Actions"].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500",
                      heading === "Assigned" && "text-center"
                    )}
                  >
                    {heading}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {users.map((user) => (
              <StaffRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
