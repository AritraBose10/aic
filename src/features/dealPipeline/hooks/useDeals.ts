"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DealEntryDoc, Role } from "@/core/types";

export function useDeals(viewer: { uid: string; role: Role } | undefined) {
  const [deals, setDeals] = useState<DealEntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!viewer) return;
    const base = collection(db, "dealEntries");
    let q: Query = base;
    if (viewer.role === "investor") q = query(base, where("investorUid", "==", viewer.uid));
    else if (viewer.role === "founder") q = query(base, where("founderId", "==", viewer.uid));
    // staff: unconstrained (rules allow)
    return onSnapshot(
      q,
      (snap) => {
        setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DealEntryDoc));
        setLoading(false);
      },
      (e) => {
        console.error("dealEntries listener", e);
        setDeals([]);
        setLoading(false);
      },
    );
  }, [viewer?.uid, viewer?.role]);
  return { deals, loading };
}
