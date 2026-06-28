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

/** Subdivisions per quarter-note beat for snapping. Basslines play OFF-beats
 *  (eighths/sixteenths), so snapping to quarters mis-scores every off-beat note
 *  by up to half a beat → huge erratic jitter even on a tight take. 4 = snap to
 *  sixteenths (covers most basslines); the analyzer's grid runs at this resolution. */
const DEFAULT_SUBDIVISIONS_PER_BEAT = 4;

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
  /** Snap resolution: subdivisions per quarter beat. 4 = sixteenths (default).
   *  Onsets snap to the nearest subdivision so off-beat notes score correctly. */
  subdivisionsPerBeat?: number;
  /** Beats per bar. Defaults to 4 (the engine's fixed 4/4). */
  beatsPerBar?: number;
}

export interface GridSlot {
  /** Onset time in audio-ctx seconds. */
  onsetSec: number;
  /** Absolute SUBDIVISION index the onset snapped to (0 = bar-1 downbeat;
   *  at sixteenths, +1 per sixteenth). The scoring grid runs at this resolution. */
  subIndex: number;
  /** Which bar (0-based) the onset snapped to. */
  measureNumber: number;
  /** Which beat within the bar (0-based) the onset snapped to. */
  beatNumber: number;
  /** Signed offset from the snapped grid slot, seconds (onset - gridSlotTime).
   *  THIS is the timing error — distance to the nearest subdivision, not a beat. */
  errorSec: number;
  /** Whether the onset fell before the first downbeat (count-in) → skipped. */
  beforeGrid: boolean;
}

/**
 * Snap one onset to the nearest grid SUBDIVISION (sixteenths by default) using
 * the deterministic loopStart + k*subSeconds grid (NOT getAudioPhase — a visual,
 * latency-shifted playhead, never a scoring clock; useReferenceDrop abandoned it
 * for exactly this). Snapping to subdivisions, not quarter beats, is essential:
 * basslines play off-beats, and quarter-snapping mis-scores every eighth/sixteenth
 * by up to half a beat → huge erratic jitter on a perfectly tight take. Grid is
 * re-derived from the LIVE loop duration so it tracks tempo.
 */
export function snapOnsetToGrid(onsetSec: number, grid: GridParams): GridSlot {
  const beatsPerBar = grid.beatsPerBar ?? BEATS_PER_BAR;
  const subPerBeat = grid.subdivisionsPerBeat ?? DEFAULT_SUBDIVISIONS_PER_BEAT;
  const barSeconds = grid.loopDurationSeconds / grid.lengthBars;
  const beatSeconds = barSeconds / beatsPerBar;
  const subSeconds = beatSeconds / subPerBeat;
  const subsPerBar = beatsPerBar * subPerBeat;

  const elapsed = onsetSec - grid.loopStartAudioTime;
  // A note snaps to slot 0 (the bar-1 downbeat) within ±half a subdivision of the
  // anchor. Only onsets EARLIER than that half-slot are count-in. Using a hard 0
  // cutoff wrongly drops a downbeat note played slightly AHEAD (e.g. 5ms early) as
  // count-in — a real note played in front of the beat, not a pre-roll click.
  if (elapsed < -subSeconds / 2) {
    return {
      onsetSec,
      subIndex: 0,
      measureNumber: 0,
      beatNumber: 0,
      errorSec: elapsed,
      beforeGrid: true,
    };
  }

  const subIndex = Math.round(elapsed / subSeconds);
  const measureNumber = Math.floor(subIndex / subsPerBar);
  const beatNumber = Math.floor((subIndex % subsPerBar) / subPerBeat);
  const gridSlotSec = grid.loopStartAudioTime + subIndex * subSeconds;

  return {
    onsetSec,
    subIndex,
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
  /** G3 over-trigger signal: fraction of scored onsets that COLLIDED on a grid
   *  subdivision already claimed by an earlier onset. A sustained note re-firing
   *  lands several onsets on one sixteenth → collisions. High = the detector is
   *  over-triggering and the score is untrustworthy (the panel refuses to grade). */
  collisionRate: number;
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
  const subPerBeat = grid.subdivisionsPerBeat ?? DEFAULT_SUBDIVISIONS_PER_BEAT;
  const analyzer = new BeatTimingAnalyzer();
  // Run the analyzer's grid at SUBDIVISION resolution: tempo × subPerBeat makes
  // its beatDuration one subdivision (60000/(bpm*subPerBeat) ms), and we feed each
  // onset's absolute subIndex as the analyzer's "beat" (measure 0). Then its
  // expectedTime = subIndex × subSeconds — the sixteenth grid. This is what makes
  // off-beat notes score correctly (the quarter grid was the 150ms-jitter bug).
  analyzer.start(grid.bpm * subPerBeat, { numerator: 1, denominator: 4 });
  // Anchor startTime to the grid's bar-1 downbeat IN MS (loopStartAudioTime is
  // audioContext.currentTime seconds), so elapsedTime = onsetMs - startMs =
  // (onsetSec - loopStartAudioTime)*1000 — relative ms in the audio clock.
  // Anchored to the downbeat (not 0) to dodge recordBeat's `if (!startTime) return`
  // falsy-zero trap; absolute onsetMs is never 0, so the `actualTime || now` trap
  // is also moot.
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
    // beat = absolute subIndex, measure = 0 → expectedTime = subIndex*subSeconds.
    // actualTime = absolute audio-clock ms → drift = onset's distance to its sub.
    analyzer.recordBeat('user-bass', slot.subIndex, 0, onsetSec * 1000);
  }

  // G3: collisions = onsets snapping to a subIndex an earlier onset already took.
  // (Note: BeatTimingAnalyzer's own 100ms dedup may have dropped some of these
  // from `stats`, but we count them on the raw slots to gauge over-trigger.)
  const scored = slots.filter((s) => !s.beforeGrid);
  const seen = new Set<number>();
  let collisions = 0;
  for (const s of scored) {
    if (seen.has(s.subIndex)) collisions++;
    else seen.add(s.subIndex);
  }
  const collisionRate = scored.length > 0 ? collisions / scored.length : 0;

  return {
    stats: analyzer.getStatistics('user-bass'),
    slots,
    skippedBeforeGrid,
    collisionRate,
  };
}
