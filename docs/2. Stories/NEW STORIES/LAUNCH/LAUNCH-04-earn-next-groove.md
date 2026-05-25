# [LAUNCH-04] "Earn Next Groove" Gate — Played-in-Full N Times (Interim, Until Bridge)

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~1 week
**Status:** 📝 Ready
**Independent of:** LAUNCH-02, LAUNCH-03 (can be built in parallel)
**Replaces in v24:** This gate is the **interim** mechanism until the Bridge scoring system ships.

---

## Story

- As a **free user who just finished playing this week's groove**
- I want to **know I'm making progress and earn access to the next groove by actually playing the current one**
- so that **the free tier feels like a game where reps are the currency, not a passive library to scroll through**

And:

- As **a free user choosing what to play next**
- I want to **steer the next groove (harder · same · easier) and a genre lean**
- so that **I have agency in my path and don't feel marched through a single curriculum**

And:

- As **Marek**
- I need **a release valve on the gate** (the "easier" option always available)
- so that **no one gets trapped behind a gate they can't pass, demoralized**

## Background / Context

The funnel-vision describes a **collect-and-conquer game** where free users earn the next groove by **demonstrating progress on the current one**. The vision specifies *Bridge scoring* as the gate ("you can play this now"), explicitly **not** rep count ("you pressed play 4 times"):

> *"Gating on a quota builds a treadmill that rewards attendance over learning and demoralizes the stuck-intermediate avatar. Gating on demonstrated ability rewards the only thing that matters."*

**Bridge is deferred to v24** (decided in our planning discussion). We need an **interim gate** that:
1. Honors the *spirit* of the funnel rule — measure something closer to "did you actually play this" than "did you press play"
2. Stays simple enough to ship pre-launch
3. Can be swapped for Bridge scoring later without breaking the surrounding game loop

**The interim mechanism: "played-in-full N times."** Must complete the groove's loop (not abandon mid-bar). N is a **configurable** value that we can tune from a dashboard. Starts at 3.

This is **a soft compromise**, not a "we agree with quotas." We're watching closely once whitelist users are inside; if we see frustration at the gate, **N is the first knob we turn**.

### The unlock loop

```
Play current groove          (capped levers from LAUNCH-02 still in effect)
        │
        ▼
"Played in full" event fires when groove reaches end of loop section
        │
        ▼
Counter increments per (user, groove)
        │
        ▼
When count ≥ N (configurable):
   Show "Choose your next groove" UI
        │
        ▼
User picks: harder · same level · easier  +  genre lean (optional)
        │
        ▼
Next groove selected & unlocked from the available pool
```

### Critical: the release valve

> **"The 'too hard / easier' branch is also the release valve. If someone genuinely can't pass a groove, the system must offer a step down rather than trapping them behind the gate feeling like a failure."**

The "easier" path is **always available**, not gated. A free user struggling on groove #2 can pick "easier" → skip to a more approachable next groove. The current groove isn't blocked — they can still practice it — but they aren't trapped.

This single mechanism is the difference between a game that motivates and a game that demoralizes.

## Solution / Scope

### 1. "Played in full" detection

A groove is "played in full" when the user **plays through one complete loop section** without abandoning. Detection rules:

- Playback reaches end of the defined loop region naturally (not via skip / scrub).
- User did not pause for more than `MAX_PAUSE_DURATION` (e.g., 30s) during the play-through.
- Tab was active (no playback while user was on another tab) — use Page Visibility API.
- The full play-through is at least the groove's `min_play_duration` (some grooves loop in 30s; some in 90s).

Edge cases:
- **Pause then resume within threshold** = same play-through, counts toward completion.
- **Pause then resume after threshold** = abandoned, doesn't count. New play-through starts.
- **Scrubbing/seeking mid-play** = treated as abandonment for this play-through (prevents gaming the counter by seeking to the end).
- **Tab backgrounded while playing** = doesn't count (prevents leaving the tab open as a counter farm).

### 2. Counter persistence

- **Table `groove_plays`:**
  - `id uuid pk`
  - `user_id uuid fk → users`
  - `groove_id uuid fk → grooves` (or whatever the existing table is — verify naming)
  - `completed_count int default 0`
  - `unlocked_at timestamptz` (when count first hit N)
  - `last_played_at timestamptz`
