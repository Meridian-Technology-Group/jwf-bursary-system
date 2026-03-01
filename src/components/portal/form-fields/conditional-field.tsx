"use client";

/**
 * ConditionalField — shows/hides children based on a condition.
 *
 * Uses CSS grid-template-rows transition for a smooth height animation
 * (200ms ease). Sets aria-hidden when collapsed so assistive technology
 * ignores the hidden content.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface ConditionalFieldProps {
  /** When true, content is visible */
  show: boolean;
  /** Content to show/hide */
  children: React.ReactNode;
  /** Extra classes on the outer container */
  className?: string;
}

export function ConditionalField({
  show,
  children,
  className,
}: ConditionalFieldProps) {
  return (
    <div
      aria-hidden={!show}
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-in-out",
        show ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
    >
      {/* Inner wrapper: overflow-hidden clips the content when grid-row is 0fr */}
      <div className="overflow-hidden">
        <div className={cn("space-y-4 pt-2", !show && "pointer-events-none")}>
          {children}
        </div>
      </div>
    </div>
  );
}
