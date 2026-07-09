"use client";

import { useEffect } from "react";
import { logClientError } from "@/core/monitoring";

/** Route-segment error boundary (NFR-12) — logs then offers recovery. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientError(error, "route-error-boundary");
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        The error has been logged. You can try again, or head back to your dashboard.
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          Try again
        </button>
        <a href="/dashboard" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          Dashboard
        </a>
      </div>
    </div>
  );
}
