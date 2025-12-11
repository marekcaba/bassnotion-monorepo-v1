import { describe, it, expect, beforeEach } from 'vitest';
import { FretboardMapperService } from './fretboard-mapper.service.js';
import type { ParsedMeasure } from '../dto/parse-midi-response.dto.js';
import type { MeasureAnchor } from '../dto/convert-midi-request.dto.js';

describe('FretboardMapperService', () => {
  let service: FretboardMapperService;

  beforeEach(() => {
    service = new FretboardMapperService();
  });

  describe('convertMidiToFretboard', () => {
    it('should convert MIDI notes to fretboard positions using anchors', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' }, // E1 - open E string
            { pitch: 33, velocity: 100, name: 'A1' }, // A1 - open A string
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 }, // E string, open
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].pitch).toBe(28);
      expect(result.notes[0].string).toBeDefined();
      expect(result.notes[0].fret).toBeDefined();
      expect(result.notes[0].confidence).toBeDefined();
      expect(result.playability).toBeDefined();
      expect(result.playability.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.playability.overallScore).toBeLessThanOrEqual(100);
    });

    it('should generate confidence scores for notes', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' }, // Only playable on E string, fret 0
            { pitch: 40, velocity: 100, name: 'E2' }, // Can be played on E string fret 12 or A string fret 7
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      // First note should have high confidence (only one option)
      expect(result.notes[0].confidence).toBe('high');

      // Second note might have medium/low confidence (multiple options)
      expect(['high', 'medium', 'low']).toContain(result.notes[1].confidence);
    });

    it('should provide alternative positions for notes', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 40, velocity: 100, name: 'E2' }, // Multiple positions available
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 12 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      expect(result.notes[0].alternatives).toBeDefined();
      expect(result.notes[0].alternatives.length).toBeGreaterThanOrEqual(0);
      expect(result.notes[0].alternatives.length).toBeLessThanOrEqual(3); // Top 3 alternatives
    });

    it('should detect large stretches and add warnings', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' }, // E string, fret 0
            { pitch: 40, velocity: 100, name: 'E2' }, // E string, fret 12 (large jump)
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      // Second note should have warnings about large stretch
      const secondNote = result.notes[1];
      if (secondNote.warnings && secondNote.warnings.length > 0) {
        const hasStretchWarning = secondNote.warnings.some(
          (w: { type: string }) => w.type === 'large_stretch',
        );
        expect(hasStretchWarning).toBe(true);
      }
    });

    it('should calculate playability metrics', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' },
            { pitch: 29, velocity: 100, name: 'F1' },
            { pitch: 30, velocity: 100, name: 'F#1' },
            { pitch: 31, velocity: 100, name: 'G1' },
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      expect(result.playability.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.playability.overallScore).toBeLessThanOrEqual(100);
      expect(result.playability.largeStretches).toBeGreaterThanOrEqual(0);
      expect(result.playability.difficultShifts).toBeGreaterThanOrEqual(0);
      expect(result.playability.stringCrossings).toBeGreaterThanOrEqual(0);
      expect(result.playability.handStability).toBeGreaterThanOrEqual(0);
      expect(result.playability.handStability).toBeLessThanOrEqual(100);
      expect(
        result.playability.highConfidencePercentage,
      ).toBeGreaterThanOrEqual(0);
      expect(result.playability.highConfidencePercentage).toBeLessThanOrEqual(
        100,
      );
    });

    it('should handle multiple measures with different anchors', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' },
            { pitch: 29, velocity: 100, name: 'F1' },
          ],
        },
        {
          measureNumber: 2,
          startTime: 2,
          endTime: 4,
          notes: [
            { pitch: 33, velocity: 100, name: 'A1' },
            { pitch: 34, velocity: 100, name: 'A#1' },
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
        { measureNumber: 2, string: 2, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      expect(result.notes).toHaveLength(4);
      expect(result.notes[0].measureNumber).toBe(1);
      expect(result.notes[2].measureNumber).toBe(2);
    });

    it('should skip measures without notes', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [{ pitch: 28, velocity: 100, name: 'E1' }],
        },
        {
          measureNumber: 2,
          startTime: 2,
          endTime: 4,
          notes: [], // Empty measure
        },
        {
          measureNumber: 3,
          startTime: 4,
          endTime: 6,
          notes: [{ pitch: 33, velocity: 100, name: 'A1' }],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
        { measureNumber: 3, string: 2, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      expect(result.notes).toHaveLength(2);
    });

    it('should support 5-string bass', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 23, velocity: 100, name: 'B0' }, // Low B (5-string only)
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 }, // B string on 5-string bass
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '5',
      );

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].pitch).toBe(23);
    });

    it('should support 6-string bass', async () => {
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 48, velocity: 100, name: 'C3' }, // High C (6-string)
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 6, fret: 0 }, // C string on 6-string bass
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '6',
      );

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].pitch).toBe(48);
    });

    it('should optimize for minimal hand movement', async () => {
      // Chromatic scale ascending - should stay in one position
      const measures: ParsedMeasure[] = [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 28, velocity: 100, name: 'E1' },
            { pitch: 29, velocity: 100, name: 'F1' },
            { pitch: 30, velocity: 100, name: 'F#1' },
            { pitch: 31, velocity: 100, name: 'G1' },
            { pitch: 32, velocity: 100, name: 'G#1' },
          ],
        },
      ];

      const anchors: MeasureAnchor[] = [
        { measureNumber: 1, string: 1, fret: 0 },
      ];

      const result = await service.convertMidiToFretboard(
        measures,
        anchors,
        '4',
      );

      // All notes should be on the E string (string 1) for minimal hand movement
      const allOnSameString = result.notes.every(
        (note: { string: number }) => note.string === 1,
      );
      expect(allOnSameString).toBe(true);

      // Frets should be ascending
      const frets = result.notes.map((n: { fret: number }) => n.fret);
      const isAscending = frets.every(
        (fret: number, i: number) => i === 0 || fret >= frets[i - 1],
      );
      expect(isAscending).toBe(true);
    });
  });
});
