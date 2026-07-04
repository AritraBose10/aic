"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StartupDoc } from "@/core/types";

/**
 * A founder owns at most one startup profile in Phase 1.
 * Returns null (not undefined) once loaded if no profile exists yet.
 */
export function useMyStartup(founderUid: string | undefined) {
  const [state, setState] = useState<{ startup: StartupDoc | null; loading: boolean }>({
    startup: null,
    loading: true,
  });

  useEffect(() => {
    if (!founderUid) return;
    const q = query(collection(db, "startups"), where("founderId", "==", founderUid));
    const unsubscribe = onSnapshot(q, (snap) => {
      // createStartup enforces one-per-founder, but if a duplicate ever slips
      // through, pick the earliest deterministically (client-sort avoids a
      // composite index on founderId + createdAt).
      const startups = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as StartupDoc)
        .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
      setState({ startup: startups[0] ?? null, loading: false });
    });
    return unsubscribe;
  }, [founderUid]);

  if (!founderUid) return { startup: null, loading: false };
  return state;
}
