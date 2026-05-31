# [LAUNCH-02] Capped Lever System — The Free-Tier Wall

**Parent:** [Launch Backlog](./README.md) • [LAUNCH_PLAN.md](../../../deployment/LAUNCH_PLAN.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~1 week (the biggest single build pre-launch)
**Status:** 📝 Ready
**Blocks:** LAUNCH-03 (Membership has nothing to uncap without this)
**Depends on:** [LAUNCH-02.5c](./LAUNCH-02.5c-groove-card-in-app.md) — the cap-aware control handlers (`useEntitlement()` call sites at every lever) live in the Groove Card's controls. 02.5c ships the stub hook returning `tier: 'member'` with all caps un-capped; this story swaps in the real `'free'` logic without touching the call sites. Does NOT require 02.5d (the waitlist uses its own hardcoded cap shapes, not entitlement-driven ones).
**The thing this story is:** the single most important build in the entire pre-launch plan. Without it, there is no funnel.

---

## Story

- As a **free user playing my first groove**
- I want to **pull every control once — slow it down, shift it to another key, mute the bass, see the deconstruction layers**
- so that **I feel the AHA: this is a real instrument I can practice with**

And:

- As a **free user who's pulled every lever once and wants more**
- I want **the wall to teach me exactly what I'm buying — not show me a fake locked button**
- so that **paying for Membership feels like removing a cap I understand, not unlocking a mystery**

And:

- As **Marek**
- I need **the entire free-vs-paid line to live inside each lever, not around the catalog**
- so that **the funnel-vision promise holds: "a lever they can pull once is a taste; a lever they can live on is the pie"**

## Background / Context

The funnel's central mechanism is **the capped lever**. The platform is "fully playable on a free account; depth, tools, and programs are paid." That line doesn't get drawn at the catalog edge (free grooves vs paid grooves) — it gets drawn **inside each lever**. Free users pull every lever once. Members live on them.

This is the build that turns the existing playback engine — which today has no concept of caps — into the funnel-aligned free tier. **Without this story, Membership has nothing to sell, the YouTube video's pitch has no landing, and "the platform IS the instrument" stops being true once the user gets past the first taste.**

From the funnel vision:

| Lever                     | Free (the taste)               | Paid (the uncap)              |
| ------------------------- | ------------------------------ | ----------------------------- |
| **Mute & jam**            | Mute the bass once, jam 8 bars | Loop infinitely, every groove |
| **Tempo**                 | One slower preset and back     | Full 40–200 BPM dial          |
| **Transpose**             | Shift to one other key         | All 12 keys                   |
| **Deconstruction layers** | See them exist (greyed)        | Isolate & drill them          |

**The discipline:** each cap must feel like a **generous teacher** ("here's how much more of this real thing exists"), never a **fake locked button** ("gotcha"). The test from the funnel doc:

> Would a player _remark_ on it to another musician? _"It actually transposed, and I realized the paid version does all 12 keys"_ sells itself. _"It showed me a fake locked button"_ breaks trust.

## Solution / Scope

This story implements **four capped levers** end-to-end: the cap detection, the enforcement, and the upsell messaging at the wall. All four caps share one mechanism — a single `EntitlementContext` (or hook) that returns the user's tier and caps applied per lever. That same context will later be consumed by LAUNCH-03 (Membership) to remove the caps.

### Lever 1 — Tempo (the easiest to feel, build first)

- **Free:** original tempo + **one slower preset** (e.g., 75% of original). Can switch between them freely. Two values total.
- **Member:** full 40–200 BPM continuous dial (existing control, just remove the cap).
- **The cap UX:** when a free user touches the dial beyond the preset, the dial **snaps back to the preset** with a small inline message: _"Members can dial any tempo, 40–200 BPM. [Try Membership →]"_. Not a popup that interrupts playback — a contextual cue _at the lever_.

### Lever 2 — Mute (the AHA lever)

- **Free:** can mute the bass **once**, jam for 8 bars (or the song's length, whichever is shorter), then mute auto-releases at the end of the section.
- **Member:** mute toggles freely, loops infinitely.
- **The cap UX:** after the free taste auto-releases, button shows: _"That's the taste. Members loop the mute forever. [Try Membership →]"_. The "once per groove" reset on next session is fine — that's the daily generosity.

### Lever 3 — Transpose (the "I can't believe it works" lever)

- **Free:** can shift to **one other key** (e.g., original + 2 semitones up). Toggle between original and the one alternate.
- **Member:** all 12 keys.
- **The cap UX:** when a free user tries to pick a third key, options 3-12 are visible but greyed with: _"Members can play in all 12 keys."_ Don't hide them — show them so the buyer understands what they're getting.

### Lever 4 — Deconstruction layers (the "show, don't unlock" lever)

- **Free:** sees the layers exist in the UI (e.g., "ghost notes", "syncopation pattern", "approach tones"), shown in greyed panel.
- **Member:** can isolate each layer, loop it, drill it.
- **The cap UX:** layers are **visible**, clearly labeled, and clickable — clicking shows a side panel: _"This is the [Ghost Notes] layer. Members can isolate, loop, and drill it across every groove. [Try Membership →]"_. The layer's _existence_ sells the upsell.

### Shared infrastructure

- **`useEntitlement()` hook** — returns `{ tier: 'free' | 'member', caps: { tempo: {...}, mute: {...}, transpose: {...}, deconstruction: {...} } }`. Single source of truth for tier-gated behavior.
- **Backend endpoint:** `GET /billing/entitlement` — returns the user's tier and active caps. Cache for the session, refresh on tier change.
- **Component:** `<UpsellCue lever={name}>` — the inline messaging at each wall. Consistent voice, single component.
- **Telemetry:** log every cap hit (`tempo_cap_hit`, `mute_cap_hit`, etc.) — this data drives Membership pricing/positioning decisions later.

## Requirements

### Functional

- [ ] `useEntitlement()` hook returns user's tier and per-lever caps; defaults to `'free'` when not logged in
- [ ] Tempo cap: free users limited to 2 tempo values; dial snaps back when exceeded; inline upsell cue
- [ ] Mute cap: free users get one mute toggle per session per groove; auto-releases at end of section; inline upsell cue
- [ ] Transpose cap: free users see all 12 key options but can only select 2; rest greyed with upsell cue
- [ ] Deconstruction layers visible to free users in greyed state; click shows side-panel upsell, no isolation/looping
- [ ] All upsell cues use shared `<UpsellCue>` component with consistent voice
- [ ] Cap hits emit telemetry events
- [ ] `GET /billing/entitlement` endpoint returns tier + caps, cached client-side per session

### Non-functional

- [ ] No cap evasion via DOM manipulation — caps enforced at the playback engine level, not just CSS
- [ ] No 4-toast loading flow during cap interactions (per LAUNCH-05 polish work)
- [ ] All cap UX works on mobile (touch targets, inline messaging readable)
- [ ] Each cap can be A/B tested independently (per-lever feature flag, not a single "show all caps" flag)

## Acceptance Criteria

- [ ] A new free user can complete the "taste" of each lever on the seeded test groove
- [ ] Each cap shows its upsell cue **at the lever**, not as a modal interrupting playback
- [ ] Upsell cues link to checkout flow (placeholder URL until LAUNCH-03 ships)
- [ ] Manual QA: log in as free user → pull each lever → confirm cap hits + cue text
- [ ] Manual QA: with `useEntitlement` mocked to `'member'` → confirm all caps are removed
- [ ] Telemetry event fires on each cap hit, visible in dev console
- [ ] No DOM-side hack can bypass the caps (verified: tried to mute twice in a row via React DevTools force-render → still capped)
- [ ] All 4 lever caps work in tandem on the same groove without interfering
- [ ] Unit tests cover the entitlement logic for each lever
- [ ] Integration test: free user session vs member session, snapshot the lever states

## Out of Scope (deferred to other stories)

- ❌ **Membership Stripe subscription + actual upgrade flow** — LAUNCH-03. This story renders upsell CTAs that go to a placeholder until then.
- ❌ **Pack-specific access** (Funk Vol. 1 grooves are different from free weekly grooves) — LAUNCH-06.
- ❌ **Bridge scoring** — deferred to v24.
- ❌ **Scoring/progress lever from the funnel-vision table** — Bridge-dependent, comes with v24.
- ❌ **Per-pack lever overrides** (e.g., Funk Pack users get full tempo on Funk grooves only) — handled in LAUNCH-06 via entitlement check.

## Implementation Notes

### Files to touch

**Frontend — entitlement infrastructure:**

- **NEW:** `apps/frontend/src/domains/billing/hooks/useEntitlement.ts`
- **NEW:** `apps/frontend/src/domains/billing/components/UpsellCue.tsx`
- **NEW:** `apps/frontend/src/domains/billing/contexts/EntitlementContext.tsx`

**Frontend — lever-by-lever changes:**

- **EDIT:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/` — tempo dial, mute button, transpose UI
- **EDIT:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/GlobalControls/hooks/usePlaybackControl.ts` — enforce caps in playback layer, not just UI
- **EDIT:** `apps/frontend/src/domains/playback/...` — wherever deconstruction layers are exposed, add the greyed-state rendering

**Backend:**

- **EDIT:** `apps/backend/src/domains/billing/billing.controller.ts` — add `GET /billing/entitlement`
- **NEW:** `apps/backend/src/domains/billing/services/entitlement.service.ts` — compute caps from user's purchases/subscription
- **EDIT:** `apps/backend/src/domains/billing/types/billing.types.ts` — add `EntitlementResponse` type

**Shared types:**

- **EDIT:** `libs/contracts/src/types/billing.ts` — `EntitlementResponse`, `LeverCap` schemas

### Architectural guidance

- **Enforce in the playback engine, not just the UI.** A DOM-level hack should not unlock the cap. The `usePlaybackControl` layer (and below, into the audio engine) checks entitlement before applying the change.
- **One source of truth.** Don't scatter `isMember` checks across components. Everything reads from `useEntitlement()`.
- **`<UpsellCue>` is a primitive.** Each lever consumes it. Voice and styling stay consistent — change in one place, applies everywhere.
- **Caps are per-tier, not per-groove (for now).** Free user sees the same cap regardless of which weekly groove they're on. Pack purchases (LAUNCH-06) will introduce per-groove overrides later — design `useEntitlement()` with that future in mind (take a `grooveId` optional arg).

### Anti-patterns to avoid (from funnel vision)

- **No fake locked buttons.** Every lever that exists in the UI must be _touchable_ and respond — the taste is real, the cap is what they hit. Don't show grayed-out non-clickable controls.
- **No modal popups blocking playback.** Cues are inline, at the lever. They don't interrupt the music.
- **No "Sign up to try"** — the free user is _already_ signed up (or about to be). The wall is for Membership, not signup.
- **No "Upgrade to Pro" generic CTAs.** Each cue references the specific thing they're getting: _"all 12 keys"_, _"infinite loop"_, _"isolate the layer"_. Specificity sells.

### Telemetry events to fire

```
tempo_cap_hit         { userId, grooveId, attemptedBpm }
mute_cap_hit          { userId, grooveId }
transpose_cap_hit     { userId, grooveId, attemptedKey }
deconstruction_layer_view { userId, grooveId, layerName }
upsell_cue_click      { userId, lever, grooveId }
```

This data tells us which levers convert best and helps tune the Membership pitch later.

---

## Notes

- **This is the funnel-vision in code.** Get this right and the rest of the launch hangs from it cleanly. Get it wrong (fake locks, modal interrupts, scattered tier checks) and we'll be ripping it out.
- The "deconstruction layers" lever may be the trickiest — depends on how layers are currently surfaced in the UI. If they aren't surfaced at all today, this story may need a precursor "expose deconstruction layers in the UI" sub-task. **Verify scope before starting.**
- The mute and tempo caps are the highest-leverage AHAs. If we have to ship in stages, ship those two first, transpose third, deconstruction fourth.
