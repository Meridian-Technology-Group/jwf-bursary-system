import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Call-site guard for the per-invitation "Submit by" date (licence fix,
 * 14 Oct 2026). The rules live in `src/lib/invitations/submit-by.ts` and are
 * unit-tested there; this pins the wiring, the same way
 * `invitation-deadline-wiring.test.ts` does for {{deadline}}: every send path
 * validates and stores the date and puts it in the email, and every path that
 * creates an application from an invitation copies it across.
 */

const ROOT = join(__dirname, "..", "..", "..", "..", "..");
const source = (file: string) => readFileSync(join(ROOT, file), "utf8");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const SEND_SITES = [
  // createInvitation, the re-assessment batch (all three entry points share
  // one core) and resend. The second-parent invite joins an existing
  // application, whose own override already applies.
  { file: "src/app/(admin)/invitations/actions.ts", validates: 2, emails: 3 },
  { file: "src/app/(admin)/contacts/invite-actions.ts", validates: 1, emails: 1 },
  { file: "src/app/(admin)/queue/actions.ts", validates: 1, emails: 1 },
];

describe('"Submit by" wiring', () => {
  for (const { file, validates, emails } of SEND_SITES) {
    describe(file, () => {
      const src = source(file);
      it("validates the date through the shared rule", () => {
        expect(count(src, "parseInvitationSubmitBy(")).toBe(validates);
      });
      it("resolves {{deadline}} with the invitation's date", () => {
        expect(count(src, "emailDeadlineOverride(")).toBe(emails);
      });
    });
  }

  it("stores it on every invitation the send paths create", () => {
    expect(count(source("src/app/(admin)/invitations/actions.ts"), "submissionDeadlineAt: submitBy")).toBe(1);
    expect(count(source("src/app/(admin)/invitations/actions.ts"), "submissionDeadlineAt: ctx.submitBy")).toBe(1);
    expect(count(source("src/app/(admin)/contacts/invite-actions.ts"), "submissionDeadlineAt: submitBy")).toBe(1);
    // Internal request: the invitation AND the application it creates up front.
    expect(count(source("src/app/(admin)/queue/actions.ts"), "submissionDeadlineAt: submitBy")).toBe(2);
  });

  it("every first-year start path hands the date to the shared creator", () => {
    // startApplicationAction + startInvitationApplicationAction; the two
    // register accept paths. Re-assessment paths pass the whole invitation row
    // to createReassessmentApplicationFromInvitation, which copies it.
    for (const file of ["src/app/(portal)/actions.ts", "src/app/(auth)/register/actions.ts"]) {
      const src = source(file);
      expect(count(src, "createFirstYearApplicationFromSource(tx, {")).toBe(2);
      expect(count(src, "submissionDeadlineAt: invitation.submissionDeadlineAt")).toBe(2);
    }
  });

  it("both creators write it onto the new application", () => {
    expect(
      count(source("src/lib/applications/create-from-invitation.ts"), "applicationDeadlineFromInvitation(")
    ).toBe(1);
    expect(
      count(source("src/lib/db/queries/reassessment.ts"), "applicationDeadlineFromInvitation(")
    ).toBe(1);
  });
});
