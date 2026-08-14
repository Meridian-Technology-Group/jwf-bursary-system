/**
 * Default (empty) form values for every applicant-wizard section.
 *
 * F5. These live here rather than inline in `section-page-client.tsx` so the
 * seed for EVERY section can be asserted against its real schema in a unit test
 * — the defect class below is invisible to a schema test that builds its own
 * fixture, because such a fixture supplies exactly the fields the real form
 * leaves `undefined`.
 *
 * ## The defect class this module exists to prevent
 *
 * A required field absent from these defaults stays `undefined` in react-hook-form.
 * A required `z.string()` / `z.boolean()` that arrives `undefined` fails Zod's
 * BASE TYPE check, which carries no custom message, and produces the raw
 *
 *     "Invalid input: expected string, received undefined"
 *
 * The section form's error banner prints `.message` only, so the applicant is
 * shown that sentence with no field name attached and no way to tell what to fix.
 * Seeded as `""` / `false` the same field fails `.min(1, "…")` (or a `superRefine`)
 * instead, and shows the intended human copy.
 *
 * Seeding a default does NOT make a field less required — it only changes which
 * Zod check rejects it, and therefore which message the applicant reads.
 *
 * ## The rule
 *
 * - Every required **string** gets `""`.
 * - Every required **boolean** gets `false` (or the true default where the form
 *   pre-ticks it).
 * - Every required **array** gets `[]`.
 * - **Enums stay `undefined`** — their schemas already carry custom
 *   "Please select …" messages, so an unseeded enum produces human copy.
 * - Blocks that are *collapsed but still mounted* must be seeded anyway.
 *   `ConditionalField` hides with `grid-rows-[0fr]`; it never unmounts, so
 *   react-hook-form registers those fields regardless of visibility.
 *
 * `src/lib/portal/__tests__/section-defaults.test.ts` enforces all of the above
 * for every section in `sectionSchemaMap`, so a new section or a new required
 * field cannot reintroduce the class.
 */

import type { ApplicationSectionType } from "@prisma/client";

import {
  isLegacyIncomeRecord,
  normaliseLegacyIncomeRecord,
} from "@/lib/portal/income-model";
import { parentDetailsDefaultValues } from "@/lib/portal/parent-details-defaults";
import { splitChildFullName } from "@/lib/schemas/child-details";
import { isTwoParentHousehold } from "@/lib/schemas/parent-details";

export interface DefaultValuesSeed {
  applicationSchool?: "TRINITY" | "WHITGIFT";
  applicationChildName?: string;
  applicationGuardianName?: string;
  isSoleParent?: boolean;
  /**
   * Relationship status from PARENT_DETAILS. Required here because the Parent 2
   * blocks on PARENTS_INCOME and DECLARATION are mounted on
   * `isTwoParentHousehold({ isSoleParent, relationshipStatus })`, NOT on
   * `isSoleParent` alone — a coupled status (married / civil partnership /
   * cohabiting) opens Parent 2 even when the applicant answered "sole parent =
   * yes". Seeding those blocks off the raw flag left the mounted fields
   * `undefined`; see `seedsParentTwo`.
   */
  relationshipStatus?: string;
}

/**
 * Does the wizard MOUNT the Parent 2 block for this household?
 *
 * This must stay identical to the condition `SectionFormContent` uses to render
 * `ParentsIncomeForm` / `DeclarationForm`, because a block that is mounted has
 * its fields registered by react-hook-form and therefore must be seeded, while a
 * block that is absent must NOT be seeded (seeding it would submit Parent 2 data
 * for a genuinely sole-parent household and trip Parent 2's validation).
 */
export function seedsParentTwo(seed: DefaultValuesSeed): boolean {
  // Mirrors `isSoleParent={isTwoParentHousehold(…) ? false : isSoleParent}`
  // combined with the forms' own `{!isSoleParent && <Parent 2 block/>}`.
  return (
    isTwoParentHousehold({
      isSoleParent: seed.isSoleParent,
      relationshipStatus: seed.relationshipStatus,
    }) || seed.isSoleParent !== true
  );
}

/**
 * FAMILY_ID (Q1): guarantee two locked, always-required rows — the child named
 * on the application (role CHILD) and the applicant / named guardian (role
 * GUARDIAN) — followed by any additional members. Their names are locked to the
 * application source (refreshed on every load); uploaded doc ids are preserved.
 * Legacy rows with no role are treated as OTHER additional members.
 */
