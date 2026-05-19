"use client";

/**
 * Pending Staff Invitations table for /users.
 *
 * Renders rows from staff_invitations WHERE status='PENDING' with per-row
 * Resend / Revoke actions. Mirrors the applicant InvitationRowActions UX.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  resendStaffInvitationAction,
  revokeStaffInvitationAction,
} from "@/app/(admin)/users/actions";

/** Pending pill — staff invitations don't reuse the ApplicationStatus badge. */
function PendingPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
      PENDING
    </span>
  );
}

export interface PendingStaffInvitationRow {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string; // ISO string from server
  inviterName: string | null;
  inviterEmail: string;
}

interface PendingStaffInvitationsTableProps {
  rows: PendingStaffInvitationRow[];
}

export function PendingStaffInvitationsTable({
  rows,
}: PendingStaffInvitationsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No pending staff invitations.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Invited</th>
            <th className="px-4 py-3">Invited by</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 text-slate-900">{row.email}</td>
              <td className="px-4 py-3 text-slate-700">
                {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
              </td>
              <td className="px-4 py-3 text-slate-700">{row.role}</td>
              <td className="px-4 py-3">
                <PendingPill />
              </td>
              <td className="px-4 py-3 text-slate-700">
                {new Date(row.createdAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {row.inviterName ?? row.inviterEmail}
              </td>
              <td className="px-4 py-3 text-right">
                <StaffInvitationRowActions
                  invitationId={row.id}
                  email={row.email}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface StaffInvitationRowActionsProps {
  invitationId: string;
  email: string;
}

function StaffInvitationRowActions({
  invitationId,
  email,
}: StaffInvitationRowActionsProps) {
  const router = useRouter();
  const [resendOpen, setResendOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendStaffInvitationAction(invitationId);
      if (!result.success) {
        setError(result.error ?? "Failed to resend invitation.");
        return;
      }
      setResendOpen(false);
      router.refresh();
    });
  }

  function handleRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeStaffInvitationAction(invitationId);
      if (!result.success) {
        setError(result.error ?? "Failed to revoke invitation.");
        return;
      }
      setRevokeOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-slate-600 hover:text-slate-900"
          onClick={() => {
            setError(null);
            setResendOpen(true);
          }}
          disabled={isPending}
          title="Resend invitation"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            setError(null);
            setRevokeOpen(true);
          }}
          disabled={isPending}
          title="Revoke invitation"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>

        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend invitation</DialogTitle>
            <DialogDescription>
              A fresh single-use link will be emailed to{" "}
              <strong>{email}</strong> and the previous link will stop working.
              The 72-hour expiry resets.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResendOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleResend}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation</DialogTitle>
            <DialogDescription>
              The invitation link for <strong>{email}</strong> will be marked
              EXPIRED so it can no longer be used. You can always send a fresh
              invitation from the form above.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevokeOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRevoke}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
