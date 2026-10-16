/**
 * The export sections as the /exports page sees them (Epic 23): title, her
 * search filters and the column registry the field picker is built from.
 * Client-safe; the server half (rows, audit) is `registry.ts`.
 */

import type { ColumnDef } from "@/lib/export/columns";
import { ASSESSMENT_FILTER_KEYS } from "./filters";
import { STATISTICAL_COLUMNS } from "./statistical-columns";

export type SectionKey = "workload" | "spend-billing" | "statistical";

export type FilterKey = (typeof ASSESSMENT_FILTER_KEYS)[number];

export interface SectionDescriptor {
  key: SectionKey;
  /** Her numbering in EXPORTS.xlsx. */
  number: number;
  title: string;
  description: string;
  filterKeys: readonly FilterKey[];
  columns: ColumnDef[];
}

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
export const SECTION_DESCRIPTORS: SectionDescriptor[] = [STATISTICAL_SECTION];

export function findSection(key: string): SectionDescriptor | undefined {
  return SECTION_DESCRIPTORS.find((s) => s.key === key);
}
