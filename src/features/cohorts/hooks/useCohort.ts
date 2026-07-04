"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CohortDoc } from "@/core/types";

export function useCohort(cohortId: string | undefined) {
  const [state, setState] = useState<{ cohort: CohortDoc | null; loading: boolean }>({
    cohort: null,
    loading: true,
  });

  useEffect(() => {
    if (!cohortId) return;
    const unsubscribe = onSnapshot(doc(db, "cohorts", cohortId), (snap) => {
      setState({
        cohort: snap.exists() ? ({ id: snap.id, ...snap.data() } as CohortDoc) : null,
        loading: false,
      });
    });
    return unsubscribe;
  }, [cohortId]);

  if (!cohortId) return { cohort: null, loading: false };
  return state;
}
