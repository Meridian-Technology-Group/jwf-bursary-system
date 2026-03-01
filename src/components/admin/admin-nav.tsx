"use client";

/**
 * Admin navigation sidebar content.
 *
 * Renders grouped navigation items with icon + label, active gold-border accent,
 * and a user footer with a sign-out link.
 *
 * Accepts `collapsed` prop to switch to icon-only mode (64 px wide).
 */

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarRange,
  Mail,
  BarChart2,
  Download,
  Clock,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    heading: "Assessment Rounds",
    items: [
      { label: "Applications", href: "/queue", icon: ClipboardList },
      { label: "Rounds", href: "/admin/rounds", icon: CalendarRange },
    ],
  },
  {
    heading: "Invitations",
    items: [
      { label: "Send Invitations", href: "/admin/invitations", icon: Mail },
    ],
  },
  {
    heading: "Reports",
    items: [
      { label: "Reports", href: "/admin/reports", icon: BarChart2 },
      { label: "Exports", href: "/admin/exports", icon: Download },
      { label: "Audit Log", href: "/admin/audit", icon: Clock },
    ],
  },
  {
    heading: "Configuration",
    items: [{ label: "Settings", href: "/admin/settings", icon: Settings }],
  },
];

// ─── Single nav item ──────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary-700 text-white font-medium"
          : "text-neutral-300 hover:bg-primary-700 hover:text-white",
        collapsed && "justify-center px-2"
      )}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
    >
      {/* Active gold left-border accent */}
      {isActive && (
        <span
          className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-accent-600"
          aria-hidden="true"
        />
      )}

      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-white" : "text-neutral-400 group-hover:text-white"
        )}
        aria-hidden="true"
      />

      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

// ─── Admin navigation ─────────────────────────────────────────────────────────

interface AdminNavProps {
  collapsed: boolean;
  userName: string;
  userEmail?: string;
}

export function AdminNav({ collapsed, userName, userEmail }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-primary-800">
      {/* Logo / wordmark */}
      <div
        className={cn(
          "flex items-center border-b border-primary-700 py-5",
          collapsed ? "justify-center px-2" : "px-5"
        )}
      >
        {collapsed ? (
          <span className="text-lg font-bold text-white">J</span>
        ) : (
          <div>
            <span className="block text-sm font-semibold leading-tight text-white">
              John Whitgift
            </span>
            <span className="block text-xs text-neutral-400">
              Foundation — Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation groups */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-4 space-y-6"
        aria-label="Admin navigation"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                {group.heading}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      collapsed={collapsed}
                      isActive={isActive}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div
        className={cn(
          "border-t border-primary-700 py-3",
          collapsed ? "px-2" : "px-4"
        )}
      >
        {!collapsed && (
          <div className="mb-2 min-w-0">
            <p className="truncate text-xs font-medium text-white">{userName}</p>
            {userEmail && (
              <p className="truncate text-xs text-neutral-400">{userEmail}</p>
            )}
          </div>
        )}
        <Link
          href="/auth/signout"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-400",
            "hover:bg-primary-700 hover:text-white transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {!collapsed && "Sign out"}
        </Link>
      </div>
    </div>
  );
}
