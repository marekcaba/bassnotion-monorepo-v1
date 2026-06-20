/**
 * timingGrade — human-scaled interpretation of a timing take.
 *
 * BeatTimingAnalyzer's syncScore / "erratic" labels are tuned for MACHINE timing
 * (it flags jitter > 20ms as erratic) — useless for a human, where ~30ms jitter is
 * a solid pocket, not a problem. The MEASUREMENT (drift/jitter from the analyzer)
 * is correct; this module only re-interprets it on a scale that matches what a
 * bass player actually hears and feels.
 *
 * Pure + unit-tested. The reference points are defensible studio/performance norms
 * (a player "in the pocket" sits within a few ms to ~30ms of the grid), but they
 * are EAR-CALIBRATABLE — adjust the bands if real takes disagree with the ear
 * (ear is ground truth; a band that contradicts how it sounds is the band that's wrong).
 */

export type TimingTier = 'locked' | 'tight' | 'solid' | 'loose' | 'rough';

export interface TimingGrade {
  tier: TimingTier;
  /** 0-100, human-scaled (NOT BeatTimingAnalyzer.syncScore). 100 = dead-on. */
  score: number;
  /** Short player-facing label, e.g. "Solid pocket". */
  label: string;
  /** Direction of the constant offset, for the "you tend to rush/drag" cue. */
  feel: 'rushing' | 'dragging' | 'centered';
  /** A hex colour for the headline number. */
  color: string;
}

// Jitter (stddev of drift, ms) → tier. Reference points, ear-calibratable:
//   ≤12  locked   — studio-tight, basically on the grid
//   ≤25  tight    — clearly in time, pro-feel
//   ≤40  solid    — a real, musical pocket (most good playing lives here)
//   ≤60  loose    — audibly loose but still musical
//   >60  rough    — timing is the thing to work on
const TIERS: { max: number; tier: TimingTier; label: string; color: string }[] = [
  { max: 12, tier: 'locked', label: 'Locked in', color: '#6ad08c' },
  { max: 25, tier: 'tight', label: 'Tight', color: '#6ad08c' },
  { max: 40, tier: 'solid', label: 'Solid pocket', color: '#a3d977' },
  { max: 60, tier: 'loose', label: 'A little loose', color: '#e0b24a' },
  { max: Infinity, tier: 'rough', label: 'Work the timing', color: '#e0604a' },
];

/**
 * Grade a take from its jitter (ms) and mean offset (ms, +late / -early).
 * `offsetMs` should be the offset AFTER rig-latency calibration when available;
 * the feel cue ("rushing"/"dragging") is only meaningful once latency is removed.
 */
export function gradeTiming(jitterMs: number, offsetMs: number): TimingGrade {
  const band = TIERS.find((t) => jitterMs <= t.max) ?? TIERS[TIERS.length - 1]!;

  // Human score: 100 at 0ms jitter, ~0 by ~80ms. Linear-ish, clamped. This is a
  // FEEL scale for a player, deliberately gentler than the machine syncScore.
  const score = Math.max(0, Math.min(100, Math.round(100 - jitterMs * 1.25)));

  // Feel only flags a CONSISTENT lean (small |offset| reads as centered).
  const feel: TimingGrade['feel'] =
    offsetMs > 12 ? 'dragging' : offsetMs < -12 ? 'rushing' : 'centered';

  return { tier: band.tier, score, label: band.label, feel, color: band.color };
}
