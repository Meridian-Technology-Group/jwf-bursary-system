/**
 * Dual-parent assessor view helpers (backlog #20, PR 5).
 *
 * Pure, client-safe utilities for separating an application's owner-tagged
 * sections and uploaded documents into the two contributor groups
 * (PRIMARY = "Parent 1", SECONDARY = "Parent 2") that the assessor reads
 * side-by-side while keying earners.
 *
 * Single-parent applications (no SECONDARY contributor) collapse to a single
 * group, so callers can render exactly as before when `hasSecondary` is false.
 */

import type {
  ApplicationContributorRole,
  ApplicationSectionType,
} from "@prisma/client";

/** Sections that belong to a parent (each contributor owns their own copy). */
export const PARENT_OWNED_SECTIONS: ApplicationSectionType[] = [
  "PARENT_DETAILS",
  "PARENTS_INCOME",
  "ASSETS_LIABILITIES",
];

/**
 * Whether a section type can be owned by a SECONDARY contributor. Everything
 * else (CHILD_DETAILS, DEPENDENT_*, DECLARATION, etc.) is PRIMARY-owned only
 * and is shown once.
 */
export function isParentOwnedSection(section: ApplicationSectionType): boolean {
  return PARENT_OWNED_SECTIONS.includes(section);
}

/** Display label for a contributor role in the dual-view. */
export function contributorRoleLabel(role: ApplicationContributorRole): string {
  return role === "PRIMARY" ? "Parent 1 (primary applicant)" : "Parent 2 (second parent)";
}

/** Short label for compact UI (badges, document group headers). */
export function contributorRoleShortLabel(
  role: ApplicationContributorRole
): string {
  return role === "PRIMARY" ? "Parent 1" : "Parent 2";
}

/**
 * Builds a lookup from contributorId → { role, label, shortLabel }. Anything
 * not in the map (e.g. a NULL uploader on a legacy document) is treated as the
 * PRIMARY group by the caller.
 */
export interface ContributorLabel {
  id: string;
  role: ApplicationContributorRole;
  label: string;
  shortLabel: string;
}

export function buildContributorLabelMap(
  contributors: { id: string; role: ApplicationContributorRole }[]
): Record<string, ContributorLabel> {
  const map: Record<string, ContributorLabel> = {};
  for (const c of contributors) {
    map[c.id] = {
      id: c.id,
      role: c.role,
      label: contributorRoleLabel(c.role),
      shortLabel: contributorRoleShortLabel(c.role),
    };
  }
  return map;
}
