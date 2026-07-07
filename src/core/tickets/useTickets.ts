"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TicketDoc, TicketKind } from "@/core/types";

interface TicketFilter {
  kind?: TicketKind;
  requesterId?: string;
  providerId?: string;
  startupId?: string;
}

/**
 * Tickets matching a single-field filter (kind / requester / provider / startup),
 * sorted newest-first client-side. Staff pass no owner filter to see everything.
 */
export function useTickets(filter: TicketFilter) {
  const [state, setState] = useState<{ tickets: TicketDoc[]; loading: boolean }>({
    tickets: [],
    loading: true,
  });

  const { kind, requesterId, providerId, startupId } = filter;

  useEffect(() => {
    const constraints = [];
    if (kind) constraints.push(where("kind", "==", kind));
    if (requesterId) constraints.push(where("requesterId", "==", requesterId));
    if (providerId) constraints.push(where("providerId", "==", providerId));
    if (startupId) constraints.push(where("startupId", "==", startupId));

    const unsubscribe = onSnapshot(
      query(collection(db, "tickets"), ...constraints),
      (snap) => {
        const tickets = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TicketDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ tickets, loading: false });
      },
      (error) => {
        console.error("tickets listener error", error);
        setState({ tickets: [], loading: false });
      },
    );
    return unsubscribe;
  }, [kind, requesterId, providerId, startupId]);

  return state;
}
