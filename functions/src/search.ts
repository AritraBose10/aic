import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

/**
 * core/search — permission-aware AI search / ecosystem intelligence (AIS).
 *
 * CRITICAL CONSTRAINT (AIS-04, the make-or-break): every retrieved candidate is
 * filtered through the CALLER'S ACTUAL transactional read permission BEFORE it
 * is used to construct a prompt or returned. The filter (`canRead`) re-derives
 * permission from the SOURCE document via the Admin SDK — mirroring
 * firestore.rules — so a user can never see, via AI search, anything they could
 * not already read in the normal UI. This runs server-side, before the model.
 *
 * SCOPE NOTE: retrieval combines structured Firestore queries with (optional)
 * semantic vector search over the searchIndex. It is NOT a graph database / graph
 * traversal engine — §7.2's "entity graph search" is deliberately out of scope
 * for this timeline; entity relationships are followed via structured queries.
 *
 * Embeddings: Voyage AI (Anthropic has no embeddings API). Vector store:
 * Firestore native findNearest. Both are placeholders here — NO API KEY is
 * configured; with no key the function runs a deterministic keyword fallback so
 * the permission filter (the security-critical part) is fully emulator-testable.
 *
 * Rate limiting, cost caps, and prompt/source/feedback logging reuse the Phase 3
 * core/ai `aiUsage` mechanism (feature: "search") — NOT a second mechanism.
 */

// Placeholders only — do NOT set real values here or in config (per hard stop).
const anthropicKey = defineSecret("ANTHROPIC_API_KEY");
const voyageKey = defineSecret("VOYAGE_API_KEY");

const db = () => getFirestore();
const MODEL = "claude-opus-4-8";
const MAX_SEARCHES_PER_HOUR = 60;
const MAX_TOKENS_PER_DAY = 2_000_000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_CANDIDATES = 40;
const MAX_RESULTS = 8;

type Role = "admin" | "cohort_manager" | "evaluator" | "founder" | "investor" | "probasi_adopter";

interface Caller {
  uid: string;
  role: Role;
  approvalStatus: string;
  identityStatus?: string;
}

