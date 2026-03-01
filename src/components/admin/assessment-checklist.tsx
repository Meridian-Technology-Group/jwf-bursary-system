"use client";

/**
 * WP-16: Assessment Checklist Component
 *
 * Six qualitative checklist tabs for recording contextual notes during
 * bursary assessment. Each tab corresponds to a ChecklistTab enum value.
 *
 * Features:
 * - Auto-saves on blur (debounced 500 ms)
 * - Auto-saves on tab change (saves current tab before switching)
 * - Visual save indicator: spinner while saving, "Saved" on success
 * - Pre-populated from existing checklist data passed as props
 * - Read-only mode when assessment is COMPLETED
 * - Horizontal scrolling tabs for mobile
 */

import * as React from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveChecklistNotes } from "@/app/(admin)/applications/[id]/assessment/checklist-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChecklistTabKey =
  | "BURSARY_DETAILS"
  | "LIVING_CONDITIONS"
  | "DEBT"
  | "OTHER_FEES"
  | "STAFF"
  | "FINANCIAL_PROFILE";

export interface AssessmentChecklistProps {
  assessmentId: string;
  applicationId: string;
  checklists: { id: string; tab: string; notes: string; updatedAt: Date }[];
  readOnly?: boolean;
}

// ─── Tab Definitions ──────────────────────────────────────────────────────────

interface TabDef {
  key: ChecklistTabKey;
  label: string;
  shortLabel: string;
  placeholder: string;
}

const TAB_DEFS: TabDef[] = [
  {
    key: "BURSARY_DETAILS",
    label: "Bursary Assessment Details",
    shortLabel: "Bursary",
    placeholder:
      "Record key details about the bursary assessment, relevant context, or specific considerations for this application…",
  },
  {
    key: "LIVING_CONDITIONS",
    label: "Living Conditions / Other JWF Children",
    shortLabel: "Living Conditions",
    placeholder:
      "Note living conditions, housing situation, and whether other children are supported by the foundation…",
  },
  {
    key: "DEBT",
    label: "Debt Situation",
    shortLabel: "Debt",
    placeholder:
      "Document outstanding debts, repayment obligations, and how debt affects household financial capacity…",
  },
  {
    key: "OTHER_FEES",
    label: "Other Fees with the Foundation",
    shortLabel: "Other Fees",
    placeholder:
      "Record any other fee arrangements, payment history, or outstanding balances with the foundation…",
  },
  {
    key: "STAFF",
    label: "Staff Situation",
    shortLabel: "Staff",
    placeholder:
      "Note any staff employment arrangements, school employment connections, or relevant HR considerations…",
  },
  {
    key: "FINANCIAL_PROFILE",
    label: "Financial Profile Impact",
    shortLabel: "Financial Profile",
    placeholder:
      "Summarise the overall financial profile, year-on-year changes, and impact on the bursary decision…",
  },
];

