/**
 * Server half of the export sections (Epic 23): how each section parses its
 * filters, builds its rows and audits the download. Server-only.
 */

import type { Tx } from "@/lib/db/prisma";
import type { ExportRecord } from "@/lib/export/columns";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/actions";
import { AssessmentFiltersSchema, parseWith, type ParseResult } from "./filters";
import { STATISTICAL_SECTION, type SectionDescriptor, type SectionKey } from "./descriptors";
import { buildStatisticalRows } from "./statistical";

export interface ServerSection {
  descriptor: SectionDescriptor;
  sheetName: string;
  filenameStem: string;
  auditAction: AuditAction;
  /** Transaction timeout: above withUserContext's 10 s default for big rounds. */
  timeoutMs: number;
  parse(params: URLSearchParams): ParseResult<Record<string, unknown>>;
  buildRows(tx: Tx, filters: Record<string, unknown>): Promise<ExportRecord[]>;
}

const SECTIONS: Partial<Record<SectionKey, ServerSection>> = {
  statistical: {
    descriptor: STATISTICAL_SECTION,
    sheetName: "Statistical",
    filenameStem: "assessments-statistical",
    auditAction: AUDIT_ACTIONS.EXPORT_STATISTICAL,
    timeoutMs: 60_000,
    parse: (p) => parseWith(AssessmentFiltersSchema, p),
    buildRows: (tx, f) => buildStatisticalRows(tx, f as Parameters<typeof buildStatisticalRows>[1]),
  },
};

export function serverSection(key: string): ServerSection | undefined {
  return (SECTIONS as Record<string, ServerSection | undefined>)[key];
}
