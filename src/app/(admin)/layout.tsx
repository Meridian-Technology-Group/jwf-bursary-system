/**
 * Admin layout — assessor/viewer shell.
 *
 * Desktop (≥768 px): fixed dark navy sidebar (240 px expanded / 64 px collapsed)
 *                    + scrollable main content area (bg-neutral-50).
 * Mobile (<768 px):  hamburger button that opens the sidebar as a Sheet overlay.
 *
 * The sidebar collapse state is managed client-side with localStorage persistence
 * via AdminSidebarController.
 */

import { getCurrentUser } from "@/lib/auth/roles";
import { AdminSidebarController } from "@/components/admin/admin-sidebar-controller";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export const metadata = {
  title: {
    template: "%s | JWF Admin",
    default: "Admin | JWF Bursary System",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const displayName =
    user
      ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email
      : "Admin";
  const userEmail = user?.email ?? undefined;
  const userRole = user?.role ?? undefined;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Client component controls sidebar collapse state + mobile sheet */}
      <AdminSidebarController
        userName={displayName}
        userEmail={userEmail}
        userRole={userRole}
      />

      {/* Main content — offset changes dynamically via CSS var set by controller */}
      {/*
        We use a CSS custom property approach with a wrapper div that has left
        padding matching the sidebar width. Since the controller renders client-side,
        we use a fixed offset and let Tailwind responsive prefixes handle it.
        On mobile (md:hidden sidebar), no offset is applied.
      */}
      <main
        id="admin-main-content"
        className="
          transition-[padding] duration-200
          md:pl-[240px]
          md:[.sidebar-collapsed_&]:pl-16
          pt-0 md:pt-0
          px-4 py-14 md:py-0 md:px-0
        "
      >
        <div className="p-6 md:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
