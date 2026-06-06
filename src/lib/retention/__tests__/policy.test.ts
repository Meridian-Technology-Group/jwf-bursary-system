import { describe, it, expect, afterEach } from "vitest";
import {
  isPurgeable,
  getRetentionPolicy,
  DEFAULT_RETENTION_POLICY,
  notYetPurgeableMessage,
  type RetentionApplication,
  type RetentionAccount,
} from "../policy";

const NOW = new Date("2026-06-06T00:00:00.000Z");

function app(overrides: Partial<RetentionApplication> = {}): RetentionApplication {
  return {
    outcome: null,
    archivedAt: null,
    submittedAt: null,
    ...overrides,
  };
}

function account(
  overrides: Partial<RetentionAccount> = {}
): RetentionAccount {
  return { status: "ACTIVE", closedAt: null, ...overrides };
}

const yearsAgo = (n: number) => {
  const d = new Date(NOW.getTime());
  d.setFullYear(d.getFullYear() - n);
  return d;
};
const daysAgo = (n: number) => {
  const d = new Date(NOW.getTime());
  d.setDate(d.getDate() - n);
  return d;
};

describe("isPurgeable — in-flight / non-terminal", () => {
  it("never purges an application with no outcome", () => {
    const r = isPurgeable(app({ submittedAt: yearsAgo(20) }), null, NOW);
    expect(r.purgeable).toBe(false);
    expect(r.tier).toBeNull();
  });

  it("never purges a legacy QUALIFIES row (predates the 3-value split)", () => {
    // QUALIFIES is not one of the three terminal outcomes the policy tiers.
    const r = isPurgeable(
      // QUALIFIES is a legacy outcome the 3-value policy does not tier.
      app({ outcome: "QUALIFIES", submittedAt: yearsAgo(20) }),
      account({ status: "CLOSED", closedAt: yearsAgo(20) }),
      NOW
    );
    expect(r.purgeable).toBe(false);
    expect(r.tier).toBeNull();
  });
});

