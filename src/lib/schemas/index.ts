/**
 * Central re-export of all application section schemas.
 * Also exports a map from ApplicationSectionType → Zod schema.
 */

export * from "./child-details";
export * from "./family-id";
export * from "./parent-details";
export * from "./dependent-children";
export * from "./dependent-elderly";
export * from "./other-info";
export * from "./parents-income";
export * from "./assets-liabilities";
export * from "./additional-info";
export * from "./declaration";

import { childDetailsSchema } from "./child-details";
import { familyIdSchema } from "./family-id";
import { parentDetailsSchema } from "./parent-details";
import { dependentChildrenSchema } from "./dependent-children";
import { dependentElderlySchema } from "./dependent-elderly";
import { otherInfoSchema } from "./other-info";
import { parentsIncomeSchema } from "./parents-income";
import { assetsLiabilitiesSchema } from "./assets-liabilities";
import { additionalInfoSchema } from "./additional-info";
import { declarationSchema } from "./declaration";
import type { ApplicationSectionType } from "@prisma/client";
import type { ZodTypeAny } from "zod";

export const sectionSchemaMap: Record<ApplicationSectionType, ZodTypeAny> = {
  CHILD_DETAILS: childDetailsSchema,
  FAMILY_ID: familyIdSchema,
  PARENT_DETAILS: parentDetailsSchema,
  DEPENDENT_CHILDREN: dependentChildrenSchema,
  DEPENDENT_ELDERLY: dependentElderlySchema,
  OTHER_INFO: otherInfoSchema,
  PARENTS_INCOME: parentsIncomeSchema,
  ASSETS_LIABILITIES: assetsLiabilitiesSchema,
  ADDITIONAL_INFO: additionalInfoSchema,
  DECLARATION: declarationSchema,
};
