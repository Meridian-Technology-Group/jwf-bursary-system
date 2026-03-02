"use client";

/**
 * Assessor assignment dropdown for the application detail header.
 *
 * Renders a Select that lists all ASSESSOR profiles. Selecting an assessor
 * (or "Unassigned") calls assignApplicationAction and shows a pending state
 * while the server action is in flight.
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignApplicationAction } from "@/app/(admin)/applications/[id]/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Assessor {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

interface AssignAssessorSelectProps {
  applicationId: string;
  currentAssessorId: string | null;
  assessors: Assessor[];
}

// Sentinel value used for the "Unassigned" option inside the Select.
const UNASSIGNED_VALUE = "__unassigned__";

// ─── Component ────────────────────────────────────────────────────────────────

export function AssignAssessorSelect({
  applicationId,
  currentAssessorId,
  assessors,
}: AssignAssessorSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    const assessorId = value === UNASSIGNED_VALUE ? null : value;
    startTransition(() => {
      void assignApplicationAction(applicationId, assessorId);
    });
  };

  const selectValue = currentAssessorId ?? UNASSIGNED_VALUE;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500 shrink-0">
        Assessor
      </span>
      <div className="relative">
        <Select
          value={selectValue}
          onValueChange={handleChange}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            {isPending ? (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Saving…
              </span>
            ) : (
              <SelectValue placeholder="Unassigned" />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_VALUE}>
              <span className="text-slate-400 italic">Unassigned</span>
            </SelectItem>
            {assessors.map((assessor) => {
              const name =
                `${assessor.firstName ?? ""} ${assessor.lastName ?? ""}`.trim() ||
                assessor.id;
              return (
                <SelectItem key={assessor.id} value={assessor.id}>
                  {name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
