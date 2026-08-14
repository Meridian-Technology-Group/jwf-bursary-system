/**
 * Decision table for the portal's dirty-navigation guard (WP B1).
 *
 * These pin the two things that actually cost the client work: whether a click
 * is allowed to leave a section, and what happens to the typing when it does.
 * The React wiring is exercised by hand on a preview deploy — the repo has no
 * jsdom/RTL — so everything decidable is decided here.
 */

import { describe, expect, it, vi } from "vitest";

import {
  isModifiedClick,
  normaliseHref,
  resolveUnsavedChoice,
  shouldPromptBeforeNavigation,
  snapshotValues,
  valuesEqual,
} from "@/lib/portal/unsaved-changes";

describe("snapshotValues", () => {
  it("detaches nested branches — the whole point", () => {
    // react-hook-form's `getValues()` is a SHALLOW spread, so an aliased
    // baseline gets edited by the applicant's own typing and the guard never
    // fires. Reproduced in the browser before this was added.
    const live = { parent1Contact: { lastName: "" }, docs: ["a"] };
    const baseline = snapshotValues(live);

    live.parent1Contact.lastName = "Smith";
    live.docs.push("b");

    expect(baseline.parent1Contact.lastName).toBe("");
    expect(baseline.docs).toEqual(["a"]);
    expect(valuesEqual(live, baseline)).toBe(false);
  });

  it("copies dates by value, not by reference", () => {
    const live = { d: new Date("2026-08-14T00:00:00Z") };
    const baseline = snapshotValues(live);

    live.d.setFullYear(2030);

    expect(baseline.d.getUTCFullYear()).toBe(2026);
  });

  it("round-trips an untouched section as equal", () => {
    const values = {
      parent1Income: { employed: { annualSalaryPaye: 0 }, total: 0 },
      documentsConfirmed: false,
    };
    expect(valuesEqual(values, snapshotValues(values))).toBe(true);
  });
});

