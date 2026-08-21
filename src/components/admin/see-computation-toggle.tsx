"use client";

/**
 * Epic 14 C2 (CG-21) — `SEE COMPUTATION` disclosure around the live
 * calculation display.
 *
 * Charlotte wants the running computation HIDDEN while she works the tables,
 * available on demand. Collapsed by default; the choice persists per browser
 * in localStorage so an assessor who prefers it open keeps it open. Wrapping
 * only — the calculation itself (and when it recomputes) is untouched.
 */

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jwf:assessment:see-computation";

export function SeeComputationToggle({
  children,
}: {
  children: React.ReactNode;
}) {
  // Collapsed on the server render; the stored preference applies after mount
  // (avoids a hydration mismatch — localStorage is client-only).
  const [open, setOpen] = React.useState(false);
  // Epic 15 W2 (CH-03): the header's SEE COMPUTATION deep-links here with
  // ?see=1 — that beats the stored preference for this visit.
  const searchParams = useSearchParams();
  const forcedOpen = searchParams?.get("see") === "1";

  React.useEffect(() => {
    if (forcedOpen) {
      setOpen(true);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === "open") setOpen(true);
    } catch {
      // Storage unavailable — stay collapsed.
    }
  }, [forcedOpen]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
      } catch {
        // Ignore — preference just won't persist.
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
          "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
          open
            ? "border-primary-900 bg-primary-900 text-white hover:bg-primary-800"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        )}
      >
        <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
        {open ? "Hide computation" : "See computation"}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
      {open && children}
    </div>
  );
}
