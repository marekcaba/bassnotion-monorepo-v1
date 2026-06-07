# Adding a new groove to the Ableton A/B robustness suite

Goal: prove the DrumBeatsPlayer matches Ableton-Beats quality on a NEW kind of
drum material. Each new groove takes ~5 min of your time + a one-command check.

## What to record in Ableton (per groove)

For each groove, you provide TWO files:

1. **The original drum stem** — the un-warped loop (any tempo), as `.wav`/`.ogg`/`.mp3`.
2. **The Ableton render** — that same loop warped (Beats mode) to a target tempo,
   exported as `.wav`/`.mp3`.

Pick targets that STRESS the engine (we've only tested mild ~20-30% slow-down):
- **A speed-UP** (e.g. 90→120 BPM) — totally untested code path.
- **An extreme slow-down** (e.g. 120→70 BPM, ratio ~0.58).
- Diverse material: reverby/roomy kit, electronic/808 (long sub tails),
  fast hi-hat roll / trap, a breakbeat, an odd time signature.

Tell me the original BPM and target BPM for each.

## What I do (per groove)

```bash
# 1. decode both to the audit folder
ffmpeg -i <original> -ar 48000 docs/dev-tools/audio-audit/<name>-drums.wav
ffmpeg -i <ableton-render> -ar 48000 -ac 1 docs/dev-tools/audio-audit/ableton-<name>-mono.wav

# 2. render OURS at the same ratio (the env-parameterized harness)
AUDIT_STEM=<name>-drums.wav AUDIT_ORIG_BPM=<orig> AUDIT_TARGET_BPM=<target> \
  AUDIT_OUT=ours-<name> AUDIT_RENDER=1 \
  npx vitest run apps/frontend/src/domains/playback/services/core/drum-slicer/__tests__/renderTestGroove2.spec.ts
ffmpeg -y -i docs/dev-tools/audio-audit/ours-<name>.wav -ar 48000 -ac 1 \
  docs/dev-tools/audio-audit/ours-<name>-mono.wav

# 3. one-command diagnostic vs Ableton
node docs/dev-tools/audio-audit/groove-vs-ableton.mjs \
  docs/dev-tools/audio-audit/ours-<name>-mono.wav \
  docs/dev-tools/audio-audit/ableton-<name>-mono.wav
```

The diagnostic reports PASS/FAIL on the four real failure modes we've hardened:
- **HARD-CUTS to silence** (the worst click class — a tail slammed to zero)
- **BLIPS** (an isolated needle Ableton genuinely doesn't have — the decayRatio bug class)
- **CLICK ARTIFACTS** (low-level seam steps NOT rising into a real transient; compared to Ableton's own count)
- **ALIGNMENT** (big-hit onset offset vs Ableton, leading-silence auto-compensated)

Then I export a stereo mp3 for your ear/eye A/B in Ableton, and fix anything that FAILs.

## Status (2026-06-07)

| Groove | Character | Ratio | Result |
|---|---|---|---|
| test-groove-2 | sparse (CF 8.2, 70% silence) | 109→89 (0.82, slow) | PASS all |
| waitlist | dense (CF 5.5, 38% silence) | 133→103 (0.77, slow) | PASS (8 sub-audible tail wiggles, < Ableton-equiv) |

**Untested (the robustness gap):** speed-UP, extreme ratios (≪0.7 or ≫1.3),
reverby/electronic/fast-roll material, odd meters, very short/long loops.
Every new groove tested this session surfaced a real bug — expect the same.
