/**
 * document-rules.ts — declarative required-document / structural rule engine.
 *
 * Replaces the bespoke per-section `GapEvaluator` functions that used to live in
 * `section-gaps.ts` (one hand-coded function per `ApplicationSectionType`, plus a
 * hand-maintained `SECTION_ITEM_TOTALS` table for progress maths). Instead each
 * section declares a flat list of rules; one generic evaluator turns a rule list
 * + the section's JSONB blob + the uploaded-slot set into `SectionGap[]`.
 *
 * This is the single source of truth the plan (02 §5.2) calls for: it drives both
 * the in-form upload prompts and the gap/submit gate, and the enumerable rule
 * list makes the progress denominator derivable (no more magic constants).
 *
 * Rule kinds (02 §3.3):
 *   - requiredAlways      — document always required once the section is started.
 *   - requiredIfValueGt0  — required when a numeric path resolves to > 0
 *                           (the workbook's "value other than £0 ⇒ upload" rule).
 *   - requiredIfTrue      — required when a boolean path is true (toggle branch).
 *   - requiredOneOf       — at least one of N candidate slots/doc-paths present
 *                           (P60 *or* March payslip).
 *   - structural          — a non-document predicate (e.g. exactly-one named
 *                           child); contributes a gap when the predicate fails.
 *
 * Documents declared `optional` are simply *not* expressed as a rule (e.g. Child
 * Benefit, lease/car docs) — absence of a rule is the "non-mandatory" kind.
 *
 * Pure module: no DB, no server-only. `section-gaps.ts` feeds it the already-read
 * blob + uploaded slot set.
 */

import type { ApplicationSectionType } from "@prisma/client";

export type SectionType = ApplicationSectionType;
export type GapSeverity = "error" | "warning";

export interface SectionGap {
  id: string;
  sectionType: SectionType;
  label: string;
  severity: GapSeverity;
  fieldRef?: string;
}

/**
 * A document is considered present when EITHER its tracked id is a non-empty
 * string on the blob (the form mirrors the uploaded doc id into the section
 * data) OR a document exists in the matching upload slot. Either is sufficient,
 * mirroring the legacy evaluators exactly.
 */
export interface DocPresence {
  /**
   * Dot-path into the section blob holding the tracked document id. The value
   * may be a non-empty string (single doc) OR a non-empty string[] (multi-doc,
   * e.g. bank statements) — either counts as present.
   */
  docIdPath: string;
  /** Upload slot string to also check. */
  slot: string;
}

interface BaseRule {
  /** Stable gap id suffix; full id is `${sectionType}:${id}`. */
  id: string;
  label: string;
  severity?: GapSeverity;
  /** Field path for deep-linking from the review summary. */
  fieldRef?: string;
  /**
   * When set, the rule is only evaluated if the value at this dot-path EXISTS
   * (is not null/undefined) on the blob. Used to scope per-parent rules to the
   * parent block that was actually shown/saved (the legacy evaluators only ran
   * the Parent 2 checks when `data.parent2Income` / `data.parent2Employment`
   * was present in the saved blob).
   */
  onlyIfExistsPath?: string;
}

export interface RequiredAlwaysRule extends BaseRule {
  kind: "requiredAlways";
  doc: DocPresence;
}

export interface RequiredIfValueGt0Rule extends BaseRule {
  kind: "requiredIfValueGt0";
  /** Dot-path(s) to numeric value(s); rule fires when ANY resolves > 0. */
  valuePaths: string[];
  doc: DocPresence;
}

export interface RequiredIfTrueRule extends BaseRule {
  kind: "requiredIfTrue";
  /** Dot-path to a boolean value; rule fires when it is strictly true. */
  truePath: string;
  doc: DocPresence;
}

export interface RequiredOneOfRule extends BaseRule {
  kind: "requiredOneOf";
  /**
   * Only enforced when the gate is satisfied (e.g. the parent is Employed). When
   * `gate` is omitted the one-of is always enforced once the section is started.
   */
  gateValuePaths?: string[];
  gateTruePath?: string;
  /** At least one of these documents must be present. */
  docs: DocPresence[];
}

export interface StructuralRule extends BaseRule {
  kind: "structural";
  /** Returns true when the rule is SATISFIED; false adds the gap. */
  predicate: (
    blob: Record<string, unknown>,
    uploadedSlots: Set<string>
  ) => boolean;
}

