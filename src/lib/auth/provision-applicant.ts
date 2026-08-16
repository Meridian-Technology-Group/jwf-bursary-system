/**
 * provision-applicant.ts — Epic 14 E1 (CG-04, US-E1): one applicant auth
 * user per EMAIL, however many children they hold.
 *
 * Every invite path used to call `supabase.auth.admin.createUser(email)`
 * unconditionally, so inviting a SECOND child on the same parent email —
 * Charlotte's exact planned test — failed with Supabase's raw
 * "already been registered" error. The data model has always allowed it
 * (`Contact` is one row per child sharing an email; one `Profile` leads many
 * `BursaryAccount`s); only the provisioning step assumed first-contact.
 *
 * Resolution order:
 *   1. An existing APPLICANT profile with this email → reuse its id (the
 *      accept flow then binds the new invitation/application to the same
 *      login; `createProfile` upserts, so nothing duplicates).
 *      A STAFF profile with the email is refused outright.
 *   2. No profile → create the auth user (the normal first-invite path).
 *   3. `createUser` says the email exists but no profile does (a
 *      half-provisioned leftover): recover the auth user id via a bounded
 *      admin listUsers scan.
 *
 * IMPORTANT for callers: only roll back the auth user on failure when
 * `created` is true — deleting a REUSED user would destroy the parent's
 * real login.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { withAdminContext } from "@/lib/db/prisma";

export type ProvisionApplicantResult =
  | { ok: true; authUserId: string; created: boolean }
  | { ok: false; error: string };

export async function provisionApplicantAuthUser(
  supabase: SupabaseClient,
  email: string
): Promise<ProvisionApplicantResult> {
  const cleanEmail = email.trim();

  // 1. Existing profile?
  const existing = await withAdminContext((tx) =>
    tx.profile.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      select: { id: true, role: true },
    })
  );

  if (existing) {
    if (existing.role !== "APPLICANT") {
      return {
        ok: false,
        error:
          "This email address belongs to a staff account and cannot receive an applicant invitation.",
      };
    }
    return { ok: true, authUserId: existing.id, created: false };
  }

  // 2. Fresh auth user.
  const tempPassword = cryptoRandomPassword();
  const { data: created, error } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "APPLICANT" },
  });

  if (!error && created?.user) {
    return { ok: true, authUserId: created.user.id, created: true };
  }

  // 3. Auth user exists without a profile (half-provisioned leftover) —
  //    recover its id. Bounded scan; this path is rare by construction.
  if (error && /already/i.test(error.message ?? "")) {
    for (let pageNo = 1; pageNo <= 20; pageNo++) {
      const { data, error: listError } = await supabase.auth.admin.listUsers({
        page: pageNo,
        perPage: 200,
      });
      if (listError) break;
      const match = data.users.find(
        (u) => (u.email ?? "").toLowerCase() === cleanEmail.toLowerCase()
      );
      if (match) return { ok: true, authUserId: match.id, created: false };
      if (data.users.length < 200) break;
    }
  }

  return {
    ok: false,
    error: error?.message ?? "Failed to create the parent's login.",
  };
}

function cryptoRandomPassword(): string {
  // node:crypto is available in every server context this runs in.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(24).toString("base64url");
}
