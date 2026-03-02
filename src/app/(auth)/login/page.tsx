"use client";

/**
 * Login page — email/password authentication.
 *
 * On successful sign-in the user is redirected based on their role:
 * - APPLICANT → / (portal home)
 * - ASSESSOR / VIEWER → /admin
 *
 * A `next` query param is respected so the middleware can send users
 * back to the page they originally requested.
 *
 * NOTE: useSearchParams() must be inside a component wrapped in <Suspense>
 * to satisfy Next.js 14 static generation requirements.
 */

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

// ---------------------------------------------------------------------------
// Inner form — isolated so useSearchParams() is inside a Suspense boundary.
// ---------------------------------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Determine redirect destination from role stored in app_metadata.
    const role = data.user?.app_metadata?.role as string | undefined;
    let destination: string;

    if (nextPath) {
      destination = nextPath;
    } else if (role === "ADMIN" || role === "ASSESSOR" || role === "VIEWER") {
      destination = "/admin";
    } else {
      // Default (APPLICANT or unknown) → portal home.
      destination = "/";
    }

    // router.refresh() re-fetches Server Components so they pick up the new
    // session cookies written by the Supabase middleware client.
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <Link
            href="/reset-password"
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="Your password"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps form in Suspense to satisfy Next.js static generation.
// ---------------------------------------------------------------------------

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-2xl font-semibold text-slate-800">
        Sign in to your account
      </h1>
      <Suspense
        fallback={
          <div className="space-y-5">
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-blue-100" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </>
  );
}
