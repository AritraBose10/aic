"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { IpCaseDoc } from "@/core/types";

/**
 * IP companion docs, keyed by ticketId. Founders pass their uid (own cases);
 * staff pass nothing to read all (rules allow staff).
 */
export function useIpCases(founderUid?: string) {
  const [state, setState] = useState<{ byTicketId: Record<string, IpCaseDoc>; loading: boolean }>({
    byTicketId: {},
    loading: true,
  });

  useEffect(() => {
    const base = collection(db, "ipCases");
    const q = founderUid ? query(base, where("founderId", "==", founderUid)) : query(base);
    return onSnapshot(
      q,
      (snap) => {
        const byTicketId: Record<string, IpCaseDoc> = {};
        snap.docs.forEach((d) => (byTicketId[d.id] = { id: d.id, ...d.data() } as IpCaseDoc));
        setState({ byTicketId, loading: false });
      },
      (e) => {
        console.error("ipCases listener", e);
        setState({ byTicketId: {}, loading: false });
      },
    );
  }, [founderUid]);

  return state;
}
