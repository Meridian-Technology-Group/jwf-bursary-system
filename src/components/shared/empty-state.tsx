/**
 * Reusable empty state component.
 *
 * Used when a list, table, or section has no data to display.
 * Renders a centered icon, title, description, and optional CTA button.
 */

import React from "react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  /** Defaults to "primary" (navy) */
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  /** Lucide icon element or any React node rendered as the visual */
  icon?: React.ReactNode;
  /** Bold title text */
  title: string;
  /** Descriptive supporting text */
  description?: string;
  /** Optional call-to-action button */
  action?: EmptyStateAction;
  /** Extra className applied to the outer wrapper */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"
          aria-hidden="true"
        >
          {/* Clone the icon to enforce consistent size */}
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                className: cn(
                  "h-7 w-7",
                  (icon as React.ReactElement<{ className?: string }>).props.className
                ),
              })
            : icon}
        </div>
      )}

      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "mt-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
            action.variant === "secondary"
              ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              : "bg-primary-900 text-white hover:bg-primary-800"
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
