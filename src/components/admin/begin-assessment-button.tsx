"use client";

/**
 * WP-10: Begin Assessment Button
 *
 * Client component. Calls beginAssessmentAction on click,
 * then refreshes the page to show the assessment workspace.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { beginAssessmentAction } from "@/app/(admin)/applications/[id]/assessment/actions";

interface BeginAssessmentButtonProps {
  applicationId: string;
}

export function BeginAssessmentButton({
  applicationId,
}: BeginAssessmentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleBegin = async () => {
    setIsLoading(true);
    setError(null);

    const result = await beginAssessmentAction(applicationId);

    if (result.success) {
      // Refresh to re-render the server component with the new assessment
      router.refresh();
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        onClick={handleBegin}
        disabled={isLoading}
        className="h-11 bg-primary-900 px-6 text-sm font-semibold text-white hover:bg-primary-800 focus-visible:ring-primary-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Starting assessment…
          </>
        ) : (
          <>
            <ClipboardList className="mr-2 h-4 w-4" aria-hidden="true" />
            Begin Assessment
          </>
        )}
      </Button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
