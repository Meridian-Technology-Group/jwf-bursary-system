/**
 * Edit-on-behalf layout (CR-001).
 *
 * Server component nested under the application-detail layout, so the admin
 * chrome (breadcrumb, header card, tab strip) renders above it. Owns the
 * edit shell's persistent pieces:
 *   - the gold "Editing on behalf of the applicant" banner (every edit page);
 *   - the section pill nav over the application's ACTIVE section order
 *     (rolling-over hides FAMILY_ID, exactly like the portal wizard);
 *   - the staff upload endpoints (FileUpload → /api/admin/documents);
 *   - the sticky Save footer + SectionSavingProvider it reads from.
 *
 * Phase gate: editing is allowed only while the review is live
 * (`canEditOnBehalf`); otherwise this layout bounces back to the application
 * detail page. The save action re-checks the gate inside its transaction.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserCog } from "lucide-react";
import { requireRole, requireApplicationAccess, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { deriveReviewPhase } from "@/lib/applications/status";
import { canEditOnBehalf } from "@/lib/applications/edit-on-behalf";
import { isRollingOverApplication } from "@/lib/db/queries/reassessment";
import {
  SECTION_ORDER,
  REASSESSMENT_SECTION_ORDER,
  SECTION_TO_SLUG,
  SECTION_TITLES,
} from "@/lib/portal/sections";
import { SectionSavingProvider } from "@/components/portal/section-saving-context";
import {
  EditSectionNav,
  StaffUploadEndpoints,
  EditOnBehalfFooter,
} from "./edit-on-behalf-chrome";

interface Props {
  children: React.ReactNode;
  params: { id: string };
}

export default async function EditOnBehalfLayout({ children, params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, params.id);

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: params.id },
        select: {
          reference: true,
          formStatus: true,
          applicationType: true,
          isReassessment: true,
          assessment: {
            select: { status: true, outcome: true, pausedUntil: true },
          },
        },
      })
  );
  if (!application) {
    notFound();
  }

  const phase = deriveReviewPhase({
    formStatus: application.formStatus,
    assessmentStatus: application.assessment?.status ?? null,
    outcome: application.assessment?.outcome ?? null,
  });
  if (!canEditOnBehalf(phase)) {
    redirect(`/applications/${params.id}`);
  }

  // ACTIVE section order — a rolling-over application hides FAMILY_ID, exactly
  // like the portal wizard (identity documents are already on file).
  const activeSectionOrder = isRollingOverApplication(application)
    ? REASSESSMENT_SECTION_ORDER
    : SECTION_ORDER;
  const navItems = activeSectionOrder.map((section) => ({
    slug: SECTION_TO_SLUG[section],
    title: SECTION_TITLES[section],
    href: `/applications/${params.id}/edit/${SECTION_TO_SLUG[section]}`,
  }));

  const pausedUntil =
    phase === "PAUSED" ? (application.assessment?.pausedUntil ?? null) : null;

  return (
    <SectionSavingProvider>
      <div className="space-y-4 pt-4">
        {/* On-behalf banner — persistent across every edit page. */}
        <div className="rounded-xl border border-accent-400/60 bg-accent-50 px-5 py-4">
          <div className="flex gap-3">
            <UserCog
              className="mt-0.5 h-5 w-5 shrink-0 text-accent-700"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary-900">
                Editing on behalf of the applicant
              </p>
              <p className="text-sm text-slate-600">
                Every change you save is attributed to you and recorded in the
                application history. The applicant keeps read-only access.
              </p>
              {pausedUntil && (
                <p className="text-sm text-slate-600">
                  Assessment paused — documents requested by{" "}
                  {pausedUntil.toLocaleDateString("en-GB")}. Saving here does
                  not resume the assessment.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section nav + back link */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EditSectionNav items={navItems} />
          <Link
            href={`/applications/${params.id}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-slate-500 transition-colors hover:text-primary-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to application
          </Link>
        </div>

        {/* Section pages — FileUpload targets the staff document endpoints. */}
        <StaffUploadEndpoints>{children}</StaffUploadEndpoints>

        {/* The one sticky Save bar (SectionPageClient suppresses the in-form
            nav, mirroring the portal's single-footer pattern). */}
        <EditOnBehalfFooter />
      </div>
    </SectionSavingProvider>
  );
}
