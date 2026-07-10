"use client";

/**
 * Email template editor.
 * Dropdown to select a template (system or custom), then edit subject + body
 * with merge field hints. ADMIN-only "Add template" affordance creates a
 * custom template; custom templates can also be soft-deleted (system
 * templates cannot — Story 9.3).
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  createEmailTemplateAction,
  deleteEmailTemplateAction,
  setEmailTemplateEnabledAction,
  upsertEmailTemplateAction,
} from "@/app/(admin)/settings/actions";
import { isLockedEmailTemplateType } from "@/lib/email/locked-types";
import { emailTemplateLabel } from "@/lib/email/template-labels";
import type { EmailTemplateRow } from "@/lib/db/queries/reference-tables";

// templateLabel is a thin local alias so the rest of this file (and its
// existing call sites) doesn't need renaming — the shared implementation
// lives in template-labels.ts (also used by the bulk Send Email wizard).
const templateLabel = emailTemplateLabel;

// ─── Merge field hints ────────────────────────────────────────────────────────

// NOTE: Merge field names use snake_case to match the keys passed by every
// `sendEmail` call site (see `src/app/(admin)/invitations/actions.ts`,
// `src/app/(portal)/apply/actions.ts`, etc.). `replaceMergeFields()` in
// `src/lib/email/merge.ts` does literal {{name}} substitution — a token in
// the template body must match the call-site key exactly or it will ship
// to the recipient verbatim.
const COMMON_MERGE_FIELDS = [
  "{{applicant_name}}",
  "{{child_name}}",
  "{{reference}}",
  "{{school}}",
  "{{academic_year}}",
  "{{deadline}}",
  "{{registration_link}}",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmailTemplateEditorProps {
  templates: EmailTemplateRow[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailTemplateEditor({ templates }: EmailTemplateEditorProps) {
  const [selectedId, setSelectedId] = React.useState<string>(
    templates.length > 0 ? templates[0].id : ""
  );
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [mergeFields, setMergeFields] = React.useState<string[]>([]);
  const [enabled, setEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const [addOpen, setAddOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const isLocked = selected?.type ? isLockedEmailTemplateType(selected.type) : false;

  // Sync editor state when selection changes
  React.useEffect(() => {
    const tpl = templates.find((t) => t.id === selectedId);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
      setMergeFields(tpl.mergeFields);
      setEnabled(tpl.enabled);
    } else {
      setSubject("");
      setBody("");
      setMergeFields([]);
      setEnabled(true);
    }
    setSaved(false);
    setError(null);
  }, [selectedId, templates]);

  function handleToggleEnabled(next: boolean) {
    if (!selected || isLocked) return;
    setError(null);
    setSaved(false);
    // Optimistic update; reverted on failure.
    const previous = enabled;
    setEnabled(next);
    const fd = new FormData();
    fd.set("id", selected.id);
    if (selected.type) fd.set("type", selected.type);
    fd.set("enabled", String(next));

    startToggleTransition(async () => {
      const result = await setEmailTemplateEnabledAction(fd);
      if (!result.success) {
        setEnabled(previous);
        setError(result.error);
      }
    });
  }

  function handleSave() {
    if (!selected) return;
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("id", selected.id);
    if (selected.type) fd.set("type", selected.type);
    fd.set("subject", subject);
    fd.set("body", body);

    startTransition(async () => {
      const result = await upsertEmailTemplateAction(fd);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!selected) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", selected.id);

    startDeleteTransition(async () => {
      const result = await deleteEmailTemplateAction(fd);
      if (result.success) {
        setDeleteOpen(false);
        setSelectedId(templates.find((t) => t.id !== selected.id)?.id ?? "");
      } else {
        setError(result.error);
        setDeleteOpen(false);
      }
    });
  }

  // Displayed merge fields: from template or common fallback
  const displayMergeFields =
    mergeFields.length > 0 ? mergeFields : COMMON_MERGE_FIELDS;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Template selector + add */}
      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="templateId" className="text-sm font-medium">
            Template
          </Label>
          <Select
            value={selectedId}
            onValueChange={(v) => {
              setSelectedId(v);
              setSaved(false);
            }}
          >
            <SelectTrigger id="templateId" className="w-72">
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  <span className="flex items-center gap-2">
                    {templateLabel(tpl)}
                    <Badge variant={tpl.isSystem ? "secondary" : "outline"} className="text-[10px]">
                      {tpl.isSystem ? "System" : "Custom"}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add template
        </Button>
      </div>

      {selected && (
        <>
          {/* Enable / disable toggle */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="templateEnabled" className="text-sm font-medium">
                Send this email
              </Label>
              <p className="text-xs text-slate-500">
                {isLocked
                  ? "Required — carries the registration link and cannot be turned off."
                  : enabled
                    ? "This email is sent automatically when its event occurs."
                    : "This email is currently suppressed and will not be sent."}
              </p>
            </div>
            {isLocked ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span wrapper so the tooltip still fires on a disabled control */}
                    <span className="inline-flex">
                      <Switch
                        id="templateEnabled"
                        checked
                        disabled
                        aria-label="Locked — required email"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Required — carries the registration link
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Switch
                id="templateEnabled"
                checked={enabled}
                disabled={isToggling}
                onCheckedChange={handleToggleEnabled}
                aria-label={enabled ? "Disable this email" : "Enable this email"}
              />
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="templateSubject" className="text-sm font-medium">
              Subject Line
            </Label>
            <Input
              id="templateSubject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSaved(false);
              }}
              placeholder="Enter email subject..."
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="templateBody" className="text-sm font-medium">
              Body
            </Label>
            <Textarea
              id="templateBody"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSaved(false);
              }}
              rows={12}
              className="font-mono text-sm leading-relaxed resize-y"
              placeholder="Enter email body text..."
            />
          </div>

          {/* Merge field hints */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Available merge fields
            </p>
            <div className="flex flex-wrap gap-2">
              {displayMergeFields.map((field) => (
                <code
                  key={field}
                  className="rounded bg-white px-2 py-0.5 text-xs font-mono text-primary-800 border border-slate-200 cursor-pointer select-all"
                  title="Click to select"
                >
                  {field}
                </code>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              These placeholders will be replaced with real values when the email is sent.
            </p>
          </div>

          {/* Save / Delete */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isPending || !subject.trim() || !body.trim()}
              className="bg-primary-800 hover:bg-primary-700 gap-2"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Save Template
            </Button>
            {!selected.isSystem && (
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            )}
            {saved && (
              <p className="text-sm text-emerald-600 font-medium" role="status">
                Template saved
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </>
      )}

      <AddTemplateDialog open={addOpen} onOpenChange={setAddOpen} onCreated={setSelectedId} />

      {selected && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete &ldquo;{templateLabel(selected)}&rdquo;?</DialogTitle>
              <DialogDescription>
                This will permanently remove this template from every template
                picker. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Add template dialog ───────────────────────────────────────────────────────

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

function AddTemplateDialog({ open, onOpenChange, onCreated }: AddTemplateDialogProps) {
  const [name, setName] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    if (open) {
      setName("");
      setSubject("");
      setBody("");
      setError(null);
    }
  }, [open]);

  function handleCreate() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("subject", subject);
    fd.set("body", body);

    startTransition(async () => {
      const result = await createEmailTemplateAction(fd);
      if (result.success) {
        onOpenChange(false);
        onCreated(result.id);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a custom email template</DialogTitle>
          <DialogDescription>
            Create a reusable template for bulk sends or ad hoc communication.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newTemplateName" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="newTemplateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Round Opening Reminder"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newTemplateSubject" className="text-sm font-medium">
              Subject Line
            </Label>
            <Input
              id="newTemplateSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newTemplateBody" className="text-sm font-medium">
              Body
            </Label>
            <Textarea
              id="newTemplateBody"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="font-mono text-sm leading-relaxed resize-y"
              placeholder="Enter email body text..."
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isPending || !name.trim() || !subject.trim() || !body.trim()}
            className="bg-primary-800 hover:bg-primary-700 gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
