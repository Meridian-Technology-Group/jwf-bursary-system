/**
 * Supabase client for Client Components.
 *
 * Uses @supabase/ssr createBrowserClient which manages cookies via
 * document.cookie automatically. Import and call this inside any
 * "use client" component.
 *
 * A module-level singleton avoids recreating the client on every render.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
