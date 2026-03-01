/**
 * Supabase client for Server Components and Route Handlers.
 *
 * Uses @supabase/ssr createServerClient with next/headers cookies().
 * Call this function inside any Server Component, Route Handler, or
 * Server Action where you need to read the authenticated user's session.
 *
 * IMPORTANT: cookies() is async in Next.js 14+ — we await it before
 * passing getAll/setAll to createServerClient.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from Server Components where cookies cannot be
            // mutated. The middleware handles cookie refresh, so this is safe.
          }
        },
      },
    }
  );
}
