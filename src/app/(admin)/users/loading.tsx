import { SectionLoader } from "@/components/shared/loading";

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          User Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Invite and manage staff accounts (assessors, viewers, and admins).
        </p>
      </div>

      <SectionLoader />
    </div>
  );
}
