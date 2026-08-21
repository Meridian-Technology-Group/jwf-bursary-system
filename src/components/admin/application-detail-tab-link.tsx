"use client";

/**
 * Application detail tab link — client component.
 * Uses usePathname to detect the active tab.
 *
 * Item 13 (Story 13.1): navigation goes through `router.push` inside a local
 * `useTransition` rather than plain `<Link>` navigation, so THIS tab can show
 * its own pending spinner the instant it's clicked — Next.js 14 has no
 * `useLinkStatus`, so a per-link transition is the mechanism. The spinner is
 * delayed ~150ms so a fast load doesn't flash. Each tab's `isPending` is local
 * to its own transition, so it's automatically cleared if the user clicks a
 * different tab (or navigates away) before this one resolves — nothing to
 * strand. `isActive` (the persistent selected-tab styling) is still derived
 * purely from `usePathname`, unaffected by the pending state, per the story's
 * "additive, not a replacement" requirement.
 */

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
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

/** Appearance delay so brief loads feel instant rather than flickering (13.1). */
const SPINNER_DELAY_MS = 150;

export function ApplicationDetailTabLink({
  label,
  href,
  isPlaceholder,
  disabled,
  disabledReason,
}: ApplicationDetailTabLinkProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSpinner, setShowSpinner] = useState(false);

  // Exact match for the detail root (/applications/[id]) to avoid matching all tabs
  const isActive = pathname === href;

  useEffect(() => {
    if (!isPending) {
      setShowSpinner(false);
      return;
    }
    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

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

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (open in new tab/window, middle-click) behave natively.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    // Already here — a no-op navigation, don't trigger a pointless transition.
    if (isActive) return;

    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
        isActive
          ? "border-primary-700 text-primary-700"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
      {showSpinner && (
        <span role="status" className="inline-flex items-center">
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-current"
            aria-hidden="true"
          />
          <span className="sr-only">Loading {label}…</span>
        </span>
      )}
    </Link>
  );
}
