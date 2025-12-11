/**
 * DiagnosticLogger Tests
 *
 * Tests MIDI note conversion and CC64 diagnostic logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiagnosticLogger } from '../DiagnosticLogger.js';

// Mock Tone.js
vi.mock('tone', () => ({
  Transport: {
    bpm: {
      value: 120,
    },
  },
}));

describe('DiagnosticLogger', () => {
  let diagnosticLogger: DiagnosticLogger;
  let mockCC64Timeline: Map<number, boolean>;
  let mockParsePosition: ReturnType<typeof vi.fn>;
  let mockFindCC64DownDuringNote: ReturnType<typeof vi.fn>;
  let mockFindNextCC64Up: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCC64Timeline = new Map();
    mockParsePosition = vi.fn((position: string) => {
      // Simple parser: "0:0:0" → 0, "1:0:0" → 0.5
      const [bars] = position.split(':');
      return parseFloat(bars) * 0.5;
    });
    mockFindCC64DownDuringNote = vi.fn(() => null);
    mockFindNextCC64Up = vi.fn(() => null);

    diagnosticLogger = new DiagnosticLogger(
      'test-instance',
      mockCC64Timeline,
      mockParsePosition,
      mockFindCC64DownDuringNote,
      mockFindNextCC64Up,
    );
  });

  // ============================================================================
  // MIDI NOTE NAME CONVERSION TESTS
  // ============================================================================

  describe('midiNoteToName', () => {
    it('should convert middle C (MIDI 60) to "C4"', () => {
      expect(diagnosticLogger.midiNoteToName(60)).toBe('C4');
    });

    it('should convert all 12 chromatic notes correctly', () => {
      expect(diagnosticLogger.midiNoteToName(60)).toBe('C4'); // C
      expect(diagnosticLogger.midiNoteToName(61)).toBe('Cs4'); // C#
      expect(diagnosticLogger.midiNoteToName(62)).toBe('D4'); // D
      expect(diagnosticLogger.midiNoteToName(63)).toBe('Ds4'); // D#
      expect(diagnosticLogger.midiNoteToName(64)).toBe('E4'); // E
      expect(diagnosticLogger.midiNoteToName(65)).toBe('F4'); // F
      expect(diagnosticLogger.midiNoteToName(66)).toBe('Fs4'); // F#
      expect(diagnosticLogger.midiNoteToName(67)).toBe('G4'); // G
      expect(diagnosticLogger.midiNoteToName(68)).toBe('Gs4'); // G#
      expect(diagnosticLogger.midiNoteToName(69)).toBe('A4'); // A
      expect(diagnosticLogger.midiNoteToName(70)).toBe('As4'); // A#
      expect(diagnosticLogger.midiNoteToName(71)).toBe('B4'); // B
    });

    it('should convert low notes correctly (octave -1)', () => {
      expect(diagnosticLogger.midiNoteToName(0)).toBe('C-1'); // MIDI 0
      expect(diagnosticLogger.midiNoteToName(12)).toBe('C0'); // MIDI 12
    });

    it('should convert high notes correctly (octave 8+)', () => {
      expect(diagnosticLogger.midiNoteToName(108)).toBe('C8'); // MIDI 108
      expect(diagnosticLogger.midiNoteToName(120)).toBe('C9'); // MIDI 120
      expect(diagnosticLogger.midiNoteToName(127)).toBe('G9'); // MIDI 127 (highest)
    });
  });

  // ============================================================================
  // CC64 DIAGNOSTIC TABLE TESTS
  // ============================================================================

  describe('logCC64DiagnosticTable', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      diagnosticLogger.setTransportStartTime(0.2);
      diagnosticLogger.setCountdown(false, 0);
    });

    it('should log diagnostic table for harmony notes', () => {
      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 0 }, // C5 → C4 after -12
          duration: 0.5,
        },
        {
          position: '0:2:0',
          data: { midiNote: 76, ticks: 960 }, // E5 → E4 after -12
          duration: 0.75,
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should log table header
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CC64 SUSTAIN PEDAL DIAGNOSTIC'),
      );

      // Should log note count
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analyzing 2 harmony notes'),
      );

      // Should log summary
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SUMMARY:'),
      );
    });

    it('should handle empty event array', () => {
      const events: any[] = [];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No harmony notes found'),
      );
    });

    it('should handle events without MIDI notes', () => {
      const events = [
        { position: '0:0:0', data: { type: 'other' }, duration: 0.5 },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No harmony notes found'),
      );
    });

    it('should show note extension when CC64 pedal down', () => {
      // Set up timeline with pedal events
      mockCC64Timeline.set(0.2, true); // Pedal down
      mockCC64Timeline.set(1.0, false); // Pedal up

      mockFindCC64DownDuringNote.mockImplementation((noteStart, noteEnd) => {
        // Return pedal down time if it's during note
        if (0.2 >= noteStart && 0.2 <= noteEnd) {
          return 0.2;
        }
        return null;
      });
      mockFindNextCC64Up.mockReturnValue(1.0); // Pedal up at 1.0s

      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 0 },
          duration: 0.5, // Note ends at 0.7s, but pedal extends to 1.0s
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should show extension in summary
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1/1 notes extended'),
      );
    });

    it('should apply countdown offset when enabled', () => {
      diagnosticLogger.setCountdown(true, 4); // 4 beat countdown at 120 BPM = 2s

      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 0 },
          duration: 0.5,
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should log table (countdown offset applied internally)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CC64 SUSTAIN PEDAL DIAGNOSTIC'),
      );
    });

    it('should skip countdown offset for regions with skipCountdownOffset flag', () => {
      diagnosticLogger.setCountdown(true, 4);

      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 0 },
          duration: 0.5,
        },
      ];
      const region = {
        id: 'test-region',
        startTime: 0,
        skipCountdownOffset: true,
      };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should use ticks for timing when available', () => {
      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 480, originalBpm: 120 }, // 480 ticks = 1 beat = 0.5s
          duration: 0.5,
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should not call parsePosition (uses ticks instead)
      expect(mockParsePosition).not.toHaveBeenCalled();
    });

    it('should fallback to parsePosition when ticks unavailable', () => {
      const events = [
        {
          position: '0:2:0',
          data: { midiNote: 72 }, // No ticks
          duration: 0.5,
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should call parsePosition
      expect(mockParsePosition).toHaveBeenCalledWith('0:2:0');
    });

    it('should calculate extension correctly with multiple notes', () => {
      // Set up timeline
      mockCC64Timeline.set(0.2, true);
      mockCC64Timeline.set(1.5, false);

      let callCount = 0;
      mockFindCC64DownDuringNote.mockImplementation((noteStart, noteEnd) => {
        callCount++;
        // Note 1: pedal down at 0.2s (within note range 0.2-0.7)
        if (callCount === 1 && 0.2 >= noteStart && 0.2 <= noteEnd) {
          return 0.2;
        }
        // Note 2: no pedal down during note
        return null;
      });

      mockFindNextCC64Up.mockReturnValue(1.5); // Pedal up at 1.5s

      const events = [
        {
          position: '0:0:0',
          data: { midiNote: 72, ticks: 0 },
          duration: 0.5, // Extended to 1.5s
        },
        {
          position: '1:0:0',
          data: { midiNote: 76, ticks: 480 },
          duration: 0.5, // Not extended
        },
      ];
      const region = { id: 'test-region', startTime: 0 };

      diagnosticLogger.logCC64DiagnosticTable(events, region);

      // Should show 1/2 notes extended
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1/2 notes extended'),
      );
    });
  });
});
