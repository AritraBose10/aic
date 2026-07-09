"use client";

import { useEffect } from "react";
import { logClientError } from "@/core/monitoring";

/** Root error boundary (catches errors in the root layout) — NFR-12. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientError(error, "global-error-boundary");
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ color: "#666", fontSize: "0.875rem", marginTop: "0.5rem" }}>The error has been logged.</p>
          <button onClick={reset} style={{ marginTop: "1rem", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #ccc", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
