# Launch Backlog — Funnel-Aligned Public Launch

**Parent Plan:** [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Funnel Vision:** [BASSICOLOGY_FUNNEL_VISION.md](../../../BASSICOLOGY_FUNNEL_VISION.md)
**Created:** 2026-05-22
**Status:** Active execution

---

## What this folder is

The full development backlog for the public launch. Each story below is **epic-sized (~1 week of focused work)**. The first 5 stories are fleshed out in detail; the rest are stubs with enough scope to know what they'll become.

**Story sizing:** epic-sized — one coherent feature per story. Examples: "the entire tempo cap end-to-end" is one story, not three.

## The critical path

```
LAUNCH-02.5 (epic, split a→b→{c,d}) ──┬──► LAUNCH-01 (Whitelist page)         ──┐
                                      │       (unblocked specifically by 02.5d)    │
                                      ├──► LAUNCH-02 (Capped levers)            ──┼──► LAUNCH-03 (Membership) ───► LAUNCH-06 (Pack) ───► LAUNCH-07 (Accelerator) ───► LAUNCH-09 (Open)
                                      │       (unblocked specifically by 02.5c)    │                          │
                                      └──► LAUNCH-05 (Playback polish)          ──│                          └──► LAUNCH-08 (Bundle webhook)
                                              (Fix 1 unblocked by 02.5c;            │
                                               Fixes 2/3/4 already independent)     │
                                                              LAUNCH-04 (Earn next groove) ──────────────────┘
```

- **LAUNCH-02.5** is the ground-base block — every other surface assumes it exists. It is **split into 4 sub-stories** (02.5a → 02.5b → 02.5c → 02.5d) that land serially. See the [epic index](./LAUNCH-02.5-groove-card-block.md) for the split rationale and dependency seams.
- **LAUNCH-01**'s stop-ship (the placeholder Groove Card on the waitlist) is closed **specifically by 02.5d**, not the whole 02.5 epic. Other LAUNCH-01 work (copy, CTAs, intent-aware signup) is already independent.
- **LAUNCH-02 + LAUNCH-04** are the foundation of the free tier. LAUNCH-02 specifically blocks on **02.5c** (the card ships the `useEntitlement` call sites that LAUNCH-02 swaps real logic into). LAUNCH-04 can be built in parallel.
- **LAUNCH-03 (Membership)** depends on LAUNCH-02 (it needs caps to uncap). First paid product, validates the cap system end-to-end.
- **LAUNCH-05** polishes the Groove Card. Specifically, Fix 1 (single play-button loading state) targets **02.5c**'s play button. Fixes 2/3/4 (preload, retry, iOS banner) are already independent of 02.5 and can ship any time.
- **LAUNCH-06, 07, 08** extend Membership infrastructure.

---

## The backlog

### Phase 1 — Whitelist & free-tier foundation

| ID                      | Title                                                                                                                                   | Status               | Detailed? |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------- |
| **LAUNCH-01**           | [Whitelist email-capture landing page](./LAUNCH-01-whitelist-page.md)                                                                   | 📝 Ready             | ✅ Yes    |
| **LAUNCH-02**           | [Capped lever system — free-tier wall](./LAUNCH-02-capped-levers.md)                                                                    | 📝 Ready             | ✅ Yes    |
| **LAUNCH-02.5**         | [Groove Card block — epic (split into 4 sub-stories)](./LAUNCH-02.5-groove-card-block.md)                                               | 🚧 2 of 4 shipped    | ✅ Yes    |
| &nbsp;&nbsp;↳ **02.5a** | [`InstrumentType` canonical refactor](./LAUNCH-02.5a-instrumenttype-refactor.md) — ~2d, no feature                                      | ✅ Done (`48f8b85`)  | ✅ Yes    |
| &nbsp;&nbsp;↳ **02.5b** | [Audio stems as first-class DAW peers](./LAUNCH-02.5b-audio-stems-daw-peers.md) — ~3-4d, engine only, no UI                             | ✅ Done (`6f50acf`)  | ✅ Yes    |
| &nbsp;&nbsp;↳ **02.5c** | [Groove Card block (in /app)](./LAUNCH-02.5c-groove-card-in-app.md) — ~5-6d, card UI + admin form, unblocks LAUNCH-02 & LAUNCH-05 Fix 1 | 📝 Ready (unblocked) | ✅ Yes    |
| &nbsp;&nbsp;↳ **02.5d** | [Waitlist embed swap](./LAUNCH-02.5d-waitlist-embed-swap.md) — ~2-3d, closes LAUNCH-01 stop-ship                                        | ⏳ Blocked on 02.5c  | ✅ Yes    |
| **LAUNCH-03**           | [Membership infrastructure — $24/mo recurring](./LAUNCH-03-membership.md)                                                               | 📝 Ready             | ✅ Yes    |
| **LAUNCH-04**           | ["Earn next groove" gate — played-in-full N times](./LAUNCH-04-earn-next-groove.md)                                                     | 📝 Ready             | ✅ Yes    |
| **LAUNCH-05**           | [Playback polish — loading UX + retry + iOS banner](./LAUNCH-05-playback-polish.md)                                                     | 📝 Ready             | ✅ Yes    |

### Phase 2 — Paid products

| ID            | Title                                                  | Status  | Detailed?  |
| ------------- | ------------------------------------------------------ | ------- | ---------- |
| **LAUNCH-06** | Groove Pack purchasing — Funk Vol. 1 ($39)             | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-07** | Accelerator drip-feed — Economy Picking ($97) + cohort | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-08** | Bundle entitlements — webhook grants multiple SKUs     | ⏳ Stub | ⬜ Not yet |

### Phase 3 — Hide unfinished + landing rewrite

| ID            | Title                                                                          | Status  | Detailed?  |
| ------------- | ------------------------------------------------------------------------------ | ------- | ---------- |
| **LAUNCH-09** | Hide unfinished features from nav (Groove Finder, Journey, Patterns, Social)   | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-10** | Public landing page rewrite — drop "personalized practice," lead with playback | ⏳ Stub | ⬜ Not yet |

### Phase 4 — Open prep

| ID            | Title                                                               | Status  | Detailed?  |
| ------------- | ------------------------------------------------------------------- | ------- | ---------- |
| **LAUNCH-11** | Whitelist conversion flow — 1 month free Membership grant on signup | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-12** | Rollback runbook + production audit + final QA walkthrough          | ⏳ Stub | ⬜ Not yet |

### Phase 5 — Post-open

| ID            | Title                                                               | Status  | Detailed?  |
| ------------- | ------------------------------------------------------------------- | ------- | ---------- |
| **LAUNCH-13** | Founding Membership offer — first 100, $397 lifetime, launch window | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-14** | Email sequence — 14-day welcome arc + weekly groove reps            | ⏳ Stub | ⬜ Not yet |

---

## Sequencing & status legend

- 📝 **Ready** — fully detailed, can be picked up
- 📝 **Split** — original story has been broken into sub-stories; use the sub-stories, the parent is the epic index
- ⏳ **Stub** — scope known, details to flesh out when we get closer
- 🚧 **In progress** — actively being built
- ✅ **Done** — shipped to staging or production

## How to use this backlog

1. Pick a story from **Phase 1** first. LAUNCH-01 ships in a day to unblock YouTube; LAUNCH-02 is the big foundational build.
2. Mark status as you go (📝 → 🚧 → ✅).
3. When ready to start a Phase 2 story, ask Claude to flesh out the detail (the stub becomes a full story doc).
4. If a story turns out to be too big, split it. If two stories merge, mark one as superseded — don't delete the file (preserve history).
