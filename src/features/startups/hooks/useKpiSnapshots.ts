"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { KpiSnapshotDoc } from "@/core/types";

/** Append-only KPI snapshots for a startup, oldest first (baseline leads). */
export function useKpiSnapshots(startupId: string | undefined) {
  const [state, setState] = useState<{ snapshots: KpiSnapshotDoc[]; loading: boolean }>({
    snapshots: [],
    loading: true,
  });

  useEffect(() => {
    if (!startupId) return;
    const q = query(
      collection(db, "startups", startupId, "kpiSnapshots"),
      orderBy("capturedAt", "asc"),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setState({
        snapshots: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as KpiSnapshotDoc),
        loading: false,
      });
    });
    return unsubscribe;
  }, [startupId]);

  if (!startupId) return { snapshots: [], loading: false };
  return state;
}
