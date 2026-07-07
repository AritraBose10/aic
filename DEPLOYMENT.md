# Deployment & Day-15 Pilot Runbook

Bengal Startup Ecosystem — Techno India Group / AIC. Next.js 16 + Firebase Auth + Firestore.

These are the steps that must run on **your** machine / the Firebase console — they need
an interactive browser login or console access that can't be automated from the build box.

---

## 0. Prerequisites (once)

```bash
# Node 20+ and the repo installed
npm install

# Firebase CLI (if not global)
npm i -g firebase-tools     # or use `npx firebase-tools ...`

# Java (only needed to RUN the rules test suite locally)
brew install openjdk
echo 'export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

`.env.local` must hold the aic-techno web config (already present locally; it is gitignored,
so re-create it on any new machine from `.env.local.example`).

---

## 1. Firebase console setup — ✅ DONE

Project: **aic-techno** (`console.firebase.google.com/project/aic-techno`).

1. ✅ **Email/Password** sign-in is enabled.
2. ✅ Firestore `(default)` database exists (Native mode).

---

## 2. Deploy rules + indexes — ✅ DONE (re-run after any rule/index change)

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

`.firebaserc` points the default project at `aic-techno`. Rules are released and the composite
index (`users`: role + approvalStatus) is deployed.

> Re-run this deploy after **any** change to `firestore.rules` or `firestore.indexes.json`.

---

## 2b. Cloud Functions — ⚠️ built + emulator-tested, NOT yet deployed (needs Blaze)

The committee decision and application submission are **server-authoritative**: they run as
callable Cloud Functions (`functions/src/index.ts`) that enforce, with Admin privileges the
client can't bypass — cohort **capacity**, **eligibility**, admin-only **unlock**, the
**deadline**, and an **immutable, server-authored audit trail**. The current `firestore.rules`
(already written) forbid the client from writing `committeeDecision`, `selectedCount`, decision
`status` transitions, `submitted`, or those audit actions — so these paths ONLY work once the
functions are deployed.

**This is a deploy-together package and requires the Firebase Blaze (pay-as-you-go) plan.**
Until you deploy it, keep the **currently-live** ruleset (from step 2) as-is — do NOT deploy the
newer rules alone, or decisions/submissions will break (the client can no longer write them and
the functions aren't there yet).

To activate (when ready):

```bash
# 1. Upgrade aic-techno to the Blaze plan (Firebase console → Usage & billing).
# 2. Deploy functions + the tightened rules together:
firebase deploy --only functions,firestore:rules,firestore:indexes
```

Local development against the emulator (no Blaze needed):

```bash
# terminal 1 — run the functions + firestore emulators
firebase emulators:start --only functions,firestore

# terminal 2 — point the app at the local functions emulator, then run it
NEXT_PUBLIC_USE_FUNCTIONS_EMULATOR=true npm run dev
```

---

## 3. Prove the rules AND functions before trusting them

```bash
npm run test:rules       # Firestore emulator + 37 rules tests
npm run test:functions   # Firestore emulator + 11 Cloud Function tests
```

Both require Java on PATH (step 0) and run entirely offline against `demo-aic-techno` — they
never touches the live project. Keep it green; add a case here whenever you touch a rule.

---

## 4. Bootstrap the first admin (once)

Self-registration deliberately cannot create admins, so the first one is promoted by hand:

1. In the running app, **Register** with your real email (pick any role — you'll overwrite it).
   You'll land on "Awaiting approval."
2. Firestore console → `users` collection → open the doc whose id is your Auth uid → set:
   - `role` → `admin`
   - `approvalStatus` → `approved`
3. Reload the app → you're in, with an **Approvals** nav item.

Every later account (founder / evaluator / cohort_manager) self-registers and is approved
from **Approvals** — no more console edits.

---

## 5. Day-15 end-to-end pilot script

Run this once against a test cohort to confirm the whole lifecycle. Use a few throwaway
accounts (an admin, a cohort manager, two evaluators, a founder).

1. **Register + approve** each account (admin approves them from Approvals).
2. **Founder →** `/startup` → create a startup profile; optionally invite a teammate.
3. **Cohort manager →** `/cohorts` → New cohort → set capacity (e.g. 2), open window, then
   flip status to **Open**.
4. **Founder →** `/cohorts` → Apply → fill pitch summary + deck link → Submit.
   - Verify: applying to a **closed/draft** cohort is impossible; submitting after the
     close date is blocked.
5. **Cohort manager →** `/cohorts/<id>/applications` → Assign the two evaluators.
6. **Each evaluator →** `/evaluate` → open the application → declare no conflict → score 1–10,
   or declare a conflict (scoring disables). Confirm one evaluator can't see the other's score.
7. **Cohort manager →** review view → set eligibility → **Select** (or waitlist/reject).
   - Verify: capacity is enforced (selecting past capacity is blocked); an ineligible
     application can't be selected.
8. **Founder →** `/startup` → work the onboarding checklist; **Capture baseline KPIs**
   (appears in KPI history; can't be edited afterward). Cohort manager marks *Founder verified*.
9. **Admin/manager →** `/dashboard` → confirm the funnel, filters (cohort/sector/stage),
   cohort capacity bar, and the incubatee list all reflect the run.
10. **Admin →** reopen the locked decision, re-decide to rejected → confirm the startup's
    incubation is rescinded and the cohort's selected count drops.

---

## 6. Hosting (Vercel)

Set the six `NEXT_PUBLIC_FIREBASE_*` vars from `.env.local` in the Vercel project settings,
then deploy. Add the Vercel domain to Firebase **Auth → Settings → Authorized domains**.

---

## Known limitations (tracked)

- **Capacity, deadline, eligibility, and the decision/submit audit trail are now
  tamper-proof via Cloud Functions** (server-authoritative; client denied by rules) —
  but only *after* you deploy the functions (step 2b, needs Blaze). Until then prod runs the
  earlier client-enforced version, which is correct on the happy path but bypassable by a
  crafted staff write.
- **Audit entries for lower-stakes actions** (register, approve, assign, score, eligibility,
  onboarding, KPI) are still client-written and best-effort. Only the high-stakes actions
  (`application.decide` / `.reopen` / `.submit`) are server-authored. Converting the rest is a
  follow-on if you want a fully tamper-proof trail.
- **Portfolio-level KPI rollup** on the dashboard is deferred — needs a `collectionGroup`
  query + rule. Per-startup KPI history already works.
- **MFA / password-complexity policy** for privileged roles is not enabled (Firebase console
  + password-policy config when you harden past the pilot).
