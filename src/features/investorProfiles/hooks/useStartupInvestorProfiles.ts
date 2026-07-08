"use client";

import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StartupInvestorProfileDoc } from "@/core/types";

/** A founder's own investor-facing profile (id == startupId). */
export function useMyStartupInvestorProfile(startupId: string | undefined) {
  const [profile, setProfile] = useState<StartupInvestorProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!startupId) return;
    return onSnapshot(
      doc(db, "startupInvestorProfiles", startupId),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as StartupInvestorProfileDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [startupId]);
  return { profile, loading };
}

/**
 * Profiles filtered by status. Verified investors pass "published" (discovery);
 * staff pass "in_review" (review queue). Rules enforce that a verified investor
 * only ever receives published rows even if they query otherwise.
 */
export function useStartupInvestorProfilesByStatus(status: "published" | "in_review") {
  const [profiles, setProfiles] = useState<StartupInvestorProfileDoc[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(db, "startupInvestorProfiles"), where("status", "==", status));
    return onSnapshot(
      q,
      (snap) => {
        setProfiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StartupInvestorProfileDoc));
        setLoading(false);
      },
      (e) => {
        console.error("investor profiles listener", e);
        setProfiles([]);
        setLoading(false);
      },
    );
  }, [status]);
  return { profiles, loading };
}
