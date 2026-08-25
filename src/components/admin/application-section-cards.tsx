/**
 * Read-only application-section rendering — shared between the Applicant Data
 * tab and the assessment workspace's APPLICATION FORM tab (Epic 14 C3).
 *
 * Extracted verbatim from `applications/[id]/page.tsx` so the two surfaces can
 * never drift on how a section's JSONB is displayed. Includes the CR-001
 * assessor-provenance pills (data-origin badges shown to every staff role).
 *
 * Server-component-safe: no hooks, no browser APIs.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationSectionType } from "@prisma/client";

// ─── Section display config ───────────────────────────────────────────────────

export const SECTION_LABELS: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Child Details",
  FAMILY_ID: "Family Identity",
  PARENT_DETAILS: "Parent Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

/** The portal's own section order — child details first, declaration last. */
export const SECTION_DISPLAY_ORDER: readonly ApplicationSectionType[] = [
  "CHILD_DETAILS",
  "FAMILY_ID",
  "PARENT_DETAILS",
  "DEPENDENT_CHILDREN",
  "DEPENDENT_ELDERLY",
  "OTHER_INFO",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
  "ADDITIONAL_INFO",
  "DECLARATION",
];

// ─── Assessor provenance (CR-001) ─────────────────────────────────────────────

/** Display-side provenance entry — fields are optional defensively. */
export interface ProvenanceDisplayEntry {
  editedByName?: string;
  editedAt?: string;
}

export type ProvenanceDisplayMap = Record<string, ProvenanceDisplayEntry>;

/**
 * Parses stored provenance JSONB defensively: non-objects (null, arrays,
 * primitives) become `{}` and malformed entries are dropped.
 */
/**
 * CH-57 — is this value something `DataBlock` can recurse into?
 *
 * Extracted because the bug it prevents is a one-character omission that reads
 * as correct: `typeof null === "object"` in JavaScript, so `typeof x ===
 * "object"` happily admits null, and `Object.entries(null)` then throws and
 * takes the whole Applicant Data tab down with it. Real data hits this — an
 * unfilled multi-document slot stores `[null, null, null]`.
 *
 * Exported so the trap is pinned by a test; this repo has no jsdom, so the
 * predicate is the testable seam rather than the render.
 */
export function isRenderableObject(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export function asProvenanceMap(raw: unknown): ProvenanceDisplayMap {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const map: ProvenanceDisplayMap = {};
  for (const [path, entry] of Object.entries(raw)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const { editedByName, editedAt } = entry as Record<string, unknown>;
    map[path] = {
      editedByName:
        typeof editedByName === "string" ? editedByName : undefined,
      editedAt: typeof editedAt === "string" ? editedAt : undefined,
    };
  }
  return map;
}

function provenancePillTitle(
  entry: ProvenanceDisplayEntry
): string | undefined {
  if (!entry.editedByName) return undefined;
  const date = entry.editedAt ? new Date(entry.editedAt) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return `Entered by ${entry.editedByName} on ${date.toLocaleDateString("en-GB")}`;
  }
  return `Entered by ${entry.editedByName}`;
}

function AssessorPill({ entry }: { entry: ProvenanceDisplayEntry }) {
  return (
    <span
      className="ml-2 inline-block whitespace-nowrap rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700"
      title={provenancePillTitle(entry)}
    >
      Entered by assessor
    </span>
  );
}

// ─── Field rendering ──────────────────────────────────────────────────────────

