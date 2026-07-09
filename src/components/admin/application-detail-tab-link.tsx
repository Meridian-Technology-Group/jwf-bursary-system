"use client";

/**
 * Application detail tab link — client component.
 * Uses usePathname to detect the active tab.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ApplicationDetailTabLinkProps {
  label: string;
  href: string;
  isPlaceholder?: boolean;
  /** When true the tab is inert (no navigation) and shows `disabledReason`. */
  disabled?: boolean;
  /** Tooltip explaining why the tab is disabled. */
  disabledReason?: string;
}

export function ApplicationDetailTabLink({
  label,
  href,
  isPlaceholder,
  disabled,
  disabledReason,
}: ApplicationDetailTabLinkProps) {
  const pathname = usePathname();

  // Exact match for the detail root (/applications/[id]) to avoid matching all tabs
  const isActive = pathname === href;

  // A gated tab (e.g. Assessment before the form is submitted) renders inert
  // with an explanatory tooltip instead of silently redirecting on click.
  if (isPlaceholder || disabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-400 cursor-not-allowed",
          "whitespace-nowrap"
        )}
        title={disabled ? disabledReason ?? "Unavailable" : "Coming soon"}
        aria-disabled="true"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
        isActive
          ? "border-primary-700 text-primary-700"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
