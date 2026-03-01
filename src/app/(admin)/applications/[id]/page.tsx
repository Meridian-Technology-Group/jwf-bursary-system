/**
 * Applicant Data tab — read-only view of all submitted ApplicationSection data.
 *
 * Each section is rendered as a Card with the section title and the raw JSON
 * fields displayed in a readable format. Currency values are formatted with £.
 * Document slots are listed via DocumentChecklist.
 */

import { notFound } from "next/navigation";
import { requireRole, Role } from "@/lib/auth/roles";
import { getApplicationWithDetails } from "@/lib/db/queries/applications";
import { getSiblingLinks } from "@/lib/db/queries/siblings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DocumentChecklist } from "@/components/admin/document-checklist";
import { AdminUpload } from "@/components/admin/admin-upload";
import { SiblingLinkerCard } from "@/components/admin/sibling-linker";
import { SiblingListCard } from "@/components/admin/sibling-list";
import type { ApplicationSectionType } from "@prisma/client";

export const metadata = {
  title: "Applicant Data",
};

// ─── Section display config ───────────────────────────────────────────────────

const SECTION_LABELS: Record<ApplicationSectionType, string> = {
  CHILD_DETAILS: "Child Details",
  FAMILY_ID: "Family Identity",
  PARENT_DETAILS: "Parent Details",
  DEPENDENT_CHILDREN: "Dependent Children",
  DEPENDENT_ELDERLY: "Dependent Elderly",
  OTHER_INFO: "Other Information",
  PARENTS_INCOME: "Parents' Income",
  ASSETS_LIABILITIES: "Assets & Liabilities",
  ADDITIONAL_INFO: "Additional Information",
  DECLARATION: "Declaration",
};

// ─── Field rendering ──────────────────────────────────────────────────────────

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 italic">Not provided</span>;
  }

  if (typeof value === "boolean") {
    return (
      <span
        className={
          value ? "text-green-700 font-medium" : "text-slate-500"
        }
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (typeof value === "number") {
    // Currency fields
    const currencyKeys = [
      "amount",
      "fees",
      "income",
      "pay",
      "salary",
      "pension",
      "benefits",
      "value",
      "balance",
      "rent",
      "dividends",
      "profit",
      "interest",
      "credits",
      "bonds",
      "maintenance",
      "bursaries",
    ];
    const isCurrency = currencyKeys.some((k) =>
      key.toLowerCase().includes(k)
    );
    if (isCurrency) {
      return (
        <span className="font-mono">
          {new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
          }).format(value)}
        </span>
      );
    }
    return <span>{String(value)}</span>;
  }

  if (typeof value === "string") {
    // Skip document ID fields — they are displayed separately
    if (key.toLowerCase().includes("documentid")) {
      return <span className="text-slate-400 italic text-xs">Document ref</span>;
    }
    return <span>{value}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-400 italic">None</span>;
    }
    return (
      <ol className="ml-4 list-decimal space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-slate-700">
            {typeof item === "object" ? (
              <DataBlock data={item as Record<string, unknown>} indent />
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ol>
    );
  }

  if (typeof value === "object") {
    return (
      <DataBlock data={value as Record<string, unknown>} indent />
    );
  }

  return <span>{String(value)}</span>;
}

function humaniseKey(key: string): string {
  // Convert camelCase to "Title Case With Spaces"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function DataBlock({
  data,
  indent = false,
}: {
  data: Record<string, unknown>;
  indent?: boolean;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0)
    return <span className="text-slate-400 italic">Empty</span>;

  return (
    <dl
      className={
        indent
          ? "space-y-1 border-l-2 border-neutral-200 pl-3 my-1"
          : "space-y-3"
      }
    >
      {entries.map(([key, val]) => (
        <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
          <dt className="min-w-[180px] text-xs font-medium text-slate-500 shrink-0">
            {humaniseKey(key)}
          </dt>
          <dd className="text-sm text-slate-700">
            {formatValue(key, val)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default async function ApplicantDataPage({ params }: Props) {
  const user = await requireRole([Role.ASSESSOR, Role.VIEWER]);
  const isAssessor = user.role === Role.ASSESSOR;

  const application = await getApplicationWithDetails(params.id);

  if (!application) {
    notFound();
  }

  const { sections, documents, bursaryAccountId } = application;

  // Fetch sibling links when the application is linked to a bursary account
  const siblingLinks = bursaryAccountId
    ? await getSiblingLinks(bursaryAccountId)
    : [];

  // Derive current child name from bursary account (available on application)
  const currentChildName = application.childName ?? "";

  if (sections.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">
            No application sections have been submitted yet.
          </p>
        </div>

        {/* Sibling Links — shown even when no sections exist if account is linked */}
        {bursaryAccountId && (
          <SiblingSection
            bursaryAccountId={bursaryAccountId}
            currentChildName={currentChildName}
            currentBursaryAccountId={bursaryAccountId}
            siblingLinks={siblingLinks}
            isAssessor={isAssessor}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Document checklist first */}
      <DocumentChecklist
        applicationId={application.id}
        documents={documents}
      />

      {/* Assessor document upload */}
      <AdminUpload applicationId={application.id} />

      {/* Section data cards */}
      {sections.map((section) => {
        const sectionData = section.data as Record<string, unknown>;
        const hasData =
          sectionData && Object.keys(sectionData).length > 0;

        return (
          <Card key={section.id} className="overflow-hidden">
            <CardHeader className="bg-neutral-50 px-6 py-4 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  {SECTION_LABELS[section.section] ?? section.section}
                </CardTitle>
                <span
                  className={
                    section.isComplete
                      ? "text-xs font-medium text-green-600"
                      : "text-xs font-medium text-amber-600"
                  }
                >
                  {section.isComplete ? "Complete" : "Incomplete"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-6 py-5">
              {hasData ? (
                <DataBlock data={sectionData} />
              ) : (
                <p className="text-sm text-slate-400 italic">No data recorded.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Sibling Links section — only when application has a bursary account */}
      {bursaryAccountId && (
        <SiblingSection
          bursaryAccountId={bursaryAccountId}
          currentChildName={currentChildName}
          currentBursaryAccountId={bursaryAccountId}
          siblingLinks={siblingLinks}
          isAssessor={isAssessor}
        />
      )}
    </div>
  );
}

// ─── Sibling Section ──────────────────────────────────────────────────────────

import type { SiblingListItem } from "@/components/admin/sibling-list";

interface SiblingSectionProps {
  bursaryAccountId: string;
  currentChildName: string;
  currentBursaryAccountId: string;
  siblingLinks: SiblingListItem[];
  isAssessor: boolean;
}

function SiblingSection({
  bursaryAccountId,
  currentChildName,
  currentBursaryAccountId,
  siblingLinks,
  isAssessor,
}: SiblingSectionProps) {
  return (
    <section aria-labelledby="sibling-links-heading">
      <h2
        id="sibling-links-heading"
        className="mb-3 text-sm font-semibold text-slate-700"
      >
        Sibling Links
      </h2>
      <div className="space-y-3">
        {/* Current linked siblings */}
        <SiblingListCard
          siblings={siblingLinks}
          currentBursaryAccountId={currentBursaryAccountId}
          isAssessor={isAssessor}
        />

        {/* Search + link new sibling (assessor only) */}
        {isAssessor && (
          <SiblingLinkerCard
            bursaryAccountId={bursaryAccountId}
            currentChildName={currentChildName}
            isAssessor={isAssessor}
          />
        )}
      </div>
    </section>
  );
}
