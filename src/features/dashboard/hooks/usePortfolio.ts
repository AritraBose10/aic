"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationDoc, OpsSummaryDoc, StartupDoc } from "@/core/types";

/**
 * All applications across every cohort — staff-only read (rules short-circuit
 * on isStaff(), so the unfiltered query is permitted). Sorted client-side.
 */
export function useAllApplications() {
  const [state, setState] = useState<{ applications: ApplicationDoc[]; loading: boolean }>({
    applications: [],
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "applications"),
      (snap) => {
        const applications = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ApplicationDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ applications, loading: false });
      },
      (error) => {
        console.error("portfolio applications listener error", error);
        setState({ applications: [], loading: false });
      },
    );
    return unsubscribe;
  }, []);

  return state;
}

/** All startups — staff-only read. Used for the incubatee portfolio view. */
export function useAllStartups() {
  const [state, setState] = useState<{ startups: StartupDoc[]; loading: boolean }>({
    startups: [],
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "startups"),
      (snap) => {
        setState({
          startups: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StartupDoc),
          loading: false,
        });
      },
      (error) => {
        console.error("portfolio startups listener error", error);
        setState({ startups: [], loading: false });
      },
    );
    return unsubscribe;
  }, []);

  return state;
}

/**
 * Per-startup ops rollups (OPS-06) — staff read the aggregated summary here,
 * never the raw CRM/finance rows. Write-side lives in features/crm + accounting.
 */
export function useAllOpsSummaries() {
  const [state, setState] = useState<{ summaries: OpsSummaryDoc[]; loading: boolean }>({
    summaries: [],
    loading: true,
  });
  useEffect(() => {
    return onSnapshot(
      collection(db, "opsSummary"),
      (snap) => {
        setState({
          summaries: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OpsSummaryDoc),
          loading: false,
        });
      },
      (error) => {
        console.error("opsSummary listener error", error);
        setState({ summaries: [], loading: false });
      },
    );
  }, []);
  return state;
}
