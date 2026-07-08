import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAuditEvent } from "@/core/audit";
import type { FinanceEntryDoc, FinanceEntryKind, Role } from "@/core/types";

interface Actor {
  uid: string;
  role: Role;
}
interface Owner {
  startupId: string;
  startupName: string;
  founderId: string;
}

export async function recordFinanceEntry(
  actor: Actor,
  owner: Owner,
  input: { kind: FinanceEntryKind; description: string; amount: number; paid?: boolean; occurredAt: Date },
): Promise<string> {
  const ref = await addDoc(collection(db, "financeEntries"), {
    startupId: owner.startupId,
    founderId: owner.founderId,
    kind: input.kind,
    description: input.description.trim(),
    amount: input.amount,
    paid: input.kind === "invoice" ? (input.paid ?? false) : null,
    occurredAt: Timestamp.fromDate(input.occurredAt),
    createdAt: serverTimestamp(),
  });
  await recomputeFinanceSummary(owner);
  await logAuditEvent({
    actorId: actor.uid,
    actorRole: actor.role,
    action: "finance.record",
    entityType: input.kind,
    entityId: ref.id,
    details: { amount: input.amount },
  });
  return ref.id;
}

/** Recompute the finance slice of the opsSummary rollup (OPS-06). */
async function recomputeFinanceSummary(owner: Owner): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "financeEntries"), where("startupId", "==", owner.startupId)),
  );
  const entries = snap.docs.map((d) => d.data() as FinanceEntryDoc);
  const invoices = entries.filter((e) => e.kind === "invoice");
  const expenses = entries.filter((e) => e.kind === "expense");
  const invoicedTotal = invoices.reduce((s, e) => s + (e.amount || 0), 0);
  const paidInvoices = invoices.filter((e) => e.paid).reduce((s, e) => s + (e.amount || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  await setDoc(
    doc(db, "opsSummary", owner.startupId),
    {
      startupId: owner.startupId,
      founderId: owner.founderId,
      startupName: owner.startupName,
      invoicedTotal,
      expenseTotal,
      cashPosition: paidInvoices - expenseTotal,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
