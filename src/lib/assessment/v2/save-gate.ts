/**
 * CALC-15 — pure save-outcome gating shared by the v2 assessor form.
 *
 * Found during an E2E walkthrough: a stale Prisma client made every
 * `saveAssessmentAction` call throw server-side, yet (a) the assessor UI showed
 * no visible failure, and (b) Complete succeeded anyway — producing a COMPLETED
 * assessment whose v2 snapshot columns were ALL NULL. Both behaviours trace back
 * to the form treating `handleSave()` as fire-and-forget: its result was never
 * inspected before flipping status or clearing the error banner.
 *
 * Extracted here as pure functions (no React, no DOM) so the fix — (1) the
 * persistent "last save failed" indicator, and (2) Complete/Pause only
 * proceeding after a successful save — is unit-testable without rendering the
 * form.
 */

import type { AssessmentSaveInput } from "@/lib/db/queries/assessments";
import type { AssessmentV2Output } from "@/lib/assessment/v2/orchestrator";

export type SaveOutcome = { success: true } | { success: false; error: string };

/**
 * The inline "last save failed" banner text to show, given the latest save
 * outcome. `null` means render nothing (the last save succeeded).
 *
 * Only a SUCCESSFUL outcome clears the banner. Callers must feed this the
 * outcome of every save attempt (autosave or explicit) and must NOT
 * optimistically clear the banner before an outcome is known — doing so would
 * blank it during a retry's "Saving…" window and defeat the "stays until a
 * save succeeds" requirement.
 */
export function reduceSaveError(outcome: SaveOutcome): string | null {
  return outcome.success ? null : outcome.error;
}

/**
 * Complete/Pause must only proceed when the synchronous save that precedes
 * them succeeded. A failed save must never be silently followed by a status
 * flip — that is exactly how a stale-save failure produced a COMPLETED
 * assessment with a null snapshot.
 */
export function canProceedAfterSave(outcome: SaveOutcome): boolean {
  return outcome.success;
}

/**
 * The v2 calculation snapshot sent with every save (orchestrator output 1:1
 * onto the v2 columns).
 *
 * When the engine could not run (`runAssessmentV2` returned null — e.g. a
 * missing reference row), every key is sent as an explicit `null`. Sending
 * NO keys instead let the partial update keep the previous figures beside
 * the new inputs, and the completion guard (which checks
 * `totalHouseholdNetIncome`) then let Complete through on those stale
 * figures. Clearing them saves the assessor's typed input, shows no figure
 * rather than a wrong one, and blocks Complete until the calculation runs.
 */
export function v2SnapshotForSave(output: AssessmentV2Output | null): V2SaveSnapshot {
  return {
    totalHouseholdNetIncome: output?.householdNetIncome ?? null,
    notionalEssentials: output?.notionalEssentials ?? null,
    notionalCar: output?.notionalCar ?? null,
    notionalPublicTransport: output?.notionalPublicTransport ?? null,
    notionalJwfAllowance: output?.notionalJwfAllowance ?? null,
    notionalSavingsBenchmark: output?.notionalSavingsBenchmark ?? null,
    savingsTestNumber: output?.savingsTestNumber ?? null,
    totalNotionalSpend: output?.totalNotionalSpend ?? null,
    ndiAfterNotionalSpend: output?.ndiAfterNotionalSpend ?? null,
    derivedYearlyDebtRepayments: output?.derivedYearlyDebtRepayments ?? null,
    yearlyDebtExposure: output?.yearlyDebtExposure ?? null,
    debtOverNdiRatio: output?.debtOverNdiRatio ?? null,
    debtStatusLabel: output?.debtStatusLabel ?? null,
    incomeCategory: output?.incomeCategory ?? null,
    propertyCategoryDerived: output?.propertyCategoryDerived ?? null,
    propertyEquityCategory: output?.propertyEquityCategory ?? null,
    financialEquityLabel: output?.financialEquityLabel ?? null,
    lifestyleSqueezeRatio: output?.lifestyleSqueezeRatio ?? null,
    lifestyleSqueezeLabel: output?.lifestyleSqueezeLabel ?? null,
    actualRemainingDi: output?.actualRemainingDi ?? null,
    theoreticalBenchmarkDi: output?.theoreticalBenchmarkDi ?? null,
    affordabilityAdjustedDi: output?.affordabilityAdjustedDi ?? null,
    recommendedPayableFees: output?.recommendedPayableFees ?? null,
  };
}

type V2SnapshotKey =
  | "totalHouseholdNetIncome"
  | "notionalEssentials"
  | "notionalCar"
  | "notionalPublicTransport"
  | "notionalJwfAllowance"
  | "notionalSavingsBenchmark"
  | "savingsTestNumber"
  | "totalNotionalSpend"
  | "ndiAfterNotionalSpend"
  | "derivedYearlyDebtRepayments"
  | "yearlyDebtExposure"
  | "debtOverNdiRatio"
  | "debtStatusLabel"
  | "incomeCategory"
  | "propertyCategoryDerived"
  | "propertyEquityCategory"
  | "financialEquityLabel"
  | "lifestyleSqueezeRatio"
  | "lifestyleSqueezeLabel"
  | "actualRemainingDi"
  | "theoreticalBenchmarkDi"
  | "affordabilityAdjustedDi"
  | "recommendedPayableFees";

/** Every snapshot key present; `null` clears the column. */
export type V2SaveSnapshot = Required<Pick<AssessmentSaveInput, V2SnapshotKey>>;
