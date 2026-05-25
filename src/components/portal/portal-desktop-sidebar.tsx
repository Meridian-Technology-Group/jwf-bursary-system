"use client";

/**
 * Desktop portal sidebar (280 px fixed).
 * Renders the section progress stepper.
 */

import { PortalSidebarContent, type SidebarSection } from "./portal-sidebar";

interface PortalDesktopSidebarProps {
  userName: string;
  sections?: SidebarSection[];
  roundName?: string;
  basePath?: string;
  countSynthetic?: boolean;
}

export function PortalDesktopSidebar({
  userName,
  sections,
  roundName,
  basePath,
  countSynthetic,
}: PortalDesktopSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <PortalSidebarContent
        sections={sections}
        roundName={roundName}
        basePath={basePath}
        countSynthetic={countSynthetic}
      />

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
