# [LAUNCH-02.5c] Groove Card Block (in `/app`)

**Parent:** [LAUNCH-02.5 (epic)](./LAUNCH-02.5-groove-card-block.md) • [Launch Backlog](./README.md)
**Phase:** 1 — Whitelist & free-tier foundation
**Estimated effort:** ~5-6 working days
**Status:** 📝 Ready
**Blocks:** [LAUNCH-02](./LAUNCH-02-capped-levers.md) (the levers' call sites live in this card's controls) • [LAUNCH-05](./LAUNCH-05-playback-polish.md) Fix 1 (single play-button loading state targets this card) • [LAUNCH-02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md) (the waitlist embeds this same component)
**Depends on:** [LAUNCH-02.5a](./LAUNCH-02.5a-instrumenttype-refactor.md) (canonical types) • [LAUNCH-02.5b](./LAUNCH-02.5b-audio-stems-daw-peers.md) (engine surface: `setAudioStemBuffers`, infinite-loop scheduling, `unregisterTracksByPrefix`)
**The thing this story is:** the Groove Card as a first-class block type, rendering inside any tutorial in `/app`. Block contract, admin form, card component family, the orchestration hook, the entitlement stub, key/pitch logic, active-card coordination, and the acoustic listen-test that closes 02.5b's deferred verification. The waitlist mockup stays in place — that swap is [02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md).

---

## Story

- As a **free user dropping into my first groove inside `/app`**
- I want to **press play on a Groove Card and immediately hear the drums and bass lock together — then pull a lever, hear the change, and feel that this is a real instrument, not a marketing video**
- so that **the funnel promise ("the platform IS the instrument") becomes physically true the first time my hand touches a control**

And:

- As an **admin building a new tutorial in the BassEditor**
- I want **adding a Groove Card to a tutorial to feel identical to adding any other block — pick the type, upload the five-key stem set, point it at a song, save**
- so that **the catalog scales without bespoke per-groove code, and the platform's content surface grows at content speed, not engineering speed**

And:

- As **Marek**
- I need **the Groove Card to be a first-class block type alongside `video`, `exercise`, `groove`, `text`, `celebration`, `explain` — not a one-off component glued to the waitlist**
- so that **the same card renders inside a tutorial, inside the Bassment, and (later, via 02.5d) inside the marketing page, from one source of truth**

## Background

[02.5b](./LAUNCH-02.5b-audio-stems-daw-peers.md) lands the audio-engine surface. This story lands the **product** — the block contract, the admin form, the card UI, the orchestration hook, and the entitlement stub. It also closes the acoustic verification that 02.5b deferred (the seam-quality and tempo-displacement listen-tests).

The card lives in two surfaces from one component family in this story:

| Surface                 | Where it renders                                                                            | Auth      | Caps applied                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| **Tutorial block**      | Inside any tutorial that has a Groove Card block                                            | logged-in | full (via [LAUNCH-02](./LAUNCH-02-capped-levers.md) when it ships) |
| **Bassment standalone** | A dedicated entry in the `/app` tutorial library — one-block tutorial of type `groove-card` | logged-in | full                                                               |

The third surface — the **waitlist embed** — uses the same component family in `mode="waitlist"` but ships separately as [02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md). This story builds the component with `mode` already as a prop, so 02.5d only adds the host bootstrap + the asset.

## The block contract

Add `'groove-card'` to the `BlockType` discriminated union in [libs/contracts/src/types/block.ts](../../../../libs/contracts/src/types/block.ts) and a matching `GrooveCardBlockConfig`:

- `title` — display title ("Greasy Pocket")
- `subtitle` — short tag ("Funk in E")
- `originalBpm` — number (e.g. 104)
- `originalKey` — string (e.g. "E") — display only; the actual pitch of each delivered key is baked into the audio
- `lengthBars` — number (e.g. 4). Groove length in bars; the engine loops the stems indefinitely until pause.
- `keys` — ordered tuple of exactly **5 key sets**, with one marked `isDefault`. Each key set has 4 stems (`bass`, `drums`, `harmony`, `click`), each pointing into the `audio-samples` Supabase bucket. Adjacent keys are spaced **4 semitones apart**. The default sits at offset 0; the other four sit at -8, -4, +4, +8 semitones.
- `previewCaption` — optional caption shown beneath the waveform when nothing is happening
- `stateCaptions` — optional map of state-change captions: `{ "mute-bass": "...", "solo-drums": "...", "key-change": "...", "tempo-change": "..." }`
- `allowBookmark` — kept as a contract field for the future; **bookmarks UI is out of scope for v1**

