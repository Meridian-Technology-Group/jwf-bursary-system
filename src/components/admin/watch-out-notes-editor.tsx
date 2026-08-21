"use client";

/**
 * Epic 14 C8 (CG-24) — the "Assessor's wizard — Things to look out for with
 * this family" editor, relocated from the assessment form's section F to its
 * workbook home on the ASSESSMENT ADMIN tab. Same storage
 * (`Assessment.watchOutNotes`), same save path (`saveAssessmentAction`),
 * same rules (read-only once the assessment is COMPLETED — the way back is
 * Reopen). Notes surface as a callout when the account's next assessment
 * begins (CALC-10).
 */

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveAssessmentAction } from "@/app/(admin)/applications/[id]/assessment/actions";
import { toast } from "@/hooks/use-toast";

interface WatchOutNotesEditorProps {
  assessmentId: string;
  applicationId: string;
  initial: string | null;
  readOnly: boolean;
}

export function WatchOutNotesEditor({
  assessmentId,
  applicationId,
  initial,
  readOnly,
}: WatchOutNotesEditorProps) {
  const [value, setValue] = React.useState(initial ?? "");
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await saveAssessmentAction(assessmentId, applicationId, {
      watchOutNotes: value.trim().length > 0 ? value : null,
    });
    setSaving(false);
    if (result.success) {
      setDirty(false);
      toast({ title: "Assessor's wizard notes saved" });
    } else {
      toast({
        variant: "destructive",
        title: "Notes not saved",
        description: result.error,
      });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Assessor&apos;s wizard — Things to look out for with this family
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Forward-looking notes for next year&apos;s assessor — surfaced as a
            callout when this account&apos;s next assessment begins.
            {readOnly && " Read-only: the assessment is completed."}
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            <Save className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {saving ? "Saving…" : "Save notes"}
          </Button>
        )}
      </div>
      <Textarea
        value={value}
        disabled={readOnly}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="e.g. Mrs works for two schools — check that she attaches two P60s."
        rows={4}
        className="mt-3 resize-y text-sm"
        aria-label="Assessor's wizard notes"
      />
    </div>
  );
}