- **API:** `POST /grooves/:id/played-in-full` increments counter, returns new count + `unlocked` boolean
- **API:** `GET /grooves/progress` returns the user's count per groove + which are unlocked

### 3. Unlock UI — "Choose your next groove"

Once `completed_count >= N`, show an overlay (or panel) at the end of the next play-through:

```
┌─────────────────────────────────────────┐
│  Nice. You've played this groove ×N.    │
│  Pick your next one:                    │
│                                          │
│  [ Harder ]  [ Same level ]  [ Easier ] │
│                                          │
│  Genre lean (optional):                  │
│  [ Funk ] [ Rock ] [ Jazz ] [ Latin ]   │
│                                          │
│  [ Pick for me ]                         │
└─────────────────────────────────────────┘
```

- **Always show "Easier"** even if no easier groove technically exists at this user's current level — the system can step them back to a re-arranged version of one they already played (or just acknowledge "stick with this one for now").
- **"Pick for me"** = system picks one based on the user's previous lean + variety.
- **One choice per unlock event** — they pick, the next groove loads.

### 4. The next-groove selection

This is the *algorithm* that picks which groove to surface based on the choice:

- Maintain a list of all grooves with metadata: `level (int)`, `genre (string[])`, `technique_tags (string[])`.
- Filter to grooves the user hasn't played yet (or has played < N times — re-surfacing isn't blocked).
- Apply the directional filter (`harder` = level + 1, `same` = level, `easier` = level - 1).
- Apply genre lean if specified.
- If no groove matches → fall back gracefully (broaden the filter, eventually any unplayed groove).

For launch, this can be **very simple**. Even a random pick from the directional subset works — the *agency* matters more than algorithmic sophistication.

### 5. Configurable N — admin dashboard

- **Env var `NEXT_GROOVE_UNLOCK_THRESHOLD`** with a sensible default (3).
- **Optional admin route `/admin/launch-config`** with a single number input for N. (Skip the admin UI if scope tight — env var alone is fine for launch; we can redeploy to tune.)
- **Per-user override** in a `user_flags` table for testing (so we can set N=1 for QA accounts).

### 6. Telemetry — the data that tells us if it's working

Emit events:
- `groove_played_in_full` — every completion
- `groove_unlocked` — when threshold hit
- `next_groove_choice` — `{ choice: 'harder'|'same'|'easier', genre_lean?: string }`
- `unlock_overlay_dismissed` — user closed without picking (signal of friction)

**The key metric to watch:** *cohort retention by groove count.* If 50% of users hit groove 1's wall and 5% reach groove 2, the gate is too tight. If 95% reach groove 4 with no engagement at the wall, it's too loose.

## Requirements

### Functional

- [ ] "Played in full" detection works on the existing playback engine
- [ ] Counter persists per (user, groove); resists pause/scrub/tab-switch gaming
- [ ] `POST /grooves/:id/played-in-full` increments and returns count + unlocked status
- [ ] `GET /grooves/progress` returns user's counts
- [ ] Unlock overlay appears when threshold met, after the current play-through finishes
- [ ] User picks `harder/same/easier` + optional genre lean → next groove loads
- [ ] "Easier" is always selectable (release valve)
- [ ] N is configurable via env var; defaults to 3
- [ ] Per-user N override exists for QA accounts
- [ ] Telemetry events fire at each step

### Non-functional

