import { onDocumentWritten, type FirestoreEvent, type Change, type DocumentSnapshot } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/**
 * core/search indexer (AIS-02). On every write to an indexable collection, build
 * a searchIndex entry {entityType, entityId, title, text, embedding?} used by the
 * searchQuery retriever. Blaze-gated (Firestore triggers). Embeddings come from
 * Voyage AI — NO KEY is configured (placeholder); with no key the embedding is
 * omitted and searchQuery falls back to keyword retrieval, so the pipeline is
 * exercisable end-to-end in the emulator without external calls.
 *
 * The index stores ONLY title/text for retrieval — the per-query permission
 * filter (searchQuery.canRead) re-checks the SOURCE doc, so the index never
 * becomes an access-control bypass.
 */

const voyageKey = defineSecret("VOYAGE_API_KEY");
const db = () => getFirestore();

/** Placeholder: real impl would POST to Voyage AI. No key → no embedding (keyword fallback). */
async function embed(_text: string): Promise<number[] | null> {
  const key = voyageKey.value();
  if (!key) return null;
  // NOTE: intentionally not implemented — do not add a key or a live call here.
  // At cutover, replace with a Voyage AI embeddings request and store the vector.
  return null;
}

async function indexEntry(entityType: string, entityId: string, title: string, text: string): Promise<void> {
  const embedding = await embed(`${title}\n${text}`);
  await db().doc(`searchIndex/${entityType}__${entityId}`).set({
    entityType,
    entityId,
    title: title.slice(0, 300),
    text: text.slice(0, 4000),
    ...(embedding ? { embedding } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function removeEntry(entityType: string, entityId: string): Promise<void> {
  await db().doc(`searchIndex/${entityType}__${entityId}`).delete().catch(() => {});
}

type Evt = FirestoreEvent<Change<DocumentSnapshot> | undefined, { id: string }>;

/** Build a trigger that maps a source doc to (title, text). */
function makeIndexer(entityType: string, extract: (d: Record<string, unknown>) => { title: string; text: string }) {
  return async (event: Evt) => {
    const after = event.data?.after;
    const id = event.params.id;
    if (!after?.exists) return removeEntry(entityType, id);
    const { title, text } = extract(after.data() as Record<string, unknown>);
    return indexEntry(entityType, id, title, text);
  };
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

export const indexStartup = onDocumentWritten("startups/{id}", makeIndexer("startup",
  (d) => ({ title: s(d.name), text: `${s(d.sector)} ${s(d.district)} ${s(d.stage)} ${s(d.description)}` })));

export const indexInvestorProfile = onDocumentWritten("startupInvestorProfiles/{id}", makeIndexer("startupInvestorProfile",
  (d) => ({ title: s(d.startupName), text: `${s(d.pitch)} ${s(d.traction)} ${s(d.useOfFunds)} status:${s(d.status)}` })));

export const indexDocument = onDocumentWritten("documents/{id}", makeIndexer("document",
  (d) => ({ title: s(d.title), text: `${s(d.category)}` })));

export const indexApplication = onDocumentWritten("applications/{id}", makeIndexer("application",
  (d) => ({ title: s(d.startupName), text: `${s(d.sector)} ${s(d.district)} ${s(d.pitchSummary)}` })));

export const indexAdoptionWorkspace = onDocumentWritten("adoptionWorkspaces/{id}", makeIndexer("adoptionWorkspace",
  (d) => ({ title: s(d.startupName), text: `${s(d.goals)} ${s(d.commitments)}` })));

export const indexDealEntry = onDocumentWritten("dealEntries/{id}", makeIndexer("dealEntry",
  (d) => ({ title: s(d.startupName), text: `deal ${s(d.stage)} ${s(d.notes)}` })));
