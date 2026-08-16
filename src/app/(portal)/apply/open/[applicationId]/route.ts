/**
 * Epic 14 E2 (CG-04) — the explicit "open this child's application" entry
 * point. The schedule home's CONTINUE buttons (D3) land here.
 *
 * Verifies the application belongs to the signed-in lead applicant (own RLS
 * context + explicit leadApplicantId WHERE), sets the active-application
 * cookie, then routes by status: drafts into the wizard, submitted
 * applications to the status page. Anything unowned/unknown falls back to
 * the portal home with no cookie change.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { ACTIVE_APPLICATION_COOKIE } from "@/lib/portal/active-application";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const app = await withUserContext(user.id, user.role as RlsRole, (tx) =>
    tx.application.findFirst({
      where: { id: applicationId, leadApplicantId: user.id },
      select: { id: true, formStatus: true },
    })
  );

  if (!app) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const target = app.formStatus === "SUBMITTED" ? "/status" : "/apply/child-details";
  const response = NextResponse.redirect(new URL(target, request.url));
  // Set on the redirect response itself so the cookie always travels with it.
  response.cookies.set(ACTIVE_APPLICATION_COOKIE, app.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
