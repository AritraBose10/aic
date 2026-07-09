"use client";

import { useEffect } from "react";
import { logClientError } from "@/core/monitoring";

/** Captures uncaught errors + unhandled promise rejections app-wide (NFR-12). */
export function ErrorMonitor() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => logClientError(e.error ?? e.message, "window.error");
    const onRejection = (e: PromiseRejectionEvent) => logClientError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
