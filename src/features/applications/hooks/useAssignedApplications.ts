"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationDoc } from "@/core/types";

/** Applications assigned to this evaluator, sorted client-side. */
export function useAssignedApplications(evaluatorUid: string | undefined) {
  const [state, setState] = useState<{ applications: ApplicationDoc[]; loading: boolean }>({
    applications: [],
    loading: true,
  });

  useEffect(() => {
    if (!evaluatorUid) return;
    const q = query(
      collection(db, "applications"),
      where("evaluatorIds", "array-contains", evaluatorUid),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const applications = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ApplicationDoc)
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      setState({ applications, loading: false });
    });
    return unsubscribe;
  }, [evaluatorUid]);

  if (!evaluatorUid) return { applications: [], loading: false };
  return state;
}
