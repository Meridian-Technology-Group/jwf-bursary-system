/**
 * Auth group layout — centered card wrapper.
 *
 * All pages under (auth)/ share this shell: a full-viewport background
 * with a centered white card. The card's max-width is constrained to
 * prevent it becoming too wide on large screens.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | JWF Bursary System",
    default: "JWF Bursary System",
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / wordmark */}
        <div className="mb-8 text-center">
          <span className="text-xl font-semibold tracking-tight text-slate-800">
            John Whitgift Foundation
          </span>
          <p className="mt-1 text-sm text-slate-500">Bursary Assessment System</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
