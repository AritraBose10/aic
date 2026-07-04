"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDoc } from "@/core/types";

/** Approved evaluators — for staff building an assignment list. */
export function useEvaluators() {
  const [evaluators, setEvaluators] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "evaluator"),
      where("approvalStatus", "==", "approved"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setEvaluators(snap.docs.map((d) => d.data() as UserDoc));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { evaluators, loading };
}
