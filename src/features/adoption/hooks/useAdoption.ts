"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdopterProfileDoc, AdoptionRequestDoc, StartupInvestorProfileDoc, UserDoc } from "@/core/types";

export function useAdopterProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<AdopterProfileDoc | null>(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "adopters", uid), (snap) =>
      setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as AdopterProfileDoc) : null), () => setProfile(null));
  }, [uid]);
  return profile;
}

/** Published startup profiles for adopter discovery (read directly — no cross-feature import). */
export function useDiscoverableStartups() {
  const [profiles, setProfiles] = useState<StartupInvestorProfileDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "startupInvestorProfiles"), where("status", "==", "published"));
    return onSnapshot(
      q,
      (snap) => { setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StartupInvestorProfileDoc)); setLoading(false); },
      () => { setProfiles([]); setLoading(false); },
    );
  }, []);
  return { profiles, loading };
}

export function useAdoptionRequests(opts: { founderId?: string; adopterUid?: string }) {
  const [requests, setRequests] = useState<AdoptionRequestDoc[]>([]);
  useEffect(() => {
    const base = collection(db, "adoptionRequests");
    const q = opts.founderId ? query(base, where("founderId", "==", opts.founderId))
      : opts.adopterUid ? query(base, where("adopterUid", "==", opts.adopterUid)) : null;
    if (!q) return;
    return onSnapshot(q, (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AdoptionRequestDoc)),
      (e) => console.error("adoptionRequests listener", e));
  }, [opts.founderId, opts.adopterUid]);
  return requests;
}

/** Every adoption request — staff-only read (rules short-circuit on isStaff()). */
export function useAllAdoptionRequests() {
  const [state, setState] = useState<{ requests: AdoptionRequestDoc[]; loading: boolean }>({ requests: [], loading: true });
  useEffect(() => {
    return onSnapshot(collection(db, "adoptionRequests"), (snap) => setState({
      requests: snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as AdoptionRequestDoc)
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
      loading: false,
    }), (e) => { console.error("adoptionRequests listener", e); setState({ requests: [], loading: false }); });
  }, []);
  return state;
}

/** Registered Probasi adopter accounts with their identity status — staff-only read. */
export function useAdopterAccounts() {
  const [state, setState] = useState<{ adopters: UserDoc[]; loading: boolean }>({ adopters: [], loading: true });
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "probasi_adopter"));
    return onSnapshot(q, (snap) => setState({
      adopters: snap.docs.map((d) => d.data() as UserDoc).sort((a, b) => a.name.localeCompare(b.name)),
      loading: false,
    }), (e) => { console.error("adopter accounts listener", e); setState({ adopters: [], loading: false }); });
  }, []);
  return state;
}
