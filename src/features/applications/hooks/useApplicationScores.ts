"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationScoreDoc } from "@/core/types";

/**
 * All score docs for an application — staff-only read (rules deny founders).
 * Used by the committee review card.
 */
export function useApplicationScores(applicationId: string | undefined) {
  const [state, setState] = useState<{ scores: ApplicationScoreDoc[]; loading: boolean }>({
    scores: [],
    loading: true,
  });

  useEffect(() => {
    if (!applicationId) return;
    const unsubscribe = onSnapshot(
      collection(db, "applications", applicationId, "scores"),
      (snap) => {
        setState({
          scores: snap.docs.map((d) => d.data() as ApplicationScoreDoc),
          loading: false,
        });
      },
    );
    return unsubscribe;
  }, [applicationId]);

  if (!applicationId) return { scores: [], loading: false };
  return state;
}
