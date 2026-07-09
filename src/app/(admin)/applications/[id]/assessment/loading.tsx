import { SectionLoader } from "@/components/shared/loading";

/**
 * Item 13 (Story 13.2): route-segment loading fallback for the Assessment
 * tab, shown while its Server Component data streams in. The layout (header
 * + tab bar) is outside this segment boundary, so it stays visible and
 * interactive automatically — only this content area swaps to the skeleton.
 *
 * Roughly mirrors the real page's split-screen workspace (narrower document
 * panel + wider assessment form) plus the docked synopsis card below, using
 * the shared generic skeleton primitives rather than a pixel-perfect replica.
 */
export default function AssessmentLoading() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <SectionLoader />
        <SectionLoader />
      </div>
      <SectionLoader />
    </div>
  );
}
