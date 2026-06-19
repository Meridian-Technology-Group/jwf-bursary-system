// src/app/(portal)/help/page.tsx
import { PortalGuidanceTabs } from "@/components/portal/portal-guidance-tabs";
import { PortalPage } from "@/components/portal/portal-page";

export const metadata = { title: "Help & Guidance" };

export default function HelpPage() {
  return (
    <PortalPage className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">Help &amp; guidance</h1>
        <p className="mt-1 text-sm text-slate-500">
          How to apply, the document checklist, and the bursary terms &amp; conditions.
        </p>
      </div>
      <PortalGuidanceTabs />
    </PortalPage>
  );
}
