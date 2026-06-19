/**
 * RoundStatusBadge — shared presentational badge for a Round's lifecycle
 * status. Pure server component (no client hooks). Extracted from the inline
 * copies that were duplicated in `/rounds` and `/rounds/[id]` so the markup
 * lives in one place.
 */

import { cn } from "@/lib/utils";

export function RoundStatusBadge({
  status,
}: {
  status: "DRAFT" | "OPEN" | "CLOSED";
}) {
  const styles = {
    DRAFT: "bg-neutral-100 text-neutral-600",
    OPEN: "bg-green-50 text-green-700",
    CLOSED: "bg-neutral-100 text-neutral-500",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
