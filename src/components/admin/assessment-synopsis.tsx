"use client";

/**
 * Epic 06: Assessment Synopsis
 *
 * The SINGLE qualitative narrative for an assessment, replacing the six
 * AssessmentChecklist tabs and the recommendation familySynopsis/summary
 * boxes. One auto-saving textarea bound to `Assessment.synopsis`.
 *
 * Key behaviours (plan §5.3c):
 *  - Always visible: docked in the assessment workspace AND rendered on the
 *    completed/final + recommendation screens.
 *  - EDITABLE AFTER COMPLETION: this component deliberately does NOT take a
 *    read-only flag. The rest of the assessment form / recommendation form lock
 *    on COMPLETED / outcome, but the synopsis stays editable, backed by the
 *    always-permissive `saveSynopsis` server action.
 *  - Auto-saves on blur (debounced 600 ms); shows a saving / saved / error
 *    indicator. Skips redundant saves.
 */

import * as React from "react";
import { Loader2, CheckCircle2, AlertTriangle, NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveSynopsis } from "@/app/(admin)/applications/[id]/assessment/checklist-actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface AssessmentSynopsisProps {
  assessmentId: string;
  applicationId: string;
  /** Current synopsis text (null when never written). */
  synopsis: string | null;
  /**
   * Visual context only. When true, a "completed" affordance explains that the
   * synopsis remains editable even though the assessment is locked. It does NOT
   * disable the textarea — the synopsis is always editable.
   */
  assessmentCompleted?: boolean;
  className?: string;
}

const PLACEHOLDER =
  "Single qualitative synopsis for this assessment — household circumstances, " +
  "living conditions, debt, other JWF fees, staff connections, and the overall " +
  "financial profile. Use ## headings to keep sections legible.";

export function AssessmentSynopsis({
  assessmentId,
  applicationId,
  synopsis,
  assessmentCompleted = false,
  className,
}: AssessmentSynopsisProps) {
  const [value, setValue] = React.useState(synopsis ?? "");
  const [status, setStatus] = React.useState<SaveStatus>("idle");

  const savedValue = React.useRef(synopsis ?? "");
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = React.useCallback(
    async (next: string) => {
      if (next === savedValue.current) return;
      setStatus("saving");
      const result = await saveSynopsis(assessmentId, applicationId, next);
      if (result.success) {
        savedValue.current = next;
        setStatus("saved");
        setTimeout(() => {
          // Only clear if no newer save started in the meantime.
          setStatus((s) => (s === "saved" ? "idle" : s));
        }, 2500);
      } else {
        setStatus("error");
      }
    },
    [assessmentId, applicationId]
  );

  const scheduleSave = React.useCallback(
    (next: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => save(next), 600);
    },
    [save]
  );

  const flushSave = React.useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    save(value);
  }, [save, value]);

  React.useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b border-neutral-100 bg-neutral-50 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <NotebookPen
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">
                Assessment Synopsis
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                {assessmentCompleted
                  ? "Editable after completion — auto-saved on blur"
                  : "One qualitative narrative for this assessment — auto-saved on blur"}
              </p>
            </div>
          </div>
          <SaveStatusIndicator status={status} />
        </div>
      </CardHeader>

      <CardContent className="px-5 py-4">
        <div className="mb-2 flex items-center justify-end">
          <span className="text-xs text-slate-300">{value.length} chars</span>
        </div>
        <Textarea
          id="assessment-synopsis"
          aria-label="Assessment synopsis"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            scheduleSave(e.target.value);
          }}
          onBlur={flushSave}
          placeholder={PLACEHOLDER}
          rows={8}
          className={cn(
            "resize-y border-slate-200 text-sm leading-relaxed text-slate-700",
            "placeholder:text-slate-300 focus-visible:ring-primary/30"
          )}
        />
        {assessmentCompleted && (
          <p className="mt-1.5 text-xs text-slate-400">
            This assessment is completed. The synopsis remains editable — other
            assessment fields are locked.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Save Status Indicator ────────────────────────────────────────────────────

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Save failed
      </span>
    );
  }
  return null;
}
