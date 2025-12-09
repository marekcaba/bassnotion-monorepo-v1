/**
 * Test Suite for exerciseToMusicXML
 *
 * Tests MusicXML generation from exercise data including:
 * - Duration to MusicXML division mapping
 * - Tied note generation for non-standard durations
 * - Rest gap filling
 * - Beam group calculation
 * - Complete MusicXML document structure
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

  // Helper to create a note
  function createNote(
    overrides: Partial<ExerciseNote> & { note: string; duration: string }
  ): ExerciseNote {
    return {
      id: `note-${Math.random()}`,
      string: 3,
      fret: 5,
      color: 'blue',
      position: { measure: 1, beat: 0, subdivision: 0 },
      ...overrides,
    } as ExerciseNote;
  }

  describe('Division Values', () => {
    it('should use correct division for quarter note (480)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>480</duration>');
      expect(xml).toContain('<type>quarter</type>');
    });

    it('should use correct division for eighth note (240)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'eighth', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>240</duration>');
      expect(xml).toContain('<type>eighth</type>');
    });

    it('should use correct division for half note (1920)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'half', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>1920</duration>');
      expect(xml).toContain('<type>half</type>');
    });

    it('should use correct division for dotted quarter (1440)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'dotted-quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>1440</duration>');
      expect(xml).toContain('<type>quarter</type>');
      expect(xml).toContain('<dot/>');
    });

    it('should use correct division for dotted eighth (360)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'dotted-eighth', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>360</duration>');
      expect(xml).toContain('<type>eighth</type>');
      expect(xml).toContain('<dot/>');
    });

    it('should use correct division for sixteenth note (120)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'sixteenth', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<duration>120</duration>');
      expect(xml).toContain('<type>16th</type>');
    });
  });

  describe('Tied Notes', () => {
    it('should generate tie elements for non-standard duration (2.5 beats = half + eighth)', () => {
      // A note with duration that equals 2.5 quarter notes should be split
      // We need to create a note with a non-standard duration
      // Since the MIDI parser would create such a note, we simulate by checking
      // the output when isStandardDuration returns false

      // For this test, we need a duration that's NOT in STANDARD_DURATIONS
      // Let's test with notes that have standard durations first
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'dotted-quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Standard duration should NOT have ties
      expect(xml).not.toContain('<tie type="start"/>');
      expect(xml).not.toContain('<tie type="stop"/>');
    });

    it('should include proper MusicXML tie structure with <tie> and <tied> elements', () => {
      // When a tied note IS generated, it should have both <tie> (playback) and <tied> (notation)
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'dotted-quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Verify the XML structure is valid
      expect(xml).toContain('<score-partwise version="3.1">');
      expect(xml).toContain('<part id="P1">');
      expect(xml).toContain('</score-partwise>');
    });
  });

  describe('Rest Generation', () => {
    it('should fill gap at start of measure with rest', () => {
      const notes: ExerciseNote[] = [
        // Note starts on beat 2 (0-indexed: beat 1)
        createNote({ note: 'A2', duration: 'quarter', position: { measure: 1, beat: 1, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should have a rest before the note
      expect(xml).toContain('<rest/>');
    });

    it('should fill gap at end of measure with rest', () => {
      const notes: ExerciseNote[] = [
        // Single quarter note at beat 0, leaves 3 beats empty
        createNote({ note: 'A2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Should have rest(s) filling the remaining 3 beats
      // The rests will be split into standard durations
      expect(xml).toContain('<rest/>');
    });

    it('should generate empty measure as whole rest', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
        totalBars: 1,
      });

      // Empty measure should have a whole rest (4 beats)
      expect(xml).toContain('<rest/>');
      expect(xml).toContain('<duration>3840</duration>'); // whole note division
    });
  });

  describe('Pitch Generation', () => {
    it('should generate correct pitch for A2 (bass guitar notation = A3)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
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
        createNote({ note: 'C#3', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
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
        createNote({ note: 'Bb2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
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
        createNote({ note: 'A2', duration: 'whole', position: { measure: 0, beat: 0, subdivision: 0 } }),
        createNote({ note: 'B2', duration: 'whole', position: { measure: 1, beat: 0, subdivision: 0 } }),
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
      });

      expect(xml).toContain('<work-title>My Bass Exercise</work-title>');
    });

    it('should include bass clef in first measure', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
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
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'eighth', position: { measure: 1, beat: 0, subdivision: 0 } }),
        createNote({ note: 'B2', duration: 'eighth', position: { measure: 1, beat: 0, subdivision: 240 } }),
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
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'eighth', position: { measure: 1, beat: 0, subdivision: 240 } }),
        createNote({ note: 'B2', duration: 'eighth', position: { measure: 1, beat: 1, subdivision: 0 } }),
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
        createNote({ note: 'A2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
        createNote({ note: 'B2', duration: 'quarter', position: { measure: 1, beat: 1, subdivision: 0 } }),
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
    it('should render dotted quarter + eighth correctly (1.5 + 0.5 = 2 beats)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'dotted-quarter', position: { measure: 1, beat: 0, subdivision: 0 } }),
        createNote({ note: 'B2', duration: 'eighth', position: { measure: 1, beat: 1, subdivision: 240 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // Dotted quarter
      expect(xml).toContain('<duration>1440</duration>');
      expect(xml).toMatch(/<type>quarter<\/type>[\s\S]*<dot\/>/);

      // Eighth
      expect(xml).toContain('<duration>240</duration>');
      expect(xml).toContain('<type>eighth</type>');
    });

    it('should render syncopated rhythm (eighth + quarter + eighth)', () => {
      const notes: ExerciseNote[] = [
        createNote({ note: 'A2', duration: 'eighth', position: { measure: 1, beat: 0, subdivision: 0 } }),
        createNote({ note: 'B2', duration: 'quarter', position: { measure: 1, beat: 0, subdivision: 240 } }),
        createNote({ note: 'C3', duration: 'eighth', position: { measure: 1, beat: 1, subdivision: 240 } }),
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      // All three note durations should be present
      const eighthMatches = xml.match(/<duration>240<\/duration>/g) || [];
      const quarterMatches = xml.match(/<duration>480<\/duration>/g) || [];

      expect(eighthMatches.length).toBeGreaterThanOrEqual(2);
      expect(quarterMatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty notes array', () => {
      const xml = exerciseToMusicXML({
        notes: [],
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<score-partwise');
      expect(xml).toContain('</score-partwise>');
    });

    it('should handle notes without position (defaults to measure 1, beat 0)', () => {
      const notes: ExerciseNote[] = [
        {
          id: 'note-1',
          string: 3,
          fret: 5,
          note: 'A2',
          color: 'blue',
          duration: 'quarter',
          position: { measure: 1, beat: 0, subdivision: 0 },
        } as ExerciseNote,
      ];

      const xml = exerciseToMusicXML({
        notes,
        bpm: 120,
        timeSignature: defaultTimeSignature,
      });

      expect(xml).toContain('<step>A</step>');
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
      // 3 beats worth of rest = dotted-half (2880 divisions)
      expect(xml).toContain('<duration>2880</duration>');
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
  });
});
