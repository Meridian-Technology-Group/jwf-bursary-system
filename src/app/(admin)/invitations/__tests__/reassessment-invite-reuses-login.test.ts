import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GT migration PR-E: the re-assessment invite must REUSE the holder's login.
 *
 * `sendReassessmentInviteForHolder` called `supabase.auth.admin.createUser`
 * unconditionally, so it failed "already registered" for any holder who
 * already has a login: every migrated parent and every in-system holder. The
 * March 2027 batch would have failed for all 247 migrated families.
 *
 * Source scan, as in invitation-deadline-wiring.test.ts: the function is a
 * private step of `"use server"` actions that stand up Supabase, Prisma and
 * Resend, so what can silently regress is the call shape, and that is what
 * this pins. `provisionApplicantAuthUser` itself (reuse, staff refusal,
 * half-provisioned recovery) is the shared helper every invite path uses.
 */
const FILE = join(__dirname, "..", "actions.ts");

function holderInviteBody(): string {
  const src = readFileSync(FILE, "utf8");
  const start = src.indexOf("async function sendReassessmentInviteForHolder(");
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end);
}

describe("re-assessment invite reuses an existing login (PR-E)", () => {
  it("provisions through the shared helper, never createUser directly", () => {
    const body = holderInviteBody();
    expect(body).toContain("provisionApplicantAuthUser(supabase, email)");
    expect(body).not.toContain("auth.admin.createUser(");
  });

  it("only rolls back a login this call created", () => {
    const body = holderInviteBody();
    const rollback = body.slice(body.indexOf("} catch (err) {"));
    expect(rollback).toContain("deleteUser(");
    expect(rollback).toMatch(/if \(authUserId && createdAuthUser\)/);
  });
});
