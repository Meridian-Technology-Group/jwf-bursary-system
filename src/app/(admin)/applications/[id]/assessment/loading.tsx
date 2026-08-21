import { SectionLoader } from "@/components/shared/loading";

/**
 * Route-segment loading fallback for the assessment workspace tabs (Epic 14
 * C3 — the five-tab IA replaced the split-screen). The application-detail
 * layout and the five-tab nav sit outside this boundary and stay interactive;
 * only the tab content swaps to the skeleton.
 */
export default function AssessmentLoading() {
  return (
    <div className="space-y-5">
      <SectionLoader />
      <SectionLoader />
    </div>
  );
}
