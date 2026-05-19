// src/lib/email/__tests__/merge.test.ts
// Regression tests for B13 — email merge-field convention drift.
//
// The contract: every seeded email template body and subject must be
// fully resolved by the snake_case keys passed at each `sendEmail` call
// site. Any `{{...}}` token surviving `replaceMergeFields()` is a bug
// (either drift between template tokens and call-site keys, or stale
// camelCase tokens still sitting in the seed data).

import { describe, expect, it } from "vitest";

import { emailTemplates } from "../../../../prisma/seed-data/email-templates";
import { replaceMergeFields } from "../merge";
import type { EmailMergeData } from "../types";

// ── Call-site key fixtures ──────────────────────────────────────────────────
// These mirror the snake_case keys passed at every `sendEmail` call site.
// When a new call site is added or an existing one changes its key set, the
// matching fixture below must be updated. The test asserts that the rendered
// subject + body contain zero `{{...}}` tokens, so any drift trips CI.

const callSiteData: Record<string, EmailMergeData> = {
  // src/app/(admin)/invitations/actions.ts:246, :513
  // src/app/(admin)/queue/actions.ts:284
  INVITATION: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    school: "Trinity School",
    round_year: "2026/27",
    registration_link: "https://app.example.com/register?token=abc",
    deadline: "01/06/2026",
  },
  // src/app/(portal)/apply/actions.ts:377
  CONFIRMATION: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    school: "Trinity School",
    reference: "TRI-2026-0001",
    submission_date: "19 May 2026",
  },
  // src/app/(admin)/applications/[id]/actions.ts:209
  MISSING_DOCS: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    reference: "TRI-2026-0001",
    missing_documents: "• HMRC SA302\n• P60",
    deadline: "02/06/2026",
  },
  // src/app/(admin)/applications/[id]/actions.ts:364
  // src/app/(admin)/applications/[id]/recommendation/actions.ts:173
  OUTCOME_QUALIFIES: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    school: "Trinity School",
    reference: "TRI-2026-0001",
    academic_year: "2026/27",
  },
  // src/app/(admin)/applications/[id]/actions.ts:364
  // src/app/(admin)/applications/[id]/recommendation/actions.ts:173
  OUTCOME_DNQ: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    school: "Whitgift School",
    reference: "WHI-2026-0042",
    academic_year: "2026/27",
  },
  // src/app/(admin)/invitations/actions.ts:399
  REASSESSMENT: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    school: "Whitgift School",
    round_year: "2026/27",
    registration_link: "https://app.example.com/register?token=abc",
    deadline: "01/06/2026",
  },
  // NOTE: no call site currently sends REMINDER (orphan template — flagged
  // separately in B13 PR). We still assert the seed body resolves cleanly
  // given the keys its `mergeFields` list advertises.
  REMINDER: {
    applicant_name: "Alex Parent",
    child_name: "Sam Parent",
    reference: "TRI-2026-0001",
    deadline: "01/06/2026",
  },
  // src/app/(admin)/users/actions.ts:156
  INVITE_STAFF: {
    first_name: "Jordan",
    role: "ASSESSOR",
    registration_link: "https://app.example.com/register/staff?token=xyz",
  },
};

const UNRESOLVED_TOKEN = /\{\{[^}]+\}\}/;

describe("seeded email templates", () => {
  for (const tpl of emailTemplates) {
    it(`${tpl.type}: subject and body contain no unresolved {{tokens}} after merge`, () => {
      const data = callSiteData[tpl.type];
      expect(
        data,
        `Missing call-site fixture for template ${tpl.type}. ` +
          `Add the snake_case keys passed at the matching sendEmail() call site.`
      ).toBeDefined();

      const renderedSubject = replaceMergeFields(tpl.subject, data!);
      const renderedBody = replaceMergeFields(tpl.body, data!);

      expect(renderedSubject).not.toMatch(UNRESOLVED_TOKEN);
      expect(renderedBody).not.toMatch(UNRESOLVED_TOKEN);
    });

    it(`${tpl.type}: declared mergeFields list matches tokens in template`, () => {
      // Defence-in-depth: catches stale camelCase tokens that don't appear
      // in any call-site fixture (which would otherwise pass the prior test
      // only because the fixture happens not to contain a key matching the
      // stray token).
      const seenTokens = new Set<string>();
      const tokenPattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g;
      for (const source of [tpl.subject, tpl.body]) {
        let match: RegExpExecArray | null;
        while ((match = tokenPattern.exec(source)) !== null) {
          seenTokens.add(match[1].trim());
        }
      }
      for (const token of Array.from(seenTokens)) {
        // Every token in the body must be declared in mergeFields
        expect(
          tpl.mergeFields,
          `Template ${tpl.type} body uses {{${token}}} but mergeFields does not declare it.`
        ).toContain(token);
        // And must be snake_case (no uppercase letters)
        expect(
          token,
          `Template ${tpl.type} uses non-snake_case token {{${token}}}. ` +
            `Convention is snake_case to match sendEmail() call-site keys.`
        ).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });
  }
});
