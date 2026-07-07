"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationDoc, StartupDoc } from "@/core/types";

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
