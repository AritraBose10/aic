"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InvestorProfileDoc } from "@/core/types";

export function useInvestorProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<InvestorProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "investors", uid),
      (snap) => {
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as InvestorProfileDoc) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid]);
  return { profile, loading };
}
