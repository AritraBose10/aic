# SoF Startup Ecosystem Platform — Phase 3 Implementation Plan

**Status:** Phase 1 complete; Phase 2 complete (built + emulator-verified; launch deploy blocked on Blaze upgrade — see `DEPLOYMENT.md` and memory blocker).
**Phase 3 scope:** Startup operations suite (CRM, accounting, logistics), AI-driven customer outreach, patent/IP/legal support.
**Compliance basis:** Bengal Startup Ecosystem IT Platform Requirements Blueprint v1.0, Sections 5.5–5.7, plus 6 (data), 7 (AI controls), 9 (security/privacy).

---

## 1. Compliance Check Against Blueprint (Run Before Planning)

### Correctly scoped
| ID | Requirement | Priority |
|---|---|---|
| OPS-01/02 | Lightweight CRM: leads, prospects, customers, opportunities, stages, activities, conversion reporting; sales-mentor lead contribution with founder permission | M/M |
| OPS-06/07 | Ops summary to management dashboards (no raw txn leak); founder chooses built-in / integrate / managed mode | M/M |
| OPS-03/04/05/08 | Accounting/bookkeeping, accounting-provider integration, logistics/supply chain, import/export | S |
| AIO-01/02 | Outreach brief (segments, value props, geos, channels, languages, goals); AI-drafted email/WhatsApp/call/LinkedIn/landing/follow-up | S/S |
| AIO-04 | Guardrails: no send without founder approval + contact consent + template governance + audit | **M** |
| AIO-05/06 | Outcomes feed CRM + dashboards; outreach as a managed service | S |
| IP-04/05 | NDA/confidentiality templates; restrict confidential IP docs from unauthorised views | **M/M** |
| IP-01/02 | IP intake (invention/brand/design/copyright); governed IP case workflow (counsel, tasks, vault, deadlines, fees) | S |

### Gaps caught on this compliance pass — added to scope below
| ID | Requirement | Priority | Why it's a gap |
|---|---|---|---|
| **Contact consent store** | AIO-04 requires per-**contact** consent before outreach; IDM-04 (consent) was only partially met in Phase 1 (registration consent, not per-contact) | **M** | No contact-level consent record exists. The guardrail is meaningless without one to check. |
| **AI usage log + rate/cost governance** | §7 AI-C05 (prompt/source/user/feedback logging) + §13 "AI and document storage costs may rise" | **M** | AI outreach must log every prompt/response and enforce a per-startup rate cap, or costs and abuse are uncontrolled. |
| **Ops summary rollup doc** | OPS-06 "expose summary metrics … without exposing sensitive transaction details beyond approved permissions" | **M** | Firestore can't aggregate server-side without Functions/BigQuery. Staff must see a **non-sensitive per-startup `opsSummary`** (pipeline value, revenue band), never raw CRM/finance rows. Mirrors the `selectedCount` counter pattern. |

### Correctly deferred (S/C — safe to push past Phase 3)
Full external accounting-provider sync (OPS-04 deep integration), logistics beyond basic records (OPS-05 carrier APIs), AIO-03 (next-best-action / A-B AI), AIO-06 managed delivery automation, IP-03 (AI prior-art search), and real payment/settlement (PAY-01). Actual message **dispatch** (email/WhatsApp gateways) stays out — Phase 3 drafts + approves + records; sending is a later integration.

---

## 2. Architecture Additions

Reuses the Phase-2 `core/` primitives heavily; only **two** genuinely new shared pieces.

```
core/
  ai/            Server-side Claude drafting (callable Cloud Function) + prompt/usage
                 audit + rate governance — AIO-02, AIO-04, AI-C05. **Blaze-only.**
  consent/       Per-contact consent records + a can-contact() check — AIO-04, IDM-04

features/
  crm/           OPS-01, OPS-02, OPS-06 (leads, contacts, opportunities, pipeline, activities)
  finance/       OPS-03 (lightweight invoices, expenses, cashflow snapshot) — no gateway
  outreach/      AIO-01, AIO-02, AIO-04, AIO-05 (brief → AI draft → consent+approval gate → outcome)
  ip/            IP-01, IP-02 on core/tickets · IP-04 NDA on core/documents · IP-05 already
                 largely satisfied by core/documents `visibleTo` + a confidential category
```

