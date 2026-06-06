# Two-Track Drum Engine — Full Plan

## The problem we're solving

When you nudge the tempo, a kick or snare sometimes **spills into the bed** — a
transient leaks through where it should be clean. We tried to fix it in the live
scheduler (hard-killing overlays, skipping overlay scheduling during the nudge-out)
and it got *better* but never 100% reliable.

### Why the live scheduler can't be made reliable

The current engine schedules each kick/snare as its **own audio source, armed ahead
of time** on a 25ms tick with a 60ms look-ahead. This is the spill mechanism:

1. The scheduler commits the next ~60ms of audio to the Web Audio clock.
2. A nudge can land **after** a kick was already committed but **before** it fires.
3. Gain automation can only *attenuate* a sound that's already scheduled — and a
   kick/snare attack is in the first 2–5ms. If the onset is within ~5–10ms of the
   kill, the transient's first samples escape.

You **cannot** close this window with tuning. It's structural: the real-time
scheduler races the nudge. This is exactly what you intuited.

## The fix (your idea): two pre-rendered continuous tracks

Instead of scheduling hundreds of individual hit sources live, render **two
continuous buffers** and play each as ONE source:

- **BED track** = the loop with the kicks/snares notched OUT, WSOLA-stretched to the
  tempo. (We already build this — `bedBuffer`.)
- **BIG-HITS track** = the COMPLEMENT: only the kicks/snares, bit-exact, re-placed at
  their grid positions for the tempo, **silence between them** (the bed fills the
  gaps). (NEW — `hitsBuffer`.)

A nudge = re-render both buffers and swap them on the grid downbeat. **There are no
future-armed per-hit sources to race against**, so there is nothing to spill. The
transients are baked into the big-hits buffer at the right positions before
playback — the nudge just changes which buffer plays.

This is the Ableton / zplane élastique model: separate transient and texture
streams, each handled continuously, recombined. The current engine recombines
per-hit in real time (the spill-prone part); the two-track model recombines offline.

---

## What the investigation agents found

Two agents mapped the engine + its integration. **One read a STALE file** (the
working tree had silently reverted to the pre-session DrumSlicePlayer because it was
on the wrong branch) — so its DrumSlicePlayer line-map was for the old version. But
the **integration facts** (read from PlaybackEngine.ts and other non-stale files)
and the **landmine analysis** are valid and transfer. Key findings:

### Integration (valid)
- **Construction:** `new DrumSlicePlayer(ctx, drumBuffer, onsets, output, options,
  confidences)` in `PlaybackEngine.ensureDrumSlicePlayer()`. `output` = the single
  `audio-drums` instrument gain node. onsets/confidences from
  `detectOnsetsDetailed(buffer)`, run once at construction.
- **Tempo nudge path:** groove card `setTempo` → `engine.setStretchRatio` → computes
  ONE shared pivot `T = now + 0.02` → `drumSlicePlayer.setRatio(ratio, T)` BEFORE the
  bass/harmony rate change, all three using the SAME pivot. Drums stay synchronous
  with bass/harmony by construction.
- **`getNextDownbeat(now)`** is read right after `setRatio` for the key-change seam —
  must keep working.
- **Lifecycle:** the player is created once per stem-load, reused across plays,
  destroyed (nulled) only on full `stopAudioStems`. `stop()` is a HARD cut — click
  safety is the engine's master-bus fade, NOT per-source fades.
- **Public API that must not change:** `setRatio`, `start`, `stop`, `getNextDownbeat`,
  `setGapFill`, `setWsola`, `setDiagnosticSolo`, `setGapFillParams`,
  `getGapFillParams`, `qualifyingFillCount`, `textureRegionCount`, plus the exported
  `buildRegions` + types. The admin panel + engine forwarders are hard-coded to these.
- **Tests:** only pure helpers are tested (`buildRegions`, `detectOnsets`,
  `wsolaStretch`, `buildExtendedTail`). No test instantiates the player. The refactor
  has freedom on scheduling internals as long as `buildRegions` + the API hold.

### Landmines (hard-won fixes — must not regress)
- **L1 — notch ≥ one WSOLA window + margin.** A narrow notch lets a WSOLA window
  straddle the gap and rebuild the body downstream ("doubled kick"). The big-hits
  track geometry must MATCH the bed notch or they comb.
- **L2 — bed synthesized ONE WINDOW longer than the grid period, played clamped to
  the exact period.** The seam locks to the GRID, not the rounded buffer length.
  Build the hits buffer the same way.
- **L3 — duck-and-replace, not sum.** The bed must be notched where the hit plays, or
  the bed's smeared copy combs with the rendered hit.
- **L5 — phase continuity on setRatio uses OLD ratio for inputPos, NEW for
  re-anchor**, with the SHARED pivot. Both tracks re-anchor with identical algebra.
