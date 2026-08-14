import { describe, it, expect, vi } from "vitest";

/**
 * Autosave controller (Epic 13 / WP B2, CF-29).
 *
 * The controller is driven entirely through injected timers here, so every
 * branch is exercised without jsdom (the repo has no DOM test environment).
 * The clock is a plain counter — the tests care about ORDER and COUNT, not
 * wall time.
 *
 * The load-bearing assertion in this file is the one about failure: the
 * indicator must never read "Saved" for a write that did not land. Charlotte
 * lost a completed income section twice; an autosave that lies about having
 * persisted would be the same loss with a reassuring label on top.
 */

import {
  createAutosaveController,
  autosaveLabel,
  autosaveAnnouncement,
  formatClockTime,
  IDLE_STATUS,
  type AutosaveOutcome,
  type AutosaveStatus,
  type TimerHandle,
} from "../autosave";

/**
 * Minimal deterministic scheduler: `schedule` records a due time, `advance`
 * fires everything due. Reproduces real setTimeout ordering without fake global
 * timers (the save is async, so the tests need to await between ticks).
 */
function makeClock() {
  let time = 1_000;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();

  return {
    now: () => time,
    schedule: (run: () => void, ms: number): TimerHandle => {
      const id = nextId++;
      timers.set(id, { at: time + ms, run });
      return id;
    },
    unschedule: (handle: TimerHandle) => {
      timers.delete(handle as number);
    },
    /** Move the clock on and fire every timer that came due, oldest first. */
    async advance(ms: number) {
      time += ms;
      const due = Array.from(timers.entries())
        .filter(([, t]) => t.at <= time)
        .sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.run();
        // Let the (async) save settle before the next timer fires.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
    },
    pendingCount: () => timers.size,
    setTime: (value: number) => {
      time = value;
    },
  };
}

function makeController(
  outcomes: AutosaveOutcome[] | (() => Promise<AutosaveOutcome>),
  overrides: { idleMs?: number; retryMs?: number; hasWork?: () => boolean } = {}
) {
  const clock = makeClock();
  const statuses: AutosaveStatus[] = [];
  const queue = Array.isArray(outcomes) ? [...outcomes] : null;

  const save = vi.fn(async (): Promise<AutosaveOutcome> => {
    if (queue) return queue.shift() ?? "saved";
    return (outcomes as () => Promise<AutosaveOutcome>)();
  });

  const controller = createAutosaveController({
    save,
    hasWork: overrides.hasWork,
    onStatus: (status) => statuses.push(status),
    idleMs: overrides.idleMs ?? 2_500,
    retryMs: overrides.retryMs ?? 15_000,
    now: clock.now,
    schedule: clock.schedule,
    unschedule: clock.unschedule,
  });

  return { controller, clock, statuses, save };
}

const states = (statuses: AutosaveStatus[]) => statuses.map((s) => s.state);

