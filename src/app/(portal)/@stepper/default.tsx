/**
 * Default render for the `@stepper` parallel slot.
 *
 * App Router renders a parallel slot's `default.tsx` for any route the slot has
 * no explicit match for. WITHOUT this file, hard-navigating to a non-`/apply`
 * portal route (`/`, `/status`, `/history`, `/documents`, `/help`, …) would
 * 404 the unmatched slot. So this MUST exist and render nothing — off the
 * wizard the persistent rail is nav-only (no stepper, no gap fetch).
 *
 * This is the first parallel route in the app; see the implementation plan
 * §2.2 / §5 risk register.
 */
export default function StepperDefault() {
  return null;
}
