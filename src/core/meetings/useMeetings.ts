"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MeetingDoc, MeetingKind } from "@/core/types";

interface MeetingFilter {
  kind?: MeetingKind;
  requesterId?: string;
  hostId?: string;
  startupId?: string;
}

/** Meetings matching a single-field filter, newest-first (client-sorted). */
export function useMeetings(filter: MeetingFilter) {
  const [state, setState] = useState<{ meetings: MeetingDoc[]; loading: boolean }>({
    meetings: [],
    loading: true,
  });

  const { kind, requesterId, hostId, startupId } = filter;

  useEffect(() => {
    const constraints = [];
    if (kind) constraints.push(where("kind", "==", kind));
    if (requesterId) constraints.push(where("requesterId", "==", requesterId));
    if (hostId) constraints.push(where("hostId", "==", hostId));
    if (startupId) constraints.push(where("startupId", "==", startupId));

    const unsubscribe = onSnapshot(
      query(collection(db, "meetings"), ...constraints),
      (snap) => {
        const meetings = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as MeetingDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ meetings, loading: false });
      },
      (error) => {
        console.error("meetings listener error", error);
        setState({ meetings: [], loading: false });
      },
    );
    return unsubscribe;
  }, [kind, requesterId, hostId, startupId]);

  return state;
}
