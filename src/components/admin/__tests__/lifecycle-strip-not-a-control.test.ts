import { describe, it, expect } from "vitest";
import { lifecycleChipClass } from "../assessment-lifecycle-strip";
import {
  ASSESSMENT_LIFECYCLE_ORDER,
  ASSESSMENT_LIFECYCLE_LABELS,
} from "@/lib/assessments/lifecycle-state";

/**
 * CH-35 regression — the assessment could not be completed, and this strip is
 * why.
 *
 * Charlotte read "Complete the assessment to record the outcome" on the award
 * tab, went up to the header, clicked the `COMPLETE` chip, and nothing
 * happened. Nothing SHOULD have happened — the strip is a status readout
 * (LA15-2), rendered as `<span>`s — but every chip carried a border AND a
 * filled background, so four status labels read as four buttons. The audit
 * trail confirms it: across her whole session there is no `ASSESSMENT_SAVE`
 * and no `ASSESSMENT_COMPLETE` server call, because clicking a `<span>` makes
 * none. She reported the button as unresponsive; it was never a button.
 *
 * Two fixes: the inactive chips lost their button-like frame (here), and the
 * award tab's instruction gained the control it asks for (CH-35, in
 * `recommendation-form-v2`).
 *
 * This repo has no jsdom/RTL, so the rule is pinned on the extracted class
 * helper rather than a render — the same convention as `section-form` and
 * `lifecycle-badges`.
 */
describe("lifecycleChipClass — CH-35: an indicator, not a control", () => {
  it("gives an inactive chip no border (the frame that made it read as a button)", () => {
    expect(lifecycleChipClass(false)).not.toMatch(/\bborder\b/);
    expect(lifecycleChipClass(false)).not.toMatch(/\bborder-/);
  });

  it("gives an inactive chip no background fill", () => {
    expect(lifecycleChipClass(false)).not.toMatch(/\bbg-/);
  });

  it("renders an inactive chip as recessed plain text", () => {
    expect(lifecycleChipClass(false)).toMatch(/text-slate-400/);
  });

  it("keeps the CURRENT state a solid green pill, so it stays legible", () => {
    const current = lifecycleChipClass(true);
    expect(current).toMatch(/bg-success-600/);
    expect(current).toMatch(/text-white/);
  });

  it("never emits a cursor or hover affordance in either state", () => {
    for (const cls of [lifecycleChipClass(true), lifecycleChipClass(false)]) {
      expect(cls).not.toMatch(/cursor-pointer/);
      expect(cls).not.toMatch(/hover:/);
    }
  });

  it("current and inactive remain visually distinguishable", () => {
    expect(lifecycleChipClass(true)).not.toBe(lifecycleChipClass(false));
  });
});

describe("assessment lifecycle states — the strip reads as a progression", () => {
  it("orders the four states the way Charlotte's mock does", () => {
    expect(ASSESSMENT_LIFECYCLE_ORDER).toEqual([
      "NOT_STARTED",
      "PAUSED",
      "COMPLETE",
      "LOCKED",
    ]);
  });

  it("labels every state, so no chip can render blank", () => {
    for (const state of ASSESSMENT_LIFECYCLE_ORDER) {
      expect(ASSESSMENT_LIFECYCLE_LABELS[state]?.trim()).toBeTruthy();
    }
  });
});
