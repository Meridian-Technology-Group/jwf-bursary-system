"use client";

/**
 * WP-13: Sibling List
 *
 * Displays all linked siblings within a family group for a given bursary
 * account. Features:
 *   - Priority ordering with up/down arrow controls
 *   - Current child highlighted with a badge
 *   - Payable fees from latest assessment shown per sibling
 *   - "Unlink" button with inline confirmation per sibling
 *   - Empty state when no siblings are linked
 *
 * Props are passed as plain serialised data from a server component parent
 * so no Prisma Decimal objects cross the boundary.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Unlink,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiblingListItem {
  id: string;
  familyGroupId: string;
  bursaryAccountId: string;
  priorityOrder: number;
  bursaryAccount: {
    id: string;
    childName: string;
    school: string;
    reference: string;
    latestPayableFees: number | null;
  };
}

interface SiblingListProps {
  siblings: SiblingListItem[];
  /** The bursary account ID of the current child being viewed */
  currentBursaryAccountId: string;
  /** Whether the current user may edit (assessor). Viewers see read-only. */
  isAssessor: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCHOOL_LABELS: Record<string, string> = {
  WHITGIFT: "Whitgift",
  TRINITY: "Trinity",
};

function fmt(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Unlink confirmation inline ───────────────────────────────────────────────

interface UnlinkConfirmProps {
  childName: string;
  siblingLinkId: string;
  onDone: () => void;
  onCancel: () => void;
}

function UnlinkConfirm({
  childName,
  siblingLinkId,
  onDone,
  onCancel,
}: UnlinkConfirmProps) {
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/siblings/${siblingLinkId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          onDone();
        } else {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Failed to remove sibling link");
        }
      } catch {
        setError("Network error — please try again");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-600">
        Remove <span className="font-medium">{childName}</span> from this sibling
        group?
      </p>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-rose-600 hover:bg-rose-700 text-white"
          onClick={handleConfirm}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Unlink className="h-3 w-3" aria-hidden="true" />
          )}
          {isPending ? "Removing…" : "Confirm Unlink"}
        </Button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SiblingList({
  siblings: initialSiblings,
  currentBursaryAccountId,
  isAssessor,
}: SiblingListProps) {
  const router = useRouter();

  // Local optimistic state so re-ordering feels instant
  const [siblings, setSiblings] = React.useState<SiblingListItem[]>(initialSiblings);
  const [confirmUnlinkId, setConfirmUnlinkId] = React.useState<string | null>(null);
  const [reorderError, setReorderError] = React.useState<string | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);

  // Keep in sync when server data changes (e.g. after link added externally)
  React.useEffect(() => {
    setSiblings(initialSiblings);
  }, [initialSiblings]);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (siblings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
        <Users className="h-8 w-8 text-slate-200" aria-hidden="true" />
        <p className="text-sm text-slate-400">No siblings linked</p>
      </div>
    );
  }

  // ── Reorder helpers ────────────────────────────────────────────────────────

  async function moveItem(index: number, direction: "up" | "down") {
    if (isReordering) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    // Assign sequential priority in local state
    const withOrder = reordered.map((s, i) => ({ ...s, priorityOrder: i + 1 }));
    setSiblings(withOrder);

    const familyGroupId = siblings[0].familyGroupId;
    const orderedIds = withOrder.map((s) => s.bursaryAccountId);

    setIsReordering(true);
    setReorderError(null);
    try {
      const res = await fetch(`/api/siblings/${siblings[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyGroupId, orderedIds }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setReorderError(data.error ?? "Reorder failed");
        setSiblings(initialSiblings); // roll back
      }
    } catch {
      setReorderError("Network error — reorder could not be saved");
      setSiblings(initialSiblings);
    } finally {
      setIsReordering(false);
    }
  }

  // ── Unlink done callback ───────────────────────────────────────────────────

  function handleUnlinkDone() {
    setConfirmUnlinkId(null);
    router.refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Explanation */}
      <p className="text-xs text-slate-500 leading-relaxed">
        Child 1&apos;s payable fees are deducted from Child 2&apos;s HNDI when
        calculating their bursary. Drag the order using the arrows to reflect the
        correct assessment sequence.
      </p>

      {/* Error banner */}
      {reorderError && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {reorderError}
        </div>
      )}

      {/* Sibling rows */}
      <ol className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white overflow-hidden">
        {siblings.map((sibling, index) => {
          const isCurrent = sibling.bursaryAccountId === currentBursaryAccountId;
          const isConfirming = confirmUnlinkId === sibling.id;

          return (
            <li
              key={sibling.id}
              className={cn(
                "px-4 py-3",
                isCurrent && "bg-primary-50/60"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Priority badge */}
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    isCurrent
                      ? "bg-primary-700 text-white"
                      : "bg-neutral-200 text-slate-600"
                  )}
                  aria-label={`Priority ${sibling.priorityOrder}`}
                >
                  {sibling.priorityOrder}
                </span>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">
                      {sibling.bursaryAccount.childName}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700">
                        This child
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5 text-xs text-slate-500">
                    <span>{SCHOOL_LABELS[sibling.bursaryAccount.school] ?? sibling.bursaryAccount.school}</span>
                    <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
                    <span>{sibling.bursaryAccount.reference}</span>
                    {sibling.bursaryAccount.latestPayableFees !== null && (
                      <>
                        <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
                        <span className="font-mono text-slate-600">
                          {fmt(sibling.bursaryAccount.latestPayableFees)} / yr
                        </span>
                      </>
                    )}
                  </div>

                  {/* Unlink confirmation inline */}
                  {isConfirming && (
                    <div className="mt-2">
                      <UnlinkConfirm
                        childName={sibling.bursaryAccount.childName}
                        siblingLinkId={sibling.id}
                        onDone={handleUnlinkDone}
                        onCancel={() => setConfirmUnlinkId(null)}
                      />
                    </div>
                  )}
                </div>

                {/* Controls — assessor only */}
                {isAssessor && !isConfirming && (
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Up/down arrows */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0 || isReordering}
                      aria-label={`Move ${sibling.bursaryAccount.childName} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                      onClick={() => moveItem(index, "down")}
                      disabled={index === siblings.length - 1 || isReordering}
                      aria-label={`Move ${sibling.bursaryAccount.childName} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>

                    {/* Unlink */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      onClick={() => setConfirmUnlinkId(sibling.id)}
                      aria-label={`Unlink ${sibling.bursaryAccount.childName}`}
                    >
                      <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Wrapper Card ─────────────────────────────────────────────────────────────

export function SiblingListCard({
  siblings,
  currentBursaryAccountId,
  isAssessor,
}: SiblingListProps) {
  return (
    <Card>
      <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Linked Siblings
          {siblings.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({siblings.length} {siblings.length === 1 ? "account" : "accounts"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-4">
        <SiblingList
          siblings={siblings}
          currentBursaryAccountId={currentBursaryAccountId}
          isAssessor={isAssessor}
        />
      </CardContent>
    </Card>
  );
}
