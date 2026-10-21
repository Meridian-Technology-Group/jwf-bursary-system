import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getSectionGapStatuses } from "../section-gaps";
import type { Tx } from "@/lib/db/prisma";

function fakeTx(isComplete: boolean) {
  return {
    applicationSection: {
      findMany: vi.fn(async () => [
        { section: "OTHER_INFO", data: {}, isComplete },
      ]),
    },
    document: { findMany: vi.fn(async () => []) },
  } as unknown as Tx;
}

describe("getSectionGapStatuses — progress (21 Oct 2026)", () => {
  it("counts the form item only once the section has its green tick", async () => {
    const ticked = (await getSectionGapStatuses(fakeTx(true), "app-1")).find(
      (s) => s.sectionType === "OTHER_INFO"
    )!;
    const unticked = (await getSectionGapStatuses(fakeTx(false), "app-1")).find(
      (s) => s.sectionType === "OTHER_INFO"
    )!;

    expect(unticked.progress.total).toBe(ticked.progress.total);
    expect(unticked.progress.satisfied).toBe(ticked.progress.satisfied - 1);
  });

  it("leaves a section that was never started at zero", async () => {
    const statuses = await getSectionGapStatuses(fakeTx(true), "app-1");
    const notStarted = statuses.find((s) => s.sectionType === "CHILD_DETAILS")!;
    expect(notStarted.isStarted).toBe(false);
    expect(notStarted.progress.satisfied).toBe(0);
  });
});
