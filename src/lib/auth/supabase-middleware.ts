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

/**
 * Mutable container so that setAll() can update the response reference
 * and the middleware always gets the latest one (with refreshed cookies).
 */
export interface MiddlewareContainer {
  supabase: ReturnType<typeof createServerClient>;
  /** Always returns the most-recently-built response (with session cookies). */
  get response(): NextResponse;
  /** Copies session cookies onto an arbitrary response (e.g. a redirect). */
  applySessionCookies(target: NextResponse): NextResponse;
}

export function createSupabaseMiddlewareClient(
  request: NextRequest
): MiddlewareContainer {
  // Start with a plain pass-through response. We accumulate Set-Cookie
  // headers on it as the Supabase client refreshes the session.
  let currentResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  // Track all session cookies set during getUser() so we can copy them
  // onto redirect responses.
  let sessionCookies: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];

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
          currentResponse = NextResponse.next({
            request: { headers: request.headers },
          });

          // Also set the cookies on the response so the browser stores them.
          sessionCookies = cookiesToSet.map(({ name, value, options }) => ({
            name,
            value,
            options: options as Record<string, unknown> | undefined,
          }));
          cookiesToSet.forEach(({ name, value, options }) => {
            currentResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return {
    supabase,
    get response() {
      return currentResponse;
    },
    applySessionCookies(target: NextResponse) {
      for (const { name, value, options } of sessionCookies) {
        target.cookies.set(name, value, options);
      }
      return target;
    },
  };
}
