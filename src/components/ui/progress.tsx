/**
 * Progress — a simple div-based progress bar matching shadcn's API surface.
 *
 * Intentionally does NOT depend on `@radix-ui/react-progress` (not installed);
 * it is a track div with an indicator div translated horizontally by `value`.
 * Exposes `value` (0–100) + `className` and forwards a ref to the track.
 */

import * as React from "react"

import { cn } from "@/lib/utils"

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Completion percentage, 0–100. Clamped to that range. Defaults to 0. */
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
          className
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
