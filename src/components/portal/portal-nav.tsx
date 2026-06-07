"use client";

/**
 * PortalNav — the persistent left-rail navigation for the applicant portal.
 *
 * This is the lead-applicant nav (Home / My Application / Documents / History /
 * Help), modelled on `admin-nav.tsx`. It is a DISTINCT component family from the
 * `/contribute`-shared stepper shell (`PortalDesktopSidebar` /
 * `PortalMobileHeader`) — do NOT parameterise one to do both (Decision 6).
 *
 * The section stepper is NOT owned here. It arrives as `children` (the
 * `@stepper` parallel-route slot node) and is rendered nested under the
 * "My Application" item — but only on `/apply/*`, because off the wizard the
 * slot resolves to null and nothing renders there. The rail is then nav-only.
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JwfLogo } from "@/components/brand/jwf-logo";
import { PortalAccountFooter } from "./portal-account-footer";

// ─── Nav model (the single source of nav membership) ──────────────────────────

export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Pathname to match for active state. */
  match: string;
  matchMode?: "exact" | "prefix";
  /** Dot badge (e.g. paused → Documents). Wired in PR-9. */
  badge?: boolean;
}

/**
 * Constant nav membership. Documents is first-class from this PR (Decision 2) —
 * it points at `/documents` (an empty-state page until PR-8) and is never
 * hidden or disabled. `applicationHref` is the adaptive "My Application" target
 * (default `/apply/child-details`; made adaptive in PR-9, Decision 4).
 */
export function buildPortalNav(applicationHref: string): PortalNavItem[] {
  return [
    { label: "Home", href: "/", icon: Home, match: "/", matchMode: "exact" },
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
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary-50 text-primary-900 font-medium"
          : "text-slate-600 hover:bg-slate-50 hover:text-primary-900"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Active gold left-border accent (matches the admin nav pattern). */}
      {isActive && (
        <span
          className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-accent-600"
          aria-hidden="true"
        />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-primary-700" : "text-slate-400 group-hover:text-primary-700"
        )}
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{item.label}</span>
      {/* Dot badge — wired in PR-9 (e.g. paused → Documents). */}
      {item.badge && (
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
          aria-label="Action needed"
        />
      )}
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
  /**
   * The `@stepper` slot node — rendered nested under "My Application". Null off
   * `/apply/*`, so nothing renders there and the rail stays nav-only.
   */
  children?: React.ReactNode;
}

export function PortalNav({
  userName,
  applicationHref = "/apply/child-details",
  needsDocs = false,
  children,
}: PortalNavProps) {
  const pathname = usePathname() ?? "/";
  const items = buildPortalNav(applicationHref);

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
            const withBadge =
              item.label === "Documents"
                ? { ...item, badge: needsDocs }
                : item;
            const active = isItemActive(pathname, withBadge);
            return (
              <li key={item.href}>
                <PortalNavLink item={withBadge} isActive={active} />
                {/* The stepper slot renders nested under "My Application" — only
                    on /apply/* (it is null elsewhere), so this is empty off the
                    wizard. */}
                {item.label === "My Application" && children ? (
                  <div className="mt-1 border-l border-slate-100 pl-2">
                    {children}
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
