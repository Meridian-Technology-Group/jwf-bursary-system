"use client";

/**
 * CALC-10 — recipient's fees-account code (workbook §3.16 "Assessor's
 * wizard" admin page). A small inline field on the bursary-account admin
 * page (`applications/[id]/page.tsx`, the "Applicant Data" view — the
 * account-scoped surface once a bursary account is linked), ADMIN/ASSESSOR
 * editable, auto-saved on blur. Rendered read-only for VIEWER, and reused
 * (read-only) on the assessment page's header context so the assessor sees
 * it without needing to switch tabs.
 */

import * as React from "react";
import { Loader2, CheckCircle2, AlertTriangle, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateFeesAccountCodeAction } from "@/app/(admin)/applications/[id]/bursary-account-actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface FeesAccountCodeFieldProps {
  accountId: string;
  applicationId: string;
  feesAccountCode: string | null;
  /** VIEWER (or the assessment-page header context) renders plain text — no input. */
  readOnly?: boolean;
  className?: string;
}

export function FeesAccountCodeField({
  accountId,
  applicationId,
  feesAccountCode,
  readOnly = false,
  className,
}: FeesAccountCodeFieldProps) {
  const [value, setValue] = React.useState(feesAccountCode ?? "");
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const savedValue = React.useRef(feesAccountCode ?? "");

  const flushSave = React.useCallback(async () => {
    if (value === savedValue.current) return;
    setStatus("saving");
    const result = await updateFeesAccountCodeAction(accountId, applicationId, value);
    if (result.success) {
      savedValue.current = value;
      setStatus("saved");
      setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } else {
      setStatus("error");
    }
  }, [accountId, applicationId, value]);

  if (readOnly) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Tag className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Fees account code
        </span>
        <span className="font-mono text-sm text-slate-700">
          {feesAccountCode || "—"}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label
        htmlFor="fees-account-code"
        className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-slate-400"
      >
        Fees account code
      </Label>
      <Input
        id="fees-account-code"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={flushSave}
        placeholder="e.g. school finance reference"
        className="h-8 max-w-[220px] font-mono text-sm"
      />
      <SaveStatusIndicator status={status} />
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-slate-400"
        aria-hidden="true"
      />
    );
  }
  if (status === "saved") {
    return (
      <CheckCircle2
        className="h-3.5 w-3.5 text-emerald-600"
        aria-hidden="true"
      />
    );
  }
  if (status === "error") {
    return (
      <AlertTriangle className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
    );
  }
  return null;
}
