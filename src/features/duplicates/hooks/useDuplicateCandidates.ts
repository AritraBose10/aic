"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DuplicateCandidateDoc } from "@/core/types";

export function useDuplicateCandidates() {
  const [candidates, setCandidates] = useState<DuplicateCandidateDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "duplicateCandidates"), where("status", "==", "open"));
    return onSnapshot(
      q,
      (snap) => {
        setCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DuplicateCandidateDoc));
        setLoading(false);
      },
      (e) => {
        console.error("duplicateCandidates listener", e);
        setCandidates([]);
        setLoading(false);
      },
    );
  }, []);
  return { candidates, loading };
}
