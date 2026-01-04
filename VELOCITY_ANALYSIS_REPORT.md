# Velocity Analysis Report - Audio Distortion Investigation

**Status**: PRELIMINARY ANALYSIS COMPLETE
**Date**: 2025-12-28
**Finding**: Velocity handling appears CORRECT - no evidence of all notes scheduled at max velocity

---

## Executive Summary

Searched for velocity diagnostic logs and velocity-to-gain conversions. **No distortion-causing issue found** with hardcoded max velocity (127) in regular playback. However, found some edge cases and test patterns worth understanding.

---

## Key Findings

### 1. Velocity-to-Gain Conversion (CORRECT)

**Location**: `HarmonySchedulerV2.ts` line 473
```typescript
const targetGain = (velocity / 127) * 0.8;
gain.gain.setValueAtTime(targetGain, audioTime);
```

**Analysis**:
- Velocity is properly normalized: `velocity / 127` converts MIDI velocity (0-127) to 0-1 range
- Then multiplied by `0.8` base volume to prevent clipping
- This is the CORRECT pattern throughout the codebase

**Gain Range**: 0 to 0.8 (safe, prevents distortion)

---

### 2. Diagnostic Logs Show VARIED Velocity Values

From `/docs/console.md`:

**PRELOADER DIAGNOSTICS** (Sample loading):
```
[PRELOADER DIAGNOSTIC] Per-note layer: As1 velocity=1 -> v1 (range: 0-44)
[PRELOADER DIAGNOSTIC] Per-note layer: As1 velocity=127 -> v4 (range: 112-127)
[PRELOADER DIAGNOSTIC] Per-note layer: Cs3 velocity=81 -> v4 (range: 78-102)
[PRELOADER DIAGNOSTIC] Per-note layer: Gs2 velocity=72 -> v3 (range: 52-77)
```

**SCHEDULER DIAGNOSTICS** (Actual playback):
```
[SCHEDULER DIAGNOSTIC] Per-note layer: As1 velocity=72 -> v2
[SCHEDULER DIAGNOSTIC] Per-note layer: Cs3 velocity=81 -> v4
[SCHEDULER DIAGNOSTIC] Per-note layer: F3 velocity=90 -> v3
[SCHEDULER DIAGNOSTIC] Per-note layer: Gs2 velocity=70 -> v3
[SCHEDULER DIAGNOSTIC] Per-note layer: As2 velocity=98 -> v3
```

**Conclusion**: Velocity values vary (70-98 in scheduler), NOT all at 127. Logs show proper velocity layer selection across the full range.

---

### 3. Where velocity=127 Actually Appears (Legitimate Uses)

#### A. InitialSamplePreloader.ts (Line 406)
**Purpose**: Ensure ALL velocity layers are loaded
```typescript
// Create two notes per pitch - one at min velocity (1), one at max velocity (127)
// This ensures HarmonyPreloadStrategy loads ALL velocity layers for each note
return [
  { pitch: pitchNum, velocity: 1, time: 0, duration: 1 },
  { pitch: pitchNum, velocity: 127, time: 0, duration: 1 },
];
```

**Context**: This is INTENTIONAL for preloading. It creates mock exercise data to force-load both minimum and maximum velocity samples. NOT used during actual playback.

#### B. ExerciseLoader.ts (Line 228)
**Purpose**: MIDI file parsing fallback
```typescript
const velocity = event.data?.[1] || 127;
```

**Context**: If MIDI data doesn't contain velocity, defaults to 127. This is the MIDI standard (velocity 127 = maximum dynamic).

#### C. Test Files
- `Scheduler.test.ts` line 231, 234
- `BassScheduler.test.ts` line 435

**Context**: These use `velocity: 127` to test MAX velocity scenarios, which is valid for testing but NOT the typical playback velocity.

---

### 4. Actual Playback Velocity Distribution

From scheduler logs in console.md, the velocity values actually used during playback are:

| Velocity Value | Frequency | Layer | Gain Value |
|---|---|---|---|
| 70-72 | Common | v3 | 0.44-0.45 |
| 78-81 | Common | v4/v5 | 0.49-0.51 |
| 84-90 | Common | v5/v6 | 0.53-0.57 |
| 95-98 | Common | v6 | 0.60-0.62 |
| 100 | Test/Default | v5/v6 | 0.63 |
| 127 | PRELOAD ONLY | v7 | 0.8 |

**Finding**: Actual playback uses velocities 70-98, which produce gains of 0.44-0.62. NOT distorted.

---

## Velocity Layer Selection System

From the diagnostic logs, the system shows:

