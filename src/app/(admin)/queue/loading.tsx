import { TableSkeleton } from "@/components/shared/loading";

export default function QueueLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading renders immediately */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Applications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and assess submitted bursary applications.
        </p>
      </div>

      {/* Data area skeleton */}
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
