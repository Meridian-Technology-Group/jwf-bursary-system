/**
 * Current Round — persistent shortcut to the active round's detail page.
 *
 * Server component — requires ADMIN, ASSESSOR or VIEWER role.
 *
 * Resolves the active round (most recent OPEN, falling back to the most recent
 * of any status) and redirects to its detail page at `/rounds/{id}`. When no
 * round exists at all, redirects to the rounds list.
 *
 * Next.js resolves this static `/rounds/current` segment ahead of the dynamic
 * `/rounds/[id]` route, so there is no routing conflict.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { withUserContext, type RlsRole } from "@/lib/db/prisma";
import { getActiveRound } from "@/lib/db/queries/reports";

export default async function CurrentRoundPage() {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);

  const activeRound = await withUserContext(
    user.id,
    user.role as RlsRole,
    (tx) => getActiveRound(tx)
  );

  if (!activeRound) redirect("/rounds");

  redirect(`/rounds/${activeRound.id}`);
}
