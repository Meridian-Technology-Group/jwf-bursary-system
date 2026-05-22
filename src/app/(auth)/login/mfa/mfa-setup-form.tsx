"use client";

/**
 * MFA setup (enrolment) form (B8).
 *
 * Renders the Supabase-provided QR code (an SVG string) inline plus the
 * plaintext secret, then collects the first 6-digit code to confirm the
 * factor. On success the session is elevated to aal2 and we navigate to the
 * originally requested admin route.
 */

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyEnrolmentAction } from "./actions";

interface MfaSetupFormProps {
  factorId: string;
  /** SVG markup returned by supabase.auth.mfa.enroll().data.totp.qr_code */
  qrCode: string;
  secret: string;
  nextPath: string;
}

export function MfaSetupForm({
  factorId,
  qrCode,
  secret,
  nextPath,
}: MfaSetupFormProps) {
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
      const result = await verifyEnrolmentAction(formData);
      if (!result.success) {
        setError(result.error ?? "Verification failed.");
        return;
      }
      // Session is now aal2. Refresh so middleware sees the new cookies.
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800">
          Set up two-factor authentication
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Staff accounts require an authenticator app. Scan the QR code below
          with Google Authenticator, 1Password, Authy, or similar, then enter
          the 6-digit code to finish.
        </p>
      </div>

      {/* QR code (inline SVG from Supabase). */}
      <div className="flex justify-center">
        <div
          className="rounded-lg border border-slate-200 bg-white p-3"
          // qr_code is a trusted SVG generated server-side by Supabase Auth.
          dangerouslySetInnerHTML={{ __html: qrCode }}
        />
      </div>

      {/* Plaintext secret fallback. */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">
          Can&apos;t scan? Enter this secret manually:
        </p>
        <code className="block w-full break-all rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center font-mono text-sm tracking-wider text-slate-700">
          {secret}
        </code>
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
          {isPending ? "Verifying..." : "Confirm and continue"}
        </button>
      </form>
    </div>
  );
}