Stored in the existing JSONB `blocks` column on `tutorials` — **no DB migration.**

## The card layout

```
┌─ Card (rounded, dark background) ────────────────────────────────┐
│  NOW PLAYING · "GREASY POCKET" — FUNK IN E              [ ♪ ]   │
│                                                                   │
│              ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇█▇▆▅▃▂▁                            │
│              (live waveform, orange bar lines)                    │
│                                                                   │
│  Bass back in. Hear how it locks with the drums.                 │
├───────────────────────────────────────────────────────────────────┤
│  [Mute Bass]  [◂ Key: E ▸]  ( ▶ )  [◂ Tempo: 104 ▸]  [Solo Drums]│
└───────────────────────────────────────────────────────────────────┘
```

Five primary controls bottom-row: **Mute Bass**, **Key**, **Play (center, primary)**, **Tempo**, **Solo Drums**. Plus a small **click toggle** (`♪`) top-right, independent of Solo/Mute. Default state: click **muted**.

**Tempo and Key controls are steppers:**

- **Tempo**: `[◂ 104 ▸]` — arrows step ±1 BPM. Range: 50–180. Subtle bounce at the floor/ceiling.
- **Key**: `[◂ E ▸]` — arrows step ±1 semitone. Range: ±12 semitones. Label shows the _musical_ key (E, F, F♯…), not the raw semitone number.

Caption updates reactively. Copy comes from `stateCaptions` in the block config (admin authors them); falls back to `previewCaption`, then empty.

**The card is always interactive.** No PREVIEW / "Try the controls" toggle.

## Active-card coordination (single play across cards on one page)

`useTransport()` is **not** a singleton — it's a context. In practice in `/app`, only one `<TransportProvider>` mounts per tutorial page, which means **two Groove Cards on the same page share one `PlaybackEngine` and one `Tone.Transport`.** A Zustand "active card" flag alone is not enough: the previous card's `audio-bass`/`audio-drums`/`audio-harmony`/`audio-click` tracks remain registered in `engine.tracks`, so when the new card starts the transport, the old card's stems still schedule. Coordination needs _both_ a flag _and_ explicit per-card track cleanup — which is why 02.5b ships `unregisterTracksByPrefix(prefix)`.

**New file:** `apps/frontend/src/domains/playback/stores/active-groove-card.store.ts`

```ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ActiveGrooveCardState {
  activeCardId: string | null;
  setActiveCard: (cardId: string) => void;
  clearActiveCard: (cardId: string) => void; // only clears if this card is the active one
}

export const useActiveGrooveCardStore = create<ActiveGrooveCardState>()(
  devtools(
    (set, get) => ({
      activeCardId: null,
      setActiveCard: (cardId) => set({ activeCardId: cardId }),
      clearActiveCard: (cardId) => {
        if (get().activeCardId === cardId) set({ activeCardId: null });
      },
    }),
    { name: 'active-groove-card-store' },
  ),
);
```

**The hook's contract when activation changes:**

1. **Becoming active** — call `playbackEngine.stopAudioStems()` to silence any in-flight sources from the previous card, then register _this_ card's audio tracks (namespaced by card ID: `trackId = ${cardId}#audio-bass` etc.), then `start()`.
2. **Losing active status** — pause locally **and** call `playbackEngine.unregisterTracksByPrefix(`${cardId}#`)` (from 02.5b) before the next card registers its own tracks.
3. **Unmount** — same as "losing active status" plus the guarded `clearActiveCard(cardId)`.

## Tempo — route through `MusicalTruthAuthority`

