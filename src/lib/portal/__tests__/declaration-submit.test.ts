/**
 * declaration-submit — the DECLARATION save/submit split (D4, CF-32).
 *
 * The behaviour under test is the rule the client asked for: saving the
 * declaration must NOT submit, and submitting must be explicit AND confirmed.
 * This repo has no jsdom/RTL, so the decision lives in a pure function and is
 * driven directly here — the same convention as `section-form.test.tsx`.
 */

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SUBMIT_INTENT,
  REVIEW_LABEL,
  SUBMIT_APPLICATION_LABEL,
  isNextRedirect,
  isSubmitCancelled,
  isSubmitRequest,
  runSectionSave,
  type SectionSaveDeps,
  type SectionSaveResult,
} from "../declaration-submit";

const OK: SectionSaveResult = { success: true };

/** A NEXT_REDIRECT sentinel shaped like the one Next's `redirect()` throws. */
function redirectError(to = "/submitted") {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;replace;${to};307;`,
  });
}

/**
 * Build the three dependency mocks with per-test overrides. Each mock is
 * declared as its own const (rather than spread over defaults) so vitest keeps
 * the precise `.mock` typing that the call-order assertions rely on.
 */
function makeDeps(overrides: {
  save?: () => Promise<SectionSaveResult>;
  confirmSubmit?: () => Promise<boolean>;
  submit?: () => Promise<void>;
} = {}) {
  const save = vi.fn(overrides.save ?? (async () => OK));
  const confirmSubmit = vi.fn(overrides.confirmSubmit ?? (async () => true));
  const submit = vi.fn(
    overrides.submit ??
      (async () => {
        throw redirectError();
      })
  );
  const deps: SectionSaveDeps = { save, confirmSubmit, submit };
  return { ...deps, save, confirmSubmit, submit };
}

// ─── The default is never "submit" ────────────────────────────────────────────

describe("submission is opt-in", () => {
  it("defaults to the non-submitting review intent", () => {
    expect(DEFAULT_SUBMIT_INTENT).toBe("review");
  });

  it("only treats an explicit DECLARATION submit from the applicant as a submission", () => {
    expect(
      isSubmitRequest({
        sectionType: "DECLARATION",
        intent: "submit",
        onBehalf: false,
      })
    ).toBe(true);

    // Wrong section — a non-terminal section can never submit.
    expect(
      isSubmitRequest({
        sectionType: "PARENTS_INCOME",
        intent: "submit",
        onBehalf: false,
      })
    ).toBe(false);

    // Review intent — the CF-32 split.
    expect(
      isSubmitRequest({
        sectionType: "DECLARATION",
        intent: "review",
        onBehalf: false,
      })
    ).toBe(false);

    // CR-001 carve-out.
    expect(
      isSubmitRequest({
        sectionType: "DECLARATION",
        intent: "submit",
        onBehalf: true,
      })
    ).toBe(false);
  });
});

// ─── CF-32: saving the declaration is no longer submitting ────────────────────

describe("saving the DECLARATION does not submit (CF-32)", () => {
  it("saves and stops — no submission, no confirmation prompt", async () => {
    const deps = makeDeps();

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "review", onBehalf: false },
      deps
    );

    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.submit).not.toHaveBeenCalled();
    expect(deps.confirmSubmit).not.toHaveBeenCalled();
    expect(result).toEqual(OK);
  });

  it("surfaces a failed declaration save unchanged", async () => {
    const failure: SectionSaveResult = {
      success: false,
      errors: ["Please sign the declaration."],
    };
    const deps = makeDeps({ save: async () => failure });

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "review", onBehalf: false },
      deps
    );

    expect(result).toEqual(failure);
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it("leaves every other section a plain save", async () => {
    const deps = makeDeps();

    await runSectionSave(
      { sectionType: "CHILD_DETAILS", intent: "submit", onBehalf: false },
      deps
    );

    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.submit).not.toHaveBeenCalled();
  });
});

// ─── The explicit SUBMIT path ─────────────────────────────────────────────────

describe("the explicit SUBMIT path", () => {
  it("confirms, then saves, then submits — in that order", async () => {
    const deps = makeDeps();

    await expect(
      runSectionSave(
        { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
        deps
      )
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(deps.confirmSubmit).toHaveBeenCalledTimes(1);
    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.submit).toHaveBeenCalledTimes(1);

    // Confirm BEFORE the first write, so a cancel leaves nothing half-done;
    // save BEFORE submit, so the signature is persisted before the server's
    // completeness gates read it.
    expect(deps.confirmSubmit.mock.invocationCallOrder[0]).toBeLessThan(
      deps.save.mock.invocationCallOrder[0]
    );
    expect(deps.save.mock.invocationCallOrder[0]).toBeLessThan(
      deps.submit.mock.invocationCallOrder[0]
    );
  });

  it("re-throws NEXT_REDIRECT so the router navigates to /submitted", async () => {
    const deps = makeDeps();

    await expect(
      runSectionSave(
        { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
        deps
      )
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
  });

  it("turns a non-redirect submission failure into a form error", async () => {
    const deps = makeDeps({
      submit: vi.fn(async () => {
        throw new Error("The submission deadline for this round has passed.");
      }),
    });

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
      deps
    );

    expect(result).toEqual({
      success: false,
      errors: ["The submission deadline for this round has passed."],
    });
  });

  it("does not submit when the save itself failed", async () => {
    const deps = makeDeps({
      save: vi.fn(async () => ({ success: false, errors: ["Bad data"] })),
    });

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
      deps
    );

    expect(deps.submit).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, errors: ["Bad data"] });
  });
});

// ─── Cancelling the confirmation ──────────────────────────────────────────────

describe("cancelling the confirmation", () => {
  it("writes nothing and returns the silent no-op sentinel", async () => {
    const deps = makeDeps({ confirmSubmit: async () => false });

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
      deps
    );

    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
    expect(isSubmitCancelled(result)).toBe(true);
  });

  it("carries no error messages, so SectionForm renders no error banner", async () => {
    const deps = makeDeps({ confirmSubmit: async () => false });

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "submit", onBehalf: false },
      deps
    );

    // SectionForm renders its banner only when `allErrors.length > 0`, and
    // skips navigation whenever `success` is false. Both must hold or a cancel
    // either looks like a failure or flings the applicant off the page.
    expect(result.success).toBe(false);
    expect(result.errors).toEqual([]);
  });
});

// ─── CR-001: on-behalf editing never auto-submits ─────────────────────────────

describe("on-behalf editing never submits (CR-001)", () => {
  it("saves only, even with a submit intent armed", async () => {
    const deps = makeDeps();

    const result = await runSectionSave(
      { sectionType: "DECLARATION", intent: "submit", onBehalf: true },
      deps
    );

    expect(deps.save).toHaveBeenCalledTimes(1);
    expect(deps.confirmSubmit).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
    expect(result).toEqual(OK);
  });
});

// ─── The label the footer and the page share ──────────────────────────────────

describe("labels", () => {
  it("names the commit action once, for both the footer and the page", () => {
    expect(SUBMIT_APPLICATION_LABEL).toBe("Submit Application");
  });

  it("names the separate, non-submitting action Review", () => {
    expect(REVIEW_LABEL).toBe("Review");
  });
});

// ─── Redirect detection ───────────────────────────────────────────────────────

describe("isNextRedirect", () => {
  it("recognises Next's redirect sentinel", () => {
    expect(isNextRedirect(redirectError())).toBe(true);
  });

  it("ignores ordinary errors and non-objects", () => {
    expect(isNextRedirect(new Error("boom"))).toBe(false);
    expect(isNextRedirect({ digest: "NEXT_NOT_FOUND" })).toBe(false);
    expect(isNextRedirect(null)).toBe(false);
    expect(isNextRedirect(undefined)).toBe(false);
  });
});
