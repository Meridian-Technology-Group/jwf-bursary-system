// src/app/(portal)/help/page.tsx
//
// Epic 22 P2 (CR-002 Phase 5 #4) — "Contact us by email". The URL stays /help
// so old links work (D-17); the question form sits at the top with Charlotte's
// wording, and the guidance tabs stay below it (`/help?tab=` opens one).

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/roles";
import { PortalGuidanceTabs } from "@/components/portal/portal-guidance-tabs";
import { PortalPage } from "@/components/portal/portal-page";
import {
  BURSARIES_CONTACT_EMAIL,
  parseGuidanceTab,
} from "@/lib/portal/guidance-content";
import { loadEnquiryChildOptions } from "@/lib/portal/enquiry-data";
import { CONTACT_US_HEADING, CONTACT_US_LABEL } from "@/lib/portal/enquiry";
import { ContactForm } from "./contact-form";

export const metadata = { title: CONTACT_US_LABEL };

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { tab } = await searchParams;
  const options = await loadEnquiryChildOptions(user);

  return (
    <PortalPage className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">{CONTACT_US_LABEL}</h1>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-primary-900">{CONTACT_US_HEADING}</h2>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>
            Your question will be sent with your bursary reference directly to the{" "}
            {BURSARIES_CONTACT_EMAIL} email address.
          </p>
          <p>
            We will send you our reply by email using your email address held in the
            system.
          </p>
        </div>
        <div className="mt-5">
          <ContactForm
            fromEmail={user.email}
            childOptions={options.map((o) => ({ key: o.key, childName: o.childName }))}
          />
        </div>
        <p className="mt-5 text-xs text-slate-500">
          Forgotten your password? Use{" "}
          <Link
            href="/reset-password"
            className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800"
          >
            Forgot password
          </Link>{" "}
          on the sign-in page — you don&rsquo;t need to ask us.
        </p>
      </section>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-primary-900">Help &amp; guidance</h2>
        <PortalGuidanceTabs initialTab={parseGuidanceTab(tab)} />
      </div>
    </PortalPage>
  );
}
