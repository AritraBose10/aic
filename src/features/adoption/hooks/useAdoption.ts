"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AdopterProfileDoc, AdoptionRequestDoc, StartupInvestorProfileDoc } from "@/core/types";

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
  useEffect(() => {
    const q = query(collection(db, "startupInvestorProfiles"), where("status", "==", "published"));
    return onSnapshot(q, (snap) => setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StartupInvestorProfileDoc)), () => setProfiles([]));
  }, []);
  return profiles;
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
