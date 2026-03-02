"use client";

/**
 * Invitation-based registration page.
 *
 * Supports two parallel registration flows:
 *
 * 1. **Token flow** (`?token=<hash>`) — Supabase magic-link / invite token.
 *    Verifies via `verifyOtp(type: "invite")`, then sets password + creates profile.
 *
 * 2. **Invitation ID flow** (`?invitationId=<uuid>`) — branded Resend email link.
 *    Validates the invitation server-side, shows a pre-filled form, then registers
 *    via `registerWithInvitationAction` + client-side `signInWithPassword`.
 *
 * If neither param is present, shows an "Invitation required" message.
 */

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { createProfile } from "@/lib/auth/create-profile";
import {
  validateInvitationAction,
  registerWithInvitationAction,
} from "./actions";

// ---------------------------------------------------------------------------
// Token-based registration (existing Supabase flow)
// ---------------------------------------------------------------------------

function TokenRegistration({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: "invite",
    });

    if (verifyError || !data.user) {
      setError(
        verifyError?.message ??
          "Invalid or expired invitation token. Please request a new invitation."
      );
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const result = await createProfile({
      id: data.user.id,
      email: data.user.email!,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Create your account
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Complete your registration to access the bursary portal.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <NameFields
          firstName={firstName}
          lastName={lastName}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
        />

        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />

        {error && <ErrorAlert message={error} />}

        <SubmitButton loading={loading} />
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Invitation ID-based registration (branded email flow)
// ---------------------------------------------------------------------------

function InvitationRegistration({
  invitationId,
}: {
  invitationId: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Invitation validation state
  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      const result = await validateInvitationAction(invitationId);
      if (cancelled) return;

      if (result.success) {
        setEmail(result.email);
        // Pre-fill name if available from invitation
        if (result.applicantName) {
          const parts = result.applicantName.split(" ");
          if (parts.length >= 2) {
            setFirstName(parts[0]);
            setLastName(parts.slice(1).join(" "));
          } else {
            setFirstName(result.applicantName);
          }
        }
      } else {
        setValidationError(result.error);
      }
      setValidating(false);
    }

    validate();
    return () => {
      cancelled = true;
    };
  }, [invitationId]);

  if (validating) {
    return (
      <div className="space-y-5">
        <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-blue-100" />
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-semibold text-slate-800">
          Invalid invitation
        </h1>
        <p className="text-sm text-slate-500">{validationError}</p>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    // Register via server action
    const result = await registerWithInvitationAction({
      invitationId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Sign in client-side to establish the browser session
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-semibold text-slate-800">
        Create your account
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Complete your registration to access the bursary portal.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Email — read-only, pre-filled from invitation */}
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
            value={email ?? ""}
            readOnly
            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm"
          />
        </div>

        <NameFields
          firstName={firstName}
          lastName={lastName}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
        />

        <PasswordFields
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
        />

        {error && <ErrorAlert message={error} />}

        <SubmitButton loading={loading} />
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared form field components
// ---------------------------------------------------------------------------

function NameFields({
  firstName,
  lastName,
  onFirstNameChange,
  onLastNameChange,
}: {
  firstName: string;
  lastName: string;
  onFirstNameChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label
          htmlFor="firstName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          First name
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="Jane"
        />
      </div>
      <div>
        <label
          htmlFor="lastName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Last name
        </label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="Smith"
        />
      </div>
    </div>
  );
}

function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
}: {
  password: string;
  confirmPassword: string;
  onPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Choose a password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="Repeat your password"
        />
      </div>
    </>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Creating account..." : "Create account"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inner content — reads search params and branches to the correct flow.
// ---------------------------------------------------------------------------

function RegisterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invitationId = searchParams.get("invitationId");

  if (token) {
    return <TokenRegistration token={token} />;
  }

  if (invitationId) {
    return <InvitationRegistration invitationId={invitationId} />;
  }

  return (
    <div className="text-center">
      <h1 className="mb-3 text-2xl font-semibold text-slate-800">
        Invitation required
      </h1>
      <p className="text-sm text-slate-500">
        This registration page is only accessible via an invitation link sent
        by the John Whitgift Foundation. Please check your email for an
        invitation, or contact your assessor for assistance.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense to satisfy Next.js static generation.
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-8 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-4 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-blue-100" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
