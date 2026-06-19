/**
 * sections.ts — Canonical, single source of truth for the portal section list.
 *
 * The ordered section list, the section ⇄ slug maps, and the shared section
 * titles used to be declared independently in 4–5 places (dashboard, wizard,
 * review, the gap engine, the submit action, the sidebar). That duplication is
 * exactly what let the "N of M" denominator drift. This module collapses the
 * order/slug declarations into one place so they can never diverge again.
 *
 * NEUTRALITY (important): this module carries NO `"use client"` and NO
 * `"server-only"` directive. It is plain data + pure helpers, so it imports
 * cleanly into BOTH server trees (`section-gaps.ts` is `server-only`;
 * `apply/actions.ts`) and client trees (`portal-sidebar-sections.ts` is
 * imported by the client `portal-sidebar.tsx`) — exactly as
 * `portal-sidebar-sections.ts` is today.
 */

import { ApplicationSectionType } from "@prisma/client";

/**
 * Every form section, in workbook order. The "N of M" denominator and every
 * stepper / review ordering derive from this single array.
 *
 * The active set for a given application may exclude FAMILY_ID for a
 * rolling-over re-assessment — see `REASSESSMENT_SECTION_ORDER` and
 * `HIDDEN_REASSESSMENT_SECTIONS` (the latter remains the single source of the
 * hidden-set in `@/lib/db/queries/reassessment`).
 */
export const SECTION_ORDER: ApplicationSectionType[] = [
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

/** ApplicationSectionType → URL slug (e.g. `CHILD_DETAILS` → `child-details`). */
export const SECTION_TO_SLUG: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "child-details",
  FAMILY_ID: "family-id",
  PARENT_DETAILS: "parent-details",
  DEPENDENT_CHILDREN: "dependent-children",
  DEPENDENT_ELDERLY: "dependent-elderly",
  OTHER_INFO: "other-info",
  PARENTS_INCOME: "parents-income",
  ASSETS_LIABILITIES: "assets-liabilities",
  ADDITIONAL_INFO: "additional-info",
  DECLARATION: "declaration",
};

/** URL slug → ApplicationSectionType (the inverse of `SECTION_TO_SLUG`). */
export const SLUG_TO_SECTION: Record<string, ApplicationSectionType> =
  Object.fromEntries(
    Object.entries(SECTION_TO_SLUG).map(([section, slug]) => [slug, section])
  ) as Record<string, ApplicationSectionType>;

/**
 * The shared section titles used by the review page (and, with a single
 * documented override, the wizard).
 *
 * NOTE (copy divergence — see PR-5): the wizard renders FAMILY_ID as
 * "Details of Child — Identification" whereas the review page renders it as
 * "Family Identification". These are NOT merged here — this canonical map holds
 * the review wording, and the wizard keeps a one-key override. Reconciling the
 * two strings is a copy decision for product, not part of this refactor.
 */
export const SECTION_TITLES: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Details of Child",
  FAMILY_ID: "Family Identification",
  PARENT_DETAILS: "Parent / Guardian Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information Required",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Parents' Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

/**
 * Sections hidden for a rolling-over re-assessment (currently just FAMILY_ID).
 *
 * This MUST agree with `HIDDEN_REASSESSMENT_SECTIONS` in
 * `@/lib/db/queries/reassessment`, which remains the source of truth consumed
 * by the wizard's hide/redirect logic. It is mirrored here only so the base
 * order can derive `REASSESSMENT_SECTION_ORDER` without a server-only import.
 */
export const REASSESSMENT_HIDDEN: ApplicationSectionType[] = ["FAMILY_ID"];

/** `SECTION_ORDER` with the re-assessment-hidden sections removed. */
export const REASSESSMENT_SECTION_ORDER: ApplicationSectionType[] =
  SECTION_ORDER.filter((s) => !REASSESSMENT_HIDDEN.includes(s));
