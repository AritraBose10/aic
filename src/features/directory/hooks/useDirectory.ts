"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DirectoryEntryDoc, DirectoryKind } from "@/core/types";

/** Directory entries, optionally filtered by kind. `activeOnly` for the browse view. */
export function useDirectory(kind?: DirectoryKind, activeOnly = false) {
  const [state, setState] = useState<{ entries: DirectoryEntryDoc[]; loading: boolean }>({
    entries: [],
    loading: true,
  });

  useEffect(() => {
    const constraints = kind ? [where("kind", "==", kind)] : [];
    const unsubscribe = onSnapshot(
      query(collection(db, "directory"), ...constraints),
      (snap) => {
        const entries = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as DirectoryEntryDoc)
          .filter((e) => !activeOnly || e.active)
          .sort((a, b) => a.name.localeCompare(b.name));
        setState({ entries, loading: false });
      },
      (error) => {
        console.error("directory listener error", error);
        setState({ entries: [], loading: false });
      },
    );
    return unsubscribe;
  }, [kind, activeOnly]);

  return state;
}