function formatValue(
  key: string,
  value: unknown,
  provenance: ProvenanceDisplayMap,
  path: string
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 italic">Not provided</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={
          value ? "text-green-700 font-medium" : "text-slate-500"
        }
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (typeof value === "number") {
    // Currency fields
    const currencyKeys = [
      "amount",
      "fees",
      "income",
      "pay",
      "salary",
      "pension",
      "benefits",
      "value",
      "balance",
      "rent",
      "dividends",
      "profit",
      "interest",
      "credits",
      "bonds",
      "maintenance",
      "bursaries",
    ];
    const isCurrency = currencyKeys.some((k) =>
      key.toLowerCase().includes(k)
    );
    if (isCurrency) {
      return (
        <span className="font-mono">
          {new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(value)}
        </span>
      );
    }
    return <span>{String(value)}</span>;
  }

  if (typeof value === "string") {
    // Skip document ID fields — they are displayed separately
    if (key.toLowerCase().includes("documentid")) {
      return <span className="text-slate-400 italic text-xs">Document ref</span>;
    }
    return <span>{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400 italic">None</span>;
    }
    return (
      <ol className="ml-4 list-decimal space-y-1">
        {value.map((item, i) => {
          // Array elements extend the dot-path with their numeric index
          // ("children.0.fullName"), matching diffSectionPaths.
          const itemPath = `${path}.${i}`;
          const itemEntry = provenance[itemPath];
          return (
            <li key={i} className="text-slate-700">
              {/* CH-57 — `typeof null === "object"` in JavaScript, so a null
                  array element used to slip through this check and reach
                  DataBlock, where Object.entries(null) threw and took the whole
                  page down. Real applications hit this: an unfilled
                  multi-document slot stores [null, null, null], which is what
                  WS-202627-0010's ucMonthlyDocumentIds held. */}
              {isRenderableObject(item) ? (
                <DataBlock
                  data={item as Record<string, unknown>}
                  indent
                  provenance={provenance}
                  pathPrefix={itemPath}
                />
              ) : item === null || item === undefined ? (
                <span className="text-slate-400 italic">Not provided</span>
              ) : (
                <>
                  {String(item)}
                  {itemEntry && <AssessorPill entry={itemEntry} />}
                </>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  if (isRenderableObject(value)) {
    return (
      <DataBlock
        data={value as Record<string, unknown>}
        indent
        provenance={provenance}
        pathPrefix={path}
      />
    );
  }

  return <span>{String(value)}</span>;
}

function humaniseKey(key: string): string {
  // Convert camelCase to "Title Case With Spaces"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function DataBlock({
  data,
  indent = false,
  provenance = {},
  pathPrefix = "",
}: {
  data: Record<string, unknown>;
  indent?: boolean;
  provenance?: ProvenanceDisplayMap;
  pathPrefix?: string;
}) {
  // CH-57 — `data` is TYPED as a record but arrives from JSONB, so it can be
  // null at runtime. `Object.entries(null)` throws, which crashed the whole
  // Applicant Data tab. Guarded here as the backstop, and at the array-element
  // call site below where the null actually gets through.
  const entries = isRenderableObject(data) ? Object.entries(data) : [];
  if (entries.length === 0)
    return <span className="text-slate-400 italic">Empty</span>;

  return (
    <dl
      className={
        indent
          ? "space-y-1 border-l-2 border-neutral-200 pl-3 my-1"
          : "space-y-3"
      }
    >
      {entries.map(([key, val]) => {
        const path = pathPrefix ? `${pathPrefix}.${key}` : key;
        // Provenance paths are leaf paths, so containers never match —
        // the pill only ever lands on the leaf row that was edited.
        const entry = provenance[path];
        return (
          <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="min-w-[180px] text-xs font-medium text-slate-500 shrink-0">
              {humaniseKey(key)}
            </dt>
            <dd className="text-sm text-slate-700">
              {formatValue(key, val, provenance, path)}
              {entry && <AssessorPill entry={entry} />}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

export interface SectionCardProps {
  section: ApplicationSectionType;
  data: Record<string, unknown> | null;
  isComplete: boolean;
  /** Raw `assessorProvenance` JSONB (parsed defensively). */
  assessorProvenance?: unknown;
  /** Optional owner label ("Parent 1" / "Parent 2") for dual-parent sections. */
  ownerLabel?: string | null;
  /** Optional extra header content (e.g. edit affordances). */
  headerExtra?: React.ReactNode;
  /** Optional footer content (e.g. the C3 per-section document titles). */
  footer?: React.ReactNode;
}

export function SectionDataCard({
  section,
  data,
  isComplete,
  assessorProvenance,
  ownerLabel,
  headerExtra,
  footer,
}: SectionCardProps) {
  const hasData = !!data && Object.keys(data).length > 0;
  const provenance = asProvenanceMap(assessorProvenance);
  const provenanceCount = Object.keys(provenance).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-semibold text-slate-700">
              {SECTION_LABELS[section] ?? section}
            </CardTitle>
            {ownerLabel && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {ownerLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {provenanceCount > 0 && (
              <span className="whitespace-nowrap rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">
                {provenanceCount} field{provenanceCount === 1 ? "" : "s"} entered
                by assessor
              </span>
            )}
            <span
              className={
                isComplete
                  ? "text-xs font-medium text-green-600"
                  : "text-xs font-medium text-amber-600"
              }
            >
              {isComplete ? "Complete" : "Incomplete"}
            </span>
            {headerExtra}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-5">
        {hasData ? (
          <DataBlock data={data} provenance={provenance} />
        ) : (
          <p className="text-sm text-slate-400 italic">No data recorded.</p>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
