"use client";

/**
 * React error boundary component.
 *
 * Catches runtime errors in its child tree and renders a clean error card
 * with a "Try again" reset button.
 */

import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Receives error and reset function. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Optional extra className for the error card wrapper */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Default error card ───────────────────────────────────────────────────────

function DefaultErrorCard({
  error,
  reset,
  className,
}: {
  error: Error;
  reset: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-error-200 bg-error-50 px-6 py-10 text-center",
        className
      )}
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-200">
        <AlertTriangle className="h-6 w-6 text-error-600" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="max-w-sm text-sm text-slate-500">
          An unexpected error occurred. Please try again. If the problem
          persists, contact support.
        </p>
      </div>

      {/* Show error message in development */}
      {process.env.NODE_ENV === "development" && (
        <pre className="max-w-full overflow-auto rounded bg-slate-100 px-3 py-2 text-left text-xs text-slate-600">
          {error.message}
        </pre>
      )}

      <button
        onClick={reset}
        className={cn(
          "rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white",
          "hover:bg-primary-800 transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ─── Error Boundary class component ──────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // In production this would send to an error tracking service
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <DefaultErrorCard
          error={this.state.error}
          reset={this.reset}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
