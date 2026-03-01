"use client";

/**
 * Desktop portal sidebar (280 px fixed).
 * Renders the section progress stepper.
 */

import { PortalSidebarContent } from "./portal-sidebar";

interface PortalDesktopSidebarProps {
  userName: string;
}

export function PortalDesktopSidebar({ userName }: PortalDesktopSidebarProps) {
  // lastSaved would come from application state in a real implementation
  const lastSaved = "2 minutes ago";

  return (
    <div className="flex h-full flex-col">
      <PortalSidebarContent lastSaved={lastSaved} />

      {/* User name at bottom */}
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
        <p className="truncate text-xs text-slate-500">Signed in as</p>
        <p className="truncate text-sm font-medium text-primary-900">
          {userName}
        </p>
      </div>
    </div>
  );
}
