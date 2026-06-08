import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PortalPage — the per-page readable-width cap for the parent portal.
 *
 * The portal root layout (`(portal)/layout.tsx`) intentionally NO LONGER hard-
 * caps content at `max-w-3xl`. It now opens its envelope to `max-w-4xl` so the
 * grid-heavy Parents' Income section can run that wide INSIDE its own card,
 * without a fixed-rem content breakout (the source of the overflow defect this
 * replaces). Because the root no longer caps, every page must re-establish its
 * own readable width — otherwise it would silently widen from 48rem to 56rem.
 *
 * Wrap each non-apply portal page's content in <PortalPage> to keep it at the
 * historical `max-w-3xl` (48rem). The apply wizard handles its own widths: the
 * apply segment opens to `max-w-4xl`, and each section's CARD re-caps itself
 * (Income → max-w-4xl, every other section → max-w-3xl).
 *
 * Width is bounded by the available space, never a fixed +rem: the cap is
 * `mx-auto w-full max-w-3xl` inside the layout's padded <main>, so the rendered
 * width is min(48rem, viewport − 280px rail − padding) and can never induce
 * horizontal scroll at any breakpoint.
 */
export function PortalPage({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)} {...rest}>
      {children}
    </div>
  );
}
