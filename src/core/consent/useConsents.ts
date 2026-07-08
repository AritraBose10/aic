"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ConsentDoc } from "@/core/types";

/** Consent records owned by a startup, keyed for lookup by `${contactId}_${purpose}`. */
export function useConsents(startupId: string | undefined) {
  const [state, setState] = useState<{ byId: Record<string, ConsentDoc>; loading: boolean }>({
    byId: {},
    loading: true,
  });

  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "consents"), where("startupId", "==", startupId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const byId: Record<string, ConsentDoc> = {};
        snap.docs.forEach((d) => (byId[d.id] = { id: d.id, ...d.data() } as ConsentDoc));
        setState({ byId, loading: false });
      },
      (error) => {
        console.error("consents listener error", error);
        setState({ byId: {}, loading: false });
      },
    );
    return unsubscribe;
  }, [startupId]);

  return state;
}
