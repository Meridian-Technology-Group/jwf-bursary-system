import { z } from "zod";

export const familyMemberIdentitySchema = z.object({
  id: z.string(),
  familyMemberName: z.string().min(1, "Family member name is required"),
  // CHILD = the child named on the application, GUARDIAN = the named
  // parent/guardian (the applicant). Both are auto-added, name-locked and
  // always required. OTHER = any additional dependent the applicant chooses to
  // add — those must be classified child/adult via `memberType` (Q1).
  role: z.enum(["CHILD", "GUARDIAN", "OTHER"]).default("OTHER"),
  // Only meaningful for OTHER rows; required for them via the refinement below.
  memberType: z.enum(["CHILD", "ADULT"]).optional(),
  // Relationship to the bursary applicant (i.e. mother, father, brother,
  // sister). Captured for OTHER rows added via the "Add family member" dialog.
  // Optional at the schema level for back-compat with previously saved records.
  relationshipToApplicant: z.string().optional(),
  // Which identity document is being uploaded for this member.
  documentType: z
    .enum(["BRITISH_PASSPORT", "SETTLED_STATUS", "ILR_VISA", "OTHER"])
    .optional(),
  isBritishCitizen: z.boolean(),
  ukPassportDocumentId: z.string().optional(),
  passportDocumentId: z.string().optional(),
  ilrDocumentId: z.string().optional(),
});

const familyIdObject = z.object({
  familyMembers: z
    .array(familyMemberIdentitySchema)
    .min(1, "At least one family member must be added"),
});

/**
 * Cross-section context that lets Family Identification block progression when
 * it is inconsistent with the rest of the application. Supplied by the section
 * page from the sibling sections' saved data; omitted (e.g. in tests or the
 * standalone schema) the cross-section rules simply don't fire.
 */
export interface FamilyIdContext {
  /**
   * The declared number of dependent children (DEPENDENT_CHILDREN section). The
   * number of CHILD members documented here must match it — including the child
   * named on the application.
   */
  dependentChildrenCount?: number;
  /**
   * True when the household is two-parent (married / civil partnership /
   * cohabiting, or not a sole parent) — an extra ADULT family member (the
   * partner) must then be added here.
   */
  requiresPartnerAdult?: boolean;
}

/** Count the CHILD family members: the auto-added named child + any OTHER children. */
function countChildMembers(
  members: { role?: string; memberType?: string }[]
): number {
  return members.filter(
    (m) => m.role === "CHILD" || (m.role === "OTHER" && m.memberType === "CHILD")
  ).length;
}

/** Stable ids for the cross-section Family Identification consistency gaps. */
export const FAMILY_ID_CHILD_COUNT_ISSUE = "FAMILY_ID_CHILD_COUNT";
export const FAMILY_ID_PARTNER_ADULT_ISSUE = "FAMILY_ID_PARTNER_ADULT";

/**
 * The single source of truth for the Family Identification cross-section rules,
 * shared by the section schema (per-section "proceed" gate) and the submit gate
 * (Review / Submit). Returns one entry per violated rule.
 */
export function familyIdConsistencyIssues(
  members: { role?: string; memberType?: string }[],
  context: FamilyIdContext
): { id: string; message: string }[] {
  const issues: { id: string; message: string }[] = [];

  // The number of children documented here must match the number of dependent
  // children declared on the Dependent Children section.
  if (typeof context.dependentChildrenCount === "number") {
    const childMembers = countChildMembers(members);
    if (childMembers !== context.dependentChildrenCount) {
      issues.push({
        id: FAMILY_ID_CHILD_COUNT_ISSUE,
        message: `You told us you have ${context.dependentChildrenCount} dependent ${
          context.dependentChildrenCount === 1 ? "child" : "children"
        }, but ${childMembers} ${
          childMembers === 1 ? "child has" : "children have"
        } been added here. Add an identity section for every dependent child (including the child named on this application) so the numbers match.`,
      });
    }
  }

  // A two-parent household must include the partner as an extra adult member.
  if (context.requiresPartnerAdult) {
    const hasPartnerAdult = members.some(
      (m) => m.role === "OTHER" && m.memberType === "ADULT"
    );
    if (!hasPartnerAdult) {
      issues.push({
        id: FAMILY_ID_PARTNER_ADULT_ISSUE,
        message:
          "Because you are married, in a civil partnership or cohabiting, please add your partner as an additional adult family member.",
      });
    }
  }

  return issues;
}

export function makeFamilyIdSchema(context: FamilyIdContext = {}) {
  return familyIdObject.superRefine((data, ctx) => {
    data.familyMembers.forEach((m, i) => {
      if (m.role === "OTHER" && !m.memberType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please indicate whether this is a child or an adult",
          path: ["familyMembers", i, "memberType"],
        });
      }
    });

    for (const issue of familyIdConsistencyIssues(data.familyMembers, context)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: issue.message,
        path: ["familyMembers"],
      });
    }
  });
}

/** Standalone schema with no cross-section context (importers, tests). */
export const familyIdSchema = makeFamilyIdSchema();

export type FamilyIdFormValues = z.infer<typeof familyIdObject>;
