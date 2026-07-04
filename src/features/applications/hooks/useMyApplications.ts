"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationDoc } from "@/core/types";

/**
 * Sorted client-side (not via Firestore orderBy) so this doesn't require a
 * composite index alongside the founderId equality filter.
 */
export function useMyApplications(founderUid: string | undefined) {
  const [state, setState] = useState<{ applications: ApplicationDoc[]; loading: boolean }>({
    applications: [],
    loading: true,
  });

  useEffect(() => {
    if (!founderUid) return;
    const q = query(collection(db, "applications"), where("founderId", "==", founderUid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const applications = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ApplicationDoc)
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setState({ applications, loading: false });
    });
    return unsubscribe;
  }, [founderUid]);

  if (!founderUid) return { applications: [], loading: false };
  return state;
}
