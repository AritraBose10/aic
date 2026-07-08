"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DataRoomAccessLogDoc, DataRoomRequestDoc } from "@/core/types";

/** Requests to a founder's startup (founder view) or an investor's own requests. */
export function useDataRoomRequests(opts: { founderId?: string; investorUid?: string }) {
  const [requests, setRequests] = useState<DataRoomRequestDoc[]>([]);
  useEffect(() => {
    const base = collection(db, "dataRoomRequests");
    const q = opts.founderId
      ? query(base, where("founderId", "==", opts.founderId))
      : opts.investorUid
        ? query(base, where("investorUid", "==", opts.investorUid))
        : null;
    if (!q) return;
    return onSnapshot(
      q,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DataRoomRequestDoc)),
      (e) => console.error("dataRoomRequests listener", e),
    );
  }, [opts.founderId, opts.investorUid]);
  return requests;
}

export function useDataRoomAccessLog(founderId: string | undefined) {
  const [log, setLog] = useState<DataRoomAccessLogDoc[]>([]);
  useEffect(() => {
    if (!founderId) return;
    const q = query(collection(db, "dataRoomAccessLog"), where("founderId", "==", founderId));
    return onSnapshot(
      q,
      (snap) => setLog(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DataRoomAccessLogDoc)),
      (e) => console.error("dataRoomAccessLog listener", e),
    );
  }, [founderId]);
  return log;
}
