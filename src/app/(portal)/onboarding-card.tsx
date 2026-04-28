"use client";

/**
 * OnboardingCard — shown on the portal dashboard when the applicant has an
 * accepted invitation but no Application record yet.
 *
 * The applicant confirms school (radio) and child's full name (text input),
 * then submits to create the Application and redirect into the form.
 */

import * as React from "react";
import { startApplicationAction } from "@/app/(portal)/actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

interface OnboardingCardProps {
  /** Pre-filled child name from the invitation, if the bursar supplied it. */
  defaultChildName?: string | null;
}

export function OnboardingCard({ defaultChildName }: OnboardingCardProps) {
  const [school, setSchool] = React.useState<string>("");
  const [childName, setChildName] = React.useState<string>(
    defaultChildName ?? ""
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!school) {
      setError("Please select a school.");
      return;
    }
    if (!childName.trim()) {
      setError("Please enter your child's full name.");
      return;
    }

    setPending(true);
    const fd = new FormData();
    fd.set("school", school);
    fd.set("childName", childName);

    const result = await startApplicationAction(fd);

    // When the action succeeds it calls redirect(), and Next.js resolves
    // the client-side promise with `undefined` while navigation kicks in —
    // so the only time we land here is when the action returned an error.
    if (result && !result.success) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
          <GraduationCap
            className="h-6 w-6 text-primary-700"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-primary-900">
            Let&rsquo;s set up your application
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Before you start, please confirm which Foundation school your child
            has been offered a place at, and their full name as it appears on
            their birth certificate.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {/* School selection */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">
            School you are applying for{" "}
            <span className="text-error-600" aria-hidden="true">
              *
            </span>
          </legend>

          <RadioGroup
            value={school}
            onValueChange={setSchool}
            aria-required="true"
            className="gap-3"
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50 has-[[data-state=checked]]:border-primary-600 has-[[data-state=checked]]:bg-primary-50">
              <RadioGroupItem value="TRINITY" id="school-trinity" />
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Trinity School
                </span>
                <span className="block text-xs text-slate-500">
                  Shirley Park, Croydon
                </span>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50 has-[[data-state=checked]]:border-primary-600 has-[[data-state=checked]]:bg-primary-50">
              <RadioGroupItem value="WHITGIFT" id="school-whitgift" />
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Whitgift School
                </span>
                <span className="block text-xs text-slate-500">
                  Haling Park, South Croydon
                </span>
              </div>
            </label>
          </RadioGroup>
        </fieldset>

        {/* Child's full name */}
        <div className="space-y-2">
          <label
            htmlFor="childName"
            className="block text-sm font-medium text-slate-700"
          >
            Child&rsquo;s full name{" "}
            <span className="text-error-600" aria-hidden="true">
              *
            </span>
          </label>
          <Input
            id="childName"
            name="childName"
            type="text"
            placeholder="Enter child's full legal name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
            aria-required="true"
            autoComplete="name"
          />
          <p className="text-xs text-slate-400">
            Enter the name exactly as it appears on the birth certificate.
          </p>
        </div>

        {/* Inline error */}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-accent-600 text-white hover:bg-accent-700 focus-visible:outline-accent-600"
        >
          {pending ? "Setting up your application…" : "Start my application"}
        </Button>
      </form>
    </div>
  );
}
