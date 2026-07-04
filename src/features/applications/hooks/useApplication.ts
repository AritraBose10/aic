"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ApplicationDoc } from "@/core/types";

export function useApplication(applicationId: string | undefined) {
  const [state, setState] = useState<{ application: ApplicationDoc | null; loading: boolean }>({
    application: null,
    loading: true,
  });

  useEffect(() => {
    if (!applicationId) return;
    const unsubscribe = onSnapshot(doc(db, "applications", applicationId), (snap) => {
      setState({
        application: snap.exists() ? ({ id: snap.id, ...snap.data() } as ApplicationDoc) : null,
        loading: false,
      });
    });
    return unsubscribe;
  }, [applicationId]);

  if (!applicationId) return { application: null, loading: false };
  return state;
}
