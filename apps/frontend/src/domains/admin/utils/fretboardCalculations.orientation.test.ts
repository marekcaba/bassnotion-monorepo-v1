import { describe, it, expect } from 'vitest';
import { calculatePitch, midiPitchToNoteName, BASS_TUNINGS } from './fretboardCalculations';

/**
 * STRING-ORIENTATION PIN (the bass-coach authoring landmine, 2026-06-21).
 *
 * The per-marker authoring matrix stores `stringNumbers` against THIS convention:
 *   string 1 = HIGHEST pitch (G on a 4-string), string N = LOWEST (E / B).
 * That is the BASS_TUNINGS / calculatePitch convention. It is REVERSED versus
 * ExerciseNote.string ("1 = E", exercise.ts:40). If a future refactor flips this, every
 * authored note would silently land on the wrong string (and the player would be graded
 * against the wrong pitch). These tests fail loudly if the orientation ever changes.
 */
describe('fretboard string orientation — string 1 = HIGHEST (the authoring convention)', () => {
  it('4-string: string 1 open = G2, string 4 open = E1', () => {
    expect(midiPitchToNoteName(calculatePitch(1, 0, '4'))).toBe('G2'); // highest
    expect(midiPitchToNoteName(calculatePitch(2, 0, '4'))).toBe('D2');
    expect(midiPitchToNoteName(calculatePitch(3, 0, '4'))).toBe('A1');
    expect(midiPitchToNoteName(calculatePitch(4, 0, '4'))).toBe('E1'); // lowest
  });

  it('the open-A note a bassist means lives on string 3 (NOT string 2)', () => {
    // a teacher authoring "open A" picks string 3 — pinning that the picker maps the
    // bassist's mental model to the right tuning index.
    expect(midiPitchToNoteName(calculatePitch(3, 0, '4'))).toBe('A1');
  });

  it('fret offset adds semitones from the open string', () => {
    // string 3 (A1, MIDI 33) + 5 frets = D2 (MIDI 38)
    expect(calculatePitch(3, 5, '4')).toBe(BASS_TUNINGS['4'][2]! + 5);
    expect(midiPitchToNoteName(calculatePitch(3, 5, '4'))).toBe('D2');
  });

  it('5-string adds a LOW B on string 5 (B0), 6-string adds a high C on string 1 (C3)', () => {
    expect(midiPitchToNoteName(calculatePitch(5, 0, '5'))).toBe('B0'); // low B = lowest
    expect(midiPitchToNoteName(calculatePitch(1, 0, '6'))).toBe('C3'); // high C = highest
  });

  it('matches the calculatePitch JSDoc anchor exactly (string 4 fret 0 = E1 = MIDI 28)', () => {
    expect(calculatePitch(4, 0, '4')).toBe(28);
  });
});
