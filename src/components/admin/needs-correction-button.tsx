"use client";

/**
 * "Needs correction" (Epic 23 T7): on a form returned to the family for
 * correction, takes this section's green tick away without changing its
 * answers, so the family sees it must be redone. For when the issue is a
 * judgement (a forged return, a blurry statement) rather than a blank field.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ApplicationSectionType } from "@prisma/client";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markSectionNeedsCorrection } from "@/app/(admin)/applications/[id]/edit/actions";

export function NeedsCorrectionButton({
  applicationId,
  section,
  isComplete,
}: {
  applicationId: string;
  section: ApplicationSectionType;
  isComplete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="min-w-0 flex-1">
        This form was returned to the family for correction.{" "}
        {isComplete
          ? "Clear a wrong figure (then leave the page and choose to save), remove a wrong document, or mark the whole section as needing correction."
          : "This section has no green tick, so the family will see it needs correcting."}
      </p>
      {isComplete && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          className="gap-2 border-amber-400 text-amber-900 hover:bg-amber-100"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await markSectionNeedsCorrection(applicationId, section);
              if (r.success) router.refresh();
              else setError(r.error ?? "Something went wrong.");
            })
          }
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
          Needs correction
        </Button>
      )}
      {error && <p className="w-full text-red-700">{error}</p>}
    </div>
  );
}
