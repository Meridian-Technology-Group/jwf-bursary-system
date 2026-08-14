import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emailTemplates } from "../../../../../prisma/seed-data/email-templates";

/**
 * Call-site guard for the E1 `{{deadline}}` fix (CF-11 / CF-12).
 *
 * Six send sites injected the invitation TOKEN EXPIRY (now + 30 days) as
 * `{{deadline}}`, which the templates present as the deadline for SUBMITTING
 * the application. `src/lib/email/invitation-deadline.ts` owns the correct
 * resolution and is unit-tested directly; what THIS file pins is the wiring —
 * that no send site has drifted back to passing the expiry.
 *
 * Why a source scan rather than an integration test: each of these paths is a
 * `"use server"` action that provisions a Supabase auth user, opens a Prisma
 * transaction and calls Resend. Standing all of that up would test the mocks,
 * not the fix; the thing that can silently regress is a call site quietly
 * re-adding `deadline: someDate.toLocaleDateString(...)`, and that is exactly
 * what this catches.
 */

const ROOT = join(__dirname, "..", "..", "..", "..", "..");

/** Every file that sends an invitation-style email with a {{deadline}} field. */
const SEND_SITES = [
  {
    file: "src/app/(admin)/invitations/actions.ts",
    // createInvitation, reassessment batch, resend, second-parent invite.
    expectedCalls: 4,
  },
  { file: "src/app/(admin)/contacts/invite-actions.ts", expectedCalls: 1 },
  { file: "src/app/(admin)/queue/actions.ts", expectedCalls: 1 },
];

function source(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("invitation {{deadline}} wiring (E1 / CF-11, CF-12)", () => {
  for (const { file, expectedCalls } of SEND_SITES) {
    describe(file, () => {
      it("never assigns a raw formatted date to the deadline merge field", () => {
        // The exact shape of the bug: `deadline: expiresAt.toLocaleDateString("en-GB")`.
        expect(source(file)).not.toMatch(/\bdeadline:\s*\w[\w.?]*\.toLocaleDateString/);
      });

      it("resolves the deadline through the shared helper at every send site", () => {
        expect(
          countOccurrences(source(file), "invitationDeadlineFields(")
        ).toBe(expectedCalls);
      });
    });
  }

  it("exactly one send site asks for the ROLLING_OVER deadline", () => {
    // A re-assessment invitation goes to an existing bursary holder, so it must
    // resolve against the round's rolling (April) date, not the new-applicant
    // one. Getting this wrong would tell every holder the wrong month — and
    // conversely, no OTHER send site may claim to be a rollover.
    const all = SEND_SITES.map(({ file }) => source(file)).join("\n");
    // Only the argument lists of the helper calls count — `"ROLLING_OVER"`
    // appears elsewhere for unrelated reasons (e.g. creating the re-assessment
    // application itself).
    const args = all.match(/invitationDeadlineFields\(([^)]*)\)/g) ?? [];
    expect(args).toHaveLength(6);
    expect(args.filter((a) => a.includes('"ROLLING_OVER"'))).toHaveLength(1);
  });

  it("the token expiry is still communicated, via its own merge field", () => {
    // The link genuinely stops working, so dropping the date entirely would be
    // its own defect — it just must not ride on {{deadline}}.
    for (const type of [
      "INVITATION",
      "REASSESSMENT",
      "SECONDARY_PARENT_INVITE",
    ]) {
      const template = emailTemplates.find((t) => t.type === type)!;
      expect(template.mergeFields).toContain("link_expiry");
      expect(template.body).toContain("{{link_expiry}}");
      // …and still states the submission deadline separately.
      expect(template.mergeFields).toContain("deadline");
      expect(template.body).toContain("{{deadline}}");
    }
  });
});
