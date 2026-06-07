"use client";

/**
 * Portal account footer — "Signed in as {name}" plus a Sign out control.
 *
 * Closes the shared-device safety gap in the portal shell (PR-3). The sign-out
 * is a same-origin <form action="/api/auth/logout" method="POST">, mirroring the
 * proven admin pattern (src/components/admin/admin-nav.tsx). The logout route
 * enforces CSRF via Origin/Referer, which a same-origin form POST satisfies —
 * no token needed.
 *
 * Reused inside PortalNav in PR-7.
 */

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalAccountFooterProps {
  userName: string;
  /** Compact (mobile sheet) vs full (desktop rail). */
  variant?: "rail" | "sheet";
}

export function PortalAccountFooter({
  userName,
  variant = "rail",
}: PortalAccountFooterProps) {
  return (
    <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
      <p className="truncate text-xs text-slate-500">Signed in as</p>
      <p className="truncate text-sm font-medium text-primary-900">
        {userName}
      </p>
      {/* Reuses the proven admin pattern: form POST to the CSRF-guarded route. */}
      <form action="/api/auth/logout" method="POST" className="mt-2">
        <button
          type="submit"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500",
            "hover:bg-slate-100 hover:text-primary-900 transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          )}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
