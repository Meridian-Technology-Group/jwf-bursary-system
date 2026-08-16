/**
 * Recommendation tab — thin wrapper around the shared RecommendationSurface
 * (Epic 14 C7): the identical surface also renders on the assessment
 * workspace's BURSARY AWARD CALCULATION (5) tab.
 */

import { requireRole, Role } from "@/lib/auth/roles";
import { RecommendationSurface } from "@/components/admin/recommendation-surface";

export const metadata = {
  title: "Recommendation",
};

interface Props {
  params: { id: string };
}

export default async function RecommendationPage({ params }: Props) {
  const user = await requireRole([Role.ADMIN, Role.ASSESSOR, Role.VIEWER]);
  return <RecommendationSurface applicationId={params.id} user={user} />;
}
