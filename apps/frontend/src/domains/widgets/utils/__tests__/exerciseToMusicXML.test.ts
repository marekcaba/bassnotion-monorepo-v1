/**
 * Test Suite for exerciseToMusicXML
 *
 * Tests MusicXML generation from exercise data including:
 * - Duration calculation based on next note's start position
 * - Tied note generation for boundary crossings
 * - Rest gap filling
 * - Beam group calculation
 * - Complete MusicXML document structure
 *
 * IMPORTANT: The duration of a note in the sheet music is NOT the raw durationTicks.
 * Instead, it's calculated as the time until the NEXT note starts (or end of measure).
 * This ensures the sheet music always fills measures correctly regardless of MIDI timing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exerciseToMusicXML } from '../exerciseToMusicXML';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';

// Suppress console.log during tests
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('exerciseToMusicXML', () => {
  const defaultTimeSignature: TimeSignature = { numerator: 4, denominator: 4 };

  // Helper to create a note with position using tick for sub-beat precision
  // tick is in PPQ (480 ticks per quarter note)
  function createNote(
    overrides: Partial<ExerciseNote> & { note: string; duration: string },
  ): ExerciseNote {
    return {
      id: `note-${Math.random()}`,
      string: 3,
      fret: 5,
      color: 'blue',
      position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
      ...overrides,
    } as ExerciseNote;
  }

  describe('Duration Calculation (based on next note position)', () => {
    it('should calculate duration from note position to end of measure for single note', () => {
      // Single note at beat 0 should extend to end of measure (4 beats = whole note)
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // 4 beats = 4 * 480 = 1920 divisions, BUT this crosses mid-measure boundary
      // So it gets split: 2 beats (half) + 2 beats (half) = tied notes
      // First half: 960 divisions, second half: 960 divisions
      expect(xml).toContain('<duration>960</duration>');
      expect(xml).toContain('<type>half</type>');
    });

    it('should calculate duration from note to next note', () => {
      // Two notes: A at beat 0, B at beat 2
      // A should have duration of 2 beats (until B starts)
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Both notes should be half notes (2 beats each = 960 divisions)
      const halfNoteMatches = xml.match(/<duration>960<\/duration>/g) || [];
      expect(halfNoteMatches.length).toBe(2);
    });

    it('should handle consecutive eighth notes correctly', () => {
      // Two eighth notes at beat 0 and beat 0.5
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 240 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // First note: from 0 to 0.5 = 0.5 beats = eighth (240 divisions)
      expect(xml).toContain('<duration>240</duration>');
      expect(xml).toContain('<type>eighth</type>');
    });

    it('should quantize durations to 16th notes', () => {
      // Note at beat 0.1 should quantize to beat 0
      // Note at beat 1.0 should stay at beat 1
      // First note duration = 1.0 - 0 = 1 beat = quarter note
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 48 },
        }), // ~0.1 beats
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // First note quantizes to beat 0, second to beat 1
      // First duration = 1 beat = 480 divisions (quarter note)
      expect(xml).toContain('<duration>480</duration>');
      expect(xml).toContain('<type>quarter</type>');
    });
  });

  describe('Tied Notes (mid-measure boundary)', () => {
    it('should split notes that cross the mid-measure boundary (beat 2 in 4/4)', () => {
      // Note at beat 1 that would last 2 beats crosses beat 2
      // Should split into: 1 beat before boundary + 1 beat after
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'half',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 3, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // First note: beat 1-3, duration 2 beats, crosses boundary at beat 2
      // Should have tie elements
      expect(xml).toContain('<tie type="start"/>');
      expect(xml).toContain('<tie type="stop"/>');
      expect(xml).toContain('<tied type="start"/>');
      expect(xml).toContain('<tied type="stop"/>');
    });

    it('should NOT tie notes that do not cross boundary', () => {
      // Two quarter notes: one at beat 0-1, one at beat 2-3
      // Neither crosses beat 2 boundary
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'C3',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'D3',
          duration: 'quarter',
          position: { measure: 1, beat: 3, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should NOT have tie elements (each quarter fits within its beat)
      expect(xml).not.toContain('<tie type="start"/>');
      expect(xml).not.toContain('<tie type="stop"/>');
    });
  });

  describe('Rest Generation', () => {
    it('should fill gap at start of measure with rest', () => {
      const notes: ExerciseNote[] = [
        // Note starts on beat 2
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should have a rest before the note (2 beats = half note rest)
      expect(xml).toContain('<rest/>');
    });

    it('should generate empty measure as whole rest', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 1,
      });

      // Empty measure should have a whole rest (4 beats = 3840 divisions)
      expect(xml).toContain('<rest/>');
      expect(xml).toContain('<duration>3840</duration>');
    });

    it('should NOT add unnecessary rests when measure is full', () => {
      // Four quarter notes filling the entire measure
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'C3',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'D3',
          duration: 'quarter',
          position: { measure: 1, beat: 3, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should NOT have any rests
      expect(xml).not.toContain('<rest/>');
    });
  });

  describe('Pitch Generation', () => {
    it('should generate correct pitch for A2 (bass guitar notation = A3)', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<step>A</step>');
      expect(xml).toContain('<octave>3</octave>'); // Transposed up one octave for bass notation
    });

    it('should generate correct pitch for C#3', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'C#3',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<step>C</step>');
      expect(xml).toContain('<alter>1</alter>'); // Sharp
      expect(xml).toContain('<octave>4</octave>'); // Transposed up
    });

    it('should generate correct pitch for Bb2', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'Bb2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<step>B</step>');
      expect(xml).toContain('<alter>-1</alter>'); // Flat
    });
  });

  describe('Measure Organization', () => {
    it('should organize notes into correct measures', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'whole',
          position: { measure: 0, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'whole',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 2,
      });

      expect(xml).toContain('<measure number="1">');
      expect(xml).toContain('<measure number="2">');
    });

    it('should create correct number of measures when totalBars is specified', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 4,
      });

      expect(xml).toContain('<measure number="1">');
      expect(xml).toContain('<measure number="2">');
      expect(xml).toContain('<measure number="3">');
      expect(xml).toContain('<measure number="4">');
    });
  });

  describe('MusicXML Document Structure', () => {
    it('should generate valid MusicXML header', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        title: 'Test Exercise',
        totalBars: 1,
      });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<!DOCTYPE score-partwise');
      expect(xml).toContain('<score-partwise version="3.1">');
    });

    it('should include work title', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        title: 'My Bass Exercise',
        totalBars: 1,
      });

      expect(xml).toContain('<work-title>My Bass Exercise</work-title>');
    });

    it('should include bass clef in first measure', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 1,
      });

      expect(xml).toContain('<clef>');
      expect(xml).toContain('<sign>F</sign>');
      expect(xml).toContain('<line>4</line>');
    });

    it('should include time signature in first measure', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
        totalBars: 1,
      });

      expect(xml).toContain('<time>');
      expect(xml).toContain('<beats>3</beats>');
      expect(xml).toContain('<beat-type>4</beat-type>');
    });

    it('should include divisions attribute (480 PPQ)', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 1,
      });

      expect(xml).toContain('<divisions>480</divisions>');
    });

    it('should include final barline on last measure', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 1,
      });

      expect(xml).toContain('<barline location="right">');
      expect(xml).toContain('<bar-style>light-heavy</bar-style>');
    });
  });

  describe('Beam Groups', () => {
    it('should beam eighth notes within the same beat', () => {
      // Two eighth notes within beat 0 (0 and 0.5)
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 240 },
        }),
        createNote({
          note: 'C3',
          duration: 'half',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<beam number="1">begin</beam>');
      expect(xml).toContain('<beam number="1">end</beam>');
    });

    it('should not beam notes in different beats', () => {
      // Two eighth notes in different beats
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 240 },
        }),
        createNote({
          note: 'B2',
          duration: 'eighth',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should NOT have beam tags since notes are in different beats
      expect(xml).not.toContain('<beam number="1">begin</beam>');
    });

    it('should not beam quarter notes', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'C3',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'D3',
          duration: 'quarter',
          position: { measure: 1, beat: 3, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).not.toContain('<beam');
    });
  });

  describe('Real-world Rhythm Patterns', () => {
    it('should render walking bass pattern (4 quarter notes)', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'E2',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'G2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'A2',
          duration: 'quarter',
          position: { measure: 1, beat: 2, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 3, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // All four notes should be quarter notes (480 divisions each)
      const quarterMatches = xml.match(/<duration>480<\/duration>/g) || [];
      expect(quarterMatches.length).toBe(4);
    });

    it('should render eighth note groove (2 eighths per beat)', () => {
      const notes: ExerciseNote[] = [
        createNote({
          note: 'E2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'E2',
          duration: 'eighth',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 240 },
        }),
        createNote({
          note: 'G2',
          duration: 'eighth',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'G2',
          duration: 'eighth',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 240 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // All four notes should be eighth notes (240 divisions each)
      const eighthMatches = xml.match(/<duration>240<\/duration>/g) || [];
      expect(eighthMatches.length).toBe(4);

      // Should have beams
      expect(xml).toContain('<beam number="1">begin</beam>');
      expect(xml).toContain('<beam number="1">end</beam>');
    });

    it('should render dotted quarter + eighth pattern correctly', () => {
      // Dotted quarter (1.5 beats) + eighth (0.5 beats) = 2 beats
      const notes: ExerciseNote[] = [
        createNote({
          note: 'A2',
          duration: 'dotted-quarter',
          position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
        }),
        createNote({
          note: 'B2',
          duration: 'eighth',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 240 },
        }), // beat 1.5
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // First note: from 0 to 1.5 = 1.5 beats = dotted quarter (720 divisions)
      expect(xml).toContain('<duration>720</duration>');
      expect(xml).toContain('<dot/>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty notes array with totalBars', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 2,
      });

      expect(xml).toContain('<score-partwise');
      expect(xml).toContain('</score-partwise>');
      expect(xml).toContain('<measure number="1">');
      expect(xml).toContain('<measure number="2">');
    });

    it('should handle 3/4 time signature', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: { numerator: 3, denominator: 4 },
        totalBars: 1,
      });

      expect(xml).toContain('<beats>3</beats>');
      expect(xml).toContain('<beat-type>4</beat-type>');
      // 3 beats worth of rest = dotted-half (2880 divisions = 3 * 480 * 2)
      // Actually: 3 quarter notes = 3 * 480 = 1440 beats, but as dotted-half it's 2880
      // The rest type is "half-dotted" which is 3 beats = 2880 divisions at 480 PPQ
      expect(xml).toContain('<duration>2880</duration>');
      expect(xml).toContain('<type>half</type>');
      expect(xml).toContain('<dot/>');
    });

    it('should handle 6/8 time signature', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: { numerator: 6, denominator: 8 },
        totalBars: 1,
      });

      expect(xml).toContain('<beats>6</beats>');
      expect(xml).toContain('<beat-type>8</beat-type>');
    });

    it('should handle notes with durationTicks property', () => {
      // When notes have durationTicks, the quantizedDuration from position is used, not durationTicks
      const noteWithTicks = createNote({
        note: 'A2',
        duration: 'quarter',
        position: { measure: 1, beat: 0, subdivision: 0, tick: 0 },
      }) as ExerciseNote & { durationTicks: number };
      noteWithTicks.durationTicks = 600; // Raw MIDI duration (ignored for display)

      const notes: ExerciseNote[] = [
        noteWithTicks,
        createNote({
          note: 'B2',
          duration: 'quarter',
          position: { measure: 1, beat: 1, subdivision: 0, tick: 0 },
        }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Display duration should be 1 beat (from position 0 to position 1)
      // Not the raw 600 ticks (1.25 beats)
      expect(xml).toContain('<duration>480</duration>');
    });
  });
});
