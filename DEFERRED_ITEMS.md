# Deferred / Out-of-Scope Register

Canonical list of blueprint requirements consciously **not built** in the current
platform (Phases 1–4 + pre-GA hardening), each with reasoning and a revisit/trigger
condition. Feature-level S/C deferrals also appear in the per-phase plan docs; this
file is the authoritative cross-cutting register.

| ID | Requirement | Priority | Status | Revisit trigger |
|----|-------------|----------|--------|-----------------|
| **API-01** | General API / integration gateway (versioned API + webhook emitter per §8.3) | **M** | **Deferred — trigger-gated** | See explicit trigger below |
| **OPS-05** | Logistics / supply chain (vendors, POs, inventory, shipments, delivery) | S | Deferred | Sector-mix demand (below) |
| NFR-13 | Interoperability / external integration standards | M | Deferred | Beyond single-institution use |
| NFR-07 | Localisation (multi-language UI) | S | Deferred | No current requirement |
| NFR-15 | Vendor neutrality | S | Deferred | No current requirement |
| SEC-07 | Production access control (process) | — | Human/process | Procurement decision, not code |
| SEC-08 | Penetration testing (process) | — | Human/process | Schedule before public launch |

---

## API-01 — General API / integration gateway (Must) — DEFERRED, trigger-gated

**Status (as of scope-closure check):** No external-facing API exists. All
functionality runs only through the internal Next.js app + Firebase session auth;
every Cloud Function is `onCall` (requires an app-minted Firebase ID token), there
are no `onRequest`/REST routes, no inbound API-key auth, and no webhook emitters for
the §8.3 events (`application.submitted`, `startup.selected`, `service.requested`,
`kpi.overdue`, `investor.access_requested`, `adoption.accepted`, `graduation.approved`).

**Reasoning for deferral:** An API/webhook layer with **zero current external
consumers** cannot be meaningfully built or tested end-to-end before the Blaze
cutover (HTTP `onRequest` functions / hosting rewrites need Blaze), and building a
speculative integration surface for a single-pilot deployment is premature.

**Explicit trigger — build as soon as ANY concrete external integration is requested:**
> Build API-01 (versioned API + webhook emitter per §8.3) as soon as any concrete
> external integration is requested — e.g. TIU wants to connect an external CRM, a
> funding body requests programmatic reporting access, or the platform is proposed
> for use beyond a single institution. **Do not build speculatively before that point.**

This is a *trigger-gated* deferral, not an open-ended one: the moment a real
integrator exists, API-01 returns to scope as a Must.

---

## OPS-05 — Logistics / supply chain (Should) — DEFERRED

**Status:** No logistics/supply-chain functionality anywhere (no vendor/PO/inventory/
shipment/delivery module, no collection, no `logisticsMode` on `OpsConfigDoc`). Phase 3
delivered the Must ops items (CRM, accounting, ops rollup, IP) and deferred OPS-03/04/05
depth per its plan.

**Reasoning for deferral:** The single-institution pilot has no vendor/shipment/inventory
need.

**Revisit trigger:** Only if a future cohort's sector mix (e.g. hardware / manufacturing
startups) creates real demand. Open-ended — revisit on demand signal, no fixed date.
