"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CrmContactDoc, CrmOpportunityDoc, OpsConfigDoc } from "@/core/types";

export function useContacts(startupId: string | undefined) {
  const [state, setState] = useState<{ contacts: CrmContactDoc[]; loading: boolean }>({
    contacts: [],
    loading: true,
  });
  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "crmContacts"), where("startupId", "==", startupId));
    return onSnapshot(
      q,
      (snap) => {
        const contacts = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CrmContactDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ contacts, loading: false });
      },
      (e) => {
        console.error("contacts listener", e);
        setState({ contacts: [], loading: false });
      },
    );
  }, [startupId]);
  if (!startupId) return { contacts: [], loading: false };
  return state;
}

export function useOpportunities(startupId: string | undefined) {
  const [state, setState] = useState<{ opportunities: CrmOpportunityDoc[]; loading: boolean }>({
    opportunities: [],
    loading: true,
  });
  useEffect(() => {
    if (!startupId) return;
    const q = query(collection(db, "crmOpportunities"), where("startupId", "==", startupId));
    return onSnapshot(
      q,
      (snap) => {
        const opportunities = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CrmOpportunityDoc)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ opportunities, loading: false });
      },
      (e) => {
        console.error("opportunities listener", e);
        setState({ opportunities: [], loading: false });
      },
    );
  }, [startupId]);
  if (!startupId) return { opportunities: [], loading: false };
  return state;
}

export function useOpsConfig(startupId: string | undefined) {
  const [config, setConfig] = useState<OpsConfigDoc | null>(null);
  useEffect(() => {
    if (!startupId) return;
    return onSnapshot(doc(db, "opsConfig", startupId), (snap) => {
      setConfig(snap.exists() ? ({ id: snap.id, ...snap.data() } as OpsConfigDoc) : null);
    });
  }, [startupId]);
  return config;
}
