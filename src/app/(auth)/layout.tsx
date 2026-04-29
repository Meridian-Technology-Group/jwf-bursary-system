/**
 * Auth group layout — branded centred-card wrapper.
 *
 * All pages under (auth)/ share this shell. Background uses the JWF
 * indigo at the top fading to the warm canvas tone, with a soft radial
 * gold accent so the page doesn't feel like a generic white sign-in.
 */

import type { Metadata } from "next";
import { JwfLogo } from "@/components/brand/jwf-logo";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas-50 px-4 py-12">
      {/* Decorative brand backdrop — indigo gradient at top, gold radial bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-800/[0.07] via-primary-800/[0.03] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-40 h-96 w-96 rounded-full bg-accent-100 opacity-40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-primary-100 opacity-40 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        {/* Logo + wordmark */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <JwfLogo className="h-28" />
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-800">
            Bursary Assessment System
          </p>
        </div>

        {/* Card */}
        <div className="relative rounded-xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          {/* Top accent stripe */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-primary-800 via-primary-700 to-accent-600"
          />
          {children}
        </div>
      </div>
    </div>
  );
}