export function normaliseFamilyId(
  existing: unknown,
  childName: string,
  guardianName: string
) {
  const raw =
    existing &&
    typeof existing === "object" &&
    Array.isArray((existing as { familyMembers?: unknown }).familyMembers)
      ? ((existing as { familyMembers: unknown[] })
          .familyMembers as Array<Record<string, unknown>>)
      : [];

  const find = (role: string) =>
    raw.find((m) => m && typeof m === "object" && m.role === role);
  const others = raw
    .filter(
      (m) =>
        m && typeof m === "object" && m.role !== "CHILD" && m.role !== "GUARDIAN"
    )
    .map((m) => ({ ...m, role: "OTHER" }));

  const fixedRow = (
    existingRow: Record<string, unknown> | undefined,
    role: "CHILD" | "GUARDIAN",
    name: string,
    fallbackId: string
  ) => ({
    id: (existingRow?.id as string) ?? fallbackId,
    role,
    familyMemberName: name, // locked to the application source
    isBritishCitizen: (existingRow?.isBritishCitizen as boolean) ?? true,
    ukPassportDocumentId: existingRow?.ukPassportDocumentId as string | undefined,
    passportDocumentId: existingRow?.passportDocumentId as string | undefined,
    ilrDocumentId: existingRow?.ilrDocumentId as string | undefined,
  });

  return {
    familyMembers: [
      fixedRow(find("CHILD"), "CHILD", childName, "family-role-child"),
      fixedRow(find("GUARDIAN"), "GUARDIAN", guardianName, "family-role-guardian"),
      ...others,
    ],
  };
}

