/**
 * Audit vocabulary — single source of truth for `AuditLog.action` keys and
 * `AuditLog.entityType` values (backlog #10).
 *
 * Conventions (decided 2026-05-24, forward-only — historical rows keep their
 * legacy values, which the audit page maps via the LEGACY_* tables below):
 *
 *   - `action`     → SCREAMING_SNAKE  (e.g. `ASSESSMENT_SAVE`)
 *   - `entityType` → PascalCase Prisma model name (e.g. `SiblingLink`)
 *
 * All call sites import from here so a typo becomes a compile error and the
 * vocabulary can't silently drift again. `createAuditLog` accepts the derived
 * union types, so passing an unknown string fails `tsc`.
 */

// ─── Action keys ────────────────────────────────────────────────────────────

/**
 * Every audit `action` key currently written by the app. SCREAMING_SNAKE only.
 * Keys and values are identical by design — the object exists to give call
 * sites a typed, autocompleted reference and to derive the `AuditAction` union.
 */
export const AUDIT_ACTIONS = {
  // Applications / outcomes
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  APPLICATION_STATUS_CHANGED: "APPLICATION_STATUS_CHANGED",
  APPLICATION_OUTCOME_SET: "APPLICATION_OUTCOME_SET",
  APPLICATION_ASSESSOR_ASSIGNED: "APPLICATION_ASSESSOR_ASSIGNED",
  APPLICATION_PAUSED: "APPLICATION_PAUSED",
  APPLICATION_RESUMED: "APPLICATION_RESUMED",
  INTERNAL_REQUEST_CREATED: "INTERNAL_REQUEST_CREATED",
  MISSING_DOCS_RESPONDED: "MISSING_DOCS_RESPONDED",
  NAME_REVEAL: "NAME_REVEAL",

  // Assessment / recommendation (normalised from dotted keys in backlog #10)
  ASSESSMENT_BEGIN: "ASSESSMENT_BEGIN",
  ASSESSMENT_SAVE: "ASSESSMENT_SAVE",
  ASSESSMENT_CHECKLIST_SAVE: "ASSESSMENT_CHECKLIST_SAVE",
  ASSESSMENT_COMPLETE: "ASSESSMENT_COMPLETE",
  ASSESSMENT_PAUSE: "ASSESSMENT_PAUSE",
  ASSESSMENT_SECOND_PARENT_OVERRIDE: "ASSESSMENT_SECOND_PARENT_OVERRIDE",
  RECOMMENDATION_SAVE: "RECOMMENDATION_SAVE",

  // Documents
  DOCUMENT_UPLOADED_BY_ASSESSOR: "DOCUMENT_UPLOADED_BY_ASSESSOR",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  DOCUMENT_URL_GRANTED: "DOCUMENT_URL_GRANTED",
  DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED",
  DOCUMENT_UNVERIFIED: "DOCUMENT_UNVERIFIED",

  // Siblings
  SIBLING_LINK_CREATED: "SIBLING_LINK_CREATED",
  SIBLING_LINK_REMOVED: "SIBLING_LINK_REMOVED",
  SIBLING_PRIORITY_REORDERED: "SIBLING_PRIORITY_REORDERED",

  // Rounds
  CREATE_ROUND: "CREATE_ROUND",
  UPDATE_ROUND: "UPDATE_ROUND",
  ROUND_OPENED: "ROUND_OPENED",
  ROUND_CLOSED: "ROUND_CLOSED",
  RECOMMENDATION_EXPORT: "RECOMMENDATION_EXPORT",

  // Reassessment
  CREATE_REASSESSMENT_APPLICATION: "CREATE_REASSESSMENT_APPLICATION",
  BATCH_REASSESSMENT_INVITE: "BATCH_REASSESSMENT_INVITE",

  // Applicant invitations
  CREATE_INVITATION: "CREATE_INVITATION",
  CREATE_INVITATION_FAILED: "CREATE_INVITATION_FAILED",
  RESEND_INVITATION: "RESEND_INVITATION",
  REVOKE_INVITATION: "REVOKE_INVITATION",
  ACCEPT_INVITATION: "ACCEPT_INVITATION",
  EXPIRE_INVITATIONS_CRON: "EXPIRE_INVITATIONS_CRON",

  // Dual-parent (secondary contributor)
  ADD_SECOND_PARENT: "ADD_SECOND_PARENT",
  ADD_SECOND_PARENT_FAILED: "ADD_SECOND_PARENT_FAILED",
  SECONDARY_PARENT_ACCEPTED: "SECONDARY_PARENT_ACCEPTED",
  SECONDARY_PARENT_SUBMITTED: "SECONDARY_PARENT_SUBMITTED",

  // Staff invitations / management
  INVITE_STAFF: "INVITE_STAFF",
  INVITE_STAFF_FAILED: "INVITE_STAFF_FAILED",
  RESEND_STAFF_INVITATION: "RESEND_STAFF_INVITATION",
  REVOKE_STAFF_INVITATION: "REVOKE_STAFF_INVITATION",
  ACCEPT_STAFF_INVITATION: "ACCEPT_STAFF_INVITATION",
  UPDATE_STAFF_ROLE: "UPDATE_STAFF_ROLE",
  DEACTIVATE_STAFF: "DEACTIVATE_STAFF",
  RESET_STAFF_MFA: "RESET_STAFF_MFA",

  // Settings (normalised from dotted keys in backlog #10)
  SETTINGS_FAMILY_TYPE_CONFIG_UPSERT: "SETTINGS_FAMILY_TYPE_CONFIG_UPSERT",
  SETTINGS_SCHOOL_FEES_UPSERT: "SETTINGS_SCHOOL_FEES_UPSERT",
  SETTINGS_COUNCIL_TAX_UPDATE: "SETTINGS_COUNCIL_TAX_UPDATE",
  SETTINGS_REASON_CODE_CREATE: "SETTINGS_REASON_CODE_CREATE",
  SETTINGS_REASON_CODE_UPDATE: "SETTINGS_REASON_CODE_UPDATE",
  SETTINGS_EMAIL_TEMPLATE_UPDATE: "SETTINGS_EMAIL_TEMPLATE_UPDATE",
  UPDATE_EMAIL_TEMPLATE_ENABLED: "UPDATE_EMAIL_TEMPLATE_ENABLED",

  // GDPR
  GDPR_DELETION: "GDPR_DELETION",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ─── Entity types ─────────────────────────────────────────────────────────────

/**
 * Every `entityType` value written by the app. Always the PascalCase Prisma
 * model name (backlog #10 normalised the lone `SIBLING_LINK` outlier to
 * `SiblingLink`).
 */
export const AUDIT_ENTITY_TYPES = {
  Application: "Application",
  Assessment: "Assessment",
  AssessmentChecklist: "AssessmentChecklist",
  Recommendation: "Recommendation",
  Document: "Document",
  Profile: "Profile",
  SiblingLink: "SiblingLink",
  Round: "Round",
  Invitation: "Invitation",
  StaffInvitation: "StaffInvitation",
  ApplicationContributor: "ApplicationContributor",
  FamilyTypeConfig: "FamilyTypeConfig",
  SchoolFees: "SchoolFees",
  CouncilTaxDefault: "CouncilTaxDefault",
  ReasonCode: "ReasonCode",
  EmailTemplate: "EmailTemplate",
} as const;

export type AuditEntityType =
  (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

// ─── Legacy aliases (forward-only display support) ──────────────────────────────

/**
 * Maps legacy `action` values still present on historical rows to their current
 * canonical key. Used by the audit page so an old `assessment.save` row renders
 * with the same label/colour as a new `ASSESSMENT_SAVE` row. New writes never
 * use these — they exist purely for display of rows written before backlog #10.
 */
export const LEGACY_ACTION_ALIASES: Record<string, AuditAction> = {
  "assessment.begin": AUDIT_ACTIONS.ASSESSMENT_BEGIN,
  "assessment.save": AUDIT_ACTIONS.ASSESSMENT_SAVE,
  "assessment.checklist.save": AUDIT_ACTIONS.ASSESSMENT_CHECKLIST_SAVE,
  "assessment.complete": AUDIT_ACTIONS.ASSESSMENT_COMPLETE,
  "assessment.pause": AUDIT_ACTIONS.ASSESSMENT_PAUSE,
  "recommendation.save": AUDIT_ACTIONS.RECOMMENDATION_SAVE,
  "settings.family_type_config.upsert":
    AUDIT_ACTIONS.SETTINGS_FAMILY_TYPE_CONFIG_UPSERT,
  "settings.school_fees.upsert": AUDIT_ACTIONS.SETTINGS_SCHOOL_FEES_UPSERT,
  "settings.council_tax.update": AUDIT_ACTIONS.SETTINGS_COUNCIL_TAX_UPDATE,
  "settings.reason_code.create": AUDIT_ACTIONS.SETTINGS_REASON_CODE_CREATE,
  "settings.reason_code.update": AUDIT_ACTIONS.SETTINGS_REASON_CODE_UPDATE,
  "settings.email_template.update": AUDIT_ACTIONS.SETTINGS_EMAIL_TEMPLATE_UPDATE,
};

/**
 * Maps legacy `entityType` values on historical rows to their current canonical
 * value. Only the `SIBLING_LINK` → `SiblingLink` normalisation exists today.
 */
export const LEGACY_ENTITY_TYPE_ALIASES: Record<string, AuditEntityType> = {
  SIBLING_LINK: AUDIT_ENTITY_TYPES.SiblingLink,
};

/**
 * Resolves any stored `action` value (legacy or current) to its canonical key.
 * Unknown values pass through unchanged.
 */
export function canonicalAction(action: string): string {
  return LEGACY_ACTION_ALIASES[action] ?? action;
}

/**
 * Resolves any stored `entityType` value (legacy or current) to its canonical
 * value. Unknown values pass through unchanged.
 */
export function canonicalEntityType(entityType: string): string {
  return LEGACY_ENTITY_TYPE_ALIASES[entityType] ?? entityType;
}

/**
 * Given a canonical (or legacy) `entityType`, returns every stored value that
 * should match when filtering — i.e. the canonical value plus any legacy
 * aliases that resolve to it. Lets the audit-page entity filter catch
 * historical rows (e.g. a `SiblingLink` filter also matches legacy
 * `SIBLING_LINK` rows). Forward-only: no DB rewrite needed.
 */
export function entityTypeFilterValues(entityType: string): string[] {
  const canonical = canonicalEntityType(entityType);
  const legacy = Object.entries(LEGACY_ENTITY_TYPE_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([legacyValue]) => legacyValue);
  return Array.from(new Set([canonical, ...legacy]));
}

// ─── Display (audit page) ───────────────────────────────────────────────────────

/**
 * Semantic colour buckets for the audit timeline status dot. Keyed by the
 * canonical action; both legacy and current rows resolve through
 * `canonicalAction` first, so a historical `assessment.pause` and a new
 * `ASSESSMENT_PAUSE` render identically.
 */
const ACTION_COLOUR: Partial<Record<AuditAction, string>> = {
  [AUDIT_ACTIONS.ASSESSMENT_PAUSE]: "bg-yellow-400",
  [AUDIT_ACTIONS.APPLICATION_PAUSED]: "bg-yellow-400",
  [AUDIT_ACTIONS.APPLICATION_OUTCOME_SET]: "bg-green-500",
  [AUDIT_ACTIONS.APPLICATION_SUBMITTED]: "bg-green-500",
  [AUDIT_ACTIONS.ASSESSMENT_COMPLETE]: "bg-green-500",
  [AUDIT_ACTIONS.RECOMMENDATION_SAVE]: "bg-green-500",
  [AUDIT_ACTIONS.APPLICATION_RESUMED]: "bg-blue-500",
  [AUDIT_ACTIONS.ASSESSMENT_BEGIN]: "bg-blue-500",
  [AUDIT_ACTIONS.RECOMMENDATION_EXPORT]: "bg-blue-500",
  [AUDIT_ACTIONS.DOCUMENT_UPLOADED_BY_ASSESSOR]: "bg-purple-500",
  [AUDIT_ACTIONS.DOCUMENT_DELETED]: "bg-purple-500",
  [AUDIT_ACTIONS.DOCUMENT_URL_GRANTED]: "bg-purple-500",
  [AUDIT_ACTIONS.DOCUMENT_VERIFIED]: "bg-orange-400",
  [AUDIT_ACTIONS.DOCUMENT_UNVERIFIED]: "bg-orange-400",
  [AUDIT_ACTIONS.APPLICATION_STATUS_CHANGED]: "bg-red-400",
  [AUDIT_ACTIONS.GDPR_DELETION]: "bg-red-400",
  [AUDIT_ACTIONS.NAME_REVEAL]: "bg-orange-400",
};

/**
 * Returns the Tailwind background class for an action's status dot. Accepts any
 * stored value (legacy or current) and resolves it to the canonical key first.
 * Falls back to substring heuristics, then a neutral slate, so unmapped/unknown
 * actions still render sensibly.
 */
export function actionColourClass(action: string): string {
  const canonical = canonicalAction(action);
  const mapped = ACTION_COLOUR[canonical as AuditAction];
  if (mapped) return mapped;

  // Heuristic fallback for any action not explicitly mapped above.
  if (canonical.includes("PAUSE")) return "bg-yellow-400";
  if (
    canonical.includes("OUTCOME") ||
    canonical.includes("COMPLETE") ||
    canonical.includes("SUBMITTED") ||
    canonical.includes("OPENED")
  ) {
    return "bg-green-500";
  }
  if (canonical.includes("RESUMED") || canonical.includes("BEGIN")) {
    return "bg-blue-500";
  }
  if (canonical.includes("DOCUMENT")) return "bg-purple-500";
  if (canonical.includes("STATUS") || canonical.includes("DELET")) {
    return "bg-red-400";
  }
  if (canonical.includes("REVEAL") || canonical.includes("VERIF")) {
    return "bg-orange-400";
  }
  return "bg-slate-400";
}
