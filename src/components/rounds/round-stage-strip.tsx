/**
 * RoundStageStrip — the 7-node lifecycle strip for the Round Cockpit (#18).
 *
 * A horizontal status instrument (NOT navigation): Setup → Invitations Sent →
 * Submissions Open → Assessment → Decision → Export → Closed. Each node renders
 * a marker reflecting its `state` and a label beneath, joined by connectors.
 *
 * Pure presentational Server Component — no hooks, no `"use client"`. State is
 * conveyed both visually and via per-node `aria-label`s so screen readers get
 * the same read sighted users do.
 *
 * States:
 *   not_yet  → hollow slate ring (upcoming, nothing happened yet)
 *   live     → gold-filled (the active stage)
 *   complete → navy-filled with a check (done)
 *   blocked  → amber ring + alert glyph (a watchlist rule lights this stage)
 */

import { Check, AlertTriangle } from "lucide-react";
import type { StageNode, StageState } from "@/lib/db/queries/round-cockpit";
import { cn } from "@/lib/utils";

interface RoundStageStripProps {
  stages: StageNode[];
}

const STATE_WORD: Record<StageState, string> = {
  not_yet: "not started",
  live: "in progress",
  complete: "complete",
  blocked: "needs attention",
};

const markerStyles: Record<StageState, string> = {
  not_yet: "border-2 border-slate-300 bg-white text-transparent",
  live: "border-2 border-accent-600 bg-accent-600 text-white shadow-sm ring-4 ring-accent-100",
  complete: "border-2 border-primary-900 bg-primary-900 text-white",
  blocked: "border-2 border-amber-500 bg-amber-50 text-amber-600 ring-4 ring-amber-100",
};

const labelStyles: Record<StageState, string> = {
  not_yet: "text-slate-400",
  live: "text-accent-700 font-semibold",
  complete: "text-primary-900 font-medium",
  blocked: "text-amber-700 font-semibold",
};

const connectorStyles: Record<StageState, string> = {
  not_yet: "bg-slate-200",
  live: "bg-accent-400",
  complete: "bg-primary-900",
  blocked: "bg-amber-300",
};

function StageMarker({ state }: { state: StageState }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        markerStyles[state],
      )}
      aria-hidden="true"
    >
      {state === "complete" && <Check className="h-4 w-4" strokeWidth={3} />}
      {state === "blocked" && <AlertTriangle className="h-4 w-4" />}
      {state === "live" && (
        <span className="h-2 w-2 rounded-full bg-white" />
      )}
    </span>
  );
}

export function RoundStageStrip({ stages }: RoundStageStripProps) {
  if (stages.length === 0) return null;

  return (
    <ol
      className="flex w-full items-start overflow-x-auto"
      aria-label="Round lifecycle progress"
    >
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        // The connector before each node (except the first) reflects the
        // *previous* node's state — a completed segment reads as "navy bridge".
        const prevState = index > 0 ? stages[index - 1].state : null;

        return (
          <li
            key={stage.key}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            {/* Marker row: leading connector · marker · trailing connector */}
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index === 0
                    ? "bg-transparent"
                    : connectorStyles[prevState ?? "not_yet"],
                )}
                aria-hidden="true"
              />
              <StageMarker state={stage.state} />
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  isLast ? "bg-transparent" : connectorStyles[stage.state],
                )}
                aria-hidden="true"
              />
            </div>

            {/* Label */}
            <span
              className={cn(
                "mt-2 px-1 text-center text-xs leading-tight",
                labelStyles[stage.state],
              )}
            >
              <span className="sr-only">Stage: </span>
              {stage.label}
              <span className="sr-only"> — {STATE_WORD[stage.state]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
