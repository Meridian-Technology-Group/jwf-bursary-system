import { describe, it, expect, vi } from "vitest";
import { createAssessment } from "../assessments";
import { CURRENT_CALCULATION_VERSION } from "@/lib/assessment/engine-version";

/**
 * CALC-14 regression: `createAssessment` (the "Begin Assessment" wizard
 * track, `beginAssessmentAction` → `createAssessment`) must default
 * `calculationVersion` to the shared `CURRENT_CALCULATION_VERSION` constant —
 * not a locally-declared magic number that could drift from the OTHER
 * assessment-creation path (`ensureAssessmentRow` in status.ts, the
 * app-detail "Begin Review" track — see status.test.ts).
 */
describe("createAssessment — calculationVersion default (CALC-14)", () => {
  function makeTx() {
    return {
      assessment: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: "asmt-new",
          ...args.data,
          earners: [],
          property: null,
          checklists: [],
        })),
      },
    };
  }

  it("defaults calculationVersion to CURRENT_CALCULATION_VERSION when not passed", async () => {
    const tx = makeTx();
    await createAssessment(tx as never, "app-1", "assessor-1");

    expect(tx.assessment.create).toHaveBeenCalledTimes(1);
    const arg = tx.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.calculationVersion).toBe(CURRENT_CALCULATION_VERSION);
    expect(arg.data.calculationVersion).toBe(2);
  });

  it("still allows an explicit calculationVersion for tests exercising the v1 path directly", async () => {
    const tx = makeTx();
    await createAssessment(tx as never, "app-1", "assessor-1", 1);

    const arg = tx.assessment.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.calculationVersion).toBe(1);
  });
});