async function resolveCaller(req: CallableRequest): Promise<Caller> {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const snap = await db().doc(`users/${req.auth.uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "No user profile.");
  const u = snap.data() as { role: Role; approvalStatus: string; identityStatus?: string };
  if (u.approvalStatus !== "approved") throw new HttpsError("permission-denied", "Account not approved.");
  return { uid: req.auth.uid, role: u.role, approvalStatus: u.approvalStatus, identityStatus: u.identityStatus };
}

function isStaff(c: Caller) {
  return c.role === "admin" || c.role === "cohort_manager";
}
function isVerified(c: Caller) {
  return c.identityStatus === "verified";
}

/** Per-user search quota from the shared aiUsage log (AIS cost governance). */
async function enforceSearchQuota(uid: string): Promise<void> {
  const since = new Date(Date.now() - DAY);
  const recent = await db()
    .collection("aiUsage")
    .where("uid", "==", uid)
    .where("at", ">=", since)
    .get();
  let searchesLastHour = 0;
  let tokensLastDay = 0;
  const now = Date.now();
  recent.forEach((d) => {
    const u = d.data() as { at?: { toMillis(): number }; totalTokens?: number; feature?: string };
    const atMs = u.at?.toMillis() ?? 0;
    if (u.feature === "search" && atMs >= now - HOUR) searchesLastHour += 1;
    tokensLastDay += u.totalTokens ?? 0;
  });
  if (searchesLastHour >= MAX_SEARCHES_PER_HOUR) {
    throw new HttpsError("resource-exhausted", "Search rate limit reached — try again later.");
  }
  if (tokensLastDay >= MAX_TOKENS_PER_DAY) {
    throw new HttpsError("resource-exhausted", "Daily AI usage cap reached.");
  }
}

// ---------------------------------------------------------------------------
// AIS-04 permission filter: re-derive the caller's read permission from the
// SOURCE document, mirroring firestore.rules per entity type. Authoritative
// (not the possibly-stale index). Returns false on any doubt (deny-by-default).
// ---------------------------------------------------------------------------
async function canRead(caller: Caller, entityType: string, entityId: string): Promise<boolean> {
  if (isStaff(caller)) {
    // Staff read everything EXCEPT the founder-private raw CRM/finance rows (OPS-06).
    if (entityType === "crmContact" || entityType === "financeEntry") return false;
    return true;
  }
  const uid = caller.uid;
  const snap = await db().doc(`${collectionFor(entityType)}/${entityId}`).get();
  if (!snap.exists) return false;
  const d = snap.data() as Record<string, unknown>;
  const has = (arr: unknown, v: string) => Array.isArray(arr) && arr.includes(v);

  switch (entityType) {
    case "startup":
      return d.founderId === uid || has(d.teamMemberUids, uid);
    case "startupInvestorProfile":
      return (
        d.founderId === uid ||
        (isVerified(caller) && d.status === "published" &&
          (caller.role === "investor" || caller.role === "probasi_adopter"))
      );
    case "document":
      return d.uploadedBy === uid || has(d.visibleTo, uid);
    case "crmContact":
    case "crmOpportunity":
    case "financeEntry":
    case "campaign":
      return d.founderId === uid; // founder-private
    case "application":
      return d.founderId === uid || has(d.evaluatorIds, uid);
    case "adoptionWorkspace":
      return d.founderId === uid || d.adopterUid === uid;
    case "dealEntry":
      return d.founderId === uid || d.investorUid === uid;
    case "pitchEvent":
      return (
        (isVerified(caller) && caller.role === "investor" && has(d.investorUids, uid)) ||
        (caller.role === "founder" && has(d.shortlistFounderIds, uid))
      );
    case "directory":
      // Catalog: incumbent roles only (Day 1 deny-by-default).
      return caller.role === "founder" || caller.role === "evaluator";
    default:
      return false; // unknown type → deny
  }
}

function collectionFor(entityType: string): string {
  const map: Record<string, string> = {
    startup: "startups",
    startupInvestorProfile: "startupInvestorProfiles",
    document: "documents",
    crmContact: "crmContacts",
    crmOpportunity: "crmOpportunities",
    financeEntry: "financeEntries",
    campaign: "campaigns",
    application: "applications",
    adoptionWorkspace: "adoptionWorkspaces",
    dealEntry: "dealEntries",
    pitchEvent: "pitchEvents",
    directory: "directory",
  };
  return map[entityType] ?? entityType;
}

interface IndexEntry {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  text: string;
}

/** Retrieve candidates. Keyword fallback when no Voyage key / no vector index
 *  (emulator). With a key + index, this is where findNearest would run. */
async function retrieveCandidates(queryText: string): Promise<IndexEntry[]> {
  const snap = await db().collection("searchIndex").limit(500).get();
  const terms = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<IndexEntry, "id">) }))
    .map((e) => {
      const hay = `${e.title} ${e.text}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((x) => x.e);
  return scored;
}

export const searchQuery = onCall({ secrets: [anthropicKey, voyageKey] }, async (req) => {
  const { query } = (req.data ?? {}) as { query?: string };
  if (typeof query !== "string" || !query.trim()) {
    throw new HttpsError("invalid-argument", "A query is required.");
  }
  const caller = await resolveCaller(req);
  await enforceSearchQuota(caller.uid);

  // Retrieve, then FILTER by permission BEFORE building the prompt (AIS-04).
  const candidates = await retrieveCandidates(query);
  const permitted: IndexEntry[] = [];
  let filteredOut = 0;
  for (const c of candidates) {
    if (await canRead(caller, c.entityType, c.entityId)) permitted.push(c);
    else filteredOut += 1;
  }
  const top = permitted.slice(0, MAX_RESULTS);

  // Citations are built from PERMITTED sources only — guaranteed present (AIS-03).
  const citations = top.map((e) => ({ sourceType: e.entityType, sourceId: e.entityId, title: e.title }));

  // Generate the answer from permitted context only.
  const context = top.map((e, i) => `[${i + 1}] (${e.entityType}) ${e.title}: ${e.text}`).join("\n");
  const key = anthropicKey.value();
  let answer: string;
  let inputTokens = 0;
  let outputTokens = 0;
  if (key && top.length > 0) {
    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You answer questions ONLY from the provided sources. Cite sources by their [n] index. " +
        "If the sources don't contain the answer, say so. Never invent facts not in the sources.",
      messages: [{ role: "user", content: `Question: ${query}\n\nSources:\n${context}` }],
    });
    answer = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;
  } else {
    answer = top.length
      ? `Based on ${top.length} record(s) you can access: ${top.map((e, i) => `[${i + 1}] ${e.title}`).join("; ")}. (stub — no API key configured)`
      : "No accessible records matched your query.";
    inputTokens = Math.ceil((context.length + query.length) / 4);
    outputTokens = Math.ceil(answer.length / 4);
  }

  const confidence: "high" | "medium" | "low" = top.length >= 3 ? "high" : top.length >= 1 ? "medium" : "low";
  const limitations =
    (key ? "" : "AI generation is stubbed (no key configured). ") +
    `Results are limited to records you are authorised to see; ${filteredOut} match(es) were withheld by permission filtering.`;

  // Usage log — extends the Phase 3 aiUsage mechanism (AIS-08 / AI-C05).
  await db().collection("aiUsage").add({
    feature: "search",
    uid: caller.uid,
    model: key ? MODEL : "stub",
    query,
    retrievedSourceIds: top.map((e) => e.entityId),
    filteredOutCount: filteredOut,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    at: FieldValue.serverTimestamp(),
  });

  return { answer, citations, confidence, limitations, resultCount: top.length, filteredOutCount: filteredOut };
});
