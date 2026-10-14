/**
 * Epic 14 E2 (CG-04) — the explicit "open this child's application" entry
 * point. The schedule home's CONTINUE buttons (D3) land here.
 *
 * Verifies the application belongs to the signed-in lead applicant (own RLS
 * context + explicit leadApplicantId WHERE), sets the active-application
 * cookie, then routes by status: drafts into the wizard, submitted
 * applications to the status page. Anything unowned/unknown falls back to
 * the portal home with no cookie change.
 *
 * Epic 22 P1: My Bursary Application(s) adds `?to=continue|review|submit`
 * (whitelisted; anything else is ignored) so each of Charlotte's options lands
 * in the right place — see `openTarget`.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { ACTIVE_APPLICATION_COOKIE } from "@/lib/portal/active-application";
import { PORTAL_APPLICATION } from "@/lib/applications/migration-source";
import { resolveOwningContributorId } from "@/lib/db/queries/contributors";
import { getSectionGapStatuses } from "@/lib/portal/section-gaps";
import { buildSidebarSections } from "@/components/portal/portal-sidebar-sections";
import { openTarget, parseOpenTarget } from "@/lib/portal/my-applications";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const to = parseOpenTarget(request.nextUrl.searchParams.get("to"));

  const resolved = await withUserContext(
    user.id,
    user.role as RlsRole,
    async (tx) => {
      const app = await tx.application.findFirst({
        where: { id: applicationId, leadApplicantId: user.id, ...PORTAL_APPLICATION },
        select: { id: true, formStatus: true, isReassessment: true },
      });
      if (!app) return null;
      // Only "continue" needs the green ticks (the first section without one).
      if (to !== "continue" || app.formStatus === "SUBMITTED") {
        return { app, sections: [] };
      }
      const ownerContributorId = await resolveOwningContributorId(
        tx,
        app.id,
        user.id
      );
      const gaps = await getSectionGapStatuses(
        tx,
        app.id,
        ownerContributorId ?? undefined
      );
      return {
        app,
        sections: buildSidebarSections(gaps, {
          isReassessment: app.isReassessment,
        }),
      };
    }
  );

  if (!resolved) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const { app, sections } = resolved;

  const target = openTarget(to, app.formStatus, sections);
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
