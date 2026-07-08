"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FinanceEntryDoc } from "@/core/types";

export function useFinanceEntries(startupId: string | undefined) {
  const [state, setState] = useState<{ entries: FinanceEntryDoc[]; loading: boolean }>({
    entries: [],
    loading: true,
  });
  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "financeEntries"), where("startupId", "==", startupId));
    return onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as FinanceEntryDoc)
          .sort((a, b) => (b.occurredAt?.toMillis() ?? 0) - (a.occurredAt?.toMillis() ?? 0));
        setState({ entries, loading: false });
      },
      (e) => {
        console.error("finance listener", e);
        setState({ entries: [], loading: false });
      },
    );
  }, [startupId]);
  if (!startupId) return { entries: [], loading: false };
  return state;
}
