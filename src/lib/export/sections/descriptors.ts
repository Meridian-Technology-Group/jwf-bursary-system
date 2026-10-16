/**
 * The export sections as the /exports page sees them (Epic 23): title, her
 * search filters and the column registry the field picker is built from.
 * Client-safe; the server half (rows, audit) is `registry.ts`.
 */

import type { ColumnDef } from "@/lib/export/columns";
import { ASSESSMENT_FILTER_KEYS } from "./filters";
import { STATISTICAL_COLUMNS } from "./statistical-columns";
import { WORKLOAD_COLUMNS, WORKLOAD_FILTER_KEYS } from "./workload-columns";
import { SPEND_BILLING_COLUMNS } from "./spend-billing-columns";

export type SectionKey = "workload" | "spend-billing" | "statistical";

export type FilterKey = (typeof ASSESSMENT_FILTER_KEYS)[number] | (typeof WORKLOAD_FILTER_KEYS)[number];

export interface SectionDescriptor {
  key: SectionKey;
  /** Her numbering in EXPORTS.xlsx. */
  number: number;
  title: string;
  description: string;
  filterKeys: readonly FilterKey[];
  columns: ColumnDef[];
}

export const WORKLOAD_SECTION: SectionDescriptor = {
  key: "workload",
  number: 1,
  title: "Assessment workload management",
  description:
    "Every application in the round, plus invitations sent with no application yet. % completion is the figure the parent sees.",
  filterKeys: WORKLOAD_FILTER_KEYS,
  columns: WORKLOAD_COLUMNS,
};

export const SPEND_BILLING_SECTION: SectionDescriptor = {
  key: "spend-billing",
  number: 2,
  title: "Assessment data for spend & billing purposes",
  description:
    "One row per assessment: every Part 1 field, the Part 2 totals, the Part 3–5 figures and the award. Untick a whole part to leave it out.",
  filterKeys: ASSESSMENT_FILTER_KEYS,
  columns: SPEND_BILLING_COLUMNS,
};

export const STATISTICAL_SECTION: SectionDescriptor = {
  key: "statistical",
  number: 3,
  title: "Assessment data for statistical purposes & external sharing",
  description:
    "One row per assessment. No names, emails or references: categories, ratios and award figures only.",
  filterKeys: ASSESSMENT_FILTER_KEYS,
  columns: STATISTICAL_COLUMNS,
};

/** In her order (1, 2, 3); sections not built yet are simply absent. */
export const SECTION_DESCRIPTORS: SectionDescriptor[] = [WORKLOAD_SECTION, SPEND_BILLING_SECTION, STATISTICAL_SECTION];

export function findSection(key: string): SectionDescriptor | undefined {
  return SECTION_DESCRIPTORS.find((s) => s.key === key);
}
