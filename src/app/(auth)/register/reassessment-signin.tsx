"use client";

/**
 * Re-assessment sign-in step for the `/register?token=…` flow.
 *
 * A re-assessment invitation belongs to an existing bursary holder who
 * already has an account from year one — so we must NOT show the first-year
 * "create your account / choose a password" form. Instead this component
 * asks them to sign in with the same credentials they used last year.
 *
 * On successful sign-in we land them on the portal dashboard, where the
 * "Begin re-assessment" card consumes the (still-PENDING) invitation and
 * creates the prepopulated application.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

interface ReassessmentSignInProps {
  email: string;
  childName: string | null;
  academicYear: string | null;
}

export function ReassessmentSignIn({
  email,
  childName,
  academicYear,
}: ReassessmentSignInProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const childLabel = childName?.trim() || "your child";
  const yearLabel = academicYear ? ` for ${academicYear}` : "";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message ||
          "Sign-in failed. Please check your password and try again."
      );
      setLoading(false);
      return;
    }

    // Land on the portal dashboard; the Begin re-assessment card takes over.
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Welcome back
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Your bursary for {childLabel} is up for re-assessment{yearLabel}. Sign
        in with the same email and password you used last year to begin.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
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
          <p className="mt-1.5 text-xs text-slate-400">
            Forgotten your password?{" "}
            <a
              href="/reset-password"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Reset it here
            </a>
            .
          </p>
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
          {loading ? "Signing in…" : "Sign in to begin"}
        </button>
      </form>
    </>
  );
}
