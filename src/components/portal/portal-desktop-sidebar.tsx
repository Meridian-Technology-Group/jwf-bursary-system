"use client";

/**
 * Desktop portal sidebar (280 px fixed).
 * Renders the section progress stepper.
 */

import { PortalSidebarContent, type SidebarSection } from "./portal-sidebar";
import { PortalAccountFooter } from "./portal-account-footer";

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

      {/* Account footer (signed-in-as + sign out) at the bottom of the rail. */}
      <PortalAccountFooter userName={userName} variant="rail" />
    </div>
  );
}
