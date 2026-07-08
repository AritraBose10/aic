"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOutreachDraft = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
/**
 * core/ai — the ONLY place a Claude prompt is constructed, and it runs
 * server-side so the API key never reaches the client.
 *
 * CRITICAL GUARDRAIL (AIO-04, §9.2): before a prompt is built, recipient
 * contacts that are not consent-cleared (core/consent) and context documents
 * that are confidential or not visible to the founder (core/documents visibleTo)
 * are filtered OUT. This happens *before* the API call — not as a post-hoc log
 * check — so non-consented data never reaches the model. Every call is
 * rate-limited, cost-capped, and its prompt+response usage is logged (AI-C05).
 */
const anthropicKey = (0, params_1.defineSecret)("ANTHROPIC_API_KEY");
// Lazy — this module is evaluated (via the re-export in index.ts) before
// index.ts's initializeApp() runs, so getFirestore() must not run at import time.
const db = () => (0, firestore_1.getFirestore)();
const MODEL = "claude-opus-4-8";
const MAX_CALLS_PER_HOUR = 30;
const MAX_TOKENS_PER_DAY = 2_000_000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
async function requireFounder(req) {
    if (!req.auth)
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    const snap = await db().doc(`users/${req.auth.uid}`).get();
    if (!snap.exists)
        throw new https_1.HttpsError("permission-denied", "No user profile.");
    const user = snap.data();
    if (user.approvalStatus !== "approved")
        throw new https_1.HttpsError("permission-denied", "Account not approved.");
    if (user.role !== "founder")
        throw new https_1.HttpsError("permission-denied", "Founders only.");
    return { uid: req.auth.uid, role: user.role };
}
/** Enforce per-startup rate + cost caps from the append-only aiUsage log. */
async function enforceQuota(startupId) {
    const now = Date.now();
    const since = new Date(now - DAY);
    const recent = await db()
        .collection("aiUsage")
        .where("startupId", "==", startupId)
        .where("at", ">=", since)
        .get();
    let callsLastHour = 0;
    let tokensLastDay = 0;
    recent.forEach((d) => {
        const u = d.data();
        const atMs = u.at?.toMillis() ?? 0;
        if (atMs >= now - HOUR)
            callsLastHour += 1;
        tokensLastDay += u.totalTokens ?? 0;
    });
    if (callsLastHour >= MAX_CALLS_PER_HOUR) {
        throw new https_1.HttpsError("resource-exhausted", "AI outreach rate limit reached — try again later.");
    }
    if (tokensLastDay >= MAX_TOKENS_PER_DAY) {
        throw new https_1.HttpsError("resource-exhausted", "Daily AI usage cap reached for this startup.");
    }
}
const CONFIDENTIAL_CATEGORIES = new Set(["confidential", "nda_signed", "ip"]);
exports.generateOutreachDraft = (0, https_1.onCall)({ secrets: [anthropicKey] }, async (req) => {
    const { startupId, channel, brief, contactIds, contextDocIds } = (req.data ?? {});
    if (typeof startupId !== "string" || !startupId) {
        throw new https_1.HttpsError("invalid-argument", "startupId is required.");
    }
    if (!brief || typeof brief.valueProp !== "string" || !brief.valueProp.trim()) {
        throw new https_1.HttpsError("invalid-argument", "A brief with a value proposition is required.");
    }
    const ids = Array.isArray(contactIds) ? contactIds.filter((x) => typeof x === "string") : [];
    if (ids.length === 0)
        throw new https_1.HttpsError("invalid-argument", "At least one contact is required.");
    const actor = await requireFounder(req);
    // Ownership: the caller must own this startup.
    const startupSnap = await db().doc(`startups/${startupId}`).get();
    if (!startupSnap.exists)
        throw new https_1.HttpsError("not-found", "Startup not found.");
    if (startupSnap.data().founderId !== actor.uid) {
        throw new https_1.HttpsError("permission-denied", "Not your startup.");
    }
    await enforceQuota(startupId);
    // ---- CONSENT FILTER (before the prompt is built) ----
    const included = [];
    const excluded = [];
    for (const contactId of ids) {
        const [consentSnap, contactSnap] = await Promise.all([
            db().doc(`consents/${contactId}_outreach`).get(),
            db().doc(`crmContacts/${contactId}`).get(),
        ]);
        const consented = consentSnap.exists && consentSnap.data()?.granted === true;
        const contact = contactSnap.data();
        const ownedByStartup = contact?.startupId === startupId;
        if (consented && ownedByStartup) {
            included.push({ id: contactId, name: contact?.name ?? "there", company: contact?.company ?? null });
        }
        else {
            excluded.push(contactId);
        }
    }
    if (included.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "None of the selected contacts have granted outreach consent.");
    }
    // ---- CONFIDENTIAL FILTER for optional context docs (before the prompt) ----
    const safeContext = [];
    const droppedDocs = [];
    for (const docId of Array.isArray(contextDocIds) ? contextDocIds : []) {
        if (typeof docId !== "string")
            continue;
        const dSnap = await db().doc(`documents/${docId}`).get();
        const d = dSnap.data();
        const isConfidential = d ? CONFIDENTIAL_CATEGORIES.has(d.category ?? "") : true;
        const visible = d ? (d.visibleTo ?? []).includes(actor.uid) || d.ownerId === startupId : false;
        if (d && !isConfidential && visible)
            safeContext.push(d.title ?? "");
        else
            droppedDocs.push(docId);
    }
    // ---- BUILD PROMPT (consent-cleared recipients + non-confidential context only) ----
    const recipientLine = included.map((c) => (c.company ? `${c.name} (${c.company})` : c.name)).join(", ");
    const system = "You draft short, respectful B2B customer-outreach messages for early-stage startups. " +
        "Never fabricate facts about the recipient. Output only the message body — no preamble.";
    const prompt = `Channel: ${channel ?? "email"}\n` +
        `Target segment: ${brief.segment ?? "n/a"}\n` +
        `Value proposition: ${brief.valueProp}\n` +
        `Campaign goal: ${brief.goal ?? "start a conversation"}\n` +
        `Tone: ${brief.tone ?? "warm, concise"}\n` +
        `Language: ${brief.language ?? "English"}\n` +
        `Recipients (consent-cleared): ${recipientLine}\n` +
        (safeContext.length ? `Approved context: ${safeContext.join("; ")}\n` : "") +
        `\nWrite one outreach message suitable for these recipients.`;
    // ---- GENERATE (real Claude when the secret is set; deterministic stub otherwise) ----
    const key = anthropicKey.value();
    let draft;
    let inputTokens = 0;
    let outputTokens = 0;
    if (key) {
        const client = new sdk_1.default({ apiKey: key });
        const message = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system,
            messages: [{ role: "user", content: prompt }],
        });
        draft = message.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
        inputTokens = message.usage.input_tokens;
        outputTokens = message.usage.output_tokens;
    }
    else {
        // Emulator / no-key path: deterministic stub so the guardrail is testable
        // without a live API call. The consent filtering above still ran for real.
        draft =
            `Hi ${included[0].name},\n\n${brief.valueProp}\n\n` +
                `Would you be open to a short conversation? (draft — stub, no API key configured)`;
        inputTokens = Math.ceil(prompt.length / 4);
        outputTokens = Math.ceil(draft.length / 4);
    }
    // ---- USAGE LOG (AI-C05) — records exactly which recipients reached the model ----
    await db().collection("aiUsage").add({
        startupId,
        uid: actor.uid,
        channel: channel ?? "email",
        model: key ? MODEL : "stub",
        promptChars: prompt.length,
        recipientContactIds: included.map((c) => c.id),
        excludedContactIds: excluded,
        droppedDocIds: droppedDocs,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        at: firestore_1.FieldValue.serverTimestamp(),
    });
    return {
        draft,
        model: key ? MODEL : "stub",
        includedContactIds: included.map((c) => c.id),
        excludedContactIds: excluded,
        droppedDocIds: droppedDocs,
    };
});