- **L6/L7 — no old/new overlap; future-armed sources escape a naive stop.** On a
  ratio change, the in-flight hits one-shot must be stopped in lockstep with the bed.
  (Our `bedOverlay` tag + `stopBedSources` already do this.)
- **L4 — `loopStartTime` is usually one period in the FUTURE**; position any source
  via the modulo-fold (`currentInputPos`), never assume `loopStartTime ≤ now`.

---

## The current (real) engine — anchor points

The live file already has a state machine (SLICES / XFADE_TO_BED / BED /
XFADE_TO_SLICES) the stale agent missed. The two-track build hooks these:

| What | Where | Today | Two-track change |
|---|---|---|---|
| Bed analysis (load) | `precomputeBedAnalysis` ~1161 | builds `bedAnalysis` (notched) | ALSO build `hitsAnalysis` (complement) |
| The notch | `notchTransients` ~1205 | dips hit bodies OUT, returns bed source | add `keepOnlyTransients` (inverse) for the hits source |
| Synth per ratio | `resynthesizeBed` ~1273 | WSOLA-stretch → `bedBuffer` | ALSO build `hitsBuffer` (bit-exact re-grid, NOT stretched) |
| Schedule | `scheduleBedIteration` ~1860 | bed one-shot + live per-hit overlay loop | bed one-shot + `hitsBuffer` one-shot; DELETE the live overlay loop |
| Async pre-render | `kickoffBedSynthAsync` (worker-era, may be dormant) | — | hits re-grid is cheap, stays on main thread |

---

## How the BIG-HITS buffer is built (the core new DSP)

For a given ratio, allocate a buffer of the SAME length as the bed
(`round(srcLen/ratio) + window`). For each strong hit:

1. Read the bit-exact hit region from the RAW loop: `[onset − pre, onset + tail]`
   (same `pre`/`tail` as the bed notch — L1/L3).
2. Copy it into the output buffer at the **re-gridded** position `onset/ratio`
   (its real-time position at the new tempo).
3. Apply short fade-in/out at the region edges (declick).
4. Everything else stays **silence** (the bed fills it — your choice).

The hits are NOT time-stretched (a kick stays a kick); only their SPACING changes.
This is cheap (a few array copies) — no WSOLA pass, so it adds almost nothing to the
per-nudge cost.

**Complement guarantee:** because the hits buffer copies EXACTLY the region the bed
notched out (same onsets, same pre/tail), `bed + hits` reconstructs the full loop at
the hit positions with no hole and no double. That's the whole point.

---

## Playback: two continuous sources, phase-locked

`scheduleBedIteration` already arms the bed one-shot for each iteration via
`scheduleBed`. We add a second one-shot for `hitsBuffer`, same `iterStart`/
`phaseSec`/`period`, its own env → output, tagged `'bedOverlay'` (so existing
teardown/stop catches it in lockstep — L6/L7). Then we **delete the live per-hit
overlay loop** (lines ~1885+). No per-hit scheduling survives → no spill.

The bed-duck automation (the cos²/sin² dip under each hit) is also removed — with the
hits on their own continuous track and the bed notched, there's nothing to duck.

---

## Build order (incremental, verify each by ear/scope)

1. **`keepOnlyTransients`** (inverse of `notchTransients`) + `hitsAnalysis` in
   `precomputeBedAnalysis`. Verify: the hits analysis contains only the hits.
2. **`hitsBuffer`** synth in `resynthesizeBed` (re-grid, not stretch). Verify via the
   scope: record "BIG HITS" — should be clean hits at grid positions, silence between.
3. **Schedule `hitsBuffer`** as the 2nd one-shot in `scheduleBedIteration`, keeping
   the OLD overlay loop temporarily behind a flag so we can A/B.
4. **Delete the live overlay loop + bed duck** once the rendered track is confirmed.
5. **Nudge test** — the spill should be structurally gone (no per-hit sources to
   race). Confirm by ear + scope across rapid drags.

Each step is committable; the checkpoint at `91f37b14` is the fallback.

---

## What it looks like at the end

- Two continuous buffers per ratio: notched-stretched bed + bit-exact re-gridded hits.
- A nudge re-renders both (bed = WSOLA, hits = cheap re-grid) and swaps on the
  downbeat. No live per-hit scheduling anywhere.
- The admin "big-hit region" sliders now shape **how the hits buffer is cut from the
  loop** (pre/tail) — same knobs, but they drive a buffer render instead of live
  per-hit timing. The bed-notch sliders shape the complement. Link keeps them matched.
- The waveform scope shows two clean complementary tracks that sum to the full beat.
- No kick/snare can spill into the bed at any tempo or during any nudge.