describe("createAutosaveController — debouncing", () => {
  it("writes once per quiet period however much is typed inside it", async () => {
    const { controller, clock, save } = makeController(["saved"]);

    // Six keystrokes inside one 2.5s window.
    for (let i = 0; i < 6; i++) {
      controller.noteChange(true);
      await clock.advance(300);
    }
    expect(save).not.toHaveBeenCalled();

    await clock.advance(2_500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh quiet period after each change", async () => {
    const { controller, clock, save } = makeController(["saved", "saved"]);

    controller.noteChange(true);
    await clock.advance(2_400);
    controller.noteChange(true); // resets the timer
    await clock.advance(2_400);
    expect(save).not.toHaveBeenCalled();

    await clock.advance(200);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not write, and clears the warning, when an edit is undone", async () => {
    const { controller, clock, statuses, save } = makeController(["saved"]);

    controller.noteChange(true);
    expect(states(statuses)).toEqual(["unsaved"]);

    controller.noteChange(false); // typed, then deleted it again
    await clock.advance(10_000);

    expect(save).not.toHaveBeenCalled();
    // Back to silence — there is no last-saved time to show yet.
    expect(controller.getStatus()).toEqual(IDLE_STATUS);
  });

  it("stops scheduling once cancelled (unmount)", async () => {
    const { controller, clock, save } = makeController(["saved"]);

    controller.noteChange(true);
    controller.cancel();
    await clock.advance(10_000);

    expect(save).not.toHaveBeenCalled();
    expect(clock.pendingCount()).toBe(0);

    // And it stays inert afterwards.
    controller.noteChange(true);
    controller.flush();
    await clock.advance(10_000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("createAutosaveController — blur flush", () => {
  it("writes immediately rather than waiting out the quiet period", async () => {
    const { controller, clock, save } = makeController(["saved"]);

    controller.noteChange(true);
    controller.flush();
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(1);
    // The pending idle timer was consumed, not left to fire a second write.
    await clock.advance(10_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not even flash 'Saving…' when tabbing out of an untouched field", async () => {
    const { controller, statuses, save } = makeController(["saved"], {
      hasWork: () => false,
    });

    // A blur with nothing typed — the common case while reading a long section.
    controller.flush();
    await Promise.resolve();

    expect(save).not.toHaveBeenCalled();
    expect(statuses).toEqual([]);
    expect(controller.getStatus()).toEqual(IDLE_STATUS);
  });

  it("collapses a flush during an in-flight write into one follow-up", async () => {
    let release!: (outcome: AutosaveOutcome) => void;
    const { controller, clock, save } = makeController(
      () => new Promise<AutosaveOutcome>((resolve) => (release = resolve))
    );

    controller.flush();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);

    // Three more blurs while the first write is still in the air.
    controller.noteChange(true);
    controller.flush();
    controller.flush();
    expect(save).toHaveBeenCalledTimes(1);

    release("saved");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Exactly one follow-up is owed, and it is scheduled, not immediate.
    expect(save).toHaveBeenCalledTimes(1);
    await clock.advance(2_500);
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("createAutosaveController — a failed write never reads as saved", () => {
  it("reports failure and keeps no saved timestamp", async () => {
    const { controller, clock, statuses } = makeController(["failed"]);

    controller.noteChange(true);
    await clock.advance(2_500);

    expect(states(statuses)).toEqual(["unsaved", "saving", "failed"]);
    const status = controller.getStatus();
    expect(status.state).toBe("failed");
    expect(status.savedAt).toBeNull();
    expect(autosaveLabel(status)).toBe("Not saved — we'll keep trying");
  });

  it("treats a thrown save as a failure, not a success", async () => {
    const { controller, clock } = makeController(async () => {
      throw new Error("network down");
    });

    controller.noteChange(true);
    await clock.advance(2_500);

    expect(controller.getStatus().state).toBe("failed");
    expect(controller.getStatus().savedAt).toBeNull();
  });

  it("keeps showing the LAST genuinely-saved time after a later failure", async () => {
    const { controller, clock } = makeController(["saved", "failed"]);

    controller.noteChange(true);
    await clock.advance(2_500);
    const savedAt = controller.getStatus().savedAt;
    expect(controller.getStatus().state).toBe("saved");
    expect(savedAt).not.toBeNull();

    controller.noteChange(true);
    await clock.advance(2_500);

    const status = controller.getStatus();
    expect(status.state).toBe("failed");
    // The stamp is the earlier, real success — never advanced by the failure.
    expect(status.savedAt).toBe(savedAt);
    expect(autosaveLabel(status)?.startsWith("Saved")).toBe(false);
  });

  it("retries a failed write on the longer backoff", async () => {
    const { controller, clock, save } = makeController(["failed", "saved"]);

    controller.noteChange(true);
    await clock.advance(2_500);
    expect(save).toHaveBeenCalledTimes(1);

    // Not on the idle timer…
    await clock.advance(2_500);
    expect(save).toHaveBeenCalledTimes(1);

    // …on the retry timer.
    await clock.advance(15_000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getStatus().state).toBe("saved");
  });

  it("lets fresh typing supersede the retry backoff", async () => {
    const { controller, clock, save } = makeController(["failed", "saved"]);

    controller.noteChange(true);
    await clock.advance(2_500);
    expect(controller.getStatus().state).toBe("failed");

    controller.noteChange(true);
    expect(controller.getStatus().state).toBe("unsaved");
    await clock.advance(2_500);

    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getStatus().state).toBe("saved");
  });
});

describe("createAutosaveController — nothing to write / someone else writing", () => {
  it("falls back to silence when the work turned out to be already gone", async () => {
    let dirty = true;
    const { controller, clock } = makeController(["skipped"], {
      hasWork: () => dirty,
    });

    controller.noteChange(true);
    // Between scheduling and firing, the values went back to the baseline.
    dirty = false;
    await clock.advance(2_500);

    expect(controller.getStatus()).toEqual(IDLE_STATUS);
  });

  it("falls back to the last saved time when the work turned out to be gone", async () => {
    let dirty = true;
    const { controller, clock } = makeController(["saved", "skipped"], {
      hasWork: () => dirty,
    });

    controller.noteChange(true);
    await clock.advance(2_500);
    const savedAt = controller.getStatus().savedAt;

    controller.noteChange(true);
    dirty = false;
    await clock.advance(2_500);

    expect(controller.getStatus()).toEqual({ state: "saved", savedAt });
  });

  /**
   * A save action can wave a write off deliberately (the `{ success: false,
   * errors: [] }` cancel sentinel). That must not turn the indicator red — but
   * it must not turn it green either, because the applicant's edits are still
   * only in the browser.
   */
  it("says 'unsaved', not 'saved', when a write is waved off with edits outstanding", async () => {
    const { controller, clock } = makeController(["saved", "skipped"], {
      hasWork: () => true,
    });

    controller.noteChange(true);
    await clock.advance(2_500);
    const savedAt = controller.getStatus().savedAt;
    expect(controller.getStatus().state).toBe("saved");

    controller.noteChange(true);
    await clock.advance(2_500);

    const status = controller.getStatus();
    expect(status.state).toBe("unsaved");
    expect(status.savedAt).toBe(savedAt); // the earlier real success stands
    expect(autosaveLabel(status)).toBe("Unsaved changes");
    // Not a failure: no red, and no retry storm — the next edit brings us back.
    expect(clock.pendingCount()).toBe(0);
  });

  it("reschedules rather than colliding with a manual save in flight", async () => {
    const { controller, clock, save } = makeController(["deferred", "saved"]);

    controller.noteChange(true);
    await clock.advance(2_500);

    expect(save).toHaveBeenCalledTimes(1);
    // Still outstanding — and honest about it.
    expect(controller.getStatus().state).toBe("unsaved");

    await clock.advance(2_500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getStatus().state).toBe("saved");
  });
});

describe("createAutosaveController — markSaved (manual / guard saves)", () => {
  it("adopts an external save and drops the pending autosave", async () => {
    const { controller, clock, save } = makeController(["saved"]);

    controller.noteChange(true);
    controller.markSaved(50_000);

    expect(controller.getStatus()).toEqual({ state: "saved", savedAt: 50_000 });
    await clock.advance(10_000);
    // The Save-and-Continue write already covered these values.
    expect(save).not.toHaveBeenCalled();
  });
});

describe("autosave presentation", () => {
  it("says nothing at all before anything has happened", () => {
    expect(autosaveLabel(IDLE_STATUS)).toBeNull();
    expect(autosaveAnnouncement(IDLE_STATUS)).toBe("");
  });

  it("formats the saved time as local HH:MM", () => {
    // Constructed in local time, so the assertion holds in any timezone.
    const at = new Date(2026, 7, 14, 9, 5).getTime();
    expect(formatClockTime(at)).toBe("09:05");
    expect(autosaveLabel({ state: "saved", savedAt: at })).toBe("Saved 09:05");
  });

  it("never labels a non-saved state as saved", () => {
    const at = new Date(2026, 7, 14, 16, 40).getTime();
    for (const status of [
      { state: "unsaved", savedAt: null },
      { state: "unsaved", savedAt: at },
      { state: "saving", savedAt: at },
      { state: "failed", savedAt: null },
      { state: "failed", savedAt: at },
    ] as AutosaveStatus[]) {
      expect(autosaveLabel(status)?.startsWith("Saved")).toBe(false);
    }
  });

  it("announces only the outcomes, so typing is not narrated", () => {
    const at = new Date(2026, 7, 14, 16, 40).getTime();
    expect(autosaveAnnouncement({ state: "unsaved", savedAt: at })).toBe("");
    expect(autosaveAnnouncement({ state: "saving", savedAt: at })).toBe("");
    expect(autosaveAnnouncement({ state: "saved", savedAt: at })).toBe(
      "Saved 16:40"
    );
    expect(autosaveAnnouncement({ state: "failed", savedAt: at })).toBe(
      "Not saved since 16:40 — we'll keep trying"
    );
  });
});
