import { SectionLoader } from "@/components/shared/loading";

/**
 * Item 13 (Story 13.2): route-segment loading fallback for the
 * Recommendation tab. See assessment/loading.tsx for the boundary rationale.
 * The real page is a single recommendation form card — two stacked section
 * skeletons approximate it without a pixel-perfect replica.
 */
export default function RecommendationLoading() {
  return (
    <div className="space-y-4">
      <SectionLoader />
      <SectionLoader />
    </div>
  );
}