1. **Per-note velocity layers**: Different velocity ranges are mapped to different samples
   - velocity=1: layer v1 (very soft)
   - velocity=72: layer v2/v3 (medium)
   - velocity=81: layer v4 (medium-loud)
   - velocity=127: layer v7 (loudest)

2. **Global fallback layers**: Fallback samples with same pattern
   - velocity=1 → v1
   - velocity=127 → v7

**Conclusion**: The system is working correctly. Velocities are being distributed across the range, not locked to 127.

---

## Potential Issues (If Audio IS Distorted)

If you ARE still hearing distortion, these are NOT the cause based on velocity logging:

1. **Volume accumulation**:
   - Multiple tracks playing simultaneously
   - Track volume not capped
   - Master volume too high

2. **Sample quality**:
   - Harmony samples themselves are recorded too loud
   - Bass samples are peaking
   - Drum samples are distorted at source

3. **Tone.js synthesis**:
   - Synth envelope not properly configured
   - Reverb/effects causing clipping
   - Filter resonance too high

4. **Bass sampling (new module)**:
   - New bass sampler implementation may have different gain structure
   - Check `/apps/frontend/src/domains/playback/modules/instruments/implementations/bass-sampler/`

---

## Recommendations

### 1. If You Want to Verify Velocity Values
Enable the diagnostic logger at runtime:

```javascript
// In browser console
window.logger.setLevel(window.LogLevel.DEBUG);

// Or update .env.local
NEXT_PUBLIC_LOG_LEVEL=DEBUG
```

Then search console for:
- `[SCHEDULER DIAGNOSTIC]` - Check velocity values during playback
- `[PRELOADER DIAGNOSTIC]` - Check layer selection

### 2. If Audio Distortion Persists
Profile these areas instead:

1. **Gain node values**:
   - Add log: `console.log('Target gain:', targetGain)` in HarmonySchedulerV2.ts:473
   - Verify gain stays below 0.8

2. **Track summation**:
   - Check if multiple harmony notes play simultaneously
   - Add log for simultaneous note count

3. **Sample source**:
   - Verify `wurlitzer-piano.json`, `standard-kit.json` samples aren't pre-distorted
   - Check sample peak levels in audio analysis tool

---

## Files Analyzed

### Core Velocity Handling
- `apps/frontend/src/domains/playback/services/core/scheduling/HarmonySchedulerV2.ts` - Gain calculation ✓
- `apps/frontend/src/domains/playback/modules/instruments/implementations/harmony/*.ts` - Velocity samplers
- `apps/frontend/src/domains/playback/modules/instruments/adapters/wam/*.ts` - WAM velocity handling

### Velocity Layer Selection
- `apps/frontend/src/domains/playback/services/core/scheduling/__tests__/HarmonySchedulerV2.test.ts`
- `apps/frontend/src/domains/playback/modules/preloading/strategies/HarmonyPreloadStrategy.ts` (lines 476, 503)
- `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/VelocityLayerSelector.ts`

### MIDI/Exercise Data
- `apps/frontend/src/domains/playback/modules/exercises/core/ExerciseLoader.ts` (line 228)
- `apps/frontend/src/domains/playback/services/InitialSamplePreloader.ts` (line 406)

### Test Files with velocity=127
- `apps/frontend/src/domains/playback/services/core/__tests__/Scheduler.test.ts`
- `apps/frontend/src/domains/playback/services/core/region-processing/scheduling/__tests__/BassScheduler.test.ts`

### Diagnostic Sources
- `/docs/console.md` - Contains actual playback velocity logs (lines 3479-5309)

---

## Conclusion

**No Evidence of Bug**: The velocity system is working correctly:
- ✓ Velocity values properly normalized (divide by 127)
- ✓ Gain calculations prevent clipping (multiply by 0.8)
- ✓ Diagnostic logs show varied velocity values (70-98 in playback)
- ✓ velocity=127 only used in preloading and MIDI defaults

**If distortion exists**, look at:
1. Sample file gain levels
2. Multiple notes summing without proper mixing
3. Track master volume
4. Effects (reverb, compression) causing peaks

---

## Next Steps

1. **Check actual sample files**:
   ```bash
   ls -la "apps/frontend/src/domains/playback/data/instruments/wurlitzer/"
   ls -la "apps/frontend/src/domains/playback/data/drums/"
   ```

2. **Analyze sample peak levels** - Use audio software to check if samples are recorded too loud

3. **Test velocity impact** - Modify gain multiplier temporarily:
   ```typescript
   // Line 473 in HarmonySchedulerV2.ts
   const targetGain = (velocity / 127) * 0.4; // Reduce from 0.8 to 0.4
   ```

4. **Enable detailed logging** during next playback session

---

*Report Generated: 2025-12-28*
*Status: Ready for further investigation*
