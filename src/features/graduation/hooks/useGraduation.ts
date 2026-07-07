"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GraduationDoc } from "@/core/types";

/** The graduation scorecard for one startup (id == startupId), or null. */
export function useGraduation(startupId: string | undefined) {
  const [state, setState] = useState<{ graduation: GraduationDoc | null; loading: boolean }>({
    graduation: null,
    loading: true,
  });

  useEffect(() => {
    if (!startupId) return;
    const unsubscribe = onSnapshot(
      doc(db, "graduations", startupId),
      (snap) => {
        setState({
          graduation: snap.exists() ? ({ id: snap.id, ...snap.data() } as GraduationDoc) : null,
          loading: false,
        });
      },
      (error) => {
        console.error("graduation listener error", error);
        setState({ graduation: null, loading: false });
      },
    );
    return unsubscribe;
  }, [startupId]);

  return state;
}