export type DocumentRule =
  | RequiredAlwaysRule
  | RequiredIfValueGt0Rule
  | RequiredIfTrueRule
  | RequiredOneOfRule
  | StructuralRule;

// ─── path / presence helpers ───────────────────────────────────────────────

/** Resolves a dot-path (e.g. "parent1Income.employed.annualSalaryPaye"). */
export function resolvePath(
  blob: Record<string, unknown> | null | undefined,
  path: string
): unknown {
  if (!blob) return undefined;
  let cur: unknown = blob;
  for (const key of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object")
      return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function docPresent(
  blob: Record<string, unknown> | null | undefined,
  uploadedSlots: Set<string>,
  doc: DocPresence
): boolean {
  const id = resolvePath(blob, doc.docIdPath);
  if (typeof id === "string" && id.length > 0) return true;
  if (Array.isArray(id) && id.some((x) => typeof x === "string" && x.length > 0))
    return true;
  return uploadedSlots.has(doc.slot);
}

function pathExists(
  blob: Record<string, unknown> | null | undefined,
  path: string
): boolean {
  const v = resolvePath(blob, path);
  return v !== null && v !== undefined;
}

// ─── generic evaluator ──────────────────────────────────────────────────────

/**
 * Evaluates a rule list against a (possibly null) section blob and the uploaded
 * slot set. Returns the gaps for unsatisfied rules. When the blob is null the
 * section has never been saved → no gaps (matches the legacy behaviour: rules
 * only apply once data exists).
 */
export function evaluateRules(
  sectionType: SectionType,
  rules: DocumentRule[],
  blob: Record<string, unknown> | null,
  uploadedSlots: Set<string>
): SectionGap[] {
  if (!blob) return [];
  const gaps: SectionGap[] = [];

  for (const rule of rules) {
    // Per-parent scoping: skip the rule entirely when its gated sub-object is
    // absent from the saved blob (e.g. Parent 2 block not shown).
    if (rule.onlyIfExistsPath && !pathExists(blob, rule.onlyIfExistsPath))
      continue;

    const severity = rule.severity ?? "error";
    const push = () =>
      gaps.push({
        id: `${sectionType}:${rule.id}`,
        sectionType,
        label: rule.label,
        severity,
        fieldRef: rule.fieldRef,
      });

    switch (rule.kind) {
      case "requiredAlways": {
        if (!docPresent(blob, uploadedSlots, rule.doc)) push();
        break;
      }
      case "requiredIfValueGt0": {
        const fires = rule.valuePaths.some(
          (p) => asNumber(resolvePath(blob, p)) > 0
        );
        if (fires && !docPresent(blob, uploadedSlots, rule.doc)) push();
        break;
      }
      case "requiredIfTrue": {
        if (
          resolvePath(blob, rule.truePath) === true &&
          !docPresent(blob, uploadedSlots, rule.doc)
        )
          push();
        break;
      }
      case "requiredOneOf": {
        const gated =
          (rule.gateValuePaths
            ? rule.gateValuePaths.some(
                (p) => asNumber(resolvePath(blob, p)) > 0
              )
            : true) &&
          (rule.gateTruePath
            ? resolvePath(blob, rule.gateTruePath) === true
            : true);
        if (!gated) break;
        const anyPresent = rule.docs.some((d) =>
          docPresent(blob, uploadedSlots, d)
        );
        if (!anyPresent) push();
        break;
      }
      case "structural": {
        if (!rule.predicate(blob, uploadedSlots)) push();
        break;
      }
    }
  }

  return gaps;
}

/**
 * Counts the rules that ACTUALLY apply to a given blob — i.e. whose
 * `onlyIfExistsPath` gate (if any) is satisfied. Used for the progress
 * denominator so a sole-parent section is not penalised for the absent
 * Parent 2 rules.
 */
export function applicableRuleCount(
  rules: DocumentRule[],
  blob: Record<string, unknown> | null
): number {
  if (!blob) return rules.length;
  return rules.filter(
    (r) => !r.onlyIfExistsPath || pathExists(blob, r.onlyIfExistsPath)
  ).length;
}

/**
 * Progress denominator for a section: 1 (the saved-form item) + one item per
 * APPLICABLE rule. This replaces the old hand-maintained `SECTION_ITEM_TOTALS`
 * constants — the rule list is now enumerable so the item count is exact.
 */
export function sectionItemTotal(
  rules: DocumentRule[],
  blob: Record<string, unknown> | null = null
): number {
  return 1 + applicableRuleCount(rules, blob);
}
