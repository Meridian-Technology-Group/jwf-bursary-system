/**
 * `@stepper` slot — wizard section route.
 *
 * Matches `/apply/[section]` for the parallel `@stepper` slot. This is one of
 * the two places the section-stepper gap data is fetched after the PR-7 shell
 * split (the other is the `review` slot page); both share `loadRailStepper()`.
 * The fetch runs ONLY on `/apply/*` because this slot only matches there — on
 * every other portal route the slot resolves to `default.tsx` → null.
 *
 * The output renders in the persistent rail (under "My Application"), NOT in the
 * page content column, because the layout places the `stepper` slot prop inside
 * the rail. `router.refresh()` (PR-1) re-executes this async body, keeping the
 * stepper live after a save.
 */

import { RailStepper } from "@/components/portal/rail-stepper";
import { loadRailStepper } from "@/lib/portal/rail-stepper-data";

export default async function StepperSectionSlot() {
  const data = await loadRailStepper();
  if (!data) return null;
  return <RailStepper sections={data.sections} roundName={data.roundName} />;
}
