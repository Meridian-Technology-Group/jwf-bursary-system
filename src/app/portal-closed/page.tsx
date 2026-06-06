/**
 * Epic 10 (D18) — "your bursary has concluded" page.
 *
 * Shown to a parent whose portal access has been revoked: their only bursary
 * account is CLOSED (the full schedule completed, or it was admin-closed) and
 * they have no in-flight application. This is a read-only dead-end — no editable
 * forms — reachable only from the portal layout's access guard. Their data is
 * NOT erased; staff retain the submitted history. A future re-award reactivates
 * the account and portal access returns automatically.
 *
 * Lives OUTSIDE the (portal) route group so the portal layout's access guard
 * cannot redirect-loop onto it. Middleware still requires an authenticated
 * APPLICANT (the /portal* prefix), so a logged-out user is sent to /login.
 */

import Link from "next/link";

export const metadata = {
  title: "Bursary concluded | JWF Bursary System",
};

export default function PortalClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-50 px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-navy-900">
          Your bursary application has concluded
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Thank you for using the John Whitgift Foundation Bursary System. Your
          bursary account is no longer active, so the application portal is now
          closed to you.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Your records have not been deleted — the Foundation retains your
          submitted information in line with its data-retention policy. If you
          believe this is a mistake, or you have been invited to apply for a new
          assessment year, please contact the Bursary Office.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-800"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
