"use client";

/**
 * WP-12: Reason Code Selector
 *
 * Multi-select checkbox panel for all active reason codes.
 * Grouped by code range with a selected-count badge.
 * Collapsible for space efficiency.
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Tag } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  groupHeadingForCode,
  REASON_CODE_GROUP_HEADINGS,
} from "@/lib/reason-codes/category";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReasonCodeOption {
  id: string;
  code: number;
  label: string;
}

interface ReasonCodeSelectorProps {
  reasonCodes: ReasonCodeOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

// ─── Group helpers ─────────────────────────────────────────────────────────────

/**
 * Bucket reason codes into named groups by numeric range. The range→category
 * mapping lives in the shared `categoryForCode` util (Epic 08) so the selector
 * and the settings table can never drift — and the real codes (D4) swap in by
 * editing one place.
 */
function groupReasonCodes(
  codes: ReasonCodeOption[]
): Array<{ groupLabel: string; codes: ReasonCodeOption[] }> {
  const buckets: Record<string, ReasonCodeOption[]> = {};

  for (const rc of codes) {
    const groupLabel = groupHeadingForCode(rc.code);
    if (!buckets[groupLabel]) {
      buckets[groupLabel] = [];
    }
    buckets[groupLabel].push(rc);
  }

  const groups: Array<{ groupLabel: string; codes: ReasonCodeOption[] }> = [];
  for (const key of REASON_CODE_GROUP_HEADINGS) {
    if (buckets[key] && buckets[key].length > 0) {
      groups.push({ groupLabel: key, codes: buckets[key] });
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReasonCodeSelector({
  reasonCodes,
  selectedIds,
  onChange,
  disabled = false,
}: ReasonCodeSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedSet = React.useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const groups = React.useMemo(
    () => groupReasonCodes(reasonCodes),
    [reasonCodes]
  );

  function handleToggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter((s) => s !== id));
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-700">
            Reason Codes
          </span>
          {selectedIds.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-800">
              {selectedIds.length} selected
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        )}
      </button>

      {/* Expandable panel */}
      {isOpen && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {groups.map(({ groupLabel, codes }) => (
            <div key={groupLabel} className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {groupLabel}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {codes.map((rc) => {
                  const checkboxId = `rc-${rc.id}`;
                  const isChecked = selectedSet.has(rc.id);
                  return (
                    <div key={rc.id} className="flex items-start gap-2">
                      <Checkbox
                        id={checkboxId}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleToggle(rc.id, checked === true)
                        }
                        disabled={disabled}
                        className={cn(
                          "mt-0.5 shrink-0",
                          disabled && "opacity-50 cursor-not-allowed"
                        )}
                      />
                      <Label
                        htmlFor={checkboxId}
                        className={cn(
                          "cursor-pointer text-sm leading-snug text-slate-700",
                          disabled && "cursor-not-allowed text-slate-400"
                        )}
                      >
                        <span className="font-mono text-xs font-semibold text-slate-500 mr-1">
                          {rc.code}.
                        </span>
                        {rc.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="px-4 py-4 text-center text-sm text-slate-400">
              No reason codes available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
