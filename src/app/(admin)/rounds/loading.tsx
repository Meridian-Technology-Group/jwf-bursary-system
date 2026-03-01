import { TableSkeleton } from "@/components/shared/loading";

export default function RoundsLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading renders immediately */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Assessment Rounds
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage bursary assessment cycles.
        </p>
      </div>

      {/* Data area skeleton */}
      <TableSkeleton rows={5} columns={8} />
    </div>
  );
}
