import { TableSkeleton } from "@/components/shared/loading";

export default function AssessmentsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Assessments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Assessments due to be completed.
        </p>
      </div>
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}