describe("isPurgeable — declined (grace days, archivedAt anchor)", () => {
  it("retains a freshly-declined application (no-op on recent data)", () => {
    const r = isPurgeable(
      app({ outcome: "DOES_NOT_QUALIFY", archivedAt: daysAgo(5) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(false);
    expect(r.tier).toBe("declined");
  });

  it("purges once the grace window has elapsed", () => {
    const r = isPurgeable(
      app({ outcome: "DOES_NOT_QUALIFY", archivedAt: daysAgo(40) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(true);
    expect(r.tier).toBe("declined");
    expect(r.anchorDate).toEqual(daysAgo(40));
  });

  it("falls back to submittedAt when archivedAt is absent", () => {
    const r = isPurgeable(
      app({ outcome: "DOES_NOT_QUALIFY", submittedAt: daysAgo(40) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(true);
    expect(r.anchorDate).toEqual(daysAgo(40));
  });

  it("is exactly boundary-inclusive at the grace edge", () => {
    const grace = DEFAULT_RETENTION_POLICY.declined.amount; // 30
    const r = isPurgeable(
      app({ outcome: "DOES_NOT_QUALIFY", archivedAt: daysAgo(grace) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(true);
  });
});

describe("isPurgeable — qualifies-not-awarded (6yr, submittedAt anchor)", () => {
  it("retains within 6 years", () => {
    const r = isPurgeable(
      app({ outcome: "QUALIFIES_NOT_AWARDED", submittedAt: yearsAgo(5) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(false);
    expect(r.tier).toBe("qualifiesNotAwarded");
  });

  it("purges past 6 years", () => {
    const r = isPurgeable(
      app({ outcome: "QUALIFIES_NOT_AWARDED", submittedAt: yearsAgo(7) }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(true);
  });

  it("retains when no submission date exists", () => {
    const r = isPurgeable(
      app({ outcome: "QUALIFIES_NOT_AWARDED" }),
      null,
      NOW
    );
    expect(r.purgeable).toBe(false);
    expect(r.anchorDate).toBeNull();
  });
});

describe("isPurgeable — awarded (7yr, closedAt anchor)", () => {
  it("NEVER purges while the account is still ACTIVE (no closedAt anchor)", () => {
    const r = isPurgeable(
      app({ outcome: "AWARDED", submittedAt: yearsAgo(20) }),
      account({ status: "ACTIVE", closedAt: null }),
      NOW
    );
    expect(r.purgeable).toBe(false);
    expect(r.tier).toBe("awarded");
    expect(r.anchorDate).toBeNull();
    expect(r.reason).toMatch(/still active/i);
  });

  it("retains within 7 years of close", () => {
    const r = isPurgeable(
      app({ outcome: "AWARDED", submittedAt: yearsAgo(20) }),
      account({ status: "CLOSED", closedAt: yearsAgo(3) }),
      NOW
    );
    expect(r.purgeable).toBe(false);
  });

  it("purges 7 years after close", () => {
    const r = isPurgeable(
      app({ outcome: "AWARDED", submittedAt: yearsAgo(20) }),
      account({ status: "CLOSED", closedAt: yearsAgo(8) }),
      NOW
    );
    expect(r.purgeable).toBe(true);
    expect(r.anchorDate).toEqual(yearsAgo(8));
  });

  it("anchors from closedAt, NOT submittedAt", () => {
    // Submitted 20y ago but closed recently → still retained.
    const r = isPurgeable(
      app({ outcome: "AWARDED", submittedAt: yearsAgo(20) }),
      account({ status: "CLOSED", closedAt: daysAgo(10) }),
      NOW
    );
    expect(r.purgeable).toBe(false);
  });
});

describe("no-op-on-recent-data property", () => {
  it("nothing submitted/decided in the last day is purgeable", () => {
    const recent = daysAgo(1);
    const cases: RetentionApplication[] = [
      app({ outcome: "DOES_NOT_QUALIFY", archivedAt: recent }),
      app({ outcome: "QUALIFIES_NOT_AWARDED", submittedAt: recent }),
      app({ outcome: "AWARDED", submittedAt: recent }),
    ];
    for (const c of cases) {
      const acc =
        c.outcome === "AWARDED"
          ? account({ status: "CLOSED", closedAt: recent })
          : null;
      expect(isPurgeable(c, acc, NOW).purgeable).toBe(false);
    }
  });
});

describe("env overrides", () => {
  afterEach(() => {
    delete process.env.RETENTION_DECLINED_GRACE_DAYS;
    delete process.env.RETENTION_QUALIFIES_NOT_AWARDED_YEARS;
    delete process.env.RETENTION_AWARDED_YEARS;
  });

  it("reads overrides from env", () => {
    process.env.RETENTION_AWARDED_YEARS = "10";
    expect(getRetentionPolicy().awarded.amount).toBe(10);
  });

  it("falls back to the default on a malformed override", () => {
    process.env.RETENTION_QUALIFIES_NOT_AWARDED_YEARS = "not-a-number";
    expect(getRetentionPolicy().qualifiesNotAwarded.amount).toBe(6);
  });

  it("a longer override defers eligibility", () => {
    const policy = { ...DEFAULT_RETENTION_POLICY, awarded: { amount: 10, unit: "years" as const, anchor: "closedAt" as const } };
    const r = isPurgeable(
      app({ outcome: "AWARDED" }),
      account({ status: "CLOSED", closedAt: yearsAgo(8) }),
      NOW,
      policy
    );
    expect(r.purgeable).toBe(false); // 8 < 10
  });
});

describe("notYetPurgeableMessage", () => {
  it("gives a friendly date for a retained record", () => {
    const r = isPurgeable(
      app({ outcome: "QUALIFIES_NOT_AWARDED", submittedAt: yearsAgo(2) }),
      null,
      NOW
    );
    expect(notYetPurgeableMessage(r)).toMatch(/cannot be deleted yet/i);
  });

  it("explains a non-terminal application", () => {
    const r = isPurgeable(app(), null, NOW);
    expect(notYetPurgeableMessage(r)).toMatch(/no final outcome/i);
  });
});
