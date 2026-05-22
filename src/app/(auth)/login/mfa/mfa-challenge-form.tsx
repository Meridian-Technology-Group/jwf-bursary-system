"use client";

/**
 * MFA challenge form (B8).
 *
 * Shown when the staff user already has a verified TOTP factor. Collects a
 * 6-digit code and elevates the session to aal2.
 */

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { challengeAndVerifyAction } from "./actions";

interface MfaChallengeFormProps {
  factorId: string;
  nextPath: string;
}

export function MfaChallengeForm({ factorId, nextPath }: MfaChallengeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("factorId", factorId);
    formData.set("code", code);

    startTransition(async () => {
      const result = await challengeAndVerifyAction(formData);
      if (!result.success) {
        setError(result.error ?? "Verification failed.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800">
          Two-factor authentication
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="code"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            6-digit verification code
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="000000"
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
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Verifying..." : "Verify and continue"}
        </button>
      </form>
    </div>
  );
}
