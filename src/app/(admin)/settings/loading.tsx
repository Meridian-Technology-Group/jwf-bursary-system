import { SectionLoader } from "@/components/shared/loading";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page heading renders immediately */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure system reference data and email templates.
        </p>
      </div>

      {/* Data area skeleton */}
      <SectionLoader />
    </div>
  );
}
