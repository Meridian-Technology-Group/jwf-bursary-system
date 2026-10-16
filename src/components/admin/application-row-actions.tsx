"use client";

/**
 * ApplicationRowActions — the per-row action menu on the Applications list.
 *
 * Exposes the case-management transitions the Foundation drives from the list
 * (state-model §4/§5/§6, revised by item 2's unified close):
 *   • Move to active    → the school's OFFERED decision (AWARDED). Routes to the
 *                         recommendation page to capture the award £ figures.
 *   • Return for correction → the form goes back to the family with its answers
 *                          and documents (rejectAndRestartApplication)
 *   • Close…            → item 2's SINGLE terminal state, ADMIN-only, driven by
 *                         an admin-configured close reason whose purgeOnClose
 *                         flag decides purge-vs-retain. REPLACES the old
 *                         Decline (outcome write) and Withdraw-account items —
 *                         a school decline is now Close with the matching
 *                         reason (D-3: no outcome coupling), and a live account
 *                         is wound down inside the close.
 *
 * Gating mirrors the server-side guards so disabled items explain themselves
 * rather than failing on click:
 *   - Reject          — only before a final outcome (form SUBMITTED, assessment
 *                       not yet COMPLETED, no outcome), and not closed.
 *   - Move to active  — only once the assessment is COMPLETED in full and no
 *                       outcome has been set yet, and not closed.
 *   - Close…          — ADMIN only (hidden otherwise); never offered on an
 *                       already-closed application (no double-close).
 *
 * Dialogs are rendered controlled (not via DialogTrigger nested in a dropdown
 * item, which Radix warns against) — a single `activeDialog` state drives them.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  MoreHorizontal,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { RejectRestartDialog } from "@/components/admin/reject-restart-dialog";
import {
  CloseApplicationDialog,
  type CloseReasonOption,
} from "@/components/admin/close-application-dialog";
import type {
  ApplicationFormStatus,
  AssessmentStatus,
  AssessmentOutcome,
} from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationRowActionsProps {
  applicationId: string;
  reference: string;
  formStatus: ApplicationFormStatus;
  assessmentStatus: AssessmentStatus | null;
  outcome: AssessmentOutcome | null;
  /** Unified close marker (item 2) — non-null hides every transition. */
  closedAt: Date | null;
  /** Close is ADMIN-only (Story 2.1); the item is hidden for other roles. */
  isAdmin: boolean;
  /** Active close reasons for the Close dialog (item 4.1). */
  closeReasons: CloseReasonOption[];
}

type ActiveDialog = "reject" | "close" | null;

// ─── Component ──────────────────────────────────────────────────────────────────

export function ApplicationRowActions({
  applicationId,
  reference,
  formStatus,
  assessmentStatus,
  outcome,
  closedAt,
  isAdmin,
  closeReasons,
}: ApplicationRowActionsProps) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = React.useState<ActiveDialog>(null);

  // Availability — kept in lock-step with the server guards.
  const isClosed = closedAt != null;
  const hasOutcome = outcome != null;
  const assessmentComplete = assessmentStatus === "COMPLETED";
  // Reject: only before a final outcome, while the form is still submitted and
  // the assessment is reversible (not yet completed), and not closed.
  const canReject =
    !isClosed && !hasOutcome && formStatus === "SUBMITTED" && !assessmentComplete;
  // Move to active: the assessment must be finished in full, and no outcome
  // recorded yet, and not closed.
  const canDecide = !isClosed && assessmentComplete && !hasOutcome;
  // Close: ADMIN-only; never re-offered on an already-closed application.
  const canClose = isAdmin && !isClosed;

  const decideDisabledReason = isClosed
    ? "This application is closed."
    : hasOutcome
      ? "An outcome has already been recorded."
      : "The assessment must be completed in full first.";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={(e) => e.stopPropagation()}
            aria-label="Application actions"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Move to active bursary — routes to the recommendation page to
              capture the award figures (the OFFERED decision). */}
          <GatedItem
            enabled={canDecide}
            disabledReason={decideDisabledReason}
            onSelect={() =>
              router.push(`/applications/${applicationId}/recommendation`)
            }
            icon={<CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />}
            label="Move to active bursary…"
          />
          <DropdownMenuSeparator />

          {/* Reject & restart. */}
          <GatedItem
            enabled={canReject}
            disabledReason={
              isClosed
                ? "This application is closed."
                : "Only available before an outcome is set."
            }
            onSelect={() => setActiveDialog("reject")}
            icon={<RotateCcw className="mr-2 h-4 w-4 text-rose-600" />}
            label="Return for correction…"
          />
          {/* Unified close (item 2) — ADMIN only, hidden for other roles. */}
          {isAdmin && canClose && (
            <GatedItem
              enabled
              disabledReason=""
              onSelect={() => setActiveDialog("close")}
              icon={<Archive className="mr-2 h-4 w-4 text-rose-600" />}
              label="Close…"
            />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Controlled dialogs */}
      <RejectRestartDialog
        applicationId={applicationId}
        open={activeDialog === "reject"}
        onOpenChange={(o) => setActiveDialog(o ? "reject" : null)}
        onDone={() => router.refresh()}
      />
      {isAdmin && (
        <CloseApplicationDialog
          applicationId={applicationId}
          reference={reference}
          reasons={closeReasons}
          open={activeDialog === "close"}
          onOpenChange={(o) => setActiveDialog(o ? "close" : null)}
        />
      )}
    </>
  );
}

// ─── Gated dropdown item ─────────────────────────────────────────────────────

function GatedItem({
  enabled,
  disabledReason,
  onSelect,
  icon,
  label,
}: {
  enabled: boolean;
  disabledReason: string;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  if (enabled) {
    return (
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onSelect();
        }}
      >
        {icon}
        {label}
      </DropdownMenuItem>
    );
  }
  // Disabled: explain why on hover. A plain disabled DropdownMenuItem swallows
  // pointer events, so wrap it and let the tooltip sit on the wrapper.
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <DropdownMenuItem
              disabled
              onSelect={(e) => e.preventDefault()}
              className="opacity-50"
            >
              {icon}
              {label}
            </DropdownMenuItem>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-56 text-xs">
          {disabledReason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
