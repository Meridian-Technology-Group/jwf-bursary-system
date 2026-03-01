import { SectionLoader } from "@/components/shared/loading";

export default function ApplicationDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading renders immediately */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Application
        </h1>
        <p className="mt-1 text-sm text-slate-500">Loading application details…</p>
      </div>

      {/* Three section skeletons for the detail view panels */}
      <SectionLoader />
      <SectionLoader />
      <SectionLoader />
    </div>
  );
}
