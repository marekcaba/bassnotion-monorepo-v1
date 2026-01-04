/**
 * Bass Sampler Types - Unit Tests
 *
 * Tests for utility functions and constants in types.ts:
 * - midiNoteToName: Convert MIDI number to note name
 * - noteNameToMidi: Convert note name to MIDI number
 * - getPositionForMidiNote: Get first valid string/fret position
 * - getAllPositionsForMidiNote: Get all valid string/fret positions
 * - Constants: BASS_TUNING, BASS_NOTE_RANGE, STRING_NUMBER_TO_NAME, etc.
 */

import { describe, it, expect } from 'vitest';
import {
  midiNoteToName,
  noteNameToMidi,
  getPositionForMidiNote,
  getAllPositionsForMidiNote,
  BASS_TUNING,
  BASS_NOTE_RANGE,
  STRING_NUMBER_TO_NAME,
  STRING_NAME_TO_NUMBER,
} from '../types.js';

describe('Bass Sampler Types', () => {
  describe('midiNoteToName', () => {
    describe('natural notes', () => {
      it('should convert C notes correctly', () => {
        expect(midiNoteToName(24)).toBe('C1');
        expect(midiNoteToName(36)).toBe('C2');
        expect(midiNoteToName(48)).toBe('C3');
        expect(midiNoteToName(60)).toBe('C4'); // Middle C
      });

      it('should convert D notes correctly', () => {
        expect(midiNoteToName(26)).toBe('D1');
        expect(midiNoteToName(38)).toBe('D2');
        expect(midiNoteToName(50)).toBe('D3');
      });

      it('should convert E notes correctly', () => {
        expect(midiNoteToName(28)).toBe('E1');
        expect(midiNoteToName(40)).toBe('E2');
        expect(midiNoteToName(52)).toBe('E3');
      });

      it('should convert F notes correctly', () => {
        expect(midiNoteToName(29)).toBe('F1');
        expect(midiNoteToName(41)).toBe('F2');
        expect(midiNoteToName(53)).toBe('F3');
      });

      it('should convert G notes correctly', () => {
        expect(midiNoteToName(31)).toBe('G1');
        expect(midiNoteToName(43)).toBe('G2');
        expect(midiNoteToName(55)).toBe('G3');
      });

      it('should convert A notes correctly', () => {
        expect(midiNoteToName(33)).toBe('A1');
        expect(midiNoteToName(45)).toBe('A2');
        expect(midiNoteToName(57)).toBe('A3');
      });

      it('should convert B notes correctly', () => {
        expect(midiNoteToName(23)).toBe('B0');
        expect(midiNoteToName(35)).toBe('B1');
        expect(midiNoteToName(47)).toBe('B2');
      });
    });

    describe('sharp notes', () => {
      it('should convert C# notes correctly (using "s" notation)', () => {
        expect(midiNoteToName(25)).toBe('Cs1');
        expect(midiNoteToName(37)).toBe('Cs2');
        expect(midiNoteToName(49)).toBe('Cs3');
      });

      it('should convert D# notes correctly', () => {
        expect(midiNoteToName(27)).toBe('Ds1');
        expect(midiNoteToName(39)).toBe('Ds2');
        expect(midiNoteToName(51)).toBe('Ds3');
      });

      it('should convert F# notes correctly', () => {
        expect(midiNoteToName(30)).toBe('Fs1');
        expect(midiNoteToName(42)).toBe('Fs2');
        expect(midiNoteToName(54)).toBe('Fs3');
      });

      it('should convert G# notes correctly', () => {
        expect(midiNoteToName(32)).toBe('Gs1');
        expect(midiNoteToName(44)).toBe('Gs2');
        expect(midiNoteToName(56)).toBe('Gs3');
      });

      it('should convert A# notes correctly', () => {
        expect(midiNoteToName(34)).toBe('As1');
        expect(midiNoteToName(46)).toBe('As2');
        expect(midiNoteToName(58)).toBe('As3');
      });
    });

    describe('bass range (MIDI 23-64)', () => {
      it('should handle lowest bass note (B0)', () => {
        expect(midiNoteToName(23)).toBe('B0');
      });

      it('should handle highest bass note (~E4)', () => {
        expect(midiNoteToName(64)).toBe('E4');
      });

      it('should handle all 5-string bass open strings', () => {
        expect(midiNoteToName(23)).toBe('B0'); // B string
        expect(midiNoteToName(28)).toBe('E1'); // E string
        expect(midiNoteToName(33)).toBe('A1'); // A string
        expect(midiNoteToName(38)).toBe('D2'); // D string
        expect(midiNoteToName(43)).toBe('G2'); // G string
      });
    });

    describe('edge cases', () => {
      it('should handle octave -1 (MIDI 0-11)', () => {
        expect(midiNoteToName(0)).toBe('C-1');
        expect(midiNoteToName(11)).toBe('B-1');
      });

      it('should handle octave 0 (MIDI 12-23)', () => {
        expect(midiNoteToName(12)).toBe('C0');
        expect(midiNoteToName(23)).toBe('B0');
      });

      it('should handle high octaves', () => {
        expect(midiNoteToName(108)).toBe('C8');
        expect(midiNoteToName(127)).toBe('G9');
      });
    });
  });

  describe('noteNameToMidi', () => {
    describe('natural notes', () => {
      it('should convert C notes correctly', () => {
        expect(noteNameToMidi('C1')).toBe(24);
        expect(noteNameToMidi('C2')).toBe(36);
        expect(noteNameToMidi('C3')).toBe(48);
        expect(noteNameToMidi('C4')).toBe(60);
      });

      it('should convert all natural notes in octave 2', () => {
        expect(noteNameToMidi('C2')).toBe(36);
        expect(noteNameToMidi('D2')).toBe(38);
        expect(noteNameToMidi('E2')).toBe(40);
        expect(noteNameToMidi('F2')).toBe(41);
        expect(noteNameToMidi('G2')).toBe(43);
        expect(noteNameToMidi('A2')).toBe(45);
        expect(noteNameToMidi('B2')).toBe(47);
      });
    });

    describe('sharp notes with "s" notation', () => {
      it('should convert Cs (C#) notes correctly', () => {
        expect(noteNameToMidi('Cs1')).toBe(25);
        expect(noteNameToMidi('Cs2')).toBe(37);
        expect(noteNameToMidi('Cs3')).toBe(49);
      });

      it('should convert all sharp notes in octave 2', () => {
        expect(noteNameToMidi('Cs2')).toBe(37);
        expect(noteNameToMidi('Ds2')).toBe(39);
        expect(noteNameToMidi('Fs2')).toBe(42);
        expect(noteNameToMidi('Gs2')).toBe(44);
        expect(noteNameToMidi('As2')).toBe(46);
      });
    });

    describe('sharp notes with "#" notation', () => {
      it('should convert C# notes correctly', () => {
        expect(noteNameToMidi('C#1')).toBe(25);
        expect(noteNameToMidi('C#2')).toBe(37);
        expect(noteNameToMidi('C#3')).toBe(49);
      });

      it('should convert all # notes in octave 2', () => {
        expect(noteNameToMidi('C#2')).toBe(37);
        expect(noteNameToMidi('D#2')).toBe(39);
        expect(noteNameToMidi('F#2')).toBe(42);
        expect(noteNameToMidi('G#2')).toBe(44);
        expect(noteNameToMidi('A#2')).toBe(46);
      });
    });

    describe('bass open strings', () => {
      it('should convert 5-string bass open string notes', () => {
        expect(noteNameToMidi('B0')).toBe(23);
        expect(noteNameToMidi('E1')).toBe(28);
        expect(noteNameToMidi('A1')).toBe(33);
        expect(noteNameToMidi('D2')).toBe(38);
        expect(noteNameToMidi('G2')).toBe(43);
      });
    });

    describe('roundtrip conversion', () => {
      it('should roundtrip correctly for natural notes', () => {
        for (let midi = 23; midi <= 64; midi++) {
          const name = midiNoteToName(midi);
          const backToMidi = noteNameToMidi(name);
          expect(backToMidi).toBe(midi);
        }
      });
    });

    describe('error handling', () => {
      it('should throw on invalid note name format', () => {
        expect(() => noteNameToMidi('invalid')).toThrow('Invalid note name');
        expect(() => noteNameToMidi('X2')).toThrow('Invalid note name');
        expect(() => noteNameToMidi('')).toThrow('Invalid note name');
      });

      it('should throw on missing octave', () => {
        expect(() => noteNameToMidi('C')).toThrow('Invalid note name');
        expect(() => noteNameToMidi('Cs')).toThrow('Invalid note name');
      });
    });

    describe('edge cases', () => {
      it('should handle negative octaves', () => {
        expect(noteNameToMidi('C-1')).toBe(0);
        expect(noteNameToMidi('B-1')).toBe(11);
      });

      it('should handle high octaves', () => {
        expect(noteNameToMidi('C8')).toBe(108);
        expect(noteNameToMidi('G9')).toBe(127);
      });
    });
  });

  describe('getPositionForMidiNote', () => {
    describe('lowest string preference (B string first)', () => {
      // Note: getPositionForMidiNote returns the FIRST valid position
      // checking strings in order: B, E, A, D, G (lowest to highest)
      // This means it prefers lower strings even when open string alternatives exist

      it('should return B string open for B0 (only valid position)', () => {
        const pos = getPositionForMidiNote(23);
        expect(pos).toEqual({ string: 'B', fret: 0 });
      });

      it('should return B string fret 5 for E1 (lower string preferred over E open)', () => {
        // E1 (MIDI 28) can be played on B string fret 5 OR E string open
        // Function prefers lower string, so returns B string
        const pos = getPositionForMidiNote(28);
        expect(pos).toEqual({ string: 'B', fret: 5 });
      });

      it('should return B string fret 10 for A1 (lower string preferred over A open)', () => {
        // A1 (MIDI 33) can be played on B string fret 10 OR E string fret 5 OR A string open
        const pos = getPositionForMidiNote(33);
        expect(pos).toEqual({ string: 'B', fret: 10 });
      });

      it('should return B string fret 15 for D2 (lower string preferred over D open)', () => {
        // D2 (MIDI 38) can be played on multiple strings, B string fret 15 is first valid
        const pos = getPositionForMidiNote(38);
        expect(pos).toEqual({ string: 'B', fret: 15 });
      });

      it('should return B string fret 20 for G2 (lower string preferred over G open)', () => {
        // G2 (MIDI 43) can be played on multiple strings, B string fret 20 is first valid
        const pos = getPositionForMidiNote(43);
        expect(pos).toEqual({ string: 'B', fret: 20 });
      });
    });

    describe('fretted notes on B string', () => {
      it('should return B string positions for frets 1-21', () => {
        // MIDI 24 (C1) = B string fret 1
        expect(getPositionForMidiNote(24)).toEqual({ string: 'B', fret: 1 });
        // MIDI 35 (B1) = B string fret 12
        expect(getPositionForMidiNote(35)).toEqual({ string: 'B', fret: 12 });
        // MIDI 44 (Gs2) = B string fret 21
        expect(getPositionForMidiNote(44)).toEqual({ string: 'B', fret: 21 });
      });
    });

    describe('notes beyond B string range', () => {
      it('should return E string for notes above B string 21st fret', () => {
        // MIDI 45 = B string would be fret 22 (invalid), E string fret 17
        const pos = getPositionForMidiNote(45);
        expect(pos?.string).toBe('E');
        expect(pos?.fret).toBe(17);
      });

      it('should return highest valid string for high notes', () => {
        // MIDI 64 (E4) - highest playable note on 5-string bass
        const pos = getPositionForMidiNote(64);
        expect(pos?.string).toBe('G');
        expect(pos?.fret).toBe(21);
      });
    });

    describe('notes outside bass range', () => {
      it('should return null for notes below B0', () => {
        expect(getPositionForMidiNote(22)).toBeNull(); // A#0
        expect(getPositionForMidiNote(0)).toBeNull();  // C-1
      });

      it('should return null for notes above bass range', () => {
        expect(getPositionForMidiNote(65)).toBeNull(); // F4
        expect(getPositionForMidiNote(127)).toBeNull();
      });
    });
  });

  describe('getAllPositionsForMidiNote', () => {
    describe('single position notes', () => {
      it('should return single position for lowest notes', () => {
        // B0 (MIDI 23) - only playable on B string open
        const positions = getAllPositionsForMidiNote(23);
        expect(positions).toHaveLength(1);
        expect(positions[0]).toEqual({ string: 'B', fret: 0 });
      });

      it('should return single position for highest notes', () => {
        // E4 (MIDI 64) - only playable on G string fret 21
        const positions = getAllPositionsForMidiNote(64);
        expect(positions).toHaveLength(1);
        expect(positions[0]).toEqual({ string: 'G', fret: 21 });
      });
    });

    describe('multiple position notes', () => {
      it('should return 2 positions for notes playable on B and E strings', () => {
        // E1 (MIDI 28) - B string fret 5 OR E string open
        const positions = getAllPositionsForMidiNote(28);
        expect(positions).toHaveLength(2);
        expect(positions).toContainEqual({ string: 'B', fret: 5 });
        expect(positions).toContainEqual({ string: 'E', fret: 0 });
      });

      it('should return multiple positions for common notes', () => {
        // A1 (MIDI 33) - multiple positions possible
        const positions = getAllPositionsForMidiNote(33);
        expect(positions.length).toBeGreaterThanOrEqual(2);
        expect(positions).toContainEqual({ string: 'A', fret: 0 });
      });

      it('should return up to 5 positions for notes in middle range', () => {
        // D3 (MIDI 50) - could be playable on multiple strings
        const positions = getAllPositionsForMidiNote(50);
        expect(positions.length).toBeGreaterThanOrEqual(1);
        // Each position should have valid fret (0-21)
        positions.forEach((pos) => {
          expect(pos.fret).toBeGreaterThanOrEqual(0);
          expect(pos.fret).toBeLessThanOrEqual(21);
        });
      });
    });

    describe('position validation', () => {
      it('should only return positions with valid frets (0-21)', () => {
        for (let midi = 23; midi <= 64; midi++) {
          const positions = getAllPositionsForMidiNote(midi);
          positions.forEach((pos) => {
            expect(pos.fret).toBeGreaterThanOrEqual(0);
            expect(pos.fret).toBeLessThanOrEqual(21);
          });
        }
      });

      it('should return empty array for notes outside bass range', () => {
        expect(getAllPositionsForMidiNote(22)).toHaveLength(0);
        expect(getAllPositionsForMidiNote(65)).toHaveLength(0);
      });
    });
  });

  describe('Constants', () => {
    describe('BASS_TUNING', () => {
      it('should have correct MIDI notes for 5-string bass', () => {
        expect(BASS_TUNING.B).toBe(23);
        expect(BASS_TUNING.E).toBe(28);
        expect(BASS_TUNING.A).toBe(33);
        expect(BASS_TUNING.D).toBe(38);
        expect(BASS_TUNING.G).toBe(43);
      });

      it('should have 5 strings', () => {
        expect(Object.keys(BASS_TUNING)).toHaveLength(5);
      });
    });

    describe('BASS_NOTE_RANGE', () => {
      it('should have correct min (B0 = 23)', () => {
        expect(BASS_NOTE_RANGE.min).toBe(23);
      });

      it('should have correct max (E4 = 64)', () => {
        expect(BASS_NOTE_RANGE.max).toBe(64);
      });
    });

    describe('STRING_NUMBER_TO_NAME', () => {
      it('should map 1-5 to string names', () => {
        expect(STRING_NUMBER_TO_NAME[1]).toBe('B');
        expect(STRING_NUMBER_TO_NAME[2]).toBe('E');
        expect(STRING_NUMBER_TO_NAME[3]).toBe('A');
        expect(STRING_NUMBER_TO_NAME[4]).toBe('D');
        expect(STRING_NUMBER_TO_NAME[5]).toBe('G');
      });
    });

    describe('STRING_NAME_TO_NUMBER', () => {
      it('should map string names to 1-5', () => {
        expect(STRING_NAME_TO_NUMBER.B).toBe(1);
        expect(STRING_NAME_TO_NUMBER.E).toBe(2);
        expect(STRING_NAME_TO_NUMBER.A).toBe(3);
        expect(STRING_NAME_TO_NUMBER.D).toBe(4);
        expect(STRING_NAME_TO_NUMBER.G).toBe(5);
      });

      it('should be inverse of STRING_NUMBER_TO_NAME', () => {
        for (let i = 1; i <= 5; i++) {
          const name = STRING_NUMBER_TO_NAME[i];
          expect(STRING_NAME_TO_NUMBER[name]).toBe(i);
        }
      });
    });
  });
});
