import { describe, expect, it } from "vitest";

import { resolveDownloadBeat } from "../submission-flow";

/**
 * Epic 14 A5 (CG-13/LA-1) — the post-submit download beat.
 *
 * The matrix that matters: the bare `DOWNLOAD MY COPY` button exists ONLY in
 * the live post-submit flow; once downloaded, forfeited, or on a plain
 * revisit there is no download surface at all (and no explanation).
 */
describe("resolveDownloadBeat", () => {
  const base = {
    downloadedAt: null as string | null,
    flowApplicationId: null as string | null,
    applicationId: "app-1",
    downloadStarted: false,
  };

  it("offers during the live post-submit beat", () => {
    expect(
      resolveDownloadBeat({ ...base, flowApplicationId: "app-1" })
    ).toBe("offer");
  });

  it("shows only Continue once the download started this visit", () => {
    expect(
      resolveDownloadBeat({
        ...base,
        flowApplicationId: "app-1",
        downloadStarted: true,
      })
    ).toBe("continue");
  });

  it("hides everything on a plain revisit (no flow flag)", () => {
    expect(resolveDownloadBeat(base)).toBe("hidden");
  });

  it("hides everything once the server says the download was taken", () => {
    expect(
      resolveDownloadBeat({
        ...base,
        downloadedAt: "16 August 2026",
        // Even with a lingering flag the server truth wins.
        flowApplicationId: "app-1",
      })
    ).toBe("hidden");
  });

  it("does not offer for a different application's flag", () => {
    expect(
      resolveDownloadBeat({ ...base, flowApplicationId: "app-2" })
    ).toBe("hidden");
  });

  it("keeps Continue visible even after the server would have consumed the shot", () => {
    // The optimistic click flips to "continue"; the parent still needs a way
    // home even though downloadedAt will be set on the next server render.
    expect(
      resolveDownloadBeat({
        ...base,
        downloadedAt: "16 August 2026",
        downloadStarted: true,
      })
    ).toBe("continue");
  });
});
