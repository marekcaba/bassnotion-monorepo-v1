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
LAUNCH-01 (Whitelist page)  ─┐
                             │
LAUNCH-02 (Capped levers) ───┼──► LAUNCH-03 (Membership) ───► LAUNCH-06 (Pack) ───► LAUNCH-07 (Accelerator) ───► LAUNCH-09 (Open)
                             │                          │
LAUNCH-04 (Earn next groove)─┘                          └──► LAUNCH-08 (Bundle webhook)
                                                        │
                                                        └──► LAUNCH-05 (Playback polish)
```

- **LAUNCH-01** is independent and tiny (~1 day). Ships immediately to unblock YouTube channel opening.
- **LAUNCH-02 + LAUNCH-04** are the foundation of the free tier. Can be built in parallel.
- **LAUNCH-03 (Membership)** depends on LAUNCH-02 (it needs caps to uncap). First paid product, validates the cap system end-to-end.
- **LAUNCH-05** can land any time during weeks 0-3.
- **LAUNCH-06, 07, 08** extend Membership infrastructure.

---

## The backlog

### Phase 1 — Whitelist & free-tier foundation

| ID | Title | Status | Detailed? |
|---|---|---|---|
| **LAUNCH-01** | [Whitelist email-capture landing page](./LAUNCH-01-whitelist-page.md) | 📝 Ready | ✅ Yes |
| **LAUNCH-02** | [Capped lever system — free-tier wall](./LAUNCH-02-capped-levers.md) | 📝 Ready | ✅ Yes |
| **LAUNCH-03** | [Membership infrastructure — $24/mo recurring](./LAUNCH-03-membership.md) | 📝 Ready | ✅ Yes |
| **LAUNCH-04** | ["Earn next groove" gate — played-in-full N times](./LAUNCH-04-earn-next-groove.md) | 📝 Ready | ✅ Yes |
| **LAUNCH-05** | [Playback polish — loading UX + retry + iOS banner](./LAUNCH-05-playback-polish.md) | 📝 Ready | ✅ Yes |

### Phase 2 — Paid products

| ID | Title | Status | Detailed? |
|---|---|---|---|
| **LAUNCH-06** | Groove Pack purchasing — Funk Vol. 1 ($39) | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-07** | Accelerator drip-feed — Economy Picking ($97) + cohort | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-08** | Bundle entitlements — webhook grants multiple SKUs | ⏳ Stub | ⬜ Not yet |

### Phase 3 — Hide unfinished + landing rewrite

| ID | Title | Status | Detailed? |
|---|---|---|---|
| **LAUNCH-09** | Hide unfinished features from nav (Groove Finder, Journey, Patterns, Social) | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-10** | Public landing page rewrite — drop "personalized practice," lead with playback | ⏳ Stub | ⬜ Not yet |

### Phase 4 — Open prep

| ID | Title | Status | Detailed? |
|---|---|---|---|
| **LAUNCH-11** | Whitelist conversion flow — 1 month free Membership grant on signup | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-12** | Rollback runbook + production audit + final QA walkthrough | ⏳ Stub | ⬜ Not yet |

### Phase 5 — Post-open

| ID | Title | Status | Detailed? |
|---|---|---|---|
| **LAUNCH-13** | Founding Membership offer — first 100, $397 lifetime, launch window | ⏳ Stub | ⬜ Not yet |
| **LAUNCH-14** | Email sequence — 14-day welcome arc + weekly groove reps | ⏳ Stub | ⬜ Not yet |

---

## Sequencing & status legend

- 📝 **Ready** — fully detailed, can be picked up
- ⏳ **Stub** — scope known, details to flesh out when we get closer
- 🚧 **In progress** — actively being built
- ✅ **Done** — shipped to staging or production

## How to use this backlog

1. Pick a story from **Phase 1** first. LAUNCH-01 ships in a day to unblock YouTube; LAUNCH-02 is the big foundational build.
2. Mark status as you go (📝 → 🚧 → ✅).
3. When ready to start a Phase 2 story, ask Claude to flesh out the detail (the stub becomes a full story doc).
4. If a story turns out to be too big, split it. If two stories merge, mark one as superseded — don't delete the file (preserve history).
