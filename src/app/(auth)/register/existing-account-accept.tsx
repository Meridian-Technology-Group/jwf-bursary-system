"use client";

/**
 * Epic 14 E1 (CG-04) — the `/register?token=…` step for a parent who ALREADY
 * has an account: a second (or third) child invited on the same email.
 *
 * Never shows the create-a-password form (that would silently reset the
 * parent's real password). Instead:
 *   - already signed in as the invited account → one button that accepts the
 *     invitation onto the existing login and lands on the portal;
 *   - signed out → sign in with the existing credentials, then accept.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { acceptInvitationForExistingAccountAction } from "./actions";

interface ExistingAccountAcceptProps {
  token: string;
  email: string;
  childName: string | null;
  /** True when the current session already belongs to the invited account. */
  signedInAsInvited: boolean;
}

export function ExistingAccountAccept({
  token,
  email,
  childName,
  signedInAsInvited,
}: ExistingAccountAcceptProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const childLabel = childName?.trim() || "this child";

  async function accept() {
    const result = await acceptInvitationForExistingAccountAction(token);
    if (!result.success) {
      setError(result.error ?? "Failed to accept the invitation.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleSignInAndAccept(e: FormEvent<HTMLFormElement>) {
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
    await accept();
  }

  async function handleAcceptOnly() {
    setError(null);
    setLoading(true);
    await accept();
  }

  return (
    <div className="text-center">
      <h1 className="mb-2 text-2xl font-semibold text-slate-800">
        You already have an account
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        This invitation adds <span className="font-medium">{childLabel}</span>{" "}
        to your existing account (<span className="font-mono">{email}</span>).
        One login covers all of your children&apos;s applications.
      </p>

      {signedInAsInvited ? (
        <button
          type="button"
          onClick={handleAcceptOnly}
          disabled={loading}
          className="inline-block rounded-lg bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {loading ? "Adding…" : `Add ${childLabel} to my account`}
        </button>
      ) : (
        <form onSubmit={handleSignInAndAccept} className="mx-auto max-w-xs space-y-3 text-left">
          <label
            htmlFor="existing-account-password"
            className="block text-sm font-medium text-slate-700"
          >
            Your password
          </label>
          <input
            id="existing-account-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="w-full rounded-lg bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-800 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in and add this child"}
          </button>
          <p className="text-center text-xs text-slate-400">
            Forgotten your password?{" "}
            <a href="/reset-password" className="underline underline-offset-2">
              Reset it
            </a>{" "}
            and then open this invitation link again.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
