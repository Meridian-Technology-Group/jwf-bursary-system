"use client";

/**
 * Password reset request page.
 *
 * Sends a "reset password" email via Supabase. After submission the user sees
 * a confirmation message. The email links straight to /reset-password/update
 * (the set-new-password page at ./update/page.tsx) carrying Supabase's
 * `token_hash`, which that page spends only when the form is submitted.
 *
 * It deliberately does NOT route through /auth/callback: that hop spent the
 * single-use token on the first GET, so mail-security link scanners burned
 * reset links before the recipient could click them.
 *
 * This page handles only the request step (entering an email address).
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type PageState = "idle" | "loading" | "sent" | "error";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // Surfaces in the email template as {{ .RedirectTo }}, which appends
        // ?token_hash=…&type=recovery. Origin-derived so preview deploys and
        // both environments resolve to their own host (the host must be on
        // the Supabase redirect allowlist).
        redirectTo: `${window.location.origin}/reset-password/update`,
      }
    );

    if (error) {
      setErrorMessage(error.message);
      setState("error");
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100"
          aria-hidden="true"
        >
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-800">
          Check your email
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          If an account exists for{" "}
          <span className="font-medium text-slate-700">{email}</span>, we have
          sent a password reset link. Check your inbox and follow the link to
          choose a new password.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Reset your password
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Enter your email address and we will send you a link to reset your
        password.
      </p>

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

        {state === "error" && errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "loading" ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