**What is already covered by Phase-2 primitives (do NOT rebuild):**
- **IP-05** (restrict confidential IP docs) — `core/documents` already has a per-doc `visibleTo` access list; add a `confidential` document category + default-empty visibility. This is ~90% done.
- **IP-02 / IP-01 / AIO-06 managed service / OPS-07 managed mode** — `core/tickets` (SLA, provider, evidence) + `directory` providers already model managed work.
- **Outreach + IP notifications** — `core/notifications` templates + timeline.
- **Ops summary on dashboard** — extend the existing `EcosystemPanel` / `PortfolioDashboard`.

**Hard dependency — Blaze.** `core/ai` calls the Claude API, which must run **server-side in a Cloud Function** (the API key can never reach the client). Cloud Functions require Blaze, which is currently the open launch blocker. Therefore: **CRM, finance, and IP (non-AI) build and run on the current setup; the AI-outreach drafting is Blaze-gated** exactly like the Phase-2 decision/submit functions — built + emulator-tested now, live at Blaze cutover. Use the latest Claude model (Claude Opus 4.8 / Sonnet 5 per project defaults) via the Anthropic SDK in the function.

---

## 3. Day-by-Day Plan (~20 days, full-time)

| Days | Work | Blueprint IDs |
|---|---|---|
| 1 | `core/consent` — per-contact consent records + `canContact()`; seed consent capture into CRM contact creation | AIO-04, IDM-04 |
| 2–5 | `features/crm` — leads, contacts (with consent), opportunities, sales stages, activities, conversion reporting; sales-mentor/staff lead contribution with founder acceptance + attribution | OPS-01, OPS-02 |
| 6 | Ops summary rollup — per-startup `opsSummary` doc (pipeline value, revenue band, counts) maintained on CRM writes; staff read summary only, never raw rows | OPS-06, OPS-07 |
| 7–9 | `features/finance` — lightweight invoices, expenses, cashflow snapshot, CSV export; feeds `opsSummary` | OPS-03, OPS-08 |
| 10 | `core/ai` (**Blaze**) — callable `generateOutreachDraft` (Anthropic SDK, server-side key), prompt/usage audit log, per-startup rate cap | AIO-02, AI-C05 |
| 11–13 | `features/outreach` — brief builder; AI draft (email/WhatsApp/call/LinkedIn/landing/follow-up); **guardrail gate**: block dispatch unless founder-approved + every recipient consented + template governed + audited; outcomes → CRM + dashboard | AIO-01, AIO-02, AIO-04, AIO-05 |
| 14–16 | `features/ip` — intake + case workflow on `core/tickets` (counsel/provider, tasks, deadlines, fee/credit, vault via `core/documents`) | IP-01, IP-02 |
| 17 | NDA/confidentiality workflow — templates + signed-doc upload + link to access grants; confidential IP-doc restriction via `documents.visibleTo` + `confidential` category | IP-04, IP-05 |
| 18 | Dashboard integration — pipeline value, conversion, outreach outcomes, IP case status into the Phase-1/2 dashboard | OPS-06, KPI-08, KPI-10 |
| 19–20 | Integration + pilot — one startup end-to-end: capture lead → outreach brief → AI draft → blocked-without-approval → approve → outcome → pipeline + dashboard; open an IP case and restrict a confidential doc | AT-05, AIO-04 |

---

## 4. Exit Test

Blueprint **AT-05** is the acceptance bar (the Probasi-adopter clause is deferred to Phase 4 — substitute a staff/sales-mentor lead contribution):

> *"Startup uses CRM to capture a lead, [a sales mentor] contributes a sales introduction, converts an opportunity, and reports outcome."*

Plus the **AIO-04 guardrail proof**, which is the Must in this phase:

> *"Attempted send without approval is blocked and logged."*

Verify: (1) a converted opportunity's value shows on the **management dashboard's ops summary** — not just the founder's CRM screen; and (2) an outreach send attempted before approval, or to a non-consented contact, is **refused and written to the audit log**.

---

## 5. Carried-Forward Debt (Do Not Let This Compound Again)

Two live debts carried into Phase 3:
1. **Blaze blocker** — Phase 2's tamper-proof functions AND Phase 3's AI outreach both need Blaze. Resolve the upgrade before the Phase 3 AI work goes live.
2. Phase 1's **IDM-04 consent** was only partially met; Phase 3 Day 1 closes it at the contact level, but revisit whether registration/data-sharing consent needs the same rigor.

Before starting **Phase 4** (investor community, Probasi adoption, AI search — §5.9–5.11), run this same compliance pass against those sections **before** writing the day-by-day plan. Note Phase 4 leans heavily on §7's permission-aware RAG + §6 knowledge graph, which will need the vector-DB decision flagged back in the original feasibility review — do not defer that architecture call to mid-build.
