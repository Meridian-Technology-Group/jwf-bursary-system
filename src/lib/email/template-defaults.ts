/**
 * Merge fields given to every new custom template (resolved decision D-5 in
 * docs/backlog/stories/09-email-template-management.md): the subset of merge
 * fields common to (nearly) every system template, excluding
 * `registration_link` which only ever applies to the two invite templates.
 * Bare names (no `{{ }}`) to match the storage convention used by
 * `prisma/seed-data/email-templates.ts` and read by `send.ts`.
 *
 * Lives in its own plain module (NOT settings/actions.ts): a "use server"
 * file may only export async functions — exporting this constant from the
 * actions file made Next.js reject the whole module at runtime (500 on every
 * settings action), which unit tests and `next build` do not catch.
 */
export const DEFAULT_CUSTOM_TEMPLATE_MERGE_FIELDS = [
  "applicant_name",
  "child_name",
  "reference",
  "school",
  "academic_year",
  "deadline",
];
