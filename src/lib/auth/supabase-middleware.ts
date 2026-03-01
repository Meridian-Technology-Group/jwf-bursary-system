/**
 * Supabase client for Edge Middleware.
 *
 * Edge middleware must read cookies from the incoming Request and write
 * updated cookies onto both the outgoing Request and Response so that
 * Server Components downstream can read the refreshed session.
 *
 * Returns both the client and the mutated response so the middleware
 * can forward the response with updated Set-Cookie headers.
 */

import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function createSupabaseMiddlewareClient(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient>;
  response: NextResponse;
} {
  // Start with a plain pass-through response. We accumulate Set-Cookie
  // headers on it as the Supabase client refreshes the session.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto the forwarded request so downstream server
          // components see the refreshed values.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Rebuild the response with the updated request headers so
          // Next.js picks up the mutated cookies.
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          // Also set the cookies on the response so the browser stores them.
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
}
