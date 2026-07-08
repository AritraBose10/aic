"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type Query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PitchEventDoc, Role } from "@/core/types";

/**
 * Events scoped by the viewer's role. Non-staff MUST query a constrained set
 * (array-contains their uid) or Firestore rejects the whole listener — staff
 * short-circuit and read all. Mirrors the deny-by-default read rule.
 */
export function usePitchEvents(viewer: { uid: string; role: Role } | undefined) {
  const [events, setEvents] = useState<PitchEventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!viewer) return;
    const base = collection(db, "pitchEvents");
    let q: Query = base;
    if (viewer.role === "investor") q = query(base, where("investorUids", "array-contains", viewer.uid));
    else if (viewer.role === "founder") q = query(base, where("shortlistFounderIds", "array-contains", viewer.uid));
    // staff: unconstrained (rules allow)
    return onSnapshot(
      q,
      (snap) => {
        setEvents(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as PitchEventDoc)
            .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0)),
        );
        setLoading(false);
      },
      (e) => {
        console.error("pitchEvents listener", e);
        setEvents([]);
        setLoading(false);
      },
    );
  }, [viewer?.uid, viewer?.role]);
  return { events, loading };
}
