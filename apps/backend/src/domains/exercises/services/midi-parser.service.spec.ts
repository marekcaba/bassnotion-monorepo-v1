import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MidiParserService } from './midi-parser.service.js';

// Mock @tonejs/midi.
// The contracts library uses `import pkg from '@tonejs/midi'` then
// `pkg.Midi || pkg.default || pkg`, so the mock must expose Midi as
// BOTH a named export and a default export.
vi.mock('@tonejs/midi', () => {
  const Midi = vi.fn();
  return {
    Midi,
    default: { Midi },
  };
});

describe('MidiParserService', () => {
  let service: MidiParserService;

  beforeEach(() => {
    service = new MidiParserService();
    vi.clearAllMocks();
  });

  describe('parseMidiFromUrl', () => {
    it('should parse a valid MIDI file and group notes by measure', async () => {
      // Mock fetch
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      // Mock Midi class.
      //
      // IMPORTANT: production now groups notes by MUSICAL position (ticks)
      // not seconds. With PPQ=480 and 4/4 time:
      //   - 1 beat  = 480 ticks
      //   - 1 measure = 480 × 4 = 1920 ticks
      // To land one note per measure across 4 measures, the notes need
      // ticks 0, 1920, 3840, 5760.
      const mockMidi = {
        duration: 8,
        header: { ppq: 480 },
        tracks: [
          {
            notes: [
              {
                midi: 40,
                velocity: 0.8,
                name: 'E1',
                time: 0,
                duration: 0.5,
                ticks: 0,
                durationTicks: 240,
              },
              {
                midi: 45,
                velocity: 0.9,
                name: 'A1',
                time: 2,
                duration: 0.5,
                ticks: 1920,
                durationTicks: 240,
              },
              {
                midi: 50,
                velocity: 0.85,
                name: 'D2',
                time: 4,
                duration: 0.5,
                ticks: 3840,
                durationTicks: 240,
              },
              {
                midi: 55,
                velocity: 0.7,
                name: 'G2',
                time: 6,
                duration: 0.5,
                ticks: 5760,
                durationTicks: 240,
              },
            ],
            controlChanges: {},
          },
        ],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      const result = await service.parseMidiFromUrl(
        'https://example.com/test.mid',
        120, // BPM
        { numerator: 4, denominator: 4 },
        4, // total bars
        'test-correlation-id',
      );

      expect(result).toBeDefined();
      expect(result.totalMeasures).toBe(4);
      expect(result.totalNotes).toBe(4);
      expect(result.durationSeconds).toBe(8);
      expect(result.measures).toHaveLength(4);
      expect(result.metadata.bpm).toBe(120);
      expect(result.metadata.timeSignature).toEqual({
        numerator: 4,
        denominator: 4,
      });
    });

    it('should throw BadRequestException if MIDI file fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        service.parseMidiFromUrl(
          'https://example.com/missing.mid',
          120,
          { numerator: 4, denominator: 4 },
          4,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if MIDI file has no tracks', async () => {
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      const mockMidi = {
        duration: 0,
        tracks: [],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      await expect(
        service.parseMidiFromUrl(
          'https://example.com/empty.mid',
          120,
          { numerator: 4, denominator: 4 },
          4,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if MIDI file has no notes', async () => {
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      const mockMidi = {
        duration: 0,
        tracks: [{ notes: [] }],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      await expect(
        service.parseMidiFromUrl(
          'https://example.com/no-notes.mid',
          120,
          { numerator: 4, denominator: 4 },
          4,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should combine notes across all tracks for polyphonic MIDI files', async () => {
      // NOTE: An earlier behavior took notes from the first track only.
      // The parser now combines notes across all tracks-with-notes so
      // harmony/piano MIDIs (left-hand + right-hand tracks) parse
      // correctly. This test was updated to match.
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      const mockMidi = {
        duration: 4,
        header: { ppq: 480 },
        tracks: [
          {
            notes: [
              {
                midi: 40,
                velocity: 0.8,
                name: 'E1',
                time: 0,
                duration: 0.5,
                ticks: 0,
                durationTicks: 240,
              },
              {
                midi: 45,
                velocity: 0.9,
                name: 'A1',
                time: 1,
                duration: 0.5,
                ticks: 480,
                durationTicks: 240,
              },
            ],
            controlChanges: {},
          },
          {
            notes: [
              {
                midi: 60,
                velocity: 0.7,
                name: 'C3',
                time: 0,
                duration: 0.5,
                ticks: 0,
                durationTicks: 240,
              },
              {
                midi: 64,
                velocity: 0.8,
                name: 'E3',
                time: 1,
                duration: 0.5,
                ticks: 480,
                durationTicks: 240,
              },
            ],
            controlChanges: {},
          },
        ],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      const result = await service.parseMidiFromUrl(
        'https://example.com/polyphonic.mid',
        120,
        { numerator: 4, denominator: 4 },
        2,
      );

      // Both tracks have 2 notes; combined → 4.
      expect(result.totalNotes).toBe(4);
    });

    it('should group notes correctly by measure', async () => {
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      // 120 BPM, 4/4 time, PPQ=480 → 1 measure = 1920 ticks.
      // Place 2 notes in each of 4 measures.
      const mockMidi = {
        duration: 8,
        header: { ppq: 480 },
        tracks: [
          {
            notes: [
              // Measure 0
              { midi: 40, velocity: 0.8, name: 'E1', time: 0, duration: 0.5, ticks: 0, durationTicks: 240 },
              { midi: 45, velocity: 0.9, name: 'A1', time: 1, duration: 0.5, ticks: 480, durationTicks: 240 },
              // Measure 1
              { midi: 50, velocity: 0.85, name: 'D2', time: 2, duration: 0.5, ticks: 1920, durationTicks: 240 },
              { midi: 55, velocity: 0.7, name: 'G2', time: 3, duration: 0.5, ticks: 2400, durationTicks: 240 },
              // Measure 2
              { midi: 40, velocity: 0.8, name: 'E1', time: 4, duration: 0.5, ticks: 3840, durationTicks: 240 },
              { midi: 45, velocity: 0.9, name: 'A1', time: 5, duration: 0.5, ticks: 4320, durationTicks: 240 },
              // Measure 3
              { midi: 50, velocity: 0.85, name: 'D2', time: 6, duration: 0.5, ticks: 5760, durationTicks: 240 },
              { midi: 55, velocity: 0.7, name: 'G2', time: 7, duration: 0.5, ticks: 6240, durationTicks: 240 },
            ],
            controlChanges: {},
          },
        ],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      const result = await service.parseMidiFromUrl(
        'https://example.com/test.mid',
        120,
        { numerator: 4, denominator: 4 },
        4,
      );

      expect(result.measures).toHaveLength(4);
      expect(result.measures[0].notes).toHaveLength(2); // Measure 1
      expect(result.measures[1].notes).toHaveLength(2); // Measure 2
      expect(result.measures[2].notes).toHaveLength(2); // Measure 3
      expect(result.measures[3].notes).toHaveLength(2); // Measure 4

      // Check measure boundaries
      expect(result.measures[0].startTime).toBe(0);
      expect(result.measures[0].endTime).toBe(2);
      expect(result.measures[1].startTime).toBe(2);
      expect(result.measures[1].endTime).toBe(4);
    });

    it('should handle different time signatures correctly', async () => {
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      // 90 BPM, 3/4 time, PPQ=480 → 1 measure = 480×3 = 1440 ticks.
      // One note per measure across 3 measures.
      const mockMidi = {
        duration: 6,
        header: { ppq: 480 },
        tracks: [
          {
            notes: [
              { midi: 40, velocity: 0.8, name: 'E1', time: 0, duration: 0.5, ticks: 0, durationTicks: 240 },
              { midi: 45, velocity: 0.9, name: 'A1', time: 2, duration: 0.5, ticks: 1440, durationTicks: 240 },
              { midi: 50, velocity: 0.85, name: 'D2', time: 4, duration: 0.5, ticks: 2880, durationTicks: 240 },
            ],
            controlChanges: {},
          },
        ],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      const result = await service.parseMidiFromUrl(
        'https://example.com/waltz.mid',
        90,
        { numerator: 3, denominator: 4 },
        3,
      );

      expect(result.measures).toHaveLength(3);
      expect(result.metadata.timeSignature).toEqual({
        numerator: 3,
        denominator: 4,
      });
    });

    it('should convert velocity from 0-1 to 0-127', async () => {
      const mockMidiBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockMidiBuffer),
      });

      // 120 BPM, 4/4 = 1 measure = 1920 ticks. Both notes in measure 0.
      const mockMidi = {
        duration: 2,
        header: { ppq: 480 },
        tracks: [
          {
            notes: [
              { midi: 40, velocity: 1.0, name: 'E1', time: 0, duration: 0.5, ticks: 0, durationTicks: 240 }, // Should be 127
              { midi: 45, velocity: 0.5, name: 'A1', time: 1, duration: 0.5, ticks: 480, durationTicks: 240 }, // Should be ~64
            ],
            controlChanges: {},
          },
        ],
      };

      const { Midi } = await import('@tonejs/midi');
      (Midi as any).mockImplementation(() => mockMidi);

      const result = await service.parseMidiFromUrl(
        'https://example.com/test.mid',
        120,
        { numerator: 4, denominator: 4 },
        1,
      );

      expect(result.measures[0].notes[0].velocity).toBe(127);
      expect(result.measures[0].notes[1].velocity).toBe(64);
    });
  });
});
