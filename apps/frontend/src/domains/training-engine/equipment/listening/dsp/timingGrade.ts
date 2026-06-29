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

  // Human score 0-100 from jitter (ms). The old `100 - jitter*1.25` linear curve was too
  // COMPRESSED + too harsh: tight playing (~24ms) only scored ~70 and sloppy playing bottomed
  // out near ~36, so the felt range was a narrow 36-70. We stretch it — GENEROUS at the top
  // (reward tight playing into the 90s) and STEEPER at the bottom (sloppy approaches 0) — using
  // a smooth quadratic falloff anchored on the tier reference points. Tune SCALE/POWER by ear.
  //   SCALE = jitter (ms) that maps to score 0; POWER > 1 keeps the top flat then drops fast.
  // Ear-tuned 2026-06-29 against a real player's takes (best ~24ms, worst ~51ms): the user wanted
  // the low bar LOWER + the top bar HIGHER (the old linear gave a narrow 36-70). SCALE=62/POWER=2
  // gives:  12ms→96 (locked)  24ms→85 (tight, was 70)  40ms→58 (solid)  51ms→32 (was 36)  60ms→6  62ms→0.
  const SCALE = 62;
  const POWER = 2.0;
  const x = Math.min(jitterMs / SCALE, 1); // 0 (dead-on) → 1 (at/over the floor)
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.pow(x, POWER)))));

  // Feel only flags a CONSISTENT lean (small |offset| reads as centered).
  const feel: TimingGrade['feel'] =
    offsetMs > 12 ? 'dragging' : offsetMs < -12 ? 'rushing' : 'centered';

  return { tier: band.tier, score, label: band.label, feel, color: band.color };
}

/** Hit window (seconds): a note within this much of its grid slot counts as "in time". ~80ms is
 *  a forgiving-but-musical pocket for bass (at 70bpm a sixteenth is ~214ms, so still sub-quarter).
 *  Ear-tuned 2026-06-29. Tune by ear. */
export const HIT_WINDOW_SEC = 0.08;

export interface HitGrade {
  /** Notes that landed inside the hit window. */
  hits: number;
  /** Notes scored (excludes count-in onsets). */
  total: number;
  /** 0-100 = hits / total — the Yousician-style headline ("6 of 8 in time"). */
  hitPercent: number;
}

/**
 * Per-note HIT/MISS grade (Yousician-style): each scored onset is "in time" if its distance to
 * the snapped grid slot is within HIT_WINDOW_SEC, else a MISS (zero for that note). The headline
 * a learner reads — concrete + motivating — alongside the deeper jitter "pocket" grade.
 *
 * The denominator is the TARGET note count (notes the exercise demanded), NOT the number played —
 * so notes the player skipped count as MISSES and you can't game the score by playing fewer notes.
 *
 * @param errorsSec    per-played-note signed distance to the grid slot (GridSlot.errorSec).
 * @param targetCount  how many notes the exercise demanded (expectedNotes × loops). Defaults to
 *                     the number played (back-compat) when omitted.
 */
export function gradeHits(errorsSec: number[], targetCount?: number): HitGrade {
  // Denominator = the exercise's TARGET count (notes demanded), so skipped notes count as misses.
  // When omitted, fall back to what was played. `hits` can't exceed `total` (extra notes beyond
  // target don't add hits past the demand).
  const total = targetCount ?? errorsSec.length;
  if (total === 0) return { hits: 0, total: 0, hitPercent: 0 };
  const inTime = errorsSec.filter((e) => Math.abs(e) <= HIT_WINDOW_SEC).length;
  const hits = Math.min(inTime, total);
  return { hits, total, hitPercent: Math.round((hits / total) * 100) };
}

export interface PitchGrade {
  /** Notes whose detected pitch matched the expected note (octave-tolerant). */
  correct: number;
  /** The DENOMINATOR = the exercise's target note count (played-and-judged + skipped). Skipped
   *  notes (target − played) count as wrong; a note PLAYED but un-pitch-readable is excluded
   *  (unverified) — we punish skipping, not what we can't hear. */
  judged: number;
  /** 0-100 = correct / judged — the "right notes" score. */
  pitchPercent: number;
  /** How many PLAYED onsets had no confident pitch read (transparency, not counted as wrong). */
  unverified: number;
}

/**
 * Per-note PITCH grade: compare each played note's DETECTED MIDI to the EXPECTED MIDI for that
 * position. SEPARATE from timing — a right-rhythm/wrong-key take is "great timing, wrong notes".
 * OCTAVE-EXACT: the chart specifies the note in a position, so playing it in the WRONG OCTAVE is
 * WRONG (the chart-informed detector measures the actual period, so the octave is reliable — no
 * need for mod-12 tolerance). A detected MIDI of null (no confident read) is UNVERIFIED — excluded.
 *
 * The denominator is the TARGET count: notes the exercise demanded but the player never played
 * count as WRONG (not unverified), so you can't game the score by playing fewer notes.
 *
 * @param pairs        per PLAYED note: the detected MIDI (or null) + the expected MIDI.
 * @param targetCount  notes the exercise demanded (expectedNotes × loops). Skipped notes
 *                     (target − played) are added as misses. Defaults to pairs.length.
 */
export function gradePitch(
  pairs: { detected: number | null; expected: number }[],
  targetCount?: number,
): PitchGrade {
  let correct = 0;
  let unverified = 0;
  for (const { detected, expected } of pairs) {
    if (detected == null) {
      unverified++;
      continue;
    }
    if (detected === expected) correct++; // octave-EXACT: same MIDI, not just same class
  }
  // Denominator = the exercise's TARGET count (same number timing uses, so the two grades ALWAYS
  // share a denominator). Skipped notes (target − played) are wrong (missing); unverified PLAYED
  // notes are pulled OUT of the denominator (we don't punish what we couldn't hear).
  const target = targetCount ?? pairs.length;
  const judged = Math.max(0, target - unverified);
  return {
    correct,
    judged,
    pitchPercent: judged > 0 ? Math.round((correct / judged) * 100) : 0,
    unverified,
  };
}
