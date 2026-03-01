"use client";

/**
 * WP-13: Sibling Linker
 *
 * Search for bursary accounts and link them as siblings.
 * Debounced search input → results dropdown → "Link as Sibling" action.
 *
 * Prevents self-linking. Shows success/error toast feedback.
 * Calls router.refresh() after linking so SiblingList updates.
 */

import * as React from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BursaryAccountResult {
  id: string;
  reference: string;
  childName: string;
  school: string;
  leadApplicantEmail: string;
}

interface SiblingLinkerProps {
  /** The bursary account we are linking FROM (the current child) */
  bursaryAccountId: string;
  /** Displayed to prevent self-link comparisons client-side */
  currentChildName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCHOOL_LABELS: Record<string, string> = {
  WHITGIFT: "Whitgift",
  TRINITY: "Trinity",
};

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState<T>(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ─── Toast primitive ──────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: "success" | "error";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SiblingLinker({
  bursaryAccountId,
  currentChildName,
}: SiblingLinkerProps) {
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BursaryAccountResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [linkingId, setLinkingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Search effect ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    fetch(`/api/siblings/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data: BursaryAccountResult[]) => {
        if (!cancelled) {
          setResults(data);
          setShowDropdown(true);
        }
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ── Link action ────────────────────────────────────────────────────────────

  async function handleLink(targetId: string, targetName: string) {
    if (targetId === bursaryAccountId) {
      setToast({ message: "Cannot link an account to itself", type: "error" });
      return;
    }

    setLinkingId(targetId);
    try {
      const res = await fetch("/api/siblings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bursaryAccountId, targetBursaryAccountId: targetId }),
      });

      if (res.ok) {
        setToast({
          message: `${targetName} linked as sibling successfully`,
          type: "success",
        });
        setQuery("");
        setResults([]);
        setShowDropdown(false);
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setToast({
          message: data.error ?? "Failed to create sibling link",
          type: "error",
        });
      }
    } catch {
      setToast({ message: "Network error — please try again", type: "error" });
    } finally {
      setLinkingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Search input + dropdown wrapper */}
      <div className="relative">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          {isSearching && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin"
              aria-hidden="true"
            />
          )}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="Search by child name, reference, or email…"
            className="pl-9 pr-9"
            aria-label="Search bursary accounts to link as sibling"
          />
        </div>

        {/* Results dropdown */}
        {showDropdown && (
          <div className="absolute z-20 top-full mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg overflow-hidden">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 italic">
                No accounts found
              </div>
            ) : (
              <ul role="listbox" aria-label="Search results">
                {results.map((account) => {
                  const isSelf = account.id === bursaryAccountId;
                  const isLinking = linkingId === account.id;

                  return (
                    <li
                      key={account.id}
                      role="option"
                      aria-selected={false}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 last:border-0",
                        isSelf ? "bg-slate-50 opacity-60" : "hover:bg-neutral-50"
                      )}
                    >
                      {/* Account details */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {account.childName}
                          {isSelf && (
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              (current child)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {SCHOOL_LABELS[account.school] ?? account.school}
                          {" · "}
                          {account.reference}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {account.leadApplicantEmail}
                        </p>
                      </div>

                      {/* Link button */}
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5 text-xs border-primary-200 text-primary-700 hover:bg-primary-50"
                          onClick={() => handleLink(account.id, account.childName)}
                          disabled={isLinking || linkingId !== null}
                          aria-label={`Link ${account.childName} as sibling of ${currentChildName}`}
                        >
                          {isLinking ? (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <UserPlus className="h-3 w-3" aria-hidden="true" />
                          )}
                          {isLinking ? "Linking…" : "Link as Sibling"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm",
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="shrink-0 text-current opacity-60 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Wrapper Card ─────────────────────────────────────────────────────────────

interface SiblingLinkerCardProps extends SiblingLinkerProps {
  /** Whether the current user is an assessor (viewers see read-only) */
  isAssessor: boolean;
}

export function SiblingLinkerCard({
  bursaryAccountId,
  currentChildName,
  isAssessor,
}: SiblingLinkerCardProps) {
  if (!isAssessor) return null;

  return (
    <Card>
      <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
        <CardTitle className="text-sm font-semibold text-slate-700">
          Link a Sibling
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-4">
        <p className="mb-3 text-xs text-slate-500">
          Search for another bursary account to link as a sibling. Siblings are
          assessed sequentially — the older child&apos;s payable fees are deducted
          from the family HNDI before calculating the younger child&apos;s bursary.
        </p>
        <SiblingLinker
          bursaryAccountId={bursaryAccountId}
          currentChildName={currentChildName}
        />
      </CardContent>
    </Card>
  );
}