Single source of truth at [MusicalTruthAuthority.ts:244](../../../../apps/frontend/src/domains/playback/modules/tempo/MusicalTruthAuthority.ts#L244) — `musicalTruth.setBPM(bpm)` updates the truth, writes `Tone.Transport.bpm.value`, notifies all subscribers in one atomic step. The established React-side pattern is at [TransportContext.tsx:828-844](../../../../apps/frontend/src/domains/playback/contexts/TransportContext.tsx#L828-L844) — comment at line 842-843 warns that going through `transportRef.current.setTempo(bpm)` "caused tempo inconsistencies." Follow the verified pattern:

```ts
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';

const setTempo = useCallback((bpm: number) => {
  const clamped = Math.max(50, Math.min(180, bpm));
  musicalTruth.setBPM(clamped);
}, []);

// Reactive subscription
useEffect(
  () => musicalTruth.subscribe((truth) => setCurrentBpm(truth.bpm)),
  [],
);
```

Tempo applies to all four stems equally (transport-level concern). Time-stretching artifacts at extremes (50 BPM on a 104 BPM source) are accepted — out of scope.

## Key system — five stem sets, shift budget ±2 semitones

Hardest piece. Pre-recorded audio can't be pitch-shifted arbitrarily without artifacts, especially on drums. Mitigation:

1. **Deliver 5 key sets per groove** at fixed offsets `-8, -4, 0, +4, +8` from `originalKey`. Each set has 4 stems. Admin uploads 5 × 4 = 20 files per groove.
2. **Pick the nearest key set** for any user-requested offset such that the residual pitch-shift stays within **±2 semitones** in the comfortable range. The rule (mirrored for negative offsets):

   | User offset | Loaded key set | Pitch-shift applied                       |
   | ----------- | -------------- | ----------------------------------------- |
   | 0..+2       | default (0)    | 0..+2                                     |
   | +3..+6      | first-up (+4)  | -1..+2                                    |
   | +7..+10     | second-up (+8) | -1..+2                                    |
   | +11..+12    | second-up (+8) | +3..+4 (over budget, accepted as extreme) |

3. **Drums never pitch-shift.** They tune up/down audibly even at small offsets. The Groove Card writes `pitch = semitones` only on the **bass and harmony** stems' `Tone.PitchShift` nodes. The drum stem swaps with the key set (so its room mic and character match) but residual shift on drums is always **0**. The click is also unaffected.
4. **Key changes apply at the next loop boundary**, not immediately. UI shows the new value with a subtle "queued" indicator. On the next boundary, 02.5b's `scheduleInfiniteAudioRegion` swaps the playing source for the new key set (with the 10ms crossfade) and writes the new `PitchShift.pitch` for bass + harmony. Tempo still applies live; only key swap waits for the loop.
5. **Stem loading order:** default key on mount → adjacent (±4) keys on first play via `requestIdleCallback` → outer (±8) keys on first cross-over.

### Pitch-shift implementation

`Tone.PitchShift` per **bass and harmony** stem. Tone.js's PitchShift is granular FFT-based — used in [BassEffectsChain.ts:158](../../../../apps/frontend/src/domains/playback/modules/instruments/components/bass/BassEffectsChain.ts#L158) **but on the real-time MIDI bass synth output, not on long pre-rendered audio buffers.** The artifact profile is:

- **Within ±2 semitones:** small, below the noise floor of bass+drum mix.
- **±3 to ±4 semitones:** "grain swirl" and phase smearing on sustained bass; attack transients can shimmer.
- **Beyond ±4:** accepted as the cost of the lever (same as tempo extremes).

**Verification step in this story:** record a ±2 / ±3 / ±4 shifted sustained-bass loop through the production PitchShift node; audition on monitors. If ±3 is unacceptable, narrow the comfortable budget to ±1 and consider more key sets later (out of scope to add more in v1).

`pickKeySet()` is a pure function: `(offsetSemitones: number) → { keySetIndex: 0|1|2|3|4, residualShift: number }`. Unit-tested in isolation. No `PitchAuthority` today — keep `setKey(semitones)` local to the Groove Card hook for this story; leave `// TODO(future): centralise via PitchAuthority`.

## Stem preload — copy the assessment pattern

Mirror [useAssessmentAudioPreloader.ts](../../../../apps/frontend/src/domains/assessment/hooks/useAssessmentAudioPreloader.ts) (confirmed live, consumed by `BunnyQuizPlayer.tsx`):

- **Parallel load with graceful per-item failure** — `Promise.allSettled` at line 177
- **In-flight dedupe** via a module-level `preloadPromises` Map at lines 54-55
- **Non-blocking schedule with Safari fallback** — `requestIdleCallback` with `setTimeout(..., 10)` fallback at lines 211-215

Difference: Groove Card caches **decoded `AudioBuffer` instances** keyed by `{ keySetIndex, stemName }`, not `HTMLAudioElement`s. Decoding via `audioContext.decodeAudioData(arrayBuffer)`.

## The admin form

A new `GrooveCardBlockForm.tsx` in [apps/frontend/src/domains/admin/components/BlockEditor/configs/](../../../../apps/frontend/src/domains/admin/components/BlockEditor/configs/), mirroring [ExplainBlockForm.tsx](../../../../apps/frontend/src/domains/admin/components/BlockEditor/configs/ExplainBlockForm.tsx) (which already handles audio URLs, though as URL text inputs not uploaders).

**Fields:**

- Title, subtitle, original BPM, original key, length-in-bars — plain inputs
- **Five key-set rows**, one marked `isDefault`. Each row: a label (e.g. "E", "G♯", "C") and four file uploads (bass, drums, harmony, click). Admin sees the offset (`−8 / −4 / 0 / +4 / +8`) inline as a non-editable hint; the system enforces 4-semitone spacing.
- Preview caption (textarea)
- State-aware captions (mute / solo / key-change / tempo-change) — optional textareas
- `allowBookmark` checkbox — contract-only, no UI

Stems write to the existing `audio-samples` Supabase bucket (admin-only write per [20250720000000_create_audio_samples_bucket.sql](../../../../supabase/migrations/20250720000000_create_audio_samples_bucket.sql)). Stems should be `.ogg` Vorbis — small enough for the (future) waitlist.

**Server-side validation:** [`admin-tutorials.service.ts`](../../../../apps/backend/src/domains/tutorials/admin-tutorials.service.ts) Zod-validates each `groove-card` block on save:

- exactly 5 key sets with the right offsets
- all 20 stem URLs matching the **bucket path pattern** `/storage/v1/object/public/audio-samples/...` (host-agnostic — staging and production project refs differ per [CLAUDE.md](../../../../CLAUDE.md); pinning the host would reject staging URLs in prod and vice versa)
- BPM in [50, 180]
- `lengthBars > 0`

The existing update path at `admin-tutorials.service.ts:291-292` uses `(updateTutorialDto as any).blocks` to dodge the missing-blocks-on-DTO problem; this story closes that gap _for groove-card blocks_. Insert path at line 538 (`blocks: dto.blocks || []`) also gets validation. Future story may extend Zod coverage to all block types.

Register the new type in [BlockTypeSelector.tsx](../../../../apps/frontend/src/domains/admin/components/BlockEditor/BlockTypeSelector.tsx).

## The renderer

Add `GrooveCardBlockView` to the registry in [BlockRenderer.tsx](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/BlockRenderer.tsx) — one line, mirrors the other six. The "YouTubeWidgetPage" folder name is legacy but the renderer is live across all block types; do not refactor the path.

## Capped-lever integration (`useEntitlement` stub)

[LAUNCH-02](./LAUNCH-02-capped-levers.md) is not built yet. Neither is `useEntitlement`. Verification: no `useEntitlement`, no tier/entitlement type, no `memberships` table. Wiring the Groove Card to a hook that doesn't exist is a non-starter, so **this story ships the stub** so LAUNCH-02 swaps in real logic without changing call sites.

1. **Shared types** — NEW: [libs/contracts/src/types/billing.ts](../../../../libs/contracts/src/types/billing.ts), exported from `libs/contracts/src/types/index.ts`:

   ```ts
   export type EntitlementTier = 'free' | 'member';

   export interface LeverCap {
     isCapped: boolean;
     limit?: number;
     message: string;
   }

   export interface LeverCaps {
     tempo: LeverCap;
     mute: LeverCap;
     transpose: LeverCap;
     deconstruction: LeverCap;
   }

   export interface EntitlementResponse {
     tier: EntitlementTier;
     caps: LeverCaps;
     fetchedAt: string;
   }
   ```

2. **Stub hook** — `apps/frontend/src/domains/billing/hooks/useEntitlement.ts`. Returns hard-coded `tier: 'member'` with all caps un-capped. No backend call yet (lands in LAUNCH-02). Query-key shape supports a future `grooveId` parameter for LAUNCH-06 per-pack entitlements:

   ```ts
   export function useEntitlement(options?: {
     grooveId?: string;
     enabled?: boolean;
   }): {
     tier: EntitlementTier;
     caps: LeverCaps;
     isLoading: boolean;
     error: string | null;
     refetch: () => void;
     invalidate: () => Promise<void>;
   };
   ```

3. **Helper hooks** in the same file: `useIsLeverCapped(lever)` and `useUpsellMessage(lever)`.

**Why the stub returns `'member'`, not `'free'`:** the card ships before LAUNCH-02 builds the caps. If the stub returned `'free'`, the card's controls would silently behave as if capped while nothing actually caps them — confusing for QA. Returning `'member'` keeps the card uncapped and visibly behaving the way LAUNCH-02 will make it behave for paying members.

**Single discipline: no `isMember` checks inline, no scattered tier logic.** The Groove Card calls `useEntitlement()` at every control handler. When LAUNCH-02 ships, only the hook implementation changes.

## The hook's public surface

`useGrooveCardPlayback` is the only place `PlaybackEngine` is touched from the Groove Card. UI components consume the hook's reactive state.

```
useGrooveCardPlayback({
  block,
  mode,                            // 'block' | 'waitlist' — 'waitlist' wired in 02.5d
  countdownClickUrl?,              // optional — set by 02.5d; in 'block' mode use the MIDI metronome path
}) → {
  // state
  isLoading, isReady, isPlaying, currentBpm, currentSemitones,
  mutedStems: Set<'audio-bass' | 'audio-drums' | 'audio-harmony' | 'audio-click'>,
  soloedStem: 'audio-drums' | null,
  clickEnabled: boolean,
  pendingKeyShift: number | null,

  // commands (all idempotent)
  play, pause, stop,
  setTempo(bpm),
  setKey(semitonesFromOriginal),    // queues; applies on next loop boundary
  setStemMuted(name, bool),
  setStemSolo(name | null),
  setClickEnabled(bool),

  // lifecycle (used by active-card store)
  becomeActive(): void,
  becomeInactive(): void,

  // visualization tap
  getAnalyser(): Tone.Analyser
}
```

State and commands only. No exposed engine objects beyond the analyser (the waveform canvas needs it; nothing else does).

## Per-stem mute / solo

- **Mute** via the existing gain-node system: `playbackEngine.setInstrumentMuted('audio-bass', true)`. No new mute infrastructure (02.5a widened the signature; 02.5b wired the gain nodes).
- **Solo at the React/hook layer, not the engine.** `PlaybackEngine` has no `setSoloInstrument`. Existing widgets (`BassLineWidget/hooks/useVolumeControl.ts:103`, `HarmonyWidget/hooks/useVolumeControl.ts`, `DrummerWidget/hooks/useDrumPlugin.ts:240`) implement solo by sibling-muting via `setInstrumentMuted`. Follow that pattern: tap "Solo Drums" → hook calls `setInstrumentMuted('audio-bass', true)` + `setInstrumentMuted('audio-harmony', true)`. Releasing solo restores both. **Do not** route through `Mixer.setSolo()` (at [`modules/tracks/mixing/Mixer.ts:399`](../../../../apps/frontend/src/domains/playback/modules/tracks/mixing/Mixer.ts#L399)) — the Mixer is live in production but no widget uses its solo API today; that's a separate refactor.

**Known divergence:** `'bass'` and `'audio-bass'` are distinct keys in `instrumentGainNodes` ([PlaybackEngine.ts:218](../../../../apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts#L218)), so a global "Drums" fader applied to MIDI tracks does not fade `'audio-drums'`. Correct shape for the Groove Card (stems are an independent submix); UI authors should be aware there's no single control affecting both.

## Requirements

### Functional — block & contract

- [ ] `'groove-card'` added to `BlockType` union in `libs/contracts/src/types/block.ts`
- [ ] `GrooveCardBlockConfig` interface defined with all fields above, including the 5-key-set tuple
- [ ] Added to `BlockConfigMap` so the discriminated union resolves end-to-end
- [ ] Contracts package rebuilt and consumed by frontend + backend without type errors

### Functional — entitlement stub

- [ ] `EntitlementTier`, `LeverCap`, `LeverCaps`, `EntitlementResponse` types added to contracts and exported
- [ ] `useEntitlement` hook implemented as stub in `apps/frontend/src/domains/billing/hooks/useEntitlement.ts`, returning `tier: 'member'` with all four caps un-capped
- [ ] Helper hooks `useIsLeverCapped(lever)` and `useUpsellMessage(lever)` exported
- [ ] Hook signature accepts optional `{ grooveId?: string }` parameter — currently unused, reserved for LAUNCH-06
- [ ] Every cap-relevant control handler calls `useEntitlement()` — no inline `isMember` checks anywhere

### Functional — admin

- [ ] `GrooveCardBlockForm.tsx` created in BlockEditor/configs
- [ ] Form requires **exactly 5 key sets** with the spacing `-8, -4, 0, +4, +8`; one marked default
- [ ] Each key set requires **4 stem uploads** (bass, drums, harmony, click)
- [ ] Stem file upload writes to the existing `audio-samples` Supabase bucket
- [ ] Block type selectable in BlockEditor "add block" modal
- [ ] Admin can create, edit, and delete a Groove Card block on any tutorial
- [ ] Saving writes to `tutorials.blocks` JSONB exactly like other block types (no migration)
- [ ] **Server-side Zod validation** of `groove-card` blocks on tutorial save: shape, 5-key-set rule, stem URLs matching `/storage/v1/object/public/audio-samples/...` path pattern (host-agnostic), BPM range, positive `lengthBars`

### Functional — card UI

- [ ] `GrooveCardBlockView` renders in [BlockRenderer.tsx](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/BlockRenderer.tsx) registry
- [ ] Card matches the layout: rounded corners, dark background, waveform window, caption line, 5-control bottom row, click toggle (♪) top-right
- [ ] Tempo and Key are **stepper buttons** (left arrow, value on button, right arrow) — ±1 BPM and ±1 semitone steps
- [ ] Tempo range 50–180 BPM enforced; key range ±12 semitones enforced
- [ ] Caption updates reactively as state changes (mute on, solo on, key changed, tempo changed) — copy from `stateCaptions`, falling back to `previewCaption`
- [ ] Card renders cleanly inside the existing tutorial player layout (`YouTubeWidgetPage` shell, which provides the `DynamicIsland` left-column nav). Note: `DynamicIsland` lives at `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/components/DynamicIsland.tsx` — it is the tutorial-player nav, not a bare-`/app`-shell nav
- [ ] No PREVIEW / "Try the controls" toggle

### Functional — audio behaviour (consumes 02.5b's engine surface)

- [ ] `useGrooveCardPlayback` orchestrates: preload default key set on mount, register audio tracks namespaced by card ID, expose commands and reactive state
- [ ] Play / pause / stop work in sync across all stems via the shared transport (sample-accurate, inherited from the engine)
- [ ] Countdown (1-2-3-4 with audible click samples) fires before the groove starts, on first play — reuses the existing countdown system (MIDI metronome track + preloaded click buffers); no new countdown code in this story. (The waitlist's bundled-click path lands in 02.5d.)
- [ ] After the countdown, all 4 stems start on the downbeat in lockstep
- [ ] Tempo control calls `musicalTruth.setBPM(bpm)`; hook also `musicalTruth.subscribe(...)`s so external BPM changes propagate
- [ ] Key control updates pending offset; **swap occurs at the next loop boundary** with the 10ms crossfade (via 02.5b's `scheduleInfiniteAudioRegion`)
- [ ] On key swap: the right key set's buffers are activated; bass and harmony get `PitchShift.pitch = residualShift`; **drums and click never pitch-shift**
- [ ] Mute Bass cuts the bass stem only — `setInstrumentMuted('audio-bass', true)`; drums + harmony + click (if on) continue
- [ ] Solo Drums silences `audio-bass` + `audio-harmony`; releasing restores both. Click toggle stays independent
- [ ] Click toggle is independent of all other controls; default state is **muted**
- [ ] Waveform canvas renders live amplitude data at ~30 FPS from a `Tone.Analyser` tap on the master bus
- [ ] AudioContext resumes on first user gesture (play button click) — uses existing `ensureAudioContext()` pattern
- [ ] Card unmounts cleanly: all `AudioBufferSource`s stopped + disconnected, registered tracks removed from engine via `unregisterTracksByPrefix`, no audio bleed
- [ ] **Stem-load order:** default key on mount → adjacent (±4) on first play via `requestIdleCallback` → outer (±8) on first cross-over

### Functional — active-card coordination

- [ ] `useActiveGrooveCardStore` exists and behaves per the [Active-card coordination](#active-card-coordination-single-play-across-cards-on-one-page) section
- [ ] Card lifecycle implements **both** the flag (`setActiveCard`/`clearActiveCard`) **and** per-card track cleanup via `playbackEngine.unregisterTracksByPrefix(`${cardId}#`)`
- [ ] Track IDs are namespaced: `trackId = ${cardId}#audio-bass`, etc.

### Non-functional

- [ ] No new coupling to `Mixer.ts` from the Groove Card. The Mixer is live in production but no widget uses its solo API today — follow the established sibling-muting pattern
- [ ] No new `_v*` test pages (per CLAUDE.md technical debt)
- [ ] All cap-relevant control handlers call `useEntitlement()` so LAUNCH-02 plugs in without touching this card
- [ ] iOS Safari: AudioContext gesture handled inline via `ensureAudioContext()`; no white-screen on first play in `/app`. (Pre-warm-on-intersection for the waitlist surface lands in 02.5d.)
- [ ] Waveform render uses `requestAnimationFrame`, pauses when card scrolls offscreen (IntersectionObserver)
- [ ] No autoplay on mount

## Acceptance Criteria

- [ ] An admin can create a tutorial in BassEditor, add a Groove Card block, upload **all 20 stems across 5 key sets**, save, and see the tutorial render with a working playable card
- [ ] A logged-in user opens the tutorial, hits play, hears the **1-2-3-4 countdown**, then all 4 stems lock in on the downbeat at original BPM and key
- [ ] User taps the Tempo `▸` arrow → BPM advances by 1, playback speeds up, **pitch unchanged**; works on all 4 stems
- [ ] User taps the Key `▸` arrow → the _next loop boundary_ swaps to the new key set + applies residual pitch-shift to bass and harmony only; drums and click do not pitch
- [ ] User crosses from default into first-up territory (+3) → first-up key set loads in background, then plays at the next boundary; no audible glitch besides the intended 10ms crossfade
- [ ] User taps Mute Bass → bass stem silenced, drums + harmony continue (+ click if on)
- [ ] User taps Solo Drums → only drums audible (bass + harmony muted); releasing restores both. Click toggle remains independent
- [ ] User taps click `♪` toggle → click track audible / muted; default is muted
- [ ] Two Groove Cards on one page: starting the second pauses the first AND silences the first's stems on the shared transport (per [Active-card coordination](#active-card-coordination-single-play-across-cards-on-one-page))
- [ ] Unmounting the card (navigate away) stops audio cleanly within 200ms; tracks unregistered from engine
- [ ] With `useEntitlement` mocked to `'free'`, no card behavior changes yet (LAUNCH-02 not built); with `'member'`, identical behavior. **One test must exercise the `'free'` mock path** so the cap-read logic isn't dormant until LAUNCH-02 ships
- [ ] Unit tests cover: (a) `pickKeySet()` pure function, (b) the mute/solo state machine, (c) the loop-boundary scheduling for the new key swap
- [ ] Integration test loads a fixture tutorial with a Groove Card block, snapshots the rendered view
- [ ] **Acoustic listen-test (closes 02.5b's deferred verification):**
  - [ ] Crossfade seam at the loop boundary is inaudible at normal listening volume
  - [ ] Tempo change from 104 → 130 mid-loop: the documented audible discontinuity is within acceptable bounds; if not, escalate before merge (the fix is iteration playbackRate ramping — separate story)
  - [ ] PitchShift artifact listen-test at ±2 / ±3 / ±4 semitones — record sustained-bass loop, audition on monitors. If ±3 unacceptable, narrow the budget to ±1

## Out of Scope (deferred)

- ❌ **Capped lever logic itself** — [LAUNCH-02](./LAUNCH-02-capped-levers.md). This story wires the _call sites_ and ships the stub; caps default to off
- ❌ **Membership upgrade flow** — [LAUNCH-03](./LAUNCH-03-membership.md). Controls work for any logged-in user
- ❌ **Bookmarks UI and data model** — `allowBookmark` stays in the contract for the future; no heart icon, no API, no migration. Separate future story
- ❌ **Completion tracking for Groove Cards** — grooves are instruments, not tasks. Card does not write to `block_completions`
- ❌ **Loading UX polish** — [LAUNCH-05](./LAUNCH-05-playback-polish.md). This story ships a functional loading state ("Loading…" overlay); polish lands separately
- ❌ **"Earn next groove" gating** — [LAUNCH-04](./LAUNCH-04-earn-next-groove.md). Card itself is unaware of progression
- ❌ **Stem analytics / scoring / pitch detection** — Bridge, post-launch
- ❌ **The waitlist embed swap and its audio bootstrap** — [02.5d](./LAUNCH-02.5d-waitlist-embed-swap.md). The mockup at `WaitlistClient.tsx:468` stays in place until 02.5d ships
- ❌ **Renaming the legacy "YouTubeWidgetPage" folder** — separate refactor
- ❌ **Routing Groove Card solo/mute through `Mixer.setSolo()`** — Mixer is live but no widget uses its solo API; follow the established pattern. Future unification story
- ❌ **Deconstruction layers UI** — LAUNCH-02's fourth lever needs a surface; v1 exposes only the four primary controls + click toggle
- ❌ **PREVIEW / "Try the controls" toggle** — removed from spec
- ❌ **A new `PitchAuthority` module** — pitch handling stays local to the hook. Future refactor
- ❌ **Time-stretching artifact mitigation at tempo extremes** — accepted
- ❌ **Crossfade tuning / configurability** — hard-coded at 10ms
- ❌ **Multiple-of-the-same-stem (e.g. two bass takes)** — stems uniquely named per key set in v1

## Files to touch

**Contracts:**

- **EDIT:** [`libs/contracts/src/types/block.ts`](../../../../libs/contracts/src/types/block.ts) — add `'groove-card'` to `BlockType`, define `GrooveCardBlockConfig`, extend `BlockConfigMap`
- **NEW:** [`libs/contracts/src/types/billing.ts`](../../../../libs/contracts/src/types/billing.ts) — entitlement types
- **EDIT:** [`libs/contracts/src/types/index.ts`](../../../../libs/contracts/src/types/index.ts) — re-export billing types

**Frontend — entitlement stub:**

- **NEW:** `apps/frontend/src/domains/billing/hooks/useEntitlement.ts`

**Frontend — card component family:**

- **NEW:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/GrooveCardBlockView.tsx`
- **NEW:** `.../blocks/groove-card/GrooveCardShell.tsx` (rounded card, header, click toggle, footer)
- **NEW:** `.../groove-card/GrooveCardWaveform.tsx` (canvas + `Tone.Analyser` polling)
- **NEW:** `.../groove-card/GrooveCardControls.tsx` (5-button bottom row + stepper arrows)
- **NEW:** `.../groove-card/useGrooveCardPlayback.ts` (orchestration)
- **NEW:** `.../groove-card/useGrooveCardStemPreload.ts` (mirrors assessment preloader, caches `AudioBuffer`s)
- **NEW:** `.../groove-card/pickKeySet.ts` (pure function; unit-tested in isolation)
- **NEW:** `apps/frontend/src/domains/playback/stores/active-groove-card.store.ts`
- **EDIT:** [`BlockRenderer.tsx`](../../../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/blocks/BlockRenderer.tsx) — register the new view

**Frontend — admin:**

- **NEW:** `apps/frontend/src/domains/admin/components/BlockEditor/configs/GrooveCardBlockForm.tsx`
- **EDIT:** [`BlockTypeSelector.tsx`](../../../../apps/frontend/src/domains/admin/components/BlockEditor/BlockTypeSelector.tsx) — add the new type option

**Backend:**

- **EDIT:** [`apps/backend/src/domains/tutorials/admin-tutorials.service.ts`](../../../../apps/backend/src/domains/tutorials/admin-tutorials.service.ts) — Zod validation on save (5-key-set rule, path-pattern URL validation, BPM/length bounds). Closes the `as any` gap at lines 291-292 for groove-card blocks. Insert path at line 538 also gets validation

**Database:** none.

## Architectural guidance

- **One component, multiple modes.** `<GrooveCardBlockView mode="block" | "waitlist" />`. This story builds `mode="block"`; 02.5d adds `mode="waitlist"` behavior. Do not fork into separate components.
- **The hook is the contract.** `useGrooveCardPlayback` is the only place `PlaybackEngine` is touched.
- **Tempo through `MusicalTruthAuthority`, not `Tone.Transport.bpm.value` directly.**
- **Cap-aware control handlers from day one.** Every control's `onChange` reads `useEntitlement()`.
- **Storage stays in `audio-samples`.** Don't create a new bucket.

## Verification before merge

- [ ] BassEditor — create a Groove Card block on a real tutorial, upload all 20 stems, save, render in `/app`, hit play, hear countdown + groove
- [ ] Two cards on one page — second play pauses first AND silences stems
- [ ] Unmount — navigate away, no audio bleeds; tracks unregistered
- [ ] Cross from default into first-up territory (+3) — buffer loads silently; swap clean on next loop boundary
- [ ] PitchShift artifact listen-test at ±2 / ±3 / ±4
- [ ] Tempo change mid-loop seam — 104 → 130 mid-playback; confirm acceptable
- [ ] Mock `useEntitlement` to `'free'` — confirm hook is called at every control; behavior unchanged (caps not built)
- [ ] Backend Zod validation — attempt to save a tutorial missing a key set; expect 4xx
- [ ] Backend Zod validation across environments — save with staging-bucket URLs against backend pointed at prod Supabase; confirm pass (path pattern, not host)

---

## Notes

- This is the product surface of the LAUNCH-02.5 epic. 02.5a/b are infrastructure; this is what a stakeholder sees.
- The active-card coordination + per-card track-cleanup contract is easy to under-implement. The flag alone fails the two-cards-on-page acceptance criterion — the cleanup is the second half.
- The acoustic listen-tests (crossfade seam, tempo displacement, PitchShift artifacts) are the merge gate that 02.5b deferred. If any fails, this story doesn't ship; either narrow the budget (PitchShift) or escalate (tempo seam).
