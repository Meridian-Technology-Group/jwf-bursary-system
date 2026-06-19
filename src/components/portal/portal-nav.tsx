"use client";

/**
 * PortalNav — the persistent left-rail navigation for the applicant portal.
 *
 * This is the lead-applicant nav (Home / My Application / Documents / History /
 * Help), modelled on `admin-nav.tsx`. It is a DISTINCT component family from the
 * `/contribute`-shared stepper shell (`PortalDesktopSidebar` /
 * `PortalMobileHeader`) — do NOT parameterise one to do both (Decision 6).
 *
 * The section stepper is rendered nested under the "My Application" item via the
 * `RailStepper` component. `RailStepper` reads the shared stepper-data store
 * (written from the apply content subtree) and is pathname-gated to `/apply/*`,
 * so off the wizard it renders null and the rail stays nav-only. This replaces
 * the former `@stepper` parallel-route slot that used to arrive as `children`.
 *
 * The account / sign-out footer is `PortalAccountFooter` (PR-3).
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  FileText,
  Upload,
  History,
  HelpCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JwfLogo } from "@/components/brand/jwf-logo";
import { PortalAccountFooter } from "./portal-account-footer";
import { RailStepper } from "./rail-stepper";

// ─── Nav model (the single source of nav membership) ──────────────────────────

export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Pathname to match for active state. */
  match: string;
  matchMode?: "exact" | "prefix";
  /**
   * Colour-coded, attention-drawing item (the "Missing Documents" call to
   * action). Only ever set on the conditional Missing Documents entry, which is
   * present in the nav ONLY while a document request is outstanding.
   */
  highlight?: boolean;
}

/**
 * Constant nav membership. Documents is first-class (Decision 2) — it points at
 * `/documents` and is never hidden or disabled. `applicationHref` is the
 * adaptive "My Application" target (default `/apply/child-details`).
 *
 * When `needsDocs` is true (an assessor has paused the application pending
 * documents) a dedicated, colour-coded "Missing Documents" item is surfaced near
 * the top of the nav, linking to `/respond`. It appears ONLY while the request
 * is outstanding — a normal login does not show it — so the parent's attention
 * is directed exactly where it needs to be without cluttering the interface.
 */
export function buildPortalNav(
  applicationHref: string,
  needsDocs = false
): PortalNavItem[] {
  return [
    { label: "Home", href: "/", icon: Home, match: "/", matchMode: "exact" },
    ...(needsDocs
      ? [
          {
            label: "Missing Documents",
            href: "/respond",
            icon: AlertCircle,
            match: "/respond",
            matchMode: "prefix" as const,
            highlight: true,
          },
        ]
      : []),
    {
      label: "My Application",
      href: applicationHref,
      icon: FileText,
      match: "/apply",
      matchMode: "prefix",
    },
    {
      label: "Documents",
      href: "/documents",
      icon: Upload,
      match: "/documents",
      matchMode: "prefix",
    },
    {
      label: "History",
      href: "/history",
      icon: History,
      match: "/history",
      matchMode: "prefix",
    },
    {
      label: "Help & guidance",
      href: "/help",
      icon: HelpCircle,
      match: "/help",
      matchMode: "prefix",
    },
  ];
}

function isItemActive(pathname: string, item: PortalNavItem): boolean {
  if (item.matchMode === "prefix") {
    return pathname === item.match || pathname.startsWith(`${item.match}/`);
  }
  return pathname === item.match;
}

// ─── Single nav link ──────────────────────────────────────────────────────────

function PortalNavLink({
  item,
  isActive,
}: {
  item: PortalNavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  // The "Missing Documents" CTA is colour-coded (gold accent) to draw the
  // parent's attention. It's a normal nav link, so we convey the urgency to
  // assistive tech with an explicit aria-label rather than a role.
  const highlight = item.highlight === true;
  return (
    <Link
      href={item.href}
      aria-label={highlight ? `${item.label}: action needed` : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        highlight
          ? isActive
            ? "bg-accent-100 text-accent-900 font-medium"
            : "bg-accent-50 text-accent-800 font-medium hover:bg-accent-100"
          : isActive
            ? "bg-primary-50 text-primary-900 font-medium"
            : "text-slate-600 hover:bg-slate-50 hover:text-primary-900"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Gold left-border accent: always on for the highlighted CTA, otherwise
          only when active (matches the admin nav pattern). */}
      {(isActive || highlight) && (
        <span
          className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-accent-600"
          aria-hidden="true"
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          highlight
            ? "text-accent-700"
            : isActive
              ? "text-primary-700"
              : "text-slate-400 group-hover:text-primary-700"
        )}
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}

// ─── Persistent nav ───────────────────────────────────────────────────────────

interface PortalNavProps {
  userName: string;
  /**
   * Adaptive target for "My Application": the wizard while drafting, `/status`
   * after submit. Defaults to `/apply/child-details`; made adaptive in PR-9
   * (Decision 4 — the LABEL is always "My Application").
   */
  applicationHref?: string;
  /** Whether a paused document request exists (badges Documents). Wired PR-9. */
  needsDocs?: boolean;
}

export function PortalNav({
  userName,
  applicationHref = "/apply/child-details",
  needsDocs = false,
}: PortalNavProps) {
  const pathname = usePathname() ?? "/";
  const items = buildPortalNav(applicationHref, needsDocs);

  return (
    <div className="flex h-full flex-col">
      {/* Logo / wordmark */}
      <div className="flex flex-col items-center gap-2 border-b border-slate-200 px-6 py-7">
        <JwfLogo className="h-16" />
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">
          Bursary Portal
        </span>
      </div>

      {/* Navigation — scrolls if nav + stepper overflow a short viewport. */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Portal navigation"
      >
        <ul className="space-y-0.5" role="list">
          {items.map((item) => {
            const active = isItemActive(pathname, item);
            return (
              <li key={item.href}>
                <PortalNavLink item={item} isActive={active} />
                {/* The stepper renders nested under "My Application". RailStepper
                    reads the shared store and is pathname-gated to /apply/*, so
                    it is null off the wizard and the wrapper collapses to empty
                    (border/padding on an empty div is invisible). */}
                {item.label === "My Application" ? (
                  <div className="mt-1 border-l border-slate-100 pl-2 empty:mt-0 empty:border-0 empty:pl-0">
                    <RailStepper />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account / sign-out footer (PR-3). */}
      <PortalAccountFooter userName={userName} variant="rail" />
    </div>
  );
}
