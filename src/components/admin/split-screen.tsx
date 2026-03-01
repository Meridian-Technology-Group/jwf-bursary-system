"use client";

/**
 * Split-screen layout for the assessment workspace.
 *
 * Desktop: Two resizable panels side-by-side with a drag handle.
 * Mobile: Tab-based view (Documents / Assessment).
 *
 * Panel ratio persisted in localStorage.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "jwf:split-screen-ratio";
const MIN_WIDTH = 380; // px — minimum width per panel
const DEFAULT_RATIO = 0.5;

interface SplitScreenProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  className?: string;
}

export function SplitScreen({ leftPanel, rightPanel, className }: SplitScreenProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = React.useState<number>(DEFAULT_RATIO);
  const [isDragging, setIsDragging] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<"documents" | "assessment">(
    "documents"
  );
  const [mounted, setMounted] = React.useState(false);

  // Read persisted ratio from localStorage after mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= 0.2 && parsed <= 0.8) {
          setRatio(parsed);
        }
      }
    } catch {
      // localStorage not available (SSR safety)
    }
    setMounted(true);
  }, []);

  // Persist ratio
  const persistRatio = React.useCallback((r: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(r));
    } catch {
      // ignore
    }
  }, []);

  // ─── Drag handle logic ────────────────────────────────────────────────────

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const container = containerRef.current;
      if (!container) return;

      const startX = e.clientX;
      const containerWidth = container.getBoundingClientRect().width;
      const startRatio = ratio;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newRatio = startRatio + delta / containerWidth;

        // Enforce min-width constraints
        const minRatio = MIN_WIDTH / containerWidth;
        const maxRatio = 1 - minRatio;
        const clamped = Math.min(maxRatio, Math.max(minRatio, newRatio));

        setRatio(clamped);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        // Persist after drag ends
        setRatio((r) => {
          persistRatio(r);
          return r;
        });
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [ratio, persistRatio]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const STEP = 0.05;
      if (e.key === "ArrowLeft") {
        setRatio((r) => {
          const next = Math.max(0.2, r - STEP);
          persistRatio(next);
          return next;
        });
      } else if (e.key === "ArrowRight") {
        setRatio((r) => {
          const next = Math.min(0.8, r + STEP);
          persistRatio(next);
          return next;
        });
      }
    },
    [persistRatio]
  );

  if (!mounted) {
    // Avoid hydration mismatch — render minimal placeholder
    return (
      <div className={cn("h-full w-full", className)}>
        <div className="hidden md:flex h-full w-full" />
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full", className)}>
      {/* ─── Mobile: Tab switcher ─────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col h-full">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setMobileTab("documents")}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              mobileTab === "documents"
                ? "border-primary-700 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            Documents
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("assessment")}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
              mobileTab === "assessment"
                ? "border-primary-700 text-primary-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            Assessment
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto">
          {mobileTab === "documents" ? leftPanel : rightPanel}
        </div>
      </div>

      {/* ─── Desktop: Side-by-side with drag handle ───────────────────────── */}
      <div
        ref={containerRef}
        className={cn(
          "hidden md:flex h-full w-full overflow-hidden",
          isDragging && "select-none cursor-col-resize"
        )}
      >
        {/* Left panel */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${ratio * 100}%`, minWidth: MIN_WIDTH }}
        >
          <div className="h-full overflow-auto">{leftPanel}</div>
        </div>

        {/* Drag handle */}
        <div
          role="separator"
          aria-label="Resize panels"
          aria-orientation="vertical"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onKeyDown={handleKeyDown}
          className={cn(
            "relative z-10 flex w-2 shrink-0 cursor-col-resize flex-col items-center justify-center",
            "bg-neutral-200 hover:bg-accent-600 transition-colors",
            isDragging && "bg-accent-600"
          )}
        >
          {/* Visual indicator dots */}
          <div className="flex flex-col gap-1 pointer-events-none">
            <div className="h-1 w-1 rounded-full bg-neutral-400" />
            <div className="h-1 w-1 rounded-full bg-neutral-400" />
            <div className="h-1 w-1 rounded-full bg-neutral-400" />
          </div>
        </div>

        {/* Right panel */}
        <div
          className="flex flex-col overflow-hidden flex-1"
          style={{ minWidth: MIN_WIDTH }}
        >
          <div className="h-full overflow-auto">{rightPanel}</div>
        </div>
      </div>
    </div>
  );
}
