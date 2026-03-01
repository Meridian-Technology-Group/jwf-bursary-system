/**
 * Supabase Admin client — server-side only.
 *
 * Uses the service_role key which bypasses Row Level Security.
 * NEVER import this in Client Components or expose to the browser.
 *
 * Suitable for:
 * - Sending user invites (auth.admin.inviteUserByEmail)
 * - Creating Profile rows after registration
 * - Administrative user management
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

export function createSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Do not persist the admin session to storage — this is a server-only
      // singleton and should never interact with browser storage.
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
