/**
 * `@stepper` slot — Review route.
 *
 * Matches `/apply/review` for the parallel `@stepper` slot. Review is a
 * navigable waypoint in the stepper (its synthetic entry highlights as active),
 * so it needs the same data as the section pages. Shares `loadRailStepper()`
 * with `@stepper/apply/[section]/page.tsx` so there is a single fetch source.
 */

import { RailStepper } from "@/components/portal/rail-stepper";
import { loadRailStepper } from "@/lib/portal/rail-stepper-data";

export default async function StepperReviewSlot() {
  const data = await loadRailStepper();
  if (!data) return null;
  return <RailStepper sections={data.sections} roundName={data.roundName} />;
}
