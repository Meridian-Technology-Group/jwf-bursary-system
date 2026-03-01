"use client";

/**
 * Email template editor.
 * Dropdown to select template type, then edit subject + body with merge field hints.
 */

import * as React from "react";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertEmailTemplateAction } from "@/app/(admin)/settings/actions";
import type { EmailTemplateRow } from "@/lib/db/queries/reference-tables";
import type { EmailTemplateType } from "@prisma/client";

// ─── Template display labels ──────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<EmailTemplateType, string> = {
  INVITATION: "Invitation",
  CONFIRMATION: "Submission Confirmation",
  MISSING_DOCS: "Missing Documents",
  OUTCOME_QUALIFIES: "Outcome — Qualifies",
  OUTCOME_DNQ: "Outcome — Does Not Qualify",
  REASSESSMENT: "Reassessment",
  REMINDER: "Reminder",
};

// ─── Merge field hints ────────────────────────────────────────────────────────

const COMMON_MERGE_FIELDS = [
  "{{applicantName}}",
  "{{childName}}",
  "{{reference}}",
  "{{school}}",
  "{{academicYear}}",
  "{{deadline}}",
  "{{loginUrl}}",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface EmailTemplateEditorProps {
  templates: EmailTemplateRow[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmailTemplateEditor({ templates }: EmailTemplateEditorProps) {
  const [selectedType, setSelectedType] = React.useState<EmailTemplateType | "">(
    templates.length > 0 ? templates[0].type : ""
  );
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [mergeFields, setMergeFields] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  // Sync editor state when selection changes
  React.useEffect(() => {
    if (!selectedType) {
      setSubject("");
      setBody("");
      setMergeFields([]);
      return;
    }
    const tpl = templates.find((t) => t.type === selectedType);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
      setMergeFields(tpl.mergeFields);
    } else {
      setSubject("");
      setBody("");
      setMergeFields(COMMON_MERGE_FIELDS);
    }
    setSaved(false);
    setError(null);
  }, [selectedType, templates]);

  function handleSave() {
    if (!selectedType) return;
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("type", selectedType);
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

  // Displayed merge fields: from template or common fallback
  const displayMergeFields =
    mergeFields.length > 0 ? mergeFields : COMMON_MERGE_FIELDS;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Template selector */}
      <div className="space-y-1.5">
        <Label htmlFor="templateType" className="text-sm font-medium">
          Template
        </Label>
        <Select
          value={selectedType}
          onValueChange={(v) => {
            setSelectedType(v as EmailTemplateType);
            setSaved(false);
          }}
        >
          <SelectTrigger id="templateType" className="w-72">
            <SelectValue placeholder="Select a template..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((tpl) => (
              <SelectItem key={tpl.type} value={tpl.type}>
                {TEMPLATE_LABELS[tpl.type] ?? tpl.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedType && (
        <>
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

          {/* Save */}
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
    </div>
  );
}
