"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CampaignDoc, CrmContactDoc } from "@/core/types";

export function useCampaigns(startupId: string | undefined) {
  const [state, setState] = useState<{ campaigns: CampaignDoc[]; loading: boolean }>({
    campaigns: [],
    loading: true,
  });
  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "campaigns"), where("startupId", "==", startupId));
    return onSnapshot(
      q,
      (snap) => {
        const campaigns = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CampaignDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ campaigns, loading: false });
      },
      (e) => {
        console.error("campaigns listener", e);
        setState({ campaigns: [], loading: false });
      },
    );
  }, [startupId]);
  if (!startupId) return { campaigns: [], loading: false };
  return state;
}

/**
 * Reads the shared crmContacts collection directly (via core types) rather than
 * importing features/crm — features never import each other. Used to pick
 * campaign targets and show their consent status.
 */
export function useOutreachContacts(startupId: string | undefined) {
  const [contacts, setContacts] = useState<CrmContactDoc[]>([]);
  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "crmContacts"), where("startupId", "==", startupId));
    return onSnapshot(
      q,
      (snap) => setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CrmContactDoc)),
      (e) => console.error("outreach contacts listener", e),
    );
  }, [startupId]);
  return contacts;
}
