# SoF Startup Ecosystem Platform — Phase 2 Implementation Plan

**Status:** Phase 1 complete (Cloud Functions hardening done, hosted).
**Phase 2 scope:** Training, graduation, mentor/service ecosystem, supporting infrastructure.
**Compliance basis:** Bengal Startup Ecosystem IT Platform Requirements Blueprint v1.0, Sections 4.1, 5.3, 5.4, 5.8, 5.12.

---

## 1. Compliance Check Against Blueprint (Run Before Planning)

### Correctly scoped from initial draft
| ID | Requirement | Priority |
|---|---|---|
| LMS-01/02/03 | Curriculum, sessions, attendance, assignments, certificates, tracks, feedback into progress profile | M/M/S |
| GRD-01/02/03 | Graduation scorecard, alumni transition, certificate + outcome report | M/M/S |
| ECO-01 | Unified ecosystem directory (mentors, fab labs, providers, all categories) | M |
| ECO-02/03 | Structured service requests, mentor matching/booking/notes/ratings | M/M |
| ECO-04 | Fab lab equipment, calendar, safety prerequisites, booking, credits | S |
| ECO-05/06/07 | Managed provider entities, startup-as-provider dual role, SLA/escalation tracking | M/M/M |
| SUP-01 | Helpdesk for all personas | M |
| ADM-01 | Admin-configurable masters (sectors, categories, tracks) | M |

### Gaps caught on this compliance pass — added to scope below
| ID | Requirement | Priority | Why it was missed initially |
|---|---|---|---|
| COM-01 | Configurable notification templates per workflow stage | **M** | Assumed ad-hoc email from Phase 1 was sufficient; Phase 2's volume of training/session/SLA notifications requires a real template system |
| COM-02 | Communication timeline per applicant/startup/mentor/provider | **M** | Not needed until multiple notification sources existed — Phase 2 creates that condition |
| DOC-01 | Secure document vault: categories, versioning, expiry, permissions, retention | **M** | Phase 1 shipped basic file upload for applications only, not a real vault; certificates and training materials in Phase 2 expose this gap |

### Correctly deferred (S/C priority — confirmed safe to push past Phase 2)
ONB-03 (personalized development plan), MIS-04 (early warning alerts), ECO-08/09 (AI recommendations, service bundles), full PAY-01 payment gateway integration (lightweight credit counter suffices for now).

---

## 2. Architecture Additions

No changes to Phase 1 code. New feature folders and two new shared primitives:

```
core/
  masters/        Admin-editable taxonomies (sectors, categories, tracks) — ADM-01
  tickets/         Shared ticket primitive (category, urgency, provider, SLA, due date,
                   attachments, completion evidence, rating) — used by services + helpdesk
  meetings/        Generic booking entity (request → accept/reject → scheduled → completed)
                   — used by mentors now, investor/pitch meetings reuse it in Phase 4
  documents/       Document vault: categories, versioning, expiry, permission checks — DOC-01
  notifications/   Template engine + per-entity communication timeline — COM-01, COM-02

features/
  training/        LMS-01, LMS-02, LMS-03
  graduation/       GRD-01, GRD-02, GRD-03
  directory/        ECO-01
  mentors/          ECO-03 (built on core/meetings)
  fablabs/          ECO-04 (built on core/meetings)
  services/         ECO-02, ECO-05, ECO-06, ECO-07 (built on core/tickets)
  helpdesk/         SUP-01 (built on core/tickets)
```

**Why `documents` and `notifications` are `core/` and not `features/`:** every feature in Phase 2 and beyond needs to attach files (certificates, session notes, SLA evidence) and trigger notifications (reminders, confirmations, alerts). Building these once in `core/` now prevents every future feature from reinventing file/notification handling — the same reasoning that put `audit` and `roles` in `core/` during Phase 1.

---

## 3. Day-by-Day Plan (23 days, full-time)

| Days | Work | Blueprint IDs |
|---|---|---|
| 1 | `core/masters` — admin-editable taxonomies; everything below reads from here, nothing hardcoded | ADM-01, NFR-05 |
| 2–3 | `core/documents` — vault with categories, versioning, expiry, permission checks (e-sign integration deferred, manual upload/approve is enough for now) | DOC-01 |
| 4 | `core/notifications` — template system keyed by workflow stage + per-entity communication timeline | COM-01, COM-02 |
| 5 | `core/meetings` — generic booking entity: request → accept/reject → scheduled → completed, notes, follow-up tasks | (infra for ECO-03, ECO-04) |
| 6 | `core/tickets` — shared ticket primitive matching Section 4.1 schema exactly (category, urgency, required outcome, provider, SLA, due date, notes, attachments, completion evidence, rating) | (infra for ECO-02, SUP-01) |
| 7–9 | `features/training` — curriculum/module creation, session calendar, attendance, assignments, feedback, certificate generation (stored via `core/documents`), mandatory/elective/sector/investor-readiness tracks | LMS-01, LMS-02, LMS-03 |
| 10–11 | `features/graduation` — configurable graduation criteria + scorecard, alumni status transition preserving historical data, certificate + outcome report via `core/documents` | GRD-01, GRD-02, GRD-03 |
| 12–14 | `features/directory` + `features/mentors` — full searchable directory across all provider categories; mentor session booking on `core/meetings`; satisfaction ratings; mentor-hour tracking feeding startup KPIs | ECO-01, ECO-03 |
| 15–16 | `features/fablabs` — equipment listing, safety-prerequisite gate before booking, booking on `core/meetings`, consumable/credit tracking (lightweight ledger, not full payment gateway) | ECO-04 |
| 17–19 | `features/services` — service request tickets on `core/tickets`; provider onboarding as managed entities with catalogue/SLA/capacity; startup-as-provider dual role; SLA/escalation dashboard | ECO-02, ECO-05, ECO-06, ECO-07 |
| 20 | `features/helpdesk` — support tickets on the same `core/tickets` primitive, different category configuration | SUP-01 |
| 21–23 | Integration + pilot — wire training completion, mentor hours, SLA compliance, fab lab utilization into the existing Phase 1 dashboard; run one cohort through training → mentor support → graduation end to end | KPI-04 to KPI-07, AT-04 |

---

## 4. Exit Test

Blueprint scenario **AT-04** is the actual Phase 2 acceptance bar, not "did I build each screen":

> *"Startup requests mentor and fab lab support; mentor session and lab booking are scheduled, completed, rated, and reflected in dashboards."*

Verify the rating and hours from a real booking actually surface on the Phase 1 dashboard's funnel view — not just inside the feature's own screen — before calling Phase 2 done.

---

## 5. Carried-Forward Debt (Do Not Let This Compound Again)

Phase 1 shipped without full DOC-01 compliance and it went unnoticed until this check. Before starting Phase 3, run the same compliance pass against Sections 5.5–5.7 (operations suite, AI outreach, patent/IP support) before writing the day-by-day plan — not after.
