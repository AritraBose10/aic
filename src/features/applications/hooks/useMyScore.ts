"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationScoreDoc } from "@/core/types";

/** This evaluator's own score doc for an application (or null if not yet scored). */
export function useMyScore(applicationId: string | undefined, evaluatorUid: string | undefined) {
  const [state, setState] = useState<{ score: ApplicationScoreDoc | null; loading: boolean }>({
    score: null,
    loading: true,
  });

  useEffect(() => {
    if (!applicationId || !evaluatorUid) return;
    const unsubscribe = onSnapshot(
      doc(db, "applications", applicationId, "scores", evaluatorUid),
      (snap) => {
        setState({ score: snap.exists() ? (snap.data() as ApplicationScoreDoc) : null, loading: false });
      },
    );
    return unsubscribe;
  }, [applicationId, evaluatorUid]);

  if (!applicationId || !evaluatorUid) return { score: null, loading: false };
  return state;
}
