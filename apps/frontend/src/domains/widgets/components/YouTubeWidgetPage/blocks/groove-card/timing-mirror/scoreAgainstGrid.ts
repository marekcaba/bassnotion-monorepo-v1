/**
 * scoreAgainstGrid — the clock bridge for the timing-mirror spike.
 *
 * Feasibility probe (see docs/TIMING_MIRROR_SPIKE_PLAN.md). Takes detected note
 * onsets in the ENGINE's audio clock (audioContext.currentTime seconds) and
 * scores them against the groove's beat grid via BeatTimingAnalyzer's
 * drift/jitter/syncScore math.
 *
 * THE LOAD-BEARING RECONCILIATION (the #1 correctness hazard):
 *   BeatTimingAnalyzer is performance.now()-MILLISECONDS internally:
 *     start() sets startTime = performance.now()
 *     recordBeat: elapsedTime = actualTime - startTime
 *     expectedTime (ms) = (measure*numerator + beat) * 60000/tempo
 *     drift = elapsedTime - expectedTime
 *   Our capture is audioContext.currentTime SECONDS, a different unit AND origin.
 *
 *   Bridge: anchor startTime = 0, then pass each onset as
 *     relMs = (onsetCtxSeconds - loopStartAudioTime) * 1000
 *   so elapsedTime === relMs, and both drift operands live in the audio clock,
 *   in ms. One clock end-to-end. The *1000 is mandatory (else drift is 1000x
 *   wrong and syncScore collapses to 0). There is NO fixed perf.now<->currentTime
 *   offset shortcut: the origins drift across context resumes/closes.
 *
 * This module is PURE (no audio, no DOM) so the bridge math can be unit-tested
 * before any mic is involved — Step 1 of the build order.
 */

import {
  BeatTimingAnalyzer,
  type TimingStatistics,
} from '@/domains/playback/utils/BeatTimingAnalyzer.js';

/** Beats per bar. The groove engine hardcodes 4/4 (useGrooveCardPlayback),
 *  so callers supply it explicitly rather than reading a phantom signature. */
const BEATS_PER_BAR = 4;

export interface GridParams {
  /** Audio-context time (seconds) of bar-1 downbeat — the engine's grid anchor
   *  (useGrooveCardPlayback.loopStartAudioTime). Same origin the waveform +
   *  useReferenceDrop use, so our grid agrees with the engine's by construction. */
  loopStartAudioTime: number;
  /** Loop length in seconds (useGrooveCardPlayback.loopDurationSeconds). */
  loopDurationSeconds: number;
  /** Loop length in bars (config.lengthBars). */
  lengthBars: number;
  /** Current tempo. Drives BeatTimingAnalyzer's expectedTime spacing. */
  bpm: number;
  /** Beats per bar. Defaults to 4 (the engine's fixed 4/4). */
  beatsPerBar?: number;
}

export interface GridSlot {
  /** Onset time in audio-ctx seconds. */
  onsetSec: number;
  /** Which bar (0-based) the onset snapped to. */
  measureNumber: number;
  /** Which beat within the bar (0-based) the onset snapped to. */
  beatNumber: number;
  /** Signed offset from the grid slot, seconds (onset - gridSlotTime). */
  errorSec: number;
  /** Whether the onset fell before the first downbeat (count-in) → skipped. */
  beforeGrid: boolean;
}

/**
 * Snap one onset to the nearest grid beat using the deterministic
 * loopStart + k*beatSeconds grid (NOT getAudioPhase — that's a visual,
 * latency-shifted playhead, never a scoring clock; useReferenceDrop abandoned
 * it for exactly this). Grid is re-derived from the LIVE loop duration so it
 * tracks tempo; never cache a grid captured at record-start.
 */
export function snapOnsetToGrid(onsetSec: number, grid: GridParams): GridSlot {
  const beatsPerBar = grid.beatsPerBar ?? BEATS_PER_BAR;
  const barSeconds = grid.loopDurationSeconds / grid.lengthBars;
  const beatSeconds = barSeconds / beatsPerBar;

  const elapsed = onsetSec - grid.loopStartAudioTime;
  if (elapsed < 0) {
    // Onset is during the count-in (loopStartAudioTime is the FUTURE bar-1
    // downbeat). Not on the loop grid yet → skip from scoring.
    return {
      onsetSec,
      measureNumber: 0,
      beatNumber: 0,
      errorSec: elapsed,
      beforeGrid: true,
    };
  }

  const absBeat = Math.round(elapsed / beatSeconds);
  const measureNumber = Math.floor(absBeat / beatsPerBar);
  // guard against negative modulo (defensive; absBeat >= 0 here)
  const beatNumber = ((absBeat % beatsPerBar) + beatsPerBar) % beatsPerBar;
  const gridSlotSec = grid.loopStartAudioTime + absBeat * beatSeconds;

  return {
    onsetSec,
    measureNumber,
    beatNumber,
    errorSec: onsetSec - gridSlotSec,
    beforeGrid: false,
  };
}

export interface ScoreResult {
  stats: TimingStatistics;
  slots: GridSlot[];
  /** Onsets dropped because they fell in the count-in (before bar 1). */
  skippedBeforeGrid: number;
}

/**
 * Score a list of onsets (audio-ctx seconds) against the grid. Returns the
 * BeatTimingAnalyzer statistics plus the per-onset grid slots (for the visualizer).
 *
 * Pure: constructs a FRESH BeatTimingAnalyzer (never the live singleton, which
 * is in use by YouTubeWidgetPage/TimingDebugWindow — sharing interleaves history).
 */
export function scoreOnsetsAgainstGrid(
  onsetsSec: number[],
  grid: GridParams,
): ScoreResult {
  const analyzer = new BeatTimingAnalyzer();
  analyzer.start(grid.bpm, {
    numerator: grid.beatsPerBar ?? BEATS_PER_BAR,
    denominator: 4,
  });
  // Anchor startTime to the grid's bar-1 downbeat IN MS (loopStartAudioTime is
  // audioContext.currentTime seconds). Then pass each onset as its ABSOLUTE
  // audio-clock ms, so the class computes:
  //   elapsedTime = onsetMs - startTime = (onsetSec - loopStartAudioTime) * 1000
  // i.e. the relative ms in the audio clock — exactly the bridge we want.
  //
  // Why anchor to the downbeat (not 0): recordBeat guards `if (!this.startTime) return`,
  // a falsy-zero trap that silently drops EVERY beat when startTime is 0. The
  // downbeat anchor keeps startTime truthy (and a real take's loopStartAudioTime
  // is ~tens of seconds, never 0). Likewise recordBeat's `actualTime || now`
  // trap: an absolute onsetMs is never 0 for a real grid, so no EPSILON dance.
  const startMs = grid.loopStartAudioTime * 1000;
  (analyzer as unknown as { startTime: number }).startTime = startMs;

  const slots: GridSlot[] = [];
  let skippedBeforeGrid = 0;

  for (const onsetSec of onsetsSec) {
    const slot = snapOnsetToGrid(onsetSec, grid);
    slots.push(slot);
    if (slot.beforeGrid) {
      skippedBeforeGrid++;
      continue;
    }
    // absolute audio-clock ms; elapsedTime resolves to relative-ms vs the anchor.
    analyzer.recordBeat(
      'user-bass',
      slot.beatNumber,
      slot.measureNumber,
      onsetSec * 1000,
    );
  }

  return {
    stats: analyzer.getStatistics('user-bass'),
    slots,
    skippedBeforeGrid,
  };
}