describe("valuesEqual — what counts as an applicant edit", () => {
  it("treats a cleared field as equal to an absent one", () => {
    // `parent-details-form` clears `isRemarriedSoleParent` to `undefined` when
    // the CF-13 matrix stops asking; that is not the applicant's edit.
    expect(
      valuesEqual(
        { isSoleParent: true, isRemarriedSoleParent: undefined },
        { isSoleParent: true }
      )
    ).toBe(true);
  });

  it("sees a real edit through nested income sub-blocks", () => {
    expect(
      valuesEqual(
        { parent1Income: { employed: { annualSalaryPaye: 0 } } },
        { parent1Income: { employed: { annualSalaryPaye: 42000 } } }
      )
    ).toBe(false);
  });

  it("does not care about key order", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("treats a reordered list as an edit", () => {
    expect(valuesEqual({ children: ["a", "b"] }, { children: ["b", "a"] })).toBe(
      false
    );
    expect(valuesEqual({ children: ["a"] }, { children: ["a", "b"] })).toBe(
      false
    );
  });

  it("distinguishes an empty string from an absent value", () => {
    // Typing then deleting leaves "", which the applicant did do — and which
    // persists differently from never having touched the field.
    expect(valuesEqual({ note: "" }, {})).toBe(false);
  });

  it("compares dates by instant, and null is not an object", () => {
    expect(
      valuesEqual({ d: new Date("2026-08-14") }, { d: new Date("2026-08-14") })
    ).toBe(true);
    expect(valuesEqual({ d: null }, { d: {} })).toBe(false);
    expect(valuesEqual({ d: null }, { d: null })).toBe(true);
  });

  it("does not confuse an uploaded document id with an empty slot", () => {
    expect(
      valuesEqual({ p60DocumentId: undefined }, { p60DocumentId: "doc-1" })
    ).toBe(false);
  });
});

const plainClick = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("isModifiedClick", () => {
  it("does not guard a plain left click — that is the case we DO guard elsewhere", () => {
    expect(isModifiedClick(plainClick)).toBe(false);
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)(
    "passes a %s-click straight through (opens elsewhere, page stays put)",
    (modifier) => {
      expect(isModifiedClick({ ...plainClick, [modifier]: true })).toBe(true);
    }
  );

  it("passes a middle click through", () => {
    expect(isModifiedClick({ ...plainClick, button: 1 })).toBe(true);
  });

  it("passes a new-tab target through but still guards target=_self", () => {
    expect(isModifiedClick(plainClick, "_blank")).toBe(true);
    expect(isModifiedClick(plainClick, "_self")).toBe(false);
  });
});

describe("normaliseHref", () => {
  it("drops a deep-link hash", () => {
    expect(normaliseHref("/apply/parents-income#parent1Income.p60DocumentId")).toBe(
      "/apply/parents-income"
    );
  });

  it("drops a trailing slash but never the root", () => {
    expect(normaliseHref("/apply/child-details/")).toBe("/apply/child-details");
    expect(normaliseHref("/")).toBe("/");
  });

  it("keeps the query string — two queries are two destinations", () => {
    expect(normaliseHref("/documents?slot=P60")).toBe("/documents?slot=P60");
  });
});

describe("shouldPromptBeforeNavigation", () => {
  it("lets a clean form navigate freely", () => {
    expect(
      shouldPromptBeforeNavigation({
        isDirty: false,
        targetHref: "/apply/parents-income",
        currentPath: "/apply/child-details",
      })
    ).toBe(false);
  });

  it("prompts when a dirty section is being left", () => {
    expect(
      shouldPromptBeforeNavigation({
        isDirty: true,
        targetHref: "/apply/parents-income",
        currentPath: "/apply/parent-details",
      })
    ).toBe(true);
  });

  it("does not prompt for a link back to the page already open", () => {
    expect(
      shouldPromptBeforeNavigation({
        isDirty: true,
        targetHref: "/apply/parents-income",
        currentPath: "/apply/parents-income",
      })
    ).toBe(false);
  });

  it("does not prompt for a hash deep-link into the current section", () => {
    // The Review page's "Issues to resolve" panel emits exactly these.
    expect(
      shouldPromptBeforeNavigation({
        isDirty: true,
        targetHref: "/apply/parents-income#parent1Income.p60DocumentId",
        currentPath: "/apply/parents-income",
      })
    ).toBe(false);
  });

  it("prompts when the current path is not yet known", () => {
    // Pre-hydration `usePathname()` is null; erring toward the prompt keeps the
    // failure mode "one extra dialog", not "work silently discarded".
    expect(
      shouldPromptBeforeNavigation({
        isDirty: true,
        targetHref: "/apply/parents-income",
        currentPath: null,
      })
    ).toBe(true);
  });
});

describe("resolveUnsavedChoice", () => {
  it("cancel keeps the applicant put and writes nothing", async () => {
    const save = vi.fn(async () => true);
    const navigate = vi.fn();

    await expect(resolveUnsavedChoice("cancel", { save, navigate })).resolves.toBe(
      "cancelled"
    );
    expect(save).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("discard navigates without saving", async () => {
    const save = vi.fn(async () => true);
    const navigate = vi.fn();

    await expect(
      resolveUnsavedChoice("discard", { save, navigate })
    ).resolves.toBe("navigated");
    expect(save).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("save persists BEFORE navigating", async () => {
    const order: string[] = [];
    const save = vi.fn(async () => {
      order.push("save");
      return true;
    });
    const navigate = vi.fn(() => {
      order.push("navigate");
    });

    await expect(resolveUnsavedChoice("save", { save, navigate })).resolves.toBe(
      "navigated"
    );
    expect(order).toEqual(["save", "navigate"]);
  });

  it("withholds the navigation when the save did not land", async () => {
    // The whole point: a guard that loses the work anyway is worse than none.
    const save = vi.fn(async () => false);
    const navigate = vi.fn();

    await expect(resolveUnsavedChoice("save", { save, navigate })).resolves.toBe(
      "save-failed"
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("treats a thrown save as a failed save, not as permission to navigate", async () => {
    const save = vi.fn(async () => {
      throw new Error("network down");
    });
    const navigate = vi.fn();

    await expect(resolveUnsavedChoice("save", { save, navigate })).resolves.toBe(
      "save-failed"
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
