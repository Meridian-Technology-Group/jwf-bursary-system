import { beforeEach, describe, expect, it, vi } from "vitest";

// `next/navigation`'s useRouter is mocked so the test exercises the same router
// surface SectionForm consumes (`useRouter()` → { refresh, push }). This repo
// has no jsdom/RTL, so we drive the extracted post-save side-effect directly
// rather than rendering the component — same convention as the other
// component __tests__ (earner-form, lifecycle-badges), which unit-test the
// pure logic lifted out of the component.
const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

import { useRouter } from "next/navigation";
import { navigateAfterSave } from "../section-form";

describe("navigateAfterSave — refresh-then-push after a successful save (PR-1, #5/#4)", () => {
  beforeEach(() => {
    refresh.mockClear();
    push.mockClear();
  });

  it("calls router.refresh() then router.push(nextHref) on a successful onSave", () => {
    const router = useRouter();

    navigateAfterSave(router, "/apply/household");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/apply/household");

    // Order matters: refresh must re-run the server layout (picking up the
    // revalidated gap data) before the soft navigation. Assert refresh's
    // invocation precedes push's via vitest's global call ordering.
    const refreshOrder = refresh.mock.invocationCallOrder[0];
    const pushOrder = push.mock.invocationCallOrder[0];
    expect(refreshOrder).toBeLessThan(pushOrder);
  });

  it("still refreshes when there is no next section (final/last section)", () => {
    const router = useRouter();

    navigateAfterSave(router, undefined);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });
});
