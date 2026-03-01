import { TableSkeleton } from "@/components/shared/loading";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading renders immediately */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Immutable record of all system actions.
        </p>
      </div>

      {/* Data area skeleton */}
      <TableSkeleton rows={10} columns={4} />
    </div>
  );
}
