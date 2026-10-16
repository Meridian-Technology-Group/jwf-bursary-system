"use client";

/**
 * SectionExportCard — one export section from Charlotte's EXPORTS.xlsx
 * (Epic 23 T4/T6/T8): her search form, a field picker (every column ticked
 * by default, as in Grant Tracker: untick to make a short report), the file
 * format and a Download button.
 *
 * The download is a plain navigation to /api/exports/<section>, as Export
 * Recommendations does. The last field selection is remembered per viewer in
 * localStorage (a convenience only; every read/write is guarded).
 */

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { columnGroups } from "@/lib/export/columns";
import { buildExportHref, groupState, initialSelection, toggleField, toggleGroup } from "@/lib/export/picker";
import type { FilterKey, SectionDescriptor } from "@/lib/export/sections/descriptors";

export interface ExportRoundOption {
  id: string;
  academicYear: string;
  status: string;
}

interface Props {
  section: SectionDescriptor;
  rounds: ExportRoundOption[];
}

const ALL = "__all__";

const SCHOOLS = [
  { value: "TRINITY", label: "Trinity" },
  { value: "WHITGIFT", label: "Whitgift" },
  { value: "OP_PARTNER", label: "OP partner" },
];
const SCHOOL_YEARS = ["Y6", "Y7", "Y8", "Y9", "Y10", "Y11", "Y12", "Y13"].map((v) => ({
  value: v,
  label: `Year ${v.slice(1)}`,
}));
const ACCOUNTS = [
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
  { value: "NONE", label: "No account yet" },
];
const APPLICATION_TYPES = [
  { value: "ROLLING_OVER", label: "Rolling-Over Application" },
  { value: "NEW", label: "New Application" },
];
const ASSESSMENT_STATUSES = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Stored as complete" },
  { value: "NEW_AWARD", label: "New award" },
  { value: "ROLLED_OVER", label: "Rolled over" },
  { value: "WAITING_LIST", label: "Waiting list" },
  { value: "CLOSED_ARCHIVED", label: "Closed & archived" },
];

function storageKey(section: string) {
  return `jwf.exports.${section}.fields`;
}

function readRemembered(section: string): { selected: string[]; known: string[] } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(section));
    if (!raw) return null;
    const v = JSON.parse(raw) as { selected?: unknown; known?: unknown };
    if (!Array.isArray(v.selected) || !Array.isArray(v.known)) return null;
    return { selected: v.selected.map(String), known: v.known.map(String) };
  } catch {
    return null;
  }
}

function writeRemembered(section: string, selected: string[], known: string[]) {
  try {
    window.localStorage.setItem(storageKey(section), JSON.stringify({ selected, known }));
  } catch {
    // Private window / blocked storage: the picker still works, it just forgets.
  }
}

function SelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SectionExportCard({ section, rounds }: Props) {
  const allKeys = useMemo(() => section.columns.map((c) => c.key), [section.columns]);
  const groups = useMemo(() => columnGroups(section.columns), [section.columns]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allKeys));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const [busy, setBusy] = useState(false);

  // Restore after mount (localStorage is client-only).
  useEffect(() => {
    const saved = readRemembered(section.key);
    if (saved) setSelected(initialSelection(section.columns, saved.selected, saved.known));
  }, [section.key, section.columns]);

  function update(next: Set<string>) {
    setSelected(next);
    writeRemembered(section.key, allKeys.filter((k) => next.has(k)), allKeys);
  }

  const set = (k: string) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const val = (k: string) => filters[k] ?? ALL;
  const academicYears = Array.from(new Set(rounds.map((r) => r.academicYear)));

  function renderFilter(key: FilterKey) {
    const id = `${section.key}-${key}`;
    switch (key) {
      case "account":
        return <SelectFilter key={key} id={id} label="Bursary account" value={val(key)} onChange={set(key)} options={ACCOUNTS} />;
      case "assessmentStatus":
        return (
          <SelectFilter key={key} id={id} label="Assessment status" value={val(key)} onChange={set(key)} options={ASSESSMENT_STATUSES} />
        );
      case "applicationType":
        return (
          <SelectFilter key={key} id={id} label="Application Type" value={val(key)} onChange={set(key)} options={APPLICATION_TYPES} />
        );
      case "roundId":
        return (
          <SelectFilter
            key={key}
            id={id}
            label="Round"
            value={val(key)}
            onChange={set(key)}
            allLabel="All rounds"
            options={rounds.map((r) => ({ value: r.id, label: `${r.academicYear} (${r.status.toLowerCase()})` }))}
          />
        );
      case "academicYear":
        return (
          <SelectFilter
            key={key}
            id={id}
            label="Academic Year"
            value={val(key)}
            onChange={set(key)}
            options={academicYears.map((y) => ({ value: y, label: y }))}
          />
        );
      case "school":
        return <SelectFilter key={key} id={id} label="School" value={val(key)} onChange={set(key)} options={SCHOOLS} />;
      case "schoolYear":
        return <SelectFilter key={key} id={id} label="School Year" value={val(key)} onChange={set(key)} options={SCHOOL_YEARS} />;
      case "completedRange":
        return (
          <div key={key} className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-from`}>Assessment Completion Date</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${id}-from`}
                type="date"
                aria-label="Completed from"
                value={filters.completedFrom ?? ""}
                onChange={(e) => set("completedFrom")(e.target.value)}
              />
              <span className="text-sm text-slate-500">to</span>
              <Input
                type="date"
                aria-label="Completed to"
                value={filters.completedTo ?? ""}
                onChange={(e) => set("completedTo")(e.target.value)}
              />
            </div>
          </div>
        );
    }
  }

  function download() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    window.location.href = buildExportHref(section.key, section.columns, selected, filters, format);
    setTimeout(() => setBusy(false), 3000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {section.number} · {section.title}
        </CardTitle>
        <CardDescription>{section.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section aria-label="Search selection" className="space-y-3">
          <h3 className="text-sm font-semibold text-primary-900">Search selection</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{section.filterKeys.map(renderFilter)}</div>
        </section>

        <section aria-label="Fields returned" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-primary-900">
              Fields returned{" "}
              <span className="font-normal text-slate-500">
                ({selected.size} of {allKeys.length})
              </span>
            </h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => update(new Set(allKeys))}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => update(new Set())}>
                Clear all
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(({ group, columns }) => {
              const keys = columns.map((c) => c.key);
              const state = groupState(keys, selected);
              const groupId = `${section.key}-group-${group.replace(/\W+/g, "-")}`;
              return (
                <fieldset key={group} className="rounded-md border border-slate-200 p-3">
                  <legend className="px-1">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        id={groupId}
                        checked={state === "all" ? true : state === "some" ? "indeterminate" : false}
                        onCheckedChange={() => update(toggleGroup(keys, selected))}
                      />
                      <Label htmlFor={groupId} className="text-sm font-medium text-primary-900">
                        {group}
                      </Label>
                    </span>
                  </legend>
                  <ul className="mt-2 space-y-1.5">
                    {columns.map((c) => {
                      const fid = `${section.key}-field-${c.key}`;
                      return (
                        <li key={c.key} className="flex items-start gap-2">
                          <Checkbox
                            id={fid}
                            className="mt-0.5"
                            checked={selected.has(c.key)}
                            onCheckedChange={() => update(toggleField(c.key, selected))}
                          />
                          <Label htmlFor={fid} className="text-xs font-normal leading-snug text-slate-700">
                            {c.header}
                          </Label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44 space-y-1.5">
            <Label htmlFor={`${section.key}-format`}>File Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "xlsx" | "csv")}>
              <SelectTrigger id={`${section.key}-format`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={download} disabled={busy || selected.size === 0} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Preparing download..." : `Download ${format.toUpperCase()}`}
          </Button>
          {selected.size === 0 && <p className="text-sm text-red-600">Tick at least one field.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
