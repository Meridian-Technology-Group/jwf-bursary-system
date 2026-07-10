import { TableSkeleton } from "@/components/shared/loading";

/**
 * Item 13 (Story 13.2): route-segment loading fallback for the History tab.
 * See assessment/loading.tsx for the boundary rationale. The real page is an
 * audit timeline inside a bordered card — wrapped the same way here so the
 * skeleton doesn't jump when the real content resolves.
 */
export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div className="h-4 w-28 skeleton" />
          <div className="h-3 w-16 skeleton" />
        </div>
        <TableSkeleton rows={6} columns={3} />
      </div>
    </div>
  );
}
