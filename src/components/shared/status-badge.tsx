/**
 * Status badge component for ApplicationStatus enum values.
 *
 * Renders a pill-shaped badge with the correct colour scheme and a
 * Lucide icon for each application status.
 *
 * @deprecated Uses the legacy {@link ApplicationStatus} display union, which
 * does not match the Prisma enum. Slated for wholesale replacement by typed
 * per-lifecycle badges in Epic 01 (plan 01 §5.3). Kept only for existing
 * callers; do not adopt in new code.
 */

import {
  FileEdit,
  Send,
  Search,
  PauseCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Status enum ──────────────────────────────────────────────────────────────

/**
 * @deprecated Legacy display vocabulary — does NOT match the Prisma
 * `ApplicationStatus` enum (which has `PRE_SUBMISSION` / `NOT_STARTED` /
 * `COMPLETED` and no `DRAFT` / `IN_REVIEW`). Live callers map their real
 * Prisma status onto this subset before rendering. Do not wire new code to this
 * union or to `StatusBadge`. Epic 01 (process-alignment status & workflow
 * model, plan 01 §5.3) replaces this with typed per-lifecycle badges
 * (`FormStatusBadge` / `AssessmentStatusBadge` / `OutcomeBadge`); this union and
 * component are removed wholesale there.
 */
export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "PAUSED"
  | "QUALIFIES"
  | "DOES_NOT_QUALIFY";

// ─── Status configuration map ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ApplicationStatus,
  {
    label: string;
    containerClass: string;
    iconClass: string;
    Icon: React.ElementType;
  }
> = {
  DRAFT: {
    label: "Draft",
    containerClass:
      "bg-neutral-100 border-neutral-300 text-neutral-600",
    iconClass: "text-neutral-500",
    Icon: FileEdit,
  },
  SUBMITTED: {
    label: "Submitted",
    containerClass: "bg-blue-50 border-blue-300 text-blue-700",
    iconClass: "text-blue-500",
    Icon: Send,
  },
  IN_REVIEW: {
    label: "In Review",
    containerClass: "bg-orange-50 border-orange-300 text-orange-700",
    iconClass: "text-orange-500",
    Icon: Search,
  },
  PAUSED: {
    label: "Paused",
    containerClass: "bg-yellow-50 border-yellow-300 text-yellow-700",
    iconClass: "text-yellow-600",
    Icon: PauseCircle,
  },
  QUALIFIES: {
    label: "Qualifies",
    containerClass: "bg-green-50 border-green-300 text-green-700",
    iconClass: "text-green-500",
    Icon: CheckCircle2,
  },
  DOES_NOT_QUALIFY: {
    label: "Does Not Qualify",
    containerClass: "bg-rose-50 border-rose-300 text-rose-700",
    iconClass: "text-rose-500",
    Icon: XCircle,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: ApplicationStatus;
  /** Extra className applied to the badge wrapper */
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    // Graceful fallback for unknown status values
    return (
      <span
        className={cn(
          "status-badge border bg-slate-100 text-slate-600",
          className
        )}
      >
        {status}
      </span>
    );
  }

  const { label, containerClass, iconClass, Icon } = config;

  return (
    <span
      className={cn("status-badge border", containerClass, className)}
      title={label}
    >
      <Icon className={cn("h-3 w-3 shrink-0", iconClass)} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export default StatusBadge;
