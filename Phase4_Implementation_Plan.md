# SoF Startup Ecosystem Platform — Phase 4 Implementation Plan

**Status:** Phases 1–3 complete (Phase 3 built + emulator-verified; launch + AI features gated on the Blaze upgrade — see `BLOCKER-blaze-deploy` in memory).
**Phase 4 scope:** Angel investor community connect, "Adopt a Bengal Startup by Probasi Bangali" program, and AI-driven search / ecosystem intelligence.
**Compliance basis:** Blueprint v1.0 §5.9–5.11 (INV-01→07, ABS-01→10, AIS-01→08), plus §6 (knowledge graph), §7 (AI controls), §9 (security/privacy).

---

## 1. Compliance Check Against Blueprint (Run Before Planning)

### Correctly scoped
| ID | Requirement | Priority |
|---|---|---|
| INV-01/02 | Verified investor profiles; startup investor-facing profiles (approved pitch, ask, visibility rules) | M/M |
| INV-04 | Secure data rooms: doc categories, access request/approval, watermark option, NDA status, access logs | **M** |
| INV-05/07 | Pitch-day / event management (invites, slots, Q&A, feedback); disclaimers + separation of discovery from execution + audit | **M/M** |
| INV-06 | Deal pipeline (EOI → diligence → commitment → closed/dropped) | S |
| INV-03 | AI investor↔startup matching | S |
| ABS-01/02/03/04 | Probasi global portal + identity verification; discover approved startups; adoption modes; founder accept/decline/negotiate + access scope | **M×4** |
| ABS-05/08/09 | Adoption workspace (goals, meetings, tasks, leads, docs, impact); impact dashboards; COI/confidentiality/disclaimer acknowledgements | **M×3** |
| ABS-06 | Adopter contributes leads into startup CRM **with attribution + founder approval** | S |
| ABS-07/10 | Adoption circles; AI Probasi↔startup matching | S |
| AIS-01/02/03/04/08 | NL search over authorised data; structured+semantic+entity-graph; citations + confidence; **permission enforcement**; AI audit log | **M×5** |
| AIS-05/06/07 | English+Bangla + transliteration; saved queries→widgets; portfolio-insight copilot | S |

