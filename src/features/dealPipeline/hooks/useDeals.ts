"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DealEntryDoc, Role } from "@/core/types";

export function useDeals(viewer: { uid: string; role: Role } | undefined) {
  const [deals, setDeals] = useState<DealEntryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const uid = viewer?.uid;
  const role = viewer?.role;
  useEffect(() => {
    if (!uid || !role) return;
    const base = collection(db, "dealEntries");
    let q: Query = base;
    if (role === "investor") q = query(base, where("investorUid", "==", uid));
    else if (role === "founder") q = query(base, where("founderId", "==", uid));
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
  }, [uid, role]);
  return { deals, loading };
}
