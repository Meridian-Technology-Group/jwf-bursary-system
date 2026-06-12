/**
 * Edit-on-behalf index (CR-001) — /applications/[id]/edit
 *
 * Resolves the application's ACTIVE section order (rolling-over hides
 * FAMILY_ID) and redirects to the first section's slug. The edit layout owns
 * the phase gate; this page only needs the order.
 */

import { notFound, redirect } from "next/navigation";
import { requireRole, requireApplicationAccess, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { isRollingOverApplication } from "@/lib/db/queries/reassessment";
import {
  SECTION_ORDER,
  REASSESSMENT_SECTION_ORDER,
  SECTION_TO_SLUG,
} from "@/lib/portal/sections";

interface Props {
  params: { id: string };
}

export default async function EditOnBehalfIndexPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR]);
  await requireApplicationAccess(user, params.id);

  const application = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) =>
      tx.application.findUnique({
        where: { id: params.id },
        select: { applicationType: true, isReassessment: true },
      })
  );
  if (!application) {
    notFound();
  }

  const activeSectionOrder = isRollingOverApplication(application)
    ? REASSESSMENT_SECTION_ORDER
    : SECTION_ORDER;

  redirect(
    `/applications/${params.id}/edit/${SECTION_TO_SLUG[activeSectionOrder[0]]}`
  );
}
