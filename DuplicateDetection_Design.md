# Mini-Phase Design — Duplicate Identity Detection & Merge (IDM-02 / NFR-09)

**Why this is its own mini-phase:** the Day-1 investigation confirmed there is **no** identity-resolution or merge capability anywhere in Phases 1–4 — only per-`uid` uniqueness guards. IDM-02/NFR-09 is a Phase-1-level Must and merging identity records rewrites ownership across nearly every collection, so it needs deliberate scoping, not a reactive day.

---

## 1. The requirement, precisely

> IDM-02 / NFR-09 — "maintain master records for persons and organisations without duplicate identities … duplicate detection and merge workflow."

Two distinct subjects:
- **Persons** → the `users` collection (founders, investors, adopters, staff).
- **Organisations** → the `startups` collection.

Two capabilities:
- **Detection** — surface *candidate* duplicates (same real person/org under two records).
- **Merge** — an admin-reviewed workflow that collapses a duplicate into a survivor and rewrites all references.

## 2. Scope & non-goals

**In scope**
- Normalized-identifier matching for persons (name + phone) and orgs (name + district).
- A **candidate queue** an admin reviews (never auto-merge — this is IDM-02's "workflow").
- Detection at two moments: **at creation** (warn the creator) and **on-demand admin scan** (sweep existing records).
- A **server-side merge** (Admin SDK) that reassigns references and tombstones the loser, fully audited.

**Non-goals (explicit)**
- No automated/heuristic auto-merge — admin decides every merge.
- No fuzzy ML matching — deterministic normalized-string + phone match only (tunable later).
- No cross-subject linking (a person who is both investor and adopter) — flagged as a follow-up, not built now.
- Email-exact person duplicates are already impossible (Firebase Auth enforces unique email); we match *different* emails for the *same* person.

## 3. The decision that shapes everything: detection ≠ merge on the Blaze axis

| Capability | Needs Blaze? | Why |
|---|---|---|
| **Detection** (persons on name+phone, orgs on name+district) | **No** | Matches only on **staff-readable** fields (`users.name/phone`, `startups.name/district`). An admin client can scan these today. |
| **Merge execution** | **Yes** (Cloud Function) | A merge must rewrite `founderId` on **founder-private** collections (`crmContacts`, `financeEntries`, `crmOpportunities`, `campaigns`) that **staff cannot read** (OPS-06). Only the Admin SDK can enumerate + rewrite them. |

So this mini-phase splits exactly like the rest of the project: **detection + review queue ship now (non-Blaze); the merge Cloud Function is built + emulator-tested now and deployed at the Blaze cutover.** No new billing gate beyond the one already pending.

## 4. Data model (additive)

```
duplicateCandidates/{autoId}   // the admin review queue
  subject:        "person" | "organisation"
  recordType:     "users" | "startups"
  recordIdA:      string        // the two records suspected to be the same
  recordIdB:      string
  matchReason:    string        // e.g. "name+phone exact (normalized)"
  matchedOn:      string[]      // ["name","phone"]
  status:         "open" | "dismissed" | "merged"
  detectedBy:     "creation" | "scan" | uid
  reviewedBy?:    uid
  createdAt, updatedAt
```
- On a confirmed merge, the survivor record gets `mergedFrom: [loserId,…]`; the loser gets `mergedInto: survivorId` + `identityStatus`/`approvalStatus` frozen (tombstone, never deleted — audit).
- Normalized match keys are computed at detect time (lowercase, trim, strip punctuation; phone digits-only). Optionally denormalized onto `users`/`startups` as `nameKey`/`phoneKey` to make scanning cheap — **additive fields**, written on create/update.

## 5. Detection mechanism (non-Blaze)

- **At creation:** `registerUser` / `createStartup` compute the normalized keys and query for an existing match; if found, they **write a `duplicateCandidates` entry** (status `open`) and let creation proceed (we don't block legitimate namesakes — we flag for review).
- **Admin scan:** an admin-invoked client routine (`/admin/duplicates`) pages `users` and `startups`, groups by normalized key, and upserts candidates for any collision. Deterministic candidate id (`sorted(idA,idB)`) so re-scans don't duplicate the queue.
- Admin review UI: list open candidates → **Dismiss** (not a duplicate) or **Merge** (calls the merge function).

## 6. Merge workflow (Cloud Function, Blaze-gated, built now)

`mergeIdentities({ recordType, survivorId, loserId })` — admin-only callable, Admin SDK transaction/batches:
1. Verify both exist, same subject, not already merged.
2. **Reassign references** from loser→survivor across every collection keyed to that identity:
   - person merge (`users`): `founderId`, `investorUid`, `adopterUid`, `requesterId`, `uploadedBy`, `contributedByUid`, `evaluatorIds[]`, `teamMemberUids[]`, `visibleTo[]`, `sentBy/toUserId`, `signerUid`, `createdBy`, etc. — enumerated per collection.
   - org merge (`startups`): `startupId` across applications, crm*, opsSummary, ipCases, campaigns, adoption*, investor profiles, dataRoom*, deals.
3. Tombstone the loser (`mergedInto`, freeze status). Never hard-delete.
4. Write a single `identity.merge` audit entry listing every doc touched.
- Idempotent + reversible-by-audit (the audit records the old owner of each reassigned doc).

## 7. Rules (additive, deny-by-default)

```
duplicateCandidates/{id}   read/write: isStaff() only (admin+cohort_manager); create also by the
                           creation-time detector (any approved user creating their own record's
                           candidate — scoped to records they just created). delete: false.
```
Merge writes come only from the Admin SDK (bypasses rules). Add `identity.merge` to the audit action union; the client may never forge it (same pattern as `application.decide`).

## 8. Build order (within this mini-phase)

1. **M1** Types + normalized keys (`nameKey`/`phoneKey`) written on create/update; `duplicateCandidates` type + rules + rules tests.
2. **M2** Creation-time detection in `registerUser` + `createStartup` (write candidate on match).
3. **M3** Admin review UI (`/admin/duplicates`) — list, dismiss, on-demand scan.
4. **M4** `mergeIdentities` Cloud Function (Admin SDK) + emulator integration tests (person-merge and org-merge each rewrite references + tombstone + audit). **Emulator only — deploy at Blaze cutover.**
5. **M5** Verify: tsc/lint/build, rules tests, functions tests.

## 9. Exit tests

- **Detection:** two `users` with the same normalized name+phone (different emails) produce exactly one open `duplicateCandidates` entry; a re-scan doesn't duplicate it.
- **Merge (emulator):** merging two founders reassigns a loser-owned startup + application + CRM lead to the survivor, tombstones the loser, and writes one `identity.merge` audit entry naming every doc touched. Same for an org merge.
- **Rules:** only staff read/write `duplicateCandidates`; a founder can't; the client can't forge an `identity.merge` audit entry.

## 10. Risk & dependency summary

- **Highest risk:** merge reference-rewriting missing a collection → orphaned ownership. Mitigation: a single enumerated `REASSIGNMENTS` map per subject, covered by the emulator test asserting each collection is rewritten; tombstone-not-delete so any miss is recoverable.
- **Blaze:** merge execution needs it (same gate as the AI cutover) — built + tested now, deployed later. Detection + review + scan need no Blaze.
- **No new billing gate.** No keys, no deploy.
