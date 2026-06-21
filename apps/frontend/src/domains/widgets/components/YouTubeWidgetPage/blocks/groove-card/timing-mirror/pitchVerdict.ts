/**
 * pitchVerdict — compare a student's DETECTED pitch to the coach's AUTHORED note (the
 * "WHAT"). The authored reference stores string+fret per marker (NO MIDI in authoring);
 * here we compute the expected pitch from it and judge the student's detection.
 *
 * The verdict is deliberately conservative on bass:
 *   - 'correct'  : detected within ±1 semitone of the expected (right note).
 *   - 'octave'   : right pitch-class but an octave off (a common low-bass detector slip —
 *                  treated as RIGHT for grading, surfaced for honesty).
 *   - 'wrong'    : a confident detection at a different pitch (a real wrong note).
 *   - 'unknown'  : no confident detection (quiet/staccato) — NOT penalised.
 *   - 'n/a'      : the marker is pitchless (ghost/dead) or not authored — pitch not graded.
 */

import type { PitchResult } from './verifyPitch';
import { calculatePitch } from '@/domains/admin/utils/fretboardCalculations';

export type PitchVerdict = 'correct' | 'octave' | 'wrong' | 'unknown' | 'n/a';

export interface AuthoredNote {
  /** 1-based string, BASS_TUNINGS orientation (1 = highest). null = unauthored. */
  string?: 1 | 2 | 3 | 4 | 5 | 6 | null;
  fret?: number | null;
  /** ghost/dead = pitchless → pitch not graded. */
  role?: 'normal' | 'ghost' | 'dead' | 'accent' | null;
}

/**
 * The expected pitch (as a chromatic pitch number — the same scale calculatePitch and the
 * detector use, purely the comparison math; NOT a MIDI file/authoring concept) for an
 * authored note, or null when there is no defined pitch (pitchless role, or string/fret
 * not authored). Authoring is string+fret; this resolves it to a pitch to compare against.
 */
export function expectedPitch(
  note: AuthoredNote,
  bassType: '4' | '5' | '6' = '4',
): number | null {
  if (note.role === 'ghost' || note.role === 'dead') return null;
  if (note.string == null || note.fret == null) return null;
  try {
    return calculatePitch(note.string, note.fret, bassType);
  } catch {
    return null;
  }
}

/**
 * Judge the student's detected pitch against the authored note.
 *
 * @param detected  verifyPitch result for the student's onset (or null = no confident read)
 * @param note      the authored marker (string+fret+role)
 * @param bassType  the reference's bass type
 */
export function pitchVerdict(
  detected: PitchResult | null,
  note: AuthoredNote,
  bassType: '4' | '5' | '6' = '4',
  /** Below this detector confidence, a NON-matching pitch is reported 'unknown' rather
   *  than 'wrong' — a quiet note the detector barely heard must not be a confident
   *  wrong-note accusation (the harmonic/neighbour slips on quiet fast notes). A MATCHING
   *  pitch is still accepted at lower confidence (agreeing with the authored note is
   *  evidence the read is real). */
  minWrongConf = 0.85,
): { verdict: PitchVerdict; expected: number | null; centsOff: number | null } {
  const expected = expectedPitch(note, bassType);
  if (expected == null) return { verdict: 'n/a', expected: null, centsOff: null };
  if (detected == null) return { verdict: 'unknown', expected, centsOff: null };

  // detected.midi is the DETECTOR's pitch number (verifyPitch's output field) — internal
  // comparison math, not authoring. expected is on the same scale.
  const semisOff = detected.midi - expected;
  // ±1 semitone window (a detector can be a semitone off on a noisy onset) = correct.
  if (Math.abs(semisOff) <= 1) {
    return { verdict: 'correct', expected, centsOff: detected.cents };
  }
  // octave (or two) off but same pitch-class = a detector octave slip, common on low bass.
  if (semisOff % 12 === 0) {
    return { verdict: 'octave', expected, centsOff: detected.cents };
  }
  // a NON-matching pitch the detector wasn't confident about → 'unknown', not a wrong-note
  // accusation. Only call 'wrong' when the detector was sure it heard a different note.
  if (detected.confidence < minWrongConf) {
    return { verdict: 'unknown', expected, centsOff: detected.cents };
  }
  return { verdict: 'wrong', expected, centsOff: detected.cents };
}