- [ ] Counter increment is idempotent (can't double-count from network retries)
- [ ] Detection logic is in the playback layer, not just UI (so DOM tampering can't fake completion)
- [ ] No counter increment without server-side validation that the play-through was legit
- [ ] Overlay is dismissible without losing the unlock (user can dismiss and unlock later)

## Acceptance Criteria

- [ ] Free user plays a groove to completion → counter increments to 1
- [ ] Play it 2 more times → unlock overlay appears at end of 3rd play-through
- [ ] User picks "Harder" → next groove (level + 1 from same pool) loads
- [ ] User picks "Easier" even when at level 1 → graceful fallback (re-suggests an earlier groove or current)
- [ ] User picks "Pick for me" → system picks a reasonable next groove
- [ ] User scrubs to end of groove → does NOT increment counter (anti-cheat)
- [ ] User backgrounds tab during play → does NOT increment counter
- [ ] User pauses for >30s → current play-through abandoned; doesn't count
- [ ] Setting `NEXT_GROOVE_UNLOCK_THRESHOLD=1` → first complete play unlocks next groove
- [ ] Setting per-user `N=1` for a QA account works; other users still see N=3
- [ ] Telemetry events fire and are visible in dev console
- [ ] Manual QA: play through 3 grooves; verify unlock and choice flow at each
- [ ] Manual QA: try to game the counter (scrub, tab-switch, pause-resume) — none of them increment

## Out of Scope (deferred)

- ❌ **Bridge scoring** — v24, replaces this entire detection mechanism with real "you can play this" measurement
- ❌ **Mastery tiers (bronze/silver/gold)** — funnel-vision feature, post-launch
- ❌ **Re-conquering for gold** — depends on mastery tiers
- ❌ **Detailed difficulty recommendation engine** — for launch, simple directional filter is enough
- ❌ **Pack-specific progression** (Funk Pack has its own internal sequencing) — LAUNCH-06 handles its own access; pack grooves don't enter this free-tier game loop
- ❌ **Cross-device sync of in-progress play-throughs** — counter only increments on completion, so partial-play state can stay client-side
- ❌ **Visual progress bar / streak / achievements UI** — defer; ship the gate mechanic first, layer game UI later

## Implementation Notes

### Files to touch

**Backend:**
- **NEW:** `apps/backend/src/domains/exercises/groove-progress.controller.ts` (or in tutorials if that's where grooves live — verify)
- **NEW:** `apps/backend/src/domains/exercises/services/groove-progress.service.ts`
- **NEW:** `supabase/migrations/[timestamp]_groove_plays.sql`
- **EDIT:** add `level`, `genre`, `technique_tags` columns to grooves table if not present

**Frontend:**
- **NEW:** `apps/frontend/src/domains/playback/hooks/usePlayInFullDetection.ts`
- **NEW:** `apps/frontend/src/domains/playback/components/NextGrooveOverlay.tsx`
- **NEW:** `apps/frontend/src/domains/playback/hooks/useGrooveProgress.ts`
- **EDIT:** `apps/frontend/src/domains/playback/components/...` — wherever the play loop completion event fires, wire `usePlayInFullDetection`

**Shared types:**
- **EDIT:** `libs/contracts/src/types/grooves.ts` — `GrooveProgress`, `NextGrooveChoice` schemas

### Architectural guidance

- **Server is the source of truth.** Client emits "I think I played in full" → server validates (duration, no scrub events, etc.) → server increments. Don't trust client to count.
- **Anti-cheat ladder:** start with the simple checks (no scrub, tab-active, duration met). If gaming is observed in whitelist phase, add more (e.g., check the audio output is non-silent). Don't over-engineer pre-launch.
- **Idempotency:** include a `play_session_id` in the request so retries don't double-count.
- **Bridge migration path:** when v24 ships Bridge, the gate condition flips from `completed_count >= N` to `last_bridge_score >= passing_threshold`. The surrounding game loop (overlay, choice, next groove selection) stays the same. Keep that contract clean.

### Anti-patterns to avoid

- **Don't show the user a progress bar to N.** "Play 1 of 3" turns this into a quota — exactly what the funnel-vision warns against. Show *completion of the play-through itself*, never the count toward unlock.
- **Don't penalize legitimate pauses** (pee break, doorbell). 30s threshold is generous. Tune up if abuse becomes a problem; don't preemptively tighten.
- **Don't gate the *current* groove.** They can keep practicing it forever. Only the *next* one is gated.
- **Don't ship without telemetry.** This is the single feature most likely to need tuning post-launch. We need the data to tune it.

### A note on the philosophical tension

This story implements something the funnel-vision explicitly warns against (quota-style gating). We're doing it because Bridge isn't ready, and "no gate at all" would lose the game loop entirely. The mitigations:
- **"Played in full" > pure rep count** — at least requires completion, not just clicks
- **Configurable N** — we tune based on data, not opinion
- **"Easier" release valve** — no one gets trapped
- **No visible progress bar** — doesn't *feel* like a quota
- **Replaces cleanly when Bridge ships** — surrounding loop stays

If whitelist users complain about the gate, **N=1 is a valid setting**. Even "you played it once, pick your next" honors the game loop while behaving almost like no gate at all.

---

## Notes

- This is the story most likely to evolve based on observed user behavior in the whitelist phase. Ship it, watch the data, tune N.
- After launch, when Bridge ships in v24, this story's detection code can be deprecated — the game loop infrastructure (overlay, choice, selection) stays.
