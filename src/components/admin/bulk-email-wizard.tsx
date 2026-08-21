"use client";

/**
 * Bulk "Send Email" wizard (item 8), launched from the Applications list bulk
 * toolbar. Three steps: 1 Template → 2 Recipients → 3 Send/Result.
 *
 * IMPORTANT: this component manages its own dialog + phase state entirely
 * independently of `BulkToolbar`'s shared `isPending`/`run` (used by the
 * other bulk actions for a single fire-and-forget mutation). The wizard's
 * dialog must stay open and visible across all three steps, including while
 * the send is in flight and while the result is shown — and the parent's
 * `onDone` (which clears the row selection) is called ONLY when the admin
 * dismisses the result view, never earlier. Clearing the selection earlier
 * would make `selectedIds.length > 0` false at the `ApplicationTable` level,
 * unmounting the whole `BulkToolbar` (and this dialog) mid-flow.
 */

import * as React from "react";
import { useTransition } from "react";
import {
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { replaceMergeFields } from "@/lib/email/merge";
import { buildBulkMergeData, isBulkResolvable } from "@/lib/email/bulk-merge-data";
import { emailTemplateLabel } from "@/lib/email/template-labels";
import {
  getBulkEmailTemplatesAction,
  getBulkEmailRecipientsAction,
  bulkSendEmailAction,
  type BulkEmailRecipient,
  type BulkSendEmailResult,
} from "@/app/(admin)/queue/bulk-email-actions";
import type { EmailTemplateRow } from "@/lib/db/queries/reference-tables";

type Phase = "template" | "recipients" | "sending" | "result";

interface BulkEmailWizardActionProps {
  selectedIds: string[];
  /** Disables the trigger while another bulk-toolbar action is running. */
  triggerDisabled: boolean;
  /**
   * Called only when the admin dismisses the result view (Done) — clears the
   * row selection + refreshes. See the file header note: never call this any
   * earlier, or the toolbar (and this dialog) unmounts mid-flow.
   */
  onDone: () => void;
}

const STEP_LABELS: { phase: Phase; label: string }[] = [
  { phase: "template", label: "1 Template" },
  { phase: "recipients", label: "2 Recipients" },
  { phase: "sending", label: "3 Send" },
];

function stepIndex(phase: Phase): number {
  if (phase === "template") return 0;
  if (phase === "recipients") return 1;
  return 2; // sending + result are both step 3
}

export function BulkEmailWizardAction({
  selectedIds,
  triggerDisabled,
  onDone,
}: BulkEmailWizardActionProps) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("template");
  const [error, setError] = React.useState<string | null>(null);

  const [templates, setTemplates] = React.useState<EmailTemplateRow[] | null>(null);
  const [isLoadingTemplates, startLoadTemplates] = useTransition();
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);
  // Epic 15 X2 (CI-05): optional blind copy on the whole batch.
  const [bcc, setBcc] = React.useState("");

  const [recipients, setRecipients] = React.useState<BulkEmailRecipient[] | null>(null);
  const [fromAddress, setFromAddress] = React.useState<string>("");
  const [replyToAddress, setReplyToAddress] = React.useState<string>("");
  const [isLoadingRecipients, startLoadRecipients] = useTransition();
  const [excludedIds, setExcludedIds] = React.useState<Set<string>>(new Set());
  const [expandedPreviewId, setExpandedPreviewId] = React.useState<string | null>(null);

  const [isSending, startSend] = useTransition();
  const [sendResult, setSendResult] = React.useState<BulkSendEmailResult | null>(null);

  const selectedTemplate = React.useMemo(
    () => templates?.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  function resetAndOpen() {
    setPhase("template");
    setError(null);
    setTemplates(null);
    setSelectedTemplateId(null);
    setRecipients(null);
    setFromAddress("");
    setExcludedIds(new Set());
    setExpandedPreviewId(null);
    setSendResult(null);
    setOpen(true);

    startLoadTemplates(async () => {
      const result = await getBulkEmailTemplatesAction();
      if (result.success) {
        setTemplates(result.templates);
      } else {
        setError(result.error);
      }
    });
  }

  function handleOpenChange(next: boolean) {
    // Never allow closing (backdrop click / escape) while a send is in
    // flight — the admin must wait for the result view.
    if (!next && phase === "sending") return;
    setOpen(next);
  }

  function goToRecipients() {
    if (!selectedTemplateId) return;
    setPhase("recipients");
    setError(null);

    startLoadRecipients(async () => {
      const result = await getBulkEmailRecipientsAction(selectedIds);
      if (result.success) {
        setRecipients(result.recipients);
        setFromAddress(result.fromAddress);
        setReplyToAddress(result.replyToAddress);
        setExcludedIds(new Set(result.recipients.filter((r) => r.unsendableReason).map((r) => r.applicationId)));
      } else {
        setError(result.error);
      }
    });
  }

  const includedRecipients = React.useMemo(
    () => (recipients ?? []).filter((r) => !excludedIds.has(r.applicationId)),
    [recipients, excludedIds]
  );

  function handleSend() {
    if (!selectedTemplateId || includedRecipients.length === 0 || isSending) return;
    setPhase("sending");
    setError(null);

    const ids = includedRecipients.map((r) => r.applicationId);
    startSend(async () => {
      const result = await bulkSendEmailAction(ids, selectedTemplateId, bcc.trim() || undefined);
      if (result.success) {
        setSendResult(result);
        setPhase("result");
      } else {
        setError(result.error ?? "Failed to send bulk email.");
        setPhase("recipients");
      }
    });
  }

  function handleDone() {
    setOpen(false);
    onDone();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={triggerDisabled || selectedIds.length === 0}
        onClick={resetAndOpen}
        className="h-8 shrink-0 whitespace-nowrap border-primary-200 bg-white text-xs text-slate-600"
      >
        <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Send email
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send email to {selectedIds.length} selected</DialogTitle>
            <DialogDescription asChild>
              <div className="flex items-center gap-2 pt-1 text-xs">
                {STEP_LABELS.map((step, i) => (
                  <span
                    key={step.phase}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      i === stepIndex(phase)
                        ? "bg-primary-100 text-primary-800"
                        : i < stepIndex(phase)
                          ? "text-primary-600"
                          : "text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {phase === "template" && (
            <TemplateStep
              templates={templates}
              isLoading={isLoadingTemplates}
              selectedTemplateId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          )}

          {phase === "recipients" && (
            <RecipientsStep
              recipients={recipients}
              isLoading={isLoadingRecipients}
              fromAddress={fromAddress}
              replyToAddress={replyToAddress}
              bcc={bcc}
              setBcc={setBcc}
              excludedIds={excludedIds}
              setExcludedIds={setExcludedIds}
              expandedPreviewId={expandedPreviewId}
              setExpandedPreviewId={setExpandedPreviewId}
              template={selectedTemplate}
            />
          )}

          {(phase === "sending" || phase === "result") && (
            <SendStep phase={phase} result={sendResult} />
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            {phase === "template" && (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={goToRecipients}
                  disabled={!selectedTemplateId}
                  className="bg-primary-800 hover:bg-primary-700 gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </>
            )}

            {phase === "recipients" && (
              <>
                <Button variant="outline" onClick={() => setPhase("template")} className="gap-1">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={includedRecipients.length === 0 || isLoadingRecipients}
                  className="bg-primary-800 hover:bg-primary-700 gap-1"
                >
                  Send to {includedRecipients.length}
                </Button>
              </>
            )}

            {phase === "sending" && (
              <Button disabled className="ml-auto gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Sending…
              </Button>
            )}

            {phase === "result" && (
              <Button onClick={handleDone} className="ml-auto bg-primary-800 hover:bg-primary-700">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Step 1: template ───────────────────────────────────────────────────────────

function TemplateStep({
  templates,
  isLoading,
  selectedTemplateId,
  onSelect,
}: {
  templates: EmailTemplateRow[] | null;
  isLoading: boolean;
  selectedTemplateId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = templates?.find((t) => t.id === selectedTemplateId) ?? null;

  if (isLoading || !templates) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading templates…
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No enabled email templates. Add one in Settings → Email Templates first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-64 rounded-md border border-slate-200 p-1">
        <RadioGroup value={selectedTemplateId ?? undefined} onValueChange={onSelect}>
          {templates.map((tpl) => {
            const resolvable = isBulkResolvable(tpl.mergeFields);
            const row = (
              <div
                key={tpl.id}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2",
                  resolvable ? "hover:bg-slate-50" : "opacity-50"
                )}
              >
                <RadioGroupItem
                  value={tpl.id}
                  id={`bulk-tpl-${tpl.id}`}
                  disabled={!resolvable}
                />
                <Label
                  htmlFor={`bulk-tpl-${tpl.id}`}
                  className={cn(
                    "flex flex-1 items-center justify-between gap-2 text-sm font-normal",
                    resolvable ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  <span>{emailTemplateLabel(tpl)}</span>
                  <Badge variant={tpl.isSystem ? "secondary" : "outline"} className="text-[10px]">
                    {tpl.isSystem ? "System" : "Custom"}
                  </Badge>
                </Label>
              </div>
            );

            if (resolvable) return row;

            return (
              <TooltipProvider key={tpl.id}>
                <Tooltip>
                  <TooltipTrigger asChild>{row}</TooltipTrigger>
                  <TooltipContent>
                    Uses fields that can&apos;t be filled in a bulk send (e.g. registration_link).
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </RadioGroup>
      </ScrollArea>

      {selected && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{selected.subject}</p>
          <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-slate-600">
            {selected.body}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: recipients ─────────────────────────────────────────────────────────

function RecipientsStep({
  recipients,
  isLoading,
  fromAddress,
  replyToAddress,
  bcc,
  setBcc,
  excludedIds,
  setExcludedIds,
  expandedPreviewId,
  setExpandedPreviewId,
  template,
}: {
  recipients: BulkEmailRecipient[] | null;
  isLoading: boolean;
  fromAddress: string;
  replyToAddress: string;
  bcc: string;
  setBcc: (v: string) => void;
  excludedIds: Set<string>;
  setExcludedIds: (updater: (prev: Set<string>) => Set<string>) => void;
  expandedPreviewId: string | null;
  setExpandedPreviewId: (id: string | null) => void;
  template: EmailTemplateRow | null;
}) {
  if (isLoading || !recipients) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Resolving recipients…
      </div>
    );
  }

  const includedCount = recipients.filter((r) => !excludedIds.has(r.applicationId)).length;

  function toggle(id: string, unsendable: boolean) {
    if (unsendable) return; // cannot re-include an unsendable recipient
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          <span className="font-semibold text-primary-800">{includedCount}</span> of{" "}
          {recipients.length} will be emailed
        </span>
        {fromAddress && (
          <span>
            From: <span className="font-mono">{fromAddress}</span>
            {replyToAddress && (
              <>
                {" · "}Replies to:{" "}
                <span className="font-mono">{replyToAddress}</span>
              </>
            )}
          </span>
        )}
      </div>

      {/* Epic 15 X2 (CI-05): optional BCC for the whole batch. */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <label htmlFor="bulk-bcc" className="font-medium">
          BCC (optional):
        </label>
        <input
          id="bulk-bcc"
          type="email"
          value={bcc}
          onChange={(e) => setBcc(e.target.value)}
          placeholder="e.g. fees@johnwhitgiftfoundation.org"
          className="h-7 w-72 rounded border border-slate-300 bg-white px-2 font-mono text-xs text-slate-700 placeholder-slate-400"
        />
      </div>

      <ScrollArea className="h-72 rounded-md border border-slate-200">
        <div className="divide-y divide-slate-100">
          {recipients.map((r) => {
            const unsendable = !!r.unsendableReason;
            const excluded = excludedIds.has(r.applicationId);
            const expanded = expandedPreviewId === r.applicationId;
            const mergeData = template ? buildBulkMergeData(r) : null;

            return (
              <div key={r.applicationId} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={!excluded}
                    disabled={unsendable}
                    onCheckedChange={() => toggle(r.applicationId, unsendable)}
                    aria-label={`Include ${r.reference}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700">
                      <span className="font-mono text-xs text-slate-500">{r.reference}</span>{" "}
                      {r.leadApplicantName}
                    </p>
                    {unsendable ? (
                      <p className="text-xs text-red-600">{r.unsendableReason}</p>
                    ) : (
                      <p className="truncate text-xs text-slate-400">{r.leadApplicant.email}</p>
                    )}
                  </div>
                  {!unsendable && template && (
                    <button
                      type="button"
                      onClick={() => setExpandedPreviewId(expanded ? null : r.applicationId)}
                      className="flex shrink-0 items-center gap-1 text-xs text-primary-700 hover:underline"
                    >
                      Preview
                      <ChevronDown
                        className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>

                {expanded && mergeData && template && (
                  <div className="mt-2 ml-7 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">
                      {replaceMergeFields(template.subject, mergeData)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {replaceMergeFields(template.body, mergeData)}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Step 3: send / result ──────────────────────────────────────────────────────

function SendStep({ phase, result }: { phase: Phase; result: BulkSendEmailResult | null }) {
  if (phase === "sending" || !result) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-700" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          Sending emails — this may take a moment. Do not close this window.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-800">
        {result.sent} sent
        {result.failed > 0 && ` · ${result.failed} failed`}
        {result.skipped > 0 && ` · ${result.skipped} skipped`}
      </p>
      <ScrollArea className="h-64 rounded-md border border-slate-200">
        <div className="divide-y divide-slate-100">
          {result.results.map((r) => (
            <div key={r.applicationId} className="flex items-start gap-2 px-3 py-2 text-sm">
              {r.outcome === "sent" && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
              )}
              {r.outcome === "failed" && (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              )}
              {r.outcome === "skipped" && (
                <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-slate-700">
                  <span className="font-mono text-xs text-slate-500">{r.reference}</span>{" "}
                  {r.email ?? "—"}
                </p>
                {r.reason && <p className="text-xs text-slate-500">{r.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
