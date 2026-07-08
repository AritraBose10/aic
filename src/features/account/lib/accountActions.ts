import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { UserDoc } from "@/core/types";

/**
 * §9.2 data-subject request — self-service data export. Runs entirely client-
 * side: it reads only records the user can already see under the rules (their
 * own profile + records they own), assembles a JSON bundle, and downloads it.
 * No Blaze, no server.
 */
export async function exportMyData(userDoc: UserDoc): Promise<Record<string, unknown>> {
  const uid = userDoc.uid;
  const bundle: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: userDoc };

  // [collection, field] owner-scoped queries — each guarded so a denied/empty
  // one doesn't abort the whole export.
  const owned: [string, string][] = [
    ["startups", "founderId"], ["applications", "founderId"], ["crmContacts", "founderId"],
    ["crmOpportunities", "founderId"], ["financeEntries", "founderId"], ["campaigns", "founderId"],
    ["consents", "founderId"], ["loginEvents", "uid"], ["aiUsage", "uid"],
    ["adoptionRequests", "adopterUid"], ["dealEntries", "investorUid"],
  ];
  for (const [col, field] of owned) {
    try {
      const snap = await getDocs(query(collection(db, col), where(field, "==", uid)));
      if (!snap.empty) bundle[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      /* not readable for this role — skip */
    }
  }
  for (const singleton of ["investors", "adopters"]) {
    try {
      const s = await getDoc(doc(db, singleton, uid));
      if (s.exists()) bundle[singleton] = { id: s.id, ...s.data() };
    } catch {
      /* skip */
    }
  }

  await logAuditEvent({ actorId: uid, actorRole: userDoc.role, action: "user.data_export", entityType: "user", entityId: uid });
  return bundle;
}

/** Trigger a browser download of the export bundle. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** §9.2 self-service deactivation (Blaze-gated Cloud Function). */
export async function deactivateMyAccount(): Promise<{ ok: boolean }> {
  const fn = httpsCallable<Record<string, never>, { ok: boolean }>(functions, "deactivateAccount");
  return (await fn({})).data;
}
