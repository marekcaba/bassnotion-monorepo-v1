# Pure Two-Track Drum Engine — the clean architecture

## The decision

Rip out the SLICES↔BED state machine. ALWAYS play two continuous tracks:
- **BED** = the loop with kicks/snares notched OUT, WSOLA-stretched.
- **BIG-HITS** = only the kicks/snares, bit-exact, re-gridded, silence between.

No SLICES mode, no settle timer, no crossfade, no per-slice path. Just two
continuous sources, re-positioned/re-stretched as the tempo changes.

## The engineering problem + solution

You can't re-run the 187ms bed WSOLA on every drag step (a drag fires many
setRatio/second → it would stall). DAWs solve this with **realtime vs rendered**:

### While DRAGGING (cheap, instant — no re-render)
- **BED**: ride `playbackRate` on the already-rendered bed buffer. Slowing the tempo
  = lower playbackRate. The texture pitch-shifts slightly (like vinyl/turntable) —
  acceptable for hats/room wash, and only momentary while you drag.
- **HITS**: the kick/snare must NOT pitch-shift (a sped-up kick = chipmunk kick). So
  the hits ride a re-grid, which is the CHEAP 4ms synth — fast enough per drag step.
  (Or: also ride playbackRate during the drag for simplicity, accept slight pitch on
  the transients momentarily, then settle to bit-exact. TBD by ear.)

### When SETTLED (a clear pause)
- Re-render BOTH at the exact ratio: bed WSOLA (187ms, masked because you've stopped)
  + hits re-grid (4ms). Swap on the next downbeat. playbackRate → 1. Now it's the
  high-quality pitch-correct version.

This is Adobe Audition Realtime↔Rendered, but applied to the WHOLE engine instead of
a SLICES/BED split. Dragging = realtime (playbackRate, instant, slight pitch).
Settled = rendered (WSOLA, pitch-correct).

## What gets removed

- The entire SLICES↔BED state machine: `mode`, `crossfadeToBed`, `crossfadeToSlices`,
  `onNudge`, `onSettled`, `XFADE_*`, `scheduleSlicesNow`/`scheduleBedNow`,
  `sliceGain`/`bedGain` crossfade buses, the settle timer.
- The per-slice path (`scheduleSlice`) — no longer used for tempo (kept only if the
  legacy A/B needs it; likely deleted).
- The live per-hit overlay loop (already behind useTwoTrack).

## What stays / changes

- `bedBuffer` + `hitsBuffer` rendering (steps 1-3) — unchanged, now ALWAYS the source.
- `scheduleBed` + `scheduleHits` — always arm both, every iteration.
- A single continuous-clock scheduler: arm bed + hits one-shots per loop iteration,
  phase-locked to `loopStartTime`, advancing by `period`.
- `setRatio`: during a drag, adjust the PLAYING sources' playbackRate (instant) +
  re-anchor the grid; mark dirty. When settled (debounced), re-render at the exact
  ratio and swap on the downbeat.

## Risks / things to verify

- **playbackRate on a 15s one-shot mid-play**: changing `src.playbackRate.value` live
  is supported and sample-accurate, but it changes the buffer's REMAINING duration —
  the grid math (period, seam) must use the rate-adjusted timeline. Care needed.
- **Bed pitch during drag**: a slow drag drops the hat pitch. If it's distracting,
  the bed can also re-grid-stretch instead, but that's not free. Ear decides.
- **The downbeat swap** from playbackRate-stretched to WSOLA-rendered must be
  click-free (crossfade or swap exactly on the seam).
- **Landmines L2/L4/L5/L6** still apply: grid-lock to period, loopStartTime fold,
  shared pivot, stop in-flight on re-render.

## Build order

1. Make bed + hits ALWAYS play (remove the `mode !== BED` gate) — verify both play at
   a held tempo with no state machine.
2. `setRatio` during drag → set playbackRate on the live bed + hits sources + re-anchor
   grid (no re-render). Verify smooth drag (no stall, no stutter).
3. Settle debounce → re-render both at exact ratio, swap on downbeat, rate→1.
4. Delete the dead state machine (modes, crossfades, slice path, settle).
5. Ear test: smooth continuous drag + pitch-correct when settled + no spill + no double.

Fallback: the hybrid two-track is committed at 13a8d51b; baseline at 91f37b14.
