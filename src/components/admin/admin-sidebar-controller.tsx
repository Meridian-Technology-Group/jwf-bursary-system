"use client";

/**
 * Admin sidebar controller.
 *
 * Manages the collapsed/expanded state with localStorage persistence.
 * Renders:
 * - Desktop: a resizable fixed sidebar (240px expanded / 64px collapsed)
 * - Mobile: an overlay Sheet triggered by a hamburger button
 */

import { useState, useEffect } from "react";
import { Menu, X, PanelLeftClose, PanelLeft } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminNav } from "./admin-nav";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jwf-admin-sidebar-collapsed";

interface AdminSidebarControllerProps {
  userName: string;
  userEmail?: string;
  userRole?: string;
}

export function AdminSidebarController({
  userName,
  userEmail,
  userRole,
}: AdminSidebarControllerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  // Avoid flash of wrong state before localStorage read
  if (!mounted) return null;

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:z-30",
          "sidebar-transition"
        )}
        style={{ width: sidebarWidth }}
        aria-label="Admin navigation"
      >
        <AdminNav
          collapsed={collapsed}
          userName={userName}
          userEmail={userEmail}
          userRole={userRole}
        />

        {/* Collapse/expand toggle */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            "absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-primary-700 bg-primary-800 text-neutral-300",
            "hover:bg-primary-700 hover:text-white transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* ── Mobile hamburger + sheet ──────────────────────────────── */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "fixed left-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-md bg-primary-900 text-white",
                "hover:bg-primary-700 transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
              )}
              aria-label="Open navigation menu"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </SheetTrigger>

          <SheetContent side="left" className="w-[240px] p-0 border-r-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin navigation</SheetTitle>
            </SheetHeader>
            <div className="h-full">
              <AdminNav
                collapsed={false}
                userName={userName}
                userEmail={userEmail}
                userRole={userRole}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
