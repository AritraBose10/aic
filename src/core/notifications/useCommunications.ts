"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CommunicationEntityType, CommunicationEventDoc, NotificationTemplateDoc } from "@/core/types";

/** The communication timeline for one subject (COM-02), newest-first. */
export function useCommunications(entityType: CommunicationEntityType, entityId: string | undefined) {
  const [state, setState] = useState<{ events: CommunicationEventDoc[]; loading: boolean }>({
    events: [],
    loading: true,
  });

  useEffect(() => {
    if (!entityId) return;
    const q = query(
      collection(db, "communications"),
      where("entityType", "==", entityType),
      where("entityId", "==", entityId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const events = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CommunicationEventDoc)
          .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0));
        setState({ events, loading: false });
      },
      (error) => {
        console.error("communications listener error", error);
        setState({ events: [], loading: false });
      },
    );
    return unsubscribe;
  }, [entityType, entityId]);

  return state;
}

/** All notification templates (admin editor). */
export function useTemplates() {
  const [state, setState] = useState<{ templates: NotificationTemplateDoc[]; loading: boolean }>({
    templates: [],
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "notificationTemplates"),
      (snap) => {
        setState({
          templates: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationTemplateDoc),
          loading: false,
        });
      },
      (error) => {
        console.error("templates listener error", error);
        setState({ templates: [], loading: false });
      },
    );
    return unsubscribe;
  }, []);

  return state;
}
