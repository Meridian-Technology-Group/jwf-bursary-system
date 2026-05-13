"use client";

/**
 * Per-row admin actions for an Invitation: Resend + Revoke.
 *
 * Both actions are wrapped in a shadcn Dialog confirmation step and call
 * the corresponding server action. Visible only on PENDING rows; ACCEPTED
 * and EXPIRED rows render a static em-dash from the parent component.
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
  resendInvitationAction,
  revokeInvitationAction,
} from "@/app/(admin)/invitations/actions";

interface InvitationRowActionsProps {
  invitationId: string;
  email: string;
}

export function InvitationRowActions({
  invitationId,
  email,
}: InvitationRowActionsProps) {
  const router = useRouter();
  const [resendOpen, setResendOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendInvitationAction(invitationId);
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
      const result = await revokeInvitationAction(invitationId);
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
      <div className="flex items-center gap-2">
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
          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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

      {/* Resend dialog */}
      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend invitation</DialogTitle>
            <DialogDescription>
              A fresh single-use link will be emailed to{" "}
              <strong>{email}</strong> and the previous link will stop
              working. The 30-day expiry resets.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
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

      {/* Revoke dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation</DialogTitle>
            <DialogDescription>
              The invitation link for <strong>{email}</strong> will be
              marked EXPIRED and the pending auth account (if any) will be
              removed. This cannot be undone — you can always send a new
              invitation from the form above.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
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
