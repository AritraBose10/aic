"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexDealEntry = exports.indexAdoptionWorkspace = exports.indexApplication = exports.indexDocument = exports.indexInvestorProfile = exports.indexStartup = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firestore_2 = require("firebase-admin/firestore");
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
const voyageKey = (0, params_1.defineSecret)("VOYAGE_API_KEY");
const db = () => (0, firestore_2.getFirestore)();
/** Placeholder: real impl would POST to Voyage AI. No key → no embedding (keyword fallback). */
async function embed(_text) {
    const key = voyageKey.value();
    if (!key)
        return null;
    // NOTE: intentionally not implemented — do not add a key or a live call here.
    // At cutover, replace with a Voyage AI embeddings request and store the vector.
    return null;
}
async function indexEntry(entityType, entityId, title, text) {
    const embedding = await embed(`${title}\n${text}`);
    await db().doc(`searchIndex/${entityType}__${entityId}`).set({
        entityType,
        entityId,
        title: title.slice(0, 300),
        text: text.slice(0, 4000),
        ...(embedding ? { embedding } : {}),
        updatedAt: firestore_2.FieldValue.serverTimestamp(),
    });
}
async function removeEntry(entityType, entityId) {
    await db().doc(`searchIndex/${entityType}__${entityId}`).delete().catch(() => { });
}
/** Build a trigger that maps a source doc to (title, text). */
function makeIndexer(entityType, extract) {
    return async (event) => {
        const after = event.data?.after;
        const id = event.params.id;
        if (!after?.exists)
            return removeEntry(entityType, id);
        const { title, text } = extract(after.data());
        return indexEntry(entityType, id, title, text);
    };
}
const s = (v) => (typeof v === "string" ? v : "");
exports.indexStartup = (0, firestore_1.onDocumentWritten)("startups/{id}", makeIndexer("startup", (d) => ({ title: s(d.name), text: `${s(d.sector)} ${s(d.district)} ${s(d.stage)} ${s(d.description)}` })));
exports.indexInvestorProfile = (0, firestore_1.onDocumentWritten)("startupInvestorProfiles/{id}", makeIndexer("startupInvestorProfile", (d) => ({ title: s(d.startupName), text: `${s(d.pitch)} ${s(d.traction)} ${s(d.useOfFunds)} status:${s(d.status)}` })));
exports.indexDocument = (0, firestore_1.onDocumentWritten)("documents/{id}", makeIndexer("document", (d) => ({ title: s(d.title), text: `${s(d.category)}` })));
exports.indexApplication = (0, firestore_1.onDocumentWritten)("applications/{id}", makeIndexer("application", (d) => ({ title: s(d.startupName), text: `${s(d.sector)} ${s(d.district)} ${s(d.pitchSummary)}` })));
exports.indexAdoptionWorkspace = (0, firestore_1.onDocumentWritten)("adoptionWorkspaces/{id}", makeIndexer("adoptionWorkspace", (d) => ({ title: s(d.startupName), text: `${s(d.goals)} ${s(d.commitments)}` })));
exports.indexDealEntry = (0, firestore_1.onDocumentWritten)("dealEntries/{id}", makeIndexer("dealEntry", (d) => ({ title: s(d.startupName), text: `deal ${s(d.stage)} ${s(d.notes)}` })));