// ─── Save state per-tab ───────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssessmentChecklist({
  assessmentId,
  applicationId,
  checklists,
  readOnly = false,
}: AssessmentChecklistProps) {
  // Initialise notes state from existing checklist data
  const initialNotes = React.useMemo<Record<ChecklistTabKey, string>>(() => {
    const map = {} as Record<ChecklistTabKey, string>;
    for (const def of TAB_DEFS) {
      const existing = checklists.find((c) => c.tab === def.key);
      map[def.key] = existing?.notes ?? "";
    }
    return map;
  }, [checklists]);

  const [notes, setNotes] = React.useState<Record<ChecklistTabKey, string>>(initialNotes);
  const [activeTab, setActiveTab] = React.useState<ChecklistTabKey>("BURSARY_DETAILS");
  const [saveStatus, setSaveStatus] = React.useState<Record<ChecklistTabKey, SaveStatus>>(
    () => {
      const s = {} as Record<ChecklistTabKey, SaveStatus>;
      for (const def of TAB_DEFS) s[def.key] = "idle";
      return s;
    }
  );

  // Debounce timers — one per tab
  const debounceTimers = React.useRef<Partial<Record<ChecklistTabKey, ReturnType<typeof setTimeout>>>>({});
  // Track the notes at the time of last save to avoid redundant requests
  const savedNotes = React.useRef<Record<ChecklistTabKey, string>>({ ...initialNotes });

  // ── Core save function ───────────────────────────────────────────────────

  const saveTab = React.useCallback(
    async (tab: ChecklistTabKey, value: string) => {
      // Skip if unchanged or read-only
      if (readOnly || value === savedNotes.current[tab]) return;

      setSaveStatus((prev) => ({ ...prev, [tab]: "saving" }));

      const result = await saveChecklistNotes(assessmentId, tab, value, applicationId);

      if (result.success) {
        savedNotes.current[tab] = value;
        setSaveStatus((prev) => ({ ...prev, [tab]: "saved" }));
        // Reset to idle after 2.5 s
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [tab]: "idle" }));
        }, 2500);
      } else {
        setSaveStatus((prev) => ({ ...prev, [tab]: "error" }));
      }
    },
    [assessmentId, applicationId, readOnly]
  );

  // ── Schedule debounced auto-save ─────────────────────────────────────────

  const scheduleAutoSave = React.useCallback(
    (tab: ChecklistTabKey, value: string) => {
      if (readOnly) return;
      const existing = debounceTimers.current[tab];
      if (existing) clearTimeout(existing);
      debounceTimers.current[tab] = setTimeout(() => {
        saveTab(tab, value);
      }, 500);
    },
    [readOnly, saveTab]
  );

  // ── Handle tab change — flush save for the tab being left ────────────────

  const handleTabChange = React.useCallback(
    (nextTab: string) => {
      const leavingTab = activeTab;
      const currentValue = notes[leavingTab];

      // Cancel any pending debounce for the tab being left
      const timer = debounceTimers.current[leavingTab];
      if (timer) {
        clearTimeout(timer);
        delete debounceTimers.current[leavingTab];
      }

      // Immediately save the leaving tab's current value
      saveTab(leavingTab, currentValue);

      setActiveTab(nextTab as ChecklistTabKey);
    },
    [activeTab, notes, saveTab]
  );

  // ── Cleanup timers on unmount ────────────────────────────────────────────

  React.useEffect(() => {
    return () => {
      for (const timer of Object.values(debounceTimers.current)) {
        if (timer) clearTimeout(timer);
      }
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="overflow-hidden">
      {/* Section header matching existing collapsible-card style */}
      <CardHeader className="border-b border-neutral-100 bg-neutral-50 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">
              F. Qualitative Checklist
            </CardTitle>
            <p className="mt-0.5 text-xs text-slate-400">
              Contextual notes for each assessment area — auto-saved on blur and tab change
            </p>
          </div>

          {/* Save status badge for the active tab */}
          <SaveStatusIndicator status={saveStatus[activeTab]} />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          {/* Tab bar — horizontal scroll on mobile */}
          <div className="overflow-x-auto border-b border-neutral-100 bg-neutral-50/50">
            <TabsList className="inline-flex h-auto w-max min-w-full gap-0 rounded-none bg-transparent p-0">
              {TAB_DEFS.map((def) => (
                <TabsTrigger
                  key={def.key}
                  value={def.key}
                  className={cn(
                    "relative shrink-0 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-medium whitespace-nowrap",
                    "text-slate-500 hover:text-slate-700 hover:bg-neutral-100 transition-colors",
                    "data-[state=active]:border-b-2 data-[state=active]:border-primary",
                    "data-[state=active]:text-primary data-[state=active]:bg-white",
                    "data-[state=active]:shadow-none",
                    // Show a subtle dot when there is content in this tab
                    notes[def.key].trim().length > 0 &&
                      def.key !== activeTab &&
                      "after:absolute after:right-2 after:top-2 after:h-1 after:w-1 after:rounded-full after:bg-primary/60 after:content-['']"
                  )}
                >
                  {def.shortLabel}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Tab content panels */}
          {TAB_DEFS.map((def) => (
            <TabsContent key={def.key} value={def.key} className="mt-0 p-0">
              <TabPanel
                def={def}
                value={notes[def.key]}
                readOnly={readOnly}
                saveStatus={saveStatus[def.key]}
                onChange={(val) => {
                  setNotes((prev) => ({ ...prev, [def.key]: val }));
                  scheduleAutoSave(def.key, val);
                }}
                onBlur={() => {
                  // Cancel debounce and save immediately on blur
                  const timer = debounceTimers.current[def.key];
                  if (timer) {
                    clearTimeout(timer);
                    delete debounceTimers.current[def.key];
                  }
                  saveTab(def.key, notes[def.key]);
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Tab Panel ────────────────────────────────────────────────────────────────

interface TabPanelProps {
  def: TabDef;
  value: string;
  readOnly: boolean;
  saveStatus: SaveStatus;
  onChange: (val: string) => void;
  onBlur: () => void;
}

function TabPanel({ def, value, readOnly, onChange, onBlur }: TabPanelProps) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <label
          htmlFor={`checklist-${def.key}`}
          className="text-xs font-medium text-slate-600"
        >
          {def.label}
        </label>
        <span className="text-xs text-slate-300">
          {value.length} chars
        </span>
      </div>

      <Textarea
        id={`checklist-${def.key}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={readOnly ? "" : def.placeholder}
        disabled={readOnly}
        rows={8}
        className={cn(
          "resize-y border-slate-200 text-sm leading-relaxed text-slate-700",
          "placeholder:text-slate-300 focus-visible:ring-primary/30",
          readOnly && "cursor-default bg-neutral-50 text-slate-500"
        )}
      />

      {readOnly && (
        <p className="mt-1.5 text-xs text-slate-400">
          Assessment is completed — notes are read-only.
        </p>
      )}
    </div>
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