### Gaps caught on this compliance pass — added to scope below
| Gap | Priority | Why it's a gap |
|---|---|---|
| **Two new self-service roles + a verification workflow** — `investor` and `probasi_adopter`. INV-01 ("verified by admin") and ABS-01 ("identity verification workflow") need more than the current binary approved/rejected. | **M** | Every Phase 1–3 rule gates on `isStaff()`/founder ownership. Adding roles that read a *scoped slice* of startup data is the **highest rules-complexity change in the whole project** — it must be additive and deny-by-default, or it leaks. |
| **Permission-aware retrieval (RAG)** — AIS-04 is make-or-break: the AI must never surface a doc/note the caller couldn't read transactionally. | **M** | A naive RAG leaks restricted data through the model. Retrieval must apply Firestore-equivalent permission filters **server-side, before** documents reach the prompt — the exact discipline proven in Phase 3's `core/ai` consent filter. Needs adversarial emulator testing. |
| **Embeddings indexing pipeline + provider decision** | **M** | Semantic search (AIS-02) needs embeddings generated on write and re-generated on update (a Cloud Function trigger), plus a vector store. **Anthropic has no embeddings endpoint** — decide Voyage AI (Anthropic's recommended partner) vs Vertex AI text-embeddings (same GCP project). Vector store: **Firestore native vector search (`findNearest`)** keeps it in-stack on Blaze — recommended over standing up Pinecone/Vertex Vector Search. Flag this in the feasibility review, do not defer to mid-build. |
| **Cross-role exposure model** | **M** | Investors/adopters see only what a founder has *approved/shared*. Needs per-collection rule additions + an access-request/grant record (reuse the Phase-3 NDA `grantNdaAccess` → `visibleTo` pattern) rather than broadening existing reads. |

### Correctly deferred (S/C — push past Phase 4 MVP)
AI matching (INV-03, ABS-10), deal-pipeline depth (INV-06), adoption circles (ABS-07), saved-query widgets (AIS-06), portfolio-insight copilot (AIS-07), and Bangla/transliteration depth (AIS-05). Watermarking (INV-04) → simple footer stamp, not per-view rendering.

---

## 2. Architecture Additions

Reuses Phase 1–3 primitives heavily; the genuinely new/hard pieces are the two roles and the permission-aware search layer.

```
core/
  roles/         + investor, probasi_adopter (additive Role union + permissions);
                 a verification state beyond approved/rejected (identity_verified).
  search/        Blaze: permission-aware retrieval Cloud Function (mirrors
                 firestore.rules server-side) + embeddings indexer (Firestore
                 vector search) + AI audit (extends the aiUsage pattern). [AIS]
  documents/     + data-room access-request → approve → access-log (INV-04),
                 reusing the existing visibleTo + NDA grant machinery.

features/
  investors/     INV-01,02,04,05,07 — investor + startup investor-facing profiles,
                 data rooms, pitch events (on core/meetings), disclaimers.
  adoption/      ABS-01..05,08,09 — Probasi portal, discovery, adoption workspace,
                 impact dashboard, acknowledgements (core/consent + NDA). ABS-06
                 lead contribution REUSES the CRM's OPS-02 contributedBy attribution.
  search/        AIS-01,03 — NL search UI over core/search (citations, permission-filtered).
```

**Already covered by earlier primitives (do NOT rebuild):**
- **ABS-06** (adopter → CRM lead with attribution + founder approval) — the Phase-3 CRM already models `contributedByUid`/`contributedByName` on `crmContacts` and staff/mentor contribution. Extending it to the adopter role is a rule tweak, not a rebuild.
- **INV-04 / ABS-09** (data-room NDA status, acknowledgements) — `core/documents` `visibleTo` + the Phase-3 NDA extension (`issueNda` → `signNda` → `grantNdaAccess`) already do access-gating; add an access-**request** step in front.
- **Pitch events / adoption meetings** — `core/meetings`. **Impact dashboards** — the `opsSummary` rollup + dashboard panel pattern. **AI audit** — the `aiUsage` collection + rule.

**Hard dependencies — Blaze + AI providers.** `core/search` (and the deferred AI-matching) need Cloud Functions (Blaze) + `ANTHROPIC_API_KEY` (already flagged) **plus an embeddings key** (Voyage/Vertex). Non-AI Phase 4 (profiles, data rooms, pitch events, adoption workspace, impact) builds and runs on the current setup; the search/RAG layer is Blaze-gated and built + emulator-tested first, exactly like `core/ai`.

---

## 3. Day-by-Day Plan (~24 days, full-time)

| Days | Work | Blueprint IDs |
|---|---|---|
| 1–2 | `core/roles` — add `investor` + `probasi_adopter`; identity-verification state; registration flows; admin verification queue | INV-01, ABS-01 |
| 3–4 | Rules foundation — deny-by-default scoped access for the new roles across existing collections; access-request/grant record | INV-04, ABS-04, §9 |
| 5–7 | `features/investors` — investor profiles + startup investor-facing profiles (admin-reviewed, visibility rules) | INV-01, INV-02, INV-07 |
| 8–9 | `core/documents` data-room extension — access request → approve → watermark stamp → access log | INV-04 |
| 10–11 | Pitch events on `core/meetings` (invites, slots, feedback); deal-pipeline stub | INV-05, INV-06 |
| 12–14 | `features/adoption` — Probasi portal, discovery of approved startups, adoption modes, accept/negotiate + access scope | ABS-01..04 |
| 15–16 | Adoption workspace (goals, meetings, tasks, docs) + CRM lead contribution (reuse OPS-02) + acknowledgements (consent+NDA) | ABS-05, ABS-06, ABS-09 |
| 17 | Impact dashboards (adopter + management) via the opsSummary rollup pattern | ABS-08 |
| 18–20 | `core/search` (**Blaze**) — embeddings indexer (Firestore vector search) + **permission-aware retrieval** Cloud Function + AI audit log | AIS-01,02,04,08 |
| 21–22 | `features/search` — NL search UI with citations + confidence; permission-filtered results | AIS-01, AIS-03 |
| 23–24 | Integration + pilot — investor onboarding → data-room request/approve/log; adopter onboarding → contributed lead in CRM; **unauthorised AI query refused** | AT-06, AIS-04 |

---

## 4. Exit Test

Two acceptance bars, both blueprint-defined:

1. **AIS-04 (the security make-or-break):**
   > *"Unauthorised user cannot retrieve restricted data through AI prompts."*
   Verify **in the emulator** (same rigor as the Phase-3 AIO-04 test): an investor/adopter NL query must not return any document or private note they can't read transactionally — and the AI audit log records exactly which sources were retrieved.

2. **Cross-role workflows:** an investor requests **data-room** access → founder approves → the access is **logged** (INV-04); and a Probasi adopter contributes a **sales lead** → it appears in the startup CRM **with attribution**, pending founder approval (ABS-06).

---

## 5. Carried-Forward Debt

1. **Blaze** — now gates three functions (`recordDecision`/`submitApplication`/`reopenDecision`), `generateOutreachDraft`, AND the Phase-4 `core/search` + embeddings indexer. Resolve before the AI-search layer goes live.
2. **Embeddings provider** — decide Voyage AI vs Vertex AI on Day 1 of the search work; it changes the indexer + a second secret.
3. **Two new roles = the project's biggest rules surface** — budget adversarial rules testing; deny-by-default and never broaden an existing founder/staff read to fit an investor/adopter.

After Phase 4 the platform covers the full blueprint feature set. Before GA, run a final **NFR/SEC/ADM hardening pass** (§ NFR-*, SEC-*, ADM-* — performance, security controls, admin/audit) — the compliance discipline that caught the gaps in every phase applies once more to the non-functional requirements, which have not yet had a dedicated pass.
