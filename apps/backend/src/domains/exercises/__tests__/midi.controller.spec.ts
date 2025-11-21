import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MidiController } from '../midi.controller.js';
import { MidiParserService } from '../services/midi-parser.service.js';
import type { StatelessParseMidiRequestDto } from '../dto/parse-midi-request.dto.js';

describe('MidiController - Stateless MIDI Parser (Story 4.4 - Task 1)', () => {
  let controller: MidiController;
  let midiParserService: MidiParserService;

  beforeEach(() => {
    // Create mock MIDI parser service
    midiParserService = {
      parseMidiFromUrl: vi.fn(),
    } as any;

    // Create mock Fretboard mapper service
    const fretboardMapperService = {
      convertMidiToFretboard: vi.fn(),
    } as any;

    const drumMapperService = {
      convertMidiToDrumPattern: vi.fn(),
      getDrumPatternStats: vi.fn(),
      validateDrumPattern: vi.fn(),
    } as any;

    const harmonyMapperService = {
      convertMidiToHarmony: vi.fn(),
    } as any;

    controller = new MidiController(midiParserService, fretboardMapperService, drumMapperService, harmonyMapperService);
    vi.clearAllMocks();
  });

  describe('POST /api/v1/midi/parse (stateless)', () => {
    const validRequest: StatelessParseMidiRequestDto = {
      midiUrl: 'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-temp/test.mid',
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      totalBars: 4,
    };

    const mockParseResult = {
      totalMeasures: 4,
      totalNotes: 16,
      durationSeconds: 8,
      measures: [
        {
          measureNumber: 1,
          startTime: 0,
          endTime: 2,
          notes: [
            { pitch: 40, velocity: 100, name: 'E1', time: 0, duration: 0.5 },
            { pitch: 45, velocity: 100, name: 'A1', time: 0.5, duration: 0.5 },
          ],
        },
        {
          measureNumber: 2,
          startTime: 2,
          endTime: 4,
          notes: [
            { pitch: 50, velocity: 100, name: 'D2', time: 2, duration: 0.5 },
            { pitch: 55, velocity: 100, name: 'G2', time: 2.5, duration: 0.5 },
          ],
        },
      ],
      metadata: {
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        totalBars: 4,
      },
    };

    it('should parse valid MIDI file from Supabase storage URL', async () => {
      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockParseResult);

      const result = await controller.parseStateless(validRequest, 'test-correlation-id');

      expect(result).toEqual(mockParseResult);
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        validRequest.midiUrl,
        validRequest.bpm,
        validRequest.timeSignature,
        validRequest.totalBars,
        'test-correlation-id',
      );
    });

    it('should reject invalid URL (not HTTPS)', async () => {
      const invalidRequest = {
        ...validRequest,
        midiUrl: 'http://xyz.supabase.co/storage/v1/object/public/test.mid',
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should reject URL without .mid/.midi extension', async () => {
      const invalidRequest = {
        ...validRequest,
        midiUrl: 'https://xyz.supabase.co/storage/v1/object/public/test.mp3',
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should reject URL not from Supabase domain', async () => {
      const invalidRequest = {
        ...validRequest,
        midiUrl: 'https://evil.com/malicious.mid',
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should reject invalid BPM (too low)', async () => {
      const invalidRequest = {
        ...validRequest,
        bpm: 30, // Below minimum of 40
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should reject invalid BPM (too high)', async () => {
      const invalidRequest = {
        ...validRequest,
        bpm: 350, // Above maximum of 300
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should accept various time signatures (3/4, 6/8, 7/8)', async () => {
      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockParseResult);

      // Test 3/4
      const request34 = {
        ...validRequest,
        timeSignature: { numerator: 3, denominator: 4 },
      };
      await controller.parseStateless(request34, 'correlation-1');
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        { numerator: 3, denominator: 4 },
        expect.any(Number),
        'correlation-1',
      );

      // Test 6/8
      const request68 = {
        ...validRequest,
        timeSignature: { numerator: 6, denominator: 8 },
      };
      await controller.parseStateless(request68, 'correlation-2');
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        { numerator: 6, denominator: 8 },
        expect.any(Number),
        'correlation-2',
      );

      // Test 7/8
      const request78 = {
        ...validRequest,
        timeSignature: { numerator: 7, denominator: 8 },
      };
      await controller.parseStateless(request78, 'correlation-3');
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        { numerator: 7, denominator: 8 },
        expect.any(Number),
        'correlation-3',
      );
    });

    it('should reject invalid time signature denominator', async () => {
      const invalidRequest = {
        ...validRequest,
        timeSignature: { numerator: 4, denominator: 3 }, // 3 is not valid (must be 2, 4, 8, or 16)
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should accept extreme BPM values within range (40, 300)', async () => {
      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockParseResult);

      // Test minimum BPM (40)
      const requestMin = { ...validRequest, bpm: 40 };
      await controller.parseStateless(requestMin, 'correlation-min');
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        40,
        expect.any(Object),
        expect.any(Number),
        'correlation-min',
      );

      // Test maximum BPM (300)
      const requestMax = { ...validRequest, bpm: 300 };
      await controller.parseStateless(requestMax, 'correlation-max');
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        expect.any(String),
        300,
        expect.any(Object),
        expect.any(Number),
        'correlation-max',
      );
    });

    it('should handle parser service errors gracefully', async () => {
      const parserError = new Error('MIDI file is corrupted');
      (midiParserService.parseMidiFromUrl as any).mockRejectedValue(parserError);

      await expect(
        controller.parseStateless(validRequest, 'test-correlation-id'),
      ).rejects.toThrow(parserError);

      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalled();
    });

    it('should accept .midi extension (case insensitive)', async () => {
      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockParseResult);

      const requestMIDI = {
        ...validRequest,
        midiUrl: 'https://xyz.supabase.co/storage/v1/object/public/test.MIDI',
      };

      const result = await controller.parseStateless(requestMIDI, 'test-correlation-id');

      expect(result).toEqual(mockParseResult);
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalled();
    });

    it('should reject total bars exceeding maximum (32)', async () => {
      const invalidRequest = {
        ...validRequest,
        totalBars: 33, // Above maximum
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });

    it('should reject total bars below minimum (1)', async () => {
      const invalidRequest = {
        ...validRequest,
        totalBars: 0,
      };

      await expect(
        controller.parseStateless(invalidRequest, 'test-correlation-id'),
      ).rejects.toThrow(BadRequestException);

      expect(midiParserService.parseMidiFromUrl).not.toHaveBeenCalled();
    });
  });

  describe('Stateless endpoint benefits', () => {
    it('should work without exercise existing in database (no DB lookup)', async () => {
      // This is the key benefit - no database dependency
      const request: StatelessParseMidiRequestDto = {
        midiUrl: 'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-temp/new-exercise.mid',
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        totalBars: 4,
      };

      const mockResult = {
        totalMeasures: 4,
        totalNotes: 16,
        durationSeconds: 8,
        measures: [],
        metadata: {
          bpm: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          totalBars: 4,
        },
      };

      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockResult);

      const result = await controller.parseStateless(request, 'test-correlation-id');

      // Should parse successfully without any database call
      expect(result).toEqual(mockResult);
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledWith(
        request.midiUrl,
        request.bpm,
        request.timeSignature,
        request.totalBars,
        'test-correlation-id',
      );

      // Key assertion: No database service was injected or called
      // This enables horizontal scaling and faster response times
    });

    it('should be idempotent (same input = same output, can retry safely)', async () => {
      const request: StatelessParseMidiRequestDto = {
        midiUrl: 'https://xyz.supabase.co/storage/v1/object/public/exercise-midi-temp/test.mid',
        bpm: 120,
        timeSignature: { numerator: 4, denominator: 4 },
        totalBars: 4,
      };

      const mockResult = {
        totalMeasures: 4,
        totalNotes: 16,
        durationSeconds: 8,
        measures: [],
        metadata: request,
      };

      (midiParserService.parseMidiFromUrl as any).mockResolvedValue(mockResult);

      // Call same endpoint multiple times with same input
      const result1 = await controller.parseStateless(request, 'correlation-1');
      const result2 = await controller.parseStateless(request, 'correlation-2');
      const result3 = await controller.parseStateless(request, 'correlation-3');

      // All results should be identical (idempotent)
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // Parser should be called each time (no state maintained)
      expect(midiParserService.parseMidiFromUrl).toHaveBeenCalledTimes(3);
    });
  });
});
