"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CohortDoc } from "@/core/types";

/** All cohorts, newest first — for staff managing the pipeline. */
export function useCohorts() {
  const [cohorts, setCohorts] = useState<CohortDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "cohorts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CohortDoc));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { cohorts, loading };
}

/** Only cohorts currently open for applications — for founders browsing. */
export function useOpenCohorts() {
  const [cohorts, setCohorts] = useState<CohortDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "cohorts"), where("status", "==", "open"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCohorts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CohortDoc));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { cohorts, loading };
}
