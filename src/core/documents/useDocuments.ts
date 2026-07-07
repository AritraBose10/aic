"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DocumentDoc, DocumentOwnerType } from "@/core/types";

/**
 * Documents attached to one owner. By default returns only current versions
 * (not superseded); pass includeSuperseded for full version history.
 */
export function useDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string | undefined,
  includeSuperseded = false,
) {
  const [state, setState] = useState<{ documents: DocumentDoc[]; loading: boolean }>({
    documents: [],
    loading: true,
  });

  useEffect(() => {
    if (!ownerId) return;
    const q = query(
      collection(db, "documents"),
      where("ownerType", "==", ownerType),
      where("ownerId", "==", ownerId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const documents = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as DocumentDoc)
          .filter((d) => includeSuperseded || !d.supersededBy)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setState({ documents, loading: false });
      },
      (error) => {
        console.error("documents listener error", error);
        setState({ documents: [], loading: false });
      },
    );
    return unsubscribe;
  }, [ownerType, ownerId, includeSuperseded]);

  return state;
}
