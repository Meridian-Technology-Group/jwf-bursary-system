"use client";

/**
 * Epic 22 P1 — "I would like to start the application" for one child's
 * invitation. Posts to `startInvitationApplicationAction`, which creates that
 * child's form and redirects to its first section; we only see a result here
 * when something went wrong before the redirect.
 */

import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { startInvitationApplicationAction } from "@/app/(portal)/actions";

export function StartApplicationOption({
  invitationId,
  label,
}: {
  invitationId: string;
  label: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    const result = await startInvitationApplicationAction(formData);
    if (result && !result.success) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <button
        type="submit"
        disabled={pending}
        className="group flex w-full items-center gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-left text-sm font-medium text-primary-900 transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-70"
      >
        <span className="flex-1">{label}</span>
        {pending ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
        >
          {error}
        </p>
      )}
    </form>
  );
}
