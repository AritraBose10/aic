"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MasterEntryDoc, MasterType } from "@/core/types";

/**
 * Master entries of a given type. `includeInactive` (admin screens) returns all;
 * the default returns only active options for pickers. Sorted client-side by
 * `order` then label to avoid a composite index alongside the type filter.
 */
export function useMasters(type: MasterType, includeInactive = false) {
  const [state, setState] = useState<{ entries: MasterEntryDoc[]; loading: boolean }>({
    entries: [],
    loading: true,
  });

  useEffect(() => {
    const q = query(collection(db, "masters"), where("type", "==", type));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const entries = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MasterEntryDoc)
          .filter((e) => includeInactive || e.active)
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
        setState({ entries, loading: false });
      },
      (error) => {
        console.error("masters listener error", error);
        setState({ entries: [], loading: false });
      },
    );
    return unsubscribe;
  }, [type, includeInactive]);

  return state;
}
