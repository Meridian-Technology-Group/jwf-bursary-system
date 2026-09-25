/**
 * GT migration (E5) — `Application.migrationSource`.
 *
 * A migrated application is a placeholder: it carries the assessment,
 * recommendation and bursary account brought across from Grant Tracker, but it
 * has no form sections because the family never filled one in here. NULL means
 * the application was created in this system.
 */
export const MIGRATION_SOURCES = {
  /** Loaded from Grant Tracker by the migration toolkit. */
  GRANT_TRACKER: "GRANT_TRACKER",
  /** A pastoral-boarder account JWF created by hand during the migration. */
  MANUAL_PB: "MANUAL_PB",
} as const;

export type MigrationSource = (typeof MIGRATION_SOURCES)[keyof typeof MIGRATION_SOURCES];

export function isMigrated(app: { migrationSource: string | null }): boolean {
  return app.migrationSource != null;
}

/** Shown in place of the application form on a migrated application. */
export const MIGRATED_NOTICE =
  "Migrated from Grant Tracker: there is no application form. Documents are under Assessment → Uploaded documents.";

/**
 * Spread into every portal query that resolves "the parent's application"
 * (dashboard, status, form, review, respond, submitted, nav, paused banner),
 * including the active-application preference. A migrated placeholder has no
 * form, so it must never become the application a parent is shown; the
 * schedule grid reads accounts, and "is this person a lead applicant at all?"
 * checks deliberately still count it.
 */
export const PORTAL_APPLICATION = { migrationSource: null } as const;
