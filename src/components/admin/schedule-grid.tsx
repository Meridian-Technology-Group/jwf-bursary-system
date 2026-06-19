"use client";

/**
 * Epic 10 (PR-7) — admin forward-schedule grid.
 *
 * Renders a rolling bursary account's multi-year schedule (the application-
 * lifecycle illustration's Year 1..N grid): Year · Type · Status · Manually
 * Created · Available On · Required By · Received On · Show on Portal. Each row
 * has a Show/Hide-on-portal toggle; the card header carries a Regenerate
 * Schedule button (idempotent — only adds missing future years).
 *
 * Props are plain serialised data (no Prisma Date/Decimal crosses the boundary).
 * ADMIN gates the mutations server-side; VIEWER/ASSESSOR see a read-only grid
 * (no toggle/regenerate controls) — `canManage` drives that.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLondonDate } from "@/lib/datetime";
import type { ScheduleEntryRow } from "@/lib/db/queries/schedule";
import {
  regenerateScheduleAction,
  toggleScheduleShowOnPortalAction,
} from "@/app/(admin)/applications/[id]/schedule-actions";

const STATUS_VARIANT: Record<
  ScheduleEntryRow["status"],
  "default" | "secondary" | "outline"
> = {
  SCHEDULED: "outline",
  RECEIVED: "secondary",
  COMPLETE: "default",
};

const STATUS_LABEL: Record<ScheduleEntryRow["status"], string> = {
  SCHEDULED: "Scheduled",
  RECEIVED: "Received",
  COMPLETE: "Complete",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return formatLondonDate(new Date(iso));
}

interface ScheduleGridProps {
  applicationId: string;
  entries: ScheduleEntryRow[];
  /** True for ADMIN — shows the Regenerate button + per-row Show/Hide toggle. */
  canManage: boolean;
}

export function ScheduleGrid({
  applicationId,
  entries,
  canManage,
}: ScheduleGridProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [regenerating, setRegenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleToggle(entryId: string, next: boolean) {
    setPendingId(entryId);
    setError(null);
    try {
      const res = await toggleScheduleShowOnPortalAction(
        applicationId,
        entryId,
        next
      );
      if (!res.success) {
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("Failed to update portal visibility.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await regenerateScheduleAction(applicationId);
      if (!res.success) {
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setError("Failed to regenerate the schedule.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarRange className="h-4 w-4 text-slate-500" aria-hidden />
          Assessment Schedule
        </CardTitle>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            )}
            Regenerate Schedule
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0 py-0">
        {error && (
          <p
            role="alert"
            className="px-6 py-3 text-sm text-error-600 bg-error-50 border-b border-error-100"
          >
            {error}
          </p>
        )}

        {entries.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-400">
            No forward schedule has been generated for this account yet.
            {canManage && " Use Regenerate Schedule to create it."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Manually Created</TableHead>
                  <TableHead>Available On</TableHead>
                  <TableHead>Required By</TableHead>
                  <TableHead>Received On</TableHead>
                  <TableHead className="text-right">Show on Portal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.scheduleYear}</TableCell>
                    <TableCell>{e.academicYear}</TableCell>
                    <TableCell className="text-slate-500">{e.type}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[e.status]}>
                        {STATUS_LABEL[e.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {e.manuallyCreated ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>{fmt(e.availableOn)}</TableCell>
                    <TableCell>{fmt(e.requiredBy)}</TableCell>
                    <TableCell>{fmt(e.receivedOn)}</TableCell>
                    <TableCell className="text-right">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-2">
                          {pendingId === e.id && (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin text-slate-400"
                              aria-hidden
                            />
                          )}
                          <Switch
                            checked={e.showOnPortal}
                            disabled={pendingId === e.id}
                            onCheckedChange={(next) => handleToggle(e.id, next)}
                            aria-label={`${
                              e.showOnPortal ? "Hide" : "Show"
                            } year ${e.scheduleYear} on the portal`}
                          />
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {e.showOnPortal ? "Shown" : "Hidden"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
