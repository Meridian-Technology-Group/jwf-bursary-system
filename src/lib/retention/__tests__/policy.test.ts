/**
 * Epic 23 T10 — the DPO-signed retention rules (16 Oct 2026), D-20.
 */
import { describe, expect, it } from "vitest";
import {
  addYears,
  canRequestErasure,
  isPurgeable,
  notYetPurgeableMessage,
  planRetention,
  type RetentionRecord,
} from "../policy";

const NOW = new Date("2030-06-01T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

const rec = (over: Partial<RetentionRecord> = {}): RetentionRecord => ({
  bursaryAccount: null,
  closedAt: null,
  assessment: null,
  retentionStage: null,
  retentionStageAt: null,
  ...over,
});

describe("rule 1 — bursary account closed", () => {
  it("an active account is kept, however old (no 30-day tier any more)", () => {
    const p = planRetention(rec({ bursaryAccount: { closedAt: null }, assessment: { status: "ROLLED_OVER", archivedAt: null } }), NOW);
    expect(p.action).toBe("keep");
    expect(p.rule).toBe("account-closed");
  });
  it("a reopened account (closedAt cleared by reopen / re-award / Add a year) is kept", () => {
    expect(planRetention(rec({ bursaryAccount: { closedAt: null }, retentionStage: null }), NOW).action).toBe("keep");
  });
  it("an award closed via the staff close: form + documents 1 year after, then the assessment 6 years after", () => {
    const closed = d("2029-03-15");
    const first = planRetention(rec({ bursaryAccount: { closedAt: closed }, closedAt: closed }), NOW);
    expect(first).toMatchObject({ action: "purge-form-docs", rule: "account-closed", anchor: closed, due: true });
    expect(first.dueAt).toEqual(addYears(closed, 1));
    const second = planRetention(rec({ bursaryAccount: { closedAt: closed }, retentionStage: "FORM_DOCS_PURGED" }), NOW);
    expect(second).toMatchObject({ action: "purge-assessment", rule: "account-closed", due: false });
    expect(second.dueAt).toEqual(addYears(closed, 6));
  });
  it("the 1-year step is not due the day before", () => {
    const closed = d("2029-06-02");
    expect(planRetention(rec({ bursaryAccount: { closedAt: closed } }), NOW).due).toBe(false);
  });
  it("never anchors on submittedAt: an old submission on an active account is kept", () => {
    expect(planRetention(rec({ bursaryAccount: { closedAt: null }, closedAt: d("2010-01-01") }), NOW).action).toBe("keep");
  });
});

describe("rule 2 — unsuccessful application (no account)", () => {
  it("in flight (not closed, waiting list included) is kept", () => {
    expect(planRetention(rec({ assessment: { status: "WAITING_LIST", archivedAt: null } }), NOW).action).toBe("keep");
  });
  it("the form and documents go AT the close; the named assessment 6 years after", () => {
    const closed = d("2030-05-31");
    const first = planRetention(rec({ closedAt: closed, assessment: { status: "COMPLETED", archivedAt: null } }), NOW);
    expect(first).toMatchObject({ action: "purge-form-docs", rule: "unsuccessful", due: true, dueAt: closed });
    const second = planRetention(rec({ closedAt: closed, retentionStage: "FORM_DOCS_PURGED" }), NOW);
    expect(second).toMatchObject({ action: "purge-assessment", due: false });
    expect(second.dueAt).toEqual(addYears(closed, 6));
  });
  it("an archived assessment anchors on its archive date (D-20); a reversal stops the clock", () => {
    const archived = d("2024-01-10");
    expect(planRetention(rec({ assessment: { status: "CLOSED_ARCHIVED", archivedAt: archived } }), NOW)).toMatchObject({
      action: "purge-form-docs",
      anchor: archived,
    });
    expect(planRetention(rec({ assessment: { status: "COMPLETED", archivedAt: null } }), NOW).action).toBe("keep");
  });
  it("the staff close wins over the archive date when both exist", () => {
    const closed = d("2025-02-02");
    expect(planRetention(rec({ closedAt: closed, assessment: { status: "CLOSED_ARCHIVED", archivedAt: d("2020-01-01") } }), NOW).anchor).toEqual(
      closed,
    );
  });
});

describe("rule 3 — erasure request", () => {
  it("the anonymous assessment goes 6 years after the request", () => {
    const erased = d("2024-06-01");
    const p = planRetention(rec({ retentionStage: "ANONYMISED", retentionStageAt: erased }), NOW);
    expect(p).toMatchObject({ action: "purge-assessment", rule: "erasure-request", due: true });
    expect(p.dueAt).toEqual(addYears(erased, 6));
  });
  it("can be requested at the new-application stage only", () => {
    expect(canRequestErasure(rec())).toEqual({ ok: true });
    expect(canRequestErasure(rec({ bursaryAccount: { closedAt: null } })).ok).toBe(false);
    expect(canRequestErasure(rec({ retentionStage: "ANONYMISED" })).ok).toBe(false);
    expect(canRequestErasure(rec({ retentionStage: "ASSESSMENT_PURGED" })).ok).toBe(false);
  });
});

describe("stages already reached", () => {
  it("a fully purged application has nothing left to do", () => {
    expect(planRetention(rec({ retentionStage: "ASSESSMENT_PURGED", bursaryAccount: { closedAt: d("2000-01-01") } }), NOW).action).toBe("keep");
  });
  it("an unknown stage value is treated as none (fail safe: re-plan from the anchor)", () => {
    expect(planRetention(rec({ retentionStage: "BOGUS", closedAt: d("2030-01-01") }), NOW).action).toBe("purge-form-docs");
  });
});

describe("the manual GDPR button (whole-family erasure)", () => {
  it("only once the assessment stage is due", () => {
    const closed = d("2026-01-01");
    const early = isPurgeable(rec({ closedAt: closed }), NOW);
    expect(early.purgeable).toBe(false);
    expect(early.eligibleFrom).toEqual(addYears(closed, 6));
    expect(notYetPurgeableMessage(early)).toMatch(/must be kept until 1 January 2032/);
    expect(isPurgeable(rec({ closedAt: d("2023-01-01") }), NOW).purgeable).toBe(true);
  });
  it("never while the account is active, nor for a live application", () => {
    expect(isPurgeable(rec({ bursaryAccount: { closedAt: null } }), NOW).purgeable).toBe(false);
    expect(isPurgeable(rec(), NOW).purgeable).toBe(false);
    expect(notYetPurgeableMessage(isPurgeable(rec(), NOW))).toMatch(/cannot be deleted yet/);
  });
});
