"use client";

/**
 * The optional per-invitation "Submit by" date (licence fix, 14 Oct 2026),
 * shared by the dialog-based send paths (invite from contact, bulk
 * re-assessment invites, internal request). The server validates it (not in
 * the past in Europe/London, not after the round's close date) and stores the
 * end of that day; the application created from the invitation inherits it.
 */

import { submitByMinValue } from "@/lib/invitations/submit-by";

export function SubmitByInput({
  id,
  value,
  onChange,
  disabled,
  batch = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Batch wording: one date applies to every invitation sent. */
  batch?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        Submit by (optional)
      </label>
      <input
        id={id}
        type="date"
        min={submitByMinValue(new Date())}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="block h-9 w-48 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
      />
      <p className="text-xs text-slate-500">
        {batch
          ? "One deadline for every family in this send. "
          : "The family's deadline. "}
        Blank uses the round&apos;s. Must be on or before the round&apos;s close
        date.
      </p>
    </div>
  );
}
