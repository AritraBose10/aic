"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdoptionWorkspaceDoc } from "@/core/types";

export function useAdoptionWorkspaces(opts: { founderId?: string; adopterUid?: string }) {
  const [workspaces, setWorkspaces] = useState<AdoptionWorkspaceDoc[]>([]);
  useEffect(() => {
    const base = collection(db, "adoptionWorkspaces");
    const q = opts.founderId ? query(base, where("founderId", "==", opts.founderId))
      : opts.adopterUid ? query(base, where("adopterUid", "==", opts.adopterUid)) : null;
    if (!q) return;
    return onSnapshot(q, (snap) => setWorkspaces(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdoptionWorkspaceDoc)),
      (e) => console.error("adoptionWorkspaces listener", e));
  }, [opts.founderId, opts.adopterUid]);
  return workspaces;
}