export function getSectionDefaultValues(
  sectionType: ApplicationSectionType,
  existingData: unknown,
  seed: DefaultValuesSeed = {}
) {
  // FAMILY_ID is normalised the same way whether or not a draft exists (Q1).
  if (sectionType === "FAMILY_ID") {
    return normaliseFamilyId(
      existingData,
      seed.applicationChildName ?? "",
      seed.applicationGuardianName ?? ""
    );
  }

  if (existingData && typeof existingData === "object") {
    // Back-compat: a CHILD_DETAILS draft saved before the name was split into
    // title/first/surname holds only `childFullName`. Seed the split fields from
    // it so the rebuilt form renders and re-validates the legacy value.
    if (sectionType === "CHILD_DETAILS") {
      const d = existingData as {
        childFirstName?: string;
        childSurname?: string;
        childFullName?: string;
        placeOfBirthCity?: string;
      };
      if (
        d.childFirstName === undefined &&
        d.childSurname === undefined &&
        d.childFullName
      ) {
        const { firstName, surname } = splitChildFullName(d.childFullName);
        return {
          ...existingData,
          childFirstName: firstName,
          childSurname: surname,
          placeOfBirthCity: d.placeOfBirthCity ?? "",
        };
      }
      return existingData;
    }
    // Back-compat: an in-flight PARENTS_INCOME draft may hold the LEGACY flat
    // shape. Normalise each parent record into the new status-driven shape so
    // the rebuilt form can render and re-validate it (Epic 02 §5.1).
    if (sectionType === "PARENTS_INCOME") {
      const d = existingData as {
        parent1Income?: unknown;
        parent2Income?: unknown;
      };
      return {
        parent1Income: isLegacyIncomeRecord(d.parent1Income)
          ? normaliseLegacyIncomeRecord(d.parent1Income)
          : (d.parent1Income ?? emptyIncomeRecord()),
        ...(d.parent2Income !== undefined
          ? {
              parent2Income: isLegacyIncomeRecord(d.parent2Income)
                ? normaliseLegacyIncomeRecord(d.parent2Income)
                : d.parent2Income,
            }
          : {}),
      };
    }
    // Back-compat: a legacy DECLARATION draft holds {accepted, signedOnBehalfOf}.
    // Map it onto the new per-parent P1 fields so the rebuilt form renders it.
    if (sectionType === "DECLARATION") {
      const d = existingData as {
        acceptedParent1?: boolean;
        signedOnBehalfOfParent1?: string;
        acceptedParent2?: boolean;
        signedOnBehalfOfParent2?: string;
        accepted?: boolean;
        signedOnBehalfOf?: string;
      };
      const hasNew =
        d.acceptedParent1 !== undefined || d.signedOnBehalfOfParent1 !== undefined;
      if (hasNew) return existingData;
      const base = {
        acceptedParent1: d.accepted ?? false,
        signedOnBehalfOfParent1: d.signedOnBehalfOf ?? "",
      };
      return seedsParentTwo(seed)
        ? { ...base, acceptedParent2: false, signedOnBehalfOfParent2: "" }
        : base;
    }
    return existingData;
  }

  switch (sectionType) {
    case "CHILD_DETAILS": {
      const seededName = splitChildFullName(seed.applicationChildName);
      return {
        school: seed.applicationSchool,
        // entryYearGroup deliberately NOT seeded — A6 removed it from the
        // applicant schema entirely (JWF-facing only, set admin-side).
        childTitle: "",
        childFirstName: seededName.firstName,
        childSurname: seededName.surname,
        childFullName: seed.applicationChildName ?? "",
        gender: "",
        dateOfBirth: "",
        placeOfBirthCity: "",
        placeOfBirth: "",
        sameAddressAsParent1: true,
        currentSchool: "",
        currentSchoolStartDate: "",
      };
    }
    case "PARENT_DETAILS":
      return parentDetailsDefaultValues();
    case "DEPENDENT_CHILDREN":
      return { numberOfDependentChildren: 0, children: [] };
    case "DEPENDENT_ELDERLY":
      return {
        hasElderlyAtHome: undefined,
        elderlyAtHome: [],
        hasElderlyInCare: undefined,
        elderlyInCare: [],
      };
    case "OTHER_INFO":
      return {
        hasCOurtOrder: undefined,
        hasInsurancePolicy: undefined,
        hasOutstandingFees: undefined,
      };
    case "PARENTS_INCOME":
      // Status-driven sub-tables (D3). The form seeds the relevant sub-blocks
      // from the declared employment status and normalises any legacy draft on
      // load (see parents-income-form.tsx).
      //
      // A4: Parent 2's block is MOUNTED for a two-parent household, so RHF
      // registers `parent2Income.documentsConfirmed`. Left unseeded it arrived
      // `undefined` and produced "expected boolean, received undefined" (and the
      // checkbox mounted uncontrolled, `checked={undefined}`). Seeded only when
      // the block is actually shown — `parent2Income` is `.optional()`, so
      // seeding it for a genuine sole parent would demand Parent 2 figures that
      // household never enters.
      return {
        parent1Income: emptyIncomeRecord(),
        ...(seedsParentTwo(seed) ? { parent2Income: emptyIncomeRecord() } : {}),
      };
    case "ASSETS_LIABILITIES":
      return {
        propertyOwnership: undefined,
        residenceValue: 0,
        hasMortgage: undefined,
        hasOtherProperties: undefined,
        otherProperties: [],
        hasChargingOrder: undefined,
        carOwnership: undefined,
        usesPublicTransport: undefined,
        otherPossessionsValue: 0,
        totalCashBalance: 0,
        investmentsValue: 0,
        parent1CurrentAccountDocumentIds: [],
        parent1SavingsAccountDocumentIds: [],
        parent1InvestmentDocumentIds: [],
        hasPersonalDebt: undefined,
        creditCardStatementDocumentIds: [],
        loanStatementDocumentIds: [],
        otherDebtDocumentIds: [],
        documentsConfirmed: false,
      };
    case "ADDITIONAL_INFO":
      return { additionalNarrative: "", additionalDocumentIds: [] };
    case "DECLARATION":
      // Per-parent ticks (Epic 02 PR-5). Seed the P2 fields only for a
      // dual-parent application so a sole parent's declaration is not blocked by
      // the P2 superRefine — which keys on `acceptedParent2` being PRESENT.
      //
      // The gate is `seedsParentTwo`, not the raw `isSoleParent`, because the
      // block mounts on `isTwoParentHousehold`. With "sole parent = yes" AND a
      // coupled status the P2 block was rendered but its fields were left
      // unseeded, so `acceptedParent2` stayed `undefined`: the checkbox mounted
      // uncontrolled and the superRefine read the block as "not shown" and
      // skipped Parent 2's declaration entirely.
      return seedsParentTwo(seed)
        ? {
            acceptedParent1: false,
            signedOnBehalfOfParent1: "",
            acceptedParent2: false,
            signedOnBehalfOfParent2: "",
          }
        : { acceptedParent1: false, signedOnBehalfOfParent1: "" };
    default:
      return {};
  }
}

/**
 * One parent's income block, with every required leaf seeded.
 *
 * `documentsConfirmed` is the field that produced the A4 report
 * ("expected boolean, received undefined") when Parent 2's block was left
 * unseeded: the block is collapsed, not unmounted, so RHF registers it either
 * way, and its checkbox additionally mounted uncontrolled (`checked={undefined}`).
 */
export function emptyIncomeRecord() {
  return { total: 0, documentsConfirmed: false };
}
