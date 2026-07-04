# SoF Startup Ecosystem Platform — Implementation Plan

**Prepared for:** School of the Future, Techno India University
**Stack:** Next.js 14, Firebase Auth, Firestore, Vercel
**Build approach:** Solo build, AI-assisted (Claude Opus 4.8)
**Phase 1 target:** 15 days, full-time

---

## 1. Core Principle: Extensibility Without Disruption

Every feature lives in its own folder and only touches shared code through three fixed entry points: **types**, **permissions**, and **audit log**. Nothing else is shared. A feature added in Phase 3 never requires editing Phase 1 code — it adds a new folder, registers its route, and imports from those three places.

This matters because the source blueprint specifies 12 functional areas across 5 phases (identity, cohorts, training, ecosystem services, operations, investors, diaspora adoption, AI search). Building these as one growing codebase without a seam strategy guarantees that Phase 3 work breaks Phase 1 behavior. The folder structure below prevents that by construction, not by discipline.

---

## 2. Folder Architecture

```
src/
  core/                 The only "shared" layer — touched rarely, additively only
    types/              Single source of truth for all data shapes
    roles/              Permission checks: can(role, action)
    audit/              One function every feature calls to log writes
  lib/
    firebase.ts         Single Firebase SDK init point
  features/             One self-contained folder per feature
    auth/
    cohorts/
    applications/
    startups/
    dashboard/
    (mentors/, crm/, investors/, adoption/ — added in later phases, same pattern)
  app/                  Next.js routes — thin, just wire features to URLs
```

**Why this holds up as features are added:**
- Roles are additive: a new role is a new entry in a permissions map, not new `if` statements scattered across the codebase.
- Types are additive: existing interfaces get extended, never rewritten.
- Each feature's Firestore queries live inside that feature's own `queries/` folder, so one feature's code cannot accidentally reach into another's logic.

**Rule for adding any future feature:**
1. New folder under `features/`
2. Extend `core/types` if a new data shape is needed (additive only)
3. Add permissions to `core/roles/permissions.ts` (additive only)
4. Call `logAuditEvent()` on every meaningful write
5. Add one route in `app/` pointing to the feature

---

## 3. Data Model (Fixed Across All Phases)

Five core Firestore collections cover the entire platform. Later phases add new top-level collections — they never modify these five.

| Collection | Purpose |
|---|---|
| `users` | Role, profile, approval status (pending/approved/rejected), consent record |
| `cohorts` | Dates, eligibility rules, scoring rubric, capacity |
| `applications` | Form data, documents, status, evaluator scores, committee decision |
| `startups` | Created on selection; includes `kpiSnapshots` as an append-only subcollection |
| `auditLog` | Every meaningful write across every feature, from day one |

**Security minimum (non-negotiable even at MVP):** Firestore security rules enforce role-based read/write server-side — not client-side checks only. The audit log exists from day one specifically to prevent evaluators from seeing each other's scores or applicants reading reviewer notes.

---

## 4. Phase 1 Build Plan — 15 Days, Full-Time

Registration model: **self-service signup with admin approval for all roles**, per the source blueprint (no invite-only shortcut).

| Days | Feature Folder | What Ships |
|---|---|---|
| 1–2 | `core/*`, `lib/firebase.ts`, `features/auth` | Types, roles, audit log, Firebase init, multi-step self-registration, admin approval queue |
| 3–4 | `features/startups` | Founder profile CRUD, team member invite/delegate |
| 5–7 | `features/cohorts`, `features/applications` | Cohort creation, application draft/submit, completeness check before submission |
| 8–10 | `features/applications` (extended) | Evaluator assignment, scorecard submission, conflict-of-interest flag, committee decision recording + lock |
| 11–12 | `features/startups` (extended) | Onboarding checklist, baseline KPI snapshot capture (append-only, never overwritten) |
| 13–14 | `features/dashboard` | Application funnel view, filters by cohort/sector/stage, KPI history view |
| 15 | — | End-to-end pilot run with a test cohort: register → apply → evaluate → decide → onboard → appear on dashboard. Fix what breaks. |

This covers every **Must-have** requirement in the source blueprint's Sections 5.1–5.3 and 5.8 (Identity, Applications/Selection, Onboarding/Training basics, Management dashboards). Everything in Sections 5.4–5.7 and 5.9–5.12 (mentor/fab lab marketplace, CRM/accounting/logistics, AI outreach, IP/patent workflow, investor community, Probasi adoption, AI search) is explicitly deferred.

---

## 5. Phased Roadmap Beyond MVP

| Phase | Scope | Est. Duration (solo, full-time, AI-assisted) |
|---|---|---|
| **Phase 1 — Core MVP** | Auth/RBAC, profiles, cohort application, selection, onboarding, basic dashboard | 3–4 weeks (compressed to 15 days for pilot cut) |
| **Phase 2 — Ecosystem services** | LMS/training tracking, mentor matching, fab lab booking, service marketplace, helpdesk | +4–5 weeks |
| **Phase 3 — Operations suite** | CRM, accounting integration, logistics, AI outreach copilot, IP/patent case tracking | +5–6 weeks |
| **Phase 4 — Investor & diaspora** | Investor profiles, NDA-gated data rooms, pitch events, Probasi adoption portal | +5–6 weeks |
| **Phase 5 — AI intelligence layer** | Permission-aware RAG search, knowledge graph, matching engines, analytics copilot | +4–6 weeks |

**Total for full platform: ~5–6 months full-time solo**, assuming no scope creep and steady AI-assisted output. This does not include compliance/certification timelines (see below).

---

## 6. Cost Summary by Phase

| Phase | Paid tools needed | Realistic monthly cost |
|---|---|---|
| Phase 1 | Firebase Blaze (pay-as-you-go), domain name, transactional email (Resend/SendGrid free tier) | Under ₹2,000/month, mostly domain cost only |
| Phase 2 | No major new infra; SMS gateway if added (~₹0.15–0.30/SMS) | Low, usage-based |
| Phase 3 | LLM API usage (outreach drafts), accounting integration (Zoho Books-style, ~₹500–3,000/month) | Starts becoming a real line item |
| Phase 4 | E-signature service (~$10–40/month), Razorpay (2% per transaction, no fixed fee) | Moderate |
| Phase 5 | Vector database (Pinecone-style, ~$70+/month at real volume), LLM API at scale | Largest recurring cost |
| **Not phase-bound, needed before external trust matters** | VAPT / penetration testing (₹1.5–4 lakh), ISO 27001 / SOC2 certification | One-time, large, cannot be compressed by better tooling |

---

## 7. Explicit Non-Goals for the 15-Day Sprint

To keep scope honest, the following are **not** part of Phase 1 regardless of how fast the coding goes, because they require design and governance decisions AI-assisted coding cannot shortcut:

- CRM, accounting, or logistics tooling
- AI-powered outreach or search
- Investor data rooms
- Probasi Bangali–style external adoption program
- Any compliance certification (VAPT, ISO 27001, SOC2)
- Automated mentor-matching algorithms (Phase 1 uses manual assignment)

---

## 8. Immediate Next Step

Begin Day 1: scaffold `core/types`, `core/roles`, `core/audit`, `lib/firebase.ts`, and the self-registration + admin approval flow in `features/auth`. All subsequent features build on top of this without modification.
