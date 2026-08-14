/**
 * CF-18 — number entry must behave identically on every applicant-facing
 * numeric field, both parents' included.
 *
 * The repo has no jsdom/RTL (see section-form.test.tsx), so the behaviour is
 * proved at the module it now lives in, and the "does it reach every field?"
 * half is proved structurally: the source of every portal form is scanned for
 * a numeric input that does NOT come from the two shared components. That scan
 * is the actual regression guard — the defect was never that the logic was
 * wrong, it was that a copy of it existed and only one copy got fixed.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseCount,
  sanitizeCount,
  selectAllOnFocus,
  stripLeadingZeros,
} from "../number-entry";
import { sanitizeCurrency } from "../currency-input";

const SRC = path.resolve(__dirname, "../../../..");
const FORM_FIELDS = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

type FocusLike = React.FocusEvent<HTMLInputElement>;

/** Install a controllable rAF for the duration of one test. */
function withRaf(run: (flush: () => void) => void): void {
  const original = (globalThis as { requestAnimationFrame?: unknown })
    .requestAnimationFrame;
  let frame: (() => void) | undefined;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (
    cb: () => void
  ) => {
    frame = cb;
    return 0;
  };
  try {
    run(() => frame?.());
  } finally {
    if (original === undefined) {
      delete (globalThis as { requestAnimationFrame?: unknown })
        .requestAnimationFrame;
    } else {
      (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame =
        original;
    }
  }
}

describe("selectAllOnFocus", () => {
  it("selects the whole value so the first keystroke replaces the default 0", () => {
    const select = vi.fn();
    withRaf((flush) => {
      selectAllOnFocus({ currentTarget: { select } } as unknown as FocusLike);
      flush();
    });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("captures the element synchronously, so React nulling currentTarget cannot break it", () => {
    const select = vi.fn();
    withRaf((flush) => {
      const event = { currentTarget: { select } } as unknown as {
        currentTarget: unknown;
      };
      selectAllOnFocus(event as unknown as FocusLike);
      // React clears currentTarget once the handler returns.
      event.currentTarget = null;
      flush();
    });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("still selects where requestAnimationFrame is unavailable", () => {
    const select = vi.fn();
    selectAllOnFocus({ currentTarget: { select } } as unknown as FocusLike);
    expect(select).toHaveBeenCalledTimes(1);
  });
});

describe("stripLeadingZeros", () => {
  it("kills the £0,001 → £0,015 → £0,150 walk Charlotte hit on mobile (CF-18)", () => {
    expect(["0", "01", "015", "0150", "01500", "015000"].map(stripLeadingZeros))
      .toEqual(["0", "1", "15", "150", "1500", "15000"]);
  });

  it("preserves a lone zero — 0 is a legitimate answer on this form", () => {
    expect(stripLeadingZeros("0")).toBe("0");
    expect(stripLeadingZeros("")).toBe("");
  });
});

describe("sanitizeCount / parseCount", () => {
  it("keeps digits only and never accumulates behind a default 0", () => {
    expect(sanitizeCount("03")).toBe("3");
    expect(sanitizeCount("2 children")).toBe("2");
    expect(sanitizeCount("1.5")).toBe("15");
  });

  it("reports an emptied field as undefined so the caller decides what blank means", () => {
    expect(parseCount("")).toBeUndefined();
    expect(parseCount("abc")).toBeUndefined();
    expect(parseCount("0")).toBe(0);
    expect(parseCount("04")).toBe(4);
  });
});

describe("the currency and count inputs share one implementation", () => {
  it("CurrencyInput's sanitizer routes its integer part through stripLeadingZeros", () => {
    expect(sanitizeCurrency("015000")).toBe("15000");
    expect(sanitizeCurrency("0")).toBe("0");
    // The decimal 0 is not a leading zero and must survive.
    expect(sanitizeCurrency("0.5")).toBe("0.5");
  });

  it("no portal file re-implements select-on-focus (the fork that caused CF-18)", () => {
    const offenders = walk(path.join(SRC, "components", "portal"))
      .concat(walk(path.join(SRC, "app", "(portal)")))
      .filter((file) => path.dirname(file) !== FORM_FIELDS)
      .filter((file) => /\.select\(\)/.test(readFileSync(file, "utf8")));

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("no portal file hand-rolls a numeric input — CurrencyInput and CountInput are the only two", () => {
    const offenders = walk(path.join(SRC, "components", "portal"))
      .concat(walk(path.join(SRC, "app", "(portal)")))
      .filter((file) => path.dirname(file) !== FORM_FIELDS)
      .filter((file) => /type="number"/.test(readFileSync(file, "utf8")));

    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("Parents' Income — both parents' fields go through the same input", () => {
  const source = readFileSync(
    path.join(SRC, "components", "portal", "sections", "parents-income-form.tsx"),
    "utf8"
  );

  it("renders one column component for parent1Income and parent2Income alike", () => {
    // One definition, two call sites — so a fix to the money cell cannot land
    // on Parent 1 and miss Parent 2 (CF-18).
    expect(source.match(/function ParentIncomeColumn\(/g)).toHaveLength(1);
    expect(source).toMatch(/prefix="parent1Income"/);
    expect(source).toMatch(/prefix="parent2Income"/);
  });

  it("has exactly one money cell, built from the shared CurrencyInput", () => {
    expect(source.match(/<CurrencyInput/g)).toHaveLength(1);
    expect(source.match(/function IncomeRow\(/g)).toHaveLength(1);
    // Every numeric row addresses `${prefix}.${path}` — the prefix is the only
    // thing that differs between the two parents.
    expect(source).toMatch(/name={`\$\{prefix\}\.\$\{path\}`/);
  });
});
