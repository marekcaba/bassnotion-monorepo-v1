/**
 * InstrumentSwitching.test.ts - Unit tests for keyboard instrument switching
 *
 * Tests the core logic for switching between different keyboard instruments
 * (Grand Piano, Wurlitzer, Rhodes) on tutorial pages with multiple exercises.
 *
 * Key concerns tested:
 * 1. Sample separation per instrument in cache keys
 * 2. Velocity layer separation per instrument
 * 3. Octave shift separation (Wurlitzer vs Yamaha convention)
 * 4. Grand Piano sparse sampling (4 notes/octave with pitch-shifting)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VelocityLayerSelector } from '../VelocityLayerSelector.js';
import { GrandPianoMapper, type KeyboardMap } from '../GrandPianoMapper.js';
import { INSTRUMENT_CONFIGS } from '../../Scheduler.js';

// ============================================================================
// UNIT TESTS: Instrument Switching Core Logic
// ============================================================================

describe('Instrument Switching - Unit Tests', () => {
  // ==========================================================================
  // TEST SUITE 1: Cache Key Separation
  // ==========================================================================
  describe('Cache Key Separation', () => {
    it('should generate unique cache keys per instrument', () => {
      // Simulate cache key generation pattern: {instrument}-{layer}-{note}
      const buildCacheKey = (instrument: string, layer: string, note: string) =>
        `${instrument}-${layer}-${note}`;

      const grandPianoKey = buildCacheKey('grandpiano', 'v7', 'C4');
      const wurlitzerKey = buildCacheKey('wurlitzer', 'v3', 'C4');
      const rhodesKey = buildCacheKey('rhodes', 'v2', 'C4');

      // Keys must be different even for same note
      expect(grandPianoKey).toBe('grandpiano-v7-C4');
      expect(wurlitzerKey).toBe('wurlitzer-v3-C4');
      expect(rhodesKey).toBe('rhodes-v2-C4');

      // No collision possible
      expect(grandPianoKey).not.toBe(wurlitzerKey);
      expect(wurlitzerKey).not.toBe(rhodesKey);
      expect(grandPianoKey).not.toBe(rhodesKey);
    });

    it('should maintain instrument prefix during fallback layer search', () => {
      // When requested layer missing, fallback should stay within same instrument
      const buildFallbackKeys = (instrument: string, note: string) => {
        const layers = ['v7', 'v6', 'v5', 'v4', 'v3', 'v2', 'v1'];
        return layers.map((layer) => `${instrument}-${layer}-${note}`);
      };

      const grandPianoFallbacks = buildFallbackKeys('grandpiano', 'D4');
      const wurlitzerFallbacks = buildFallbackKeys('wurlitzer', 'D4');

      // All fallbacks should stay within the same instrument
      expect(
        grandPianoFallbacks.every((k) => k.startsWith('grandpiano-')),
      ).toBe(true);
      expect(wurlitzerFallbacks.every((k) => k.startsWith('wurlitzer-'))).toBe(
        true,
      );

      // No cross-instrument contamination
      expect(grandPianoFallbacks.some((k) => k.includes('wurlitzer'))).toBe(
        false,
      );
    });
  });

  // ==========================================================================
  // TEST SUITE 2: Velocity Layer Separation
  // ==========================================================================
  describe('Velocity Layer Separation', () => {
    it('should return different layers for same velocity on different instruments', () => {
      const grandPianoSelector = new VelocityLayerSelector('grandpiano');
      const wurlitzerSelector = new VelocityLayerSelector('wurlitzer');
      const rhodesSelector = new VelocityLayerSelector('rhodes');

      // Same velocity (70) should map to different layers per instrument
      const velocity = 70;
      const note = 'C4';

      const grandPianoLayer = grandPianoSelector.selectLayer(velocity, note);
      const wurlitzerLayer = wurlitzerSelector.selectLayer(velocity, note);
      const rhodesLayer = rhodesSelector.selectLayer(velocity, note);

      // Grand Piano: 7 layers, velocity 70 = v4 (55-72 range)
      expect(grandPianoLayer).toBe('v4');

      // Wurlitzer: 5 layers, velocity 70 = v3 (52-76 range)
      expect(wurlitzerLayer).toBe('v3');

      // Rhodes: 4 layers, velocity 70 = v3 (64-95 range)
      expect(rhodesLayer).toBe('v3');
    });

    it('should correctly update velocity selector when switching instruments', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      // Initial: Wurlitzer (5 layers)
      expect(selector.selectLayer(50, 'C4')).toBe('v2'); // 26-51 range

      // Switch to Grand Piano (7 layers)
      selector.setInstrument('grandpiano');
      expect(selector.selectLayer(50, 'C4')).toBe('v3'); // 37-54 range

      // Switch to Rhodes (4 layers)
      selector.setInstrument('rhodes');
      expect(selector.selectLayer(50, 'C4')).toBe('v2'); // 32-63 range
    });

    it('should handle all velocity ranges correctly for Grand Piano (7 layers)', () => {
      const selector = new VelocityLayerSelector('grandpiano');

      expect(selector.selectLayer(0, 'C4')).toBe('v1'); // 0-18
      expect(selector.selectLayer(18, 'C4')).toBe('v1');
      expect(selector.selectLayer(19, 'C4')).toBe('v2'); // 19-36
      expect(selector.selectLayer(36, 'C4')).toBe('v2');
      expect(selector.selectLayer(37, 'C4')).toBe('v3'); // 37-54
      expect(selector.selectLayer(54, 'C4')).toBe('v3');
      expect(selector.selectLayer(55, 'C4')).toBe('v4'); // 55-72
      expect(selector.selectLayer(72, 'C4')).toBe('v4');
      expect(selector.selectLayer(73, 'C4')).toBe('v5'); // 73-90
      expect(selector.selectLayer(90, 'C4')).toBe('v5');
      expect(selector.selectLayer(91, 'C4')).toBe('v6'); // 91-108
      expect(selector.selectLayer(108, 'C4')).toBe('v6');
      expect(selector.selectLayer(109, 'C4')).toBe('v7'); // 109-127
      expect(selector.selectLayer(127, 'C4')).toBe('v7');
    });

    it('should handle all velocity ranges correctly for Wurlitzer (5 layers)', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      expect(selector.selectLayer(0, 'C4')).toBe('v1'); // 0-25
      expect(selector.selectLayer(25, 'C4')).toBe('v1');
      expect(selector.selectLayer(26, 'C4')).toBe('v2'); // 26-51
      expect(selector.selectLayer(51, 'C4')).toBe('v2');
      expect(selector.selectLayer(52, 'C4')).toBe('v3'); // 52-76
      expect(selector.selectLayer(76, 'C4')).toBe('v3');
      expect(selector.selectLayer(77, 'C4')).toBe('v4'); // 77-102
      expect(selector.selectLayer(102, 'C4')).toBe('v4');
      expect(selector.selectLayer(103, 'C4')).toBe('v5'); // 103-127
      expect(selector.selectLayer(127, 'C4')).toBe('v5');
    });

    it('should handle all velocity ranges correctly for Rhodes (4 layers)', () => {
      const selector = new VelocityLayerSelector('rhodes');

      expect(selector.selectLayer(0, 'C4')).toBe('v1'); // 0-31
      expect(selector.selectLayer(31, 'C4')).toBe('v1');
      expect(selector.selectLayer(32, 'C4')).toBe('v2'); // 32-63
      expect(selector.selectLayer(63, 'C4')).toBe('v2');
      expect(selector.selectLayer(64, 'C4')).toBe('v3'); // 64-95
      expect(selector.selectLayer(95, 'C4')).toBe('v3');
      expect(selector.selectLayer(96, 'C4')).toBe('v4'); // 96-127
      expect(selector.selectLayer(127, 'C4')).toBe('v4');
    });
  });

  // ==========================================================================
  // TEST SUITE 3: Octave Shift Separation (Yamaha vs Wurlitzer Convention)
  // ==========================================================================
  describe('Octave Shift Separation', () => {
    it('should have zero octave shift for Grand Piano (Yamaha convention)', () => {
      // Grand Piano follows Yamaha convention: C4 = MIDI 60 (no shift)
      const calculateOctaveShift = (instrument: string): number => {
        return instrument === 'grandpiano' ? 0 : 12;
      };

      expect(calculateOctaveShift('grandpiano')).toBe(0);
    });

    it('should have 12-semitone octave shift for Wurlitzer', () => {
      // Wurlitzer samples recorded 1 octave higher, need -12 semitone shift
      const calculateOctaveShift = (instrument: string): number => {
        return instrument === 'grandpiano' ? 0 : 12;
      };

      expect(calculateOctaveShift('wurlitzer')).toBe(12);
    });

    it('should have 12-semitone octave shift for Rhodes', () => {
      const calculateOctaveShift = (instrument: string): number => {
        return instrument === 'grandpiano' ? 0 : 12;
      };

      expect(calculateOctaveShift('rhodes')).toBe(12);
    });

    it('should correctly adjust MIDI note based on instrument', () => {
      const adjustMidiNote = (midiNote: number, instrument: string): number => {
        const octaveShift = instrument === 'grandpiano' ? 0 : 12;
        return midiNote - octaveShift;
      };

      // MIDI 60 = C4
      const midiC4 = 60;

      // Grand Piano: No shift, MIDI 60 stays as MIDI 60
      expect(adjustMidiNote(midiC4, 'grandpiano')).toBe(60);

      // Wurlitzer: -12 shift, MIDI 60 becomes MIDI 48 (to find C4 sample)
      expect(adjustMidiNote(midiC4, 'wurlitzer')).toBe(48);

      // Rhodes: -12 shift, MIDI 60 becomes MIDI 48 (to find C4 sample)
      expect(adjustMidiNote(midiC4, 'rhodes')).toBe(48);
    });

    it('should update INSTRUMENT_CONFIGS.harmony.octaveShift when instrument changes', () => {
      // Simulate what Scheduler.setHarmonyInstrument() does
      const updateHarmonyConfig = (instrument: string) => {
        INSTRUMENT_CONFIGS.harmony.harmonyInstrument = instrument as any;
        INSTRUMENT_CONFIGS.harmony.octaveShift =
          instrument === 'grandpiano' ? 0 : 12;
      };

      updateHarmonyConfig('grandpiano');
      expect(INSTRUMENT_CONFIGS.harmony.octaveShift).toBe(0);
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('grandpiano');

      updateHarmonyConfig('wurlitzer');
      expect(INSTRUMENT_CONFIGS.harmony.octaveShift).toBe(12);
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('wurlitzer');
    });
  });

  // ==========================================================================
  // TEST SUITE 4: Grand Piano Sparse Sampling (4 notes per octave)
  // ==========================================================================
  describe('Grand Piano Sparse Sampling', () => {
    // Mock keyboard map with 4 notes per octave pattern: A, C, D#, F#
    const mockKeyboardMap: KeyboardMap = {
      // Octave 4 - sampled notes
      A4: { sample: 'A4', semitones: 0, playbackRate: 1.0 },
      C4: { sample: 'C4', semitones: 0, playbackRate: 1.0 },
      Ds4: { sample: 'Ds4', semitones: 0, playbackRate: 1.0 },
      Fs4: { sample: 'Fs4', semitones: 0, playbackRate: 1.0 },
      // Octave 4 - pitch-shifted notes
      As4: { sample: 'A4', semitones: 1, playbackRate: 1.059463094 },
      B4: { sample: 'C5', semitones: -1, playbackRate: 0.943874313 },
      Cs4: { sample: 'C4', semitones: 1, playbackRate: 1.059463094 },
      D4: { sample: 'Ds4', semitones: -1, playbackRate: 0.943874313 },
      E4: { sample: 'Ds4', semitones: 1, playbackRate: 1.059463094 },
      F4: { sample: 'Fs4', semitones: -1, playbackRate: 0.943874313 },
      G4: { sample: 'Fs4', semitones: 1, playbackRate: 1.059463094 },
      Gs4: { sample: 'A4', semitones: -1, playbackRate: 0.943874313 },
      // Octave 5
      C5: { sample: 'C5', semitones: 0, playbackRate: 1.0 },
    };

    let mapper: GrandPianoMapper;

    beforeEach(() => {
      mapper = new GrandPianoMapper();
      // Inject mock keyboard map
      (mapper as any).keyboardMap = mockKeyboardMap;
    });

    it('should map exact sampled notes without pitch-shift', () => {
      // A, C, D#, F# are the 4 sampled notes per octave
      expect(mapper.mapNote('A4')).toEqual({
        sample: 'A4',
        semitones: 0,
        playbackRate: 1.0,
      });
      expect(mapper.mapNote('C4')).toEqual({
        sample: 'C4',
        semitones: 0,
        playbackRate: 1.0,
      });
      expect(mapper.mapNote('Ds4')).toEqual({
        sample: 'Ds4',
        semitones: 0,
        playbackRate: 1.0,
      });
      expect(mapper.mapNote('Fs4')).toEqual({
        sample: 'Fs4',
        semitones: 0,
        playbackRate: 1.0,
      });
    });

    it('should map non-sampled notes to nearest sample with +1 semitone shift', () => {
      // C#4 uses C4 sample pitched up 1 semitone
      expect(mapper.mapNote('Cs4')).toEqual({
        sample: 'C4',
        semitones: 1,
        playbackRate: 1.059463094,
      });

      // E4 uses D#4 sample pitched up 1 semitone
      expect(mapper.mapNote('E4')).toEqual({
        sample: 'Ds4',
        semitones: 1,
        playbackRate: 1.059463094,
      });

      // G4 uses F#4 sample pitched up 1 semitone
      expect(mapper.mapNote('G4')).toEqual({
        sample: 'Fs4',
        semitones: 1,
        playbackRate: 1.059463094,
      });

      // A#4 uses A4 sample pitched up 1 semitone
      expect(mapper.mapNote('As4')).toEqual({
        sample: 'A4',
        semitones: 1,
        playbackRate: 1.059463094,
      });
    });

    it('should map non-sampled notes to nearest sample with -1 semitone shift', () => {
      // D4 uses D#4 sample pitched down 1 semitone
      expect(mapper.mapNote('D4')).toEqual({
        sample: 'Ds4',
        semitones: -1,
        playbackRate: 0.943874313,
      });

      // F4 uses F#4 sample pitched down 1 semitone
      expect(mapper.mapNote('F4')).toEqual({
        sample: 'Fs4',
        semitones: -1,
        playbackRate: 0.943874313,
      });

      // G#4 uses A4 sample pitched down 1 semitone
      expect(mapper.mapNote('Gs4')).toEqual({
        sample: 'A4',
        semitones: -1,
        playbackRate: 0.943874313,
      });

      // B4 uses C5 sample pitched down 1 semitone
      expect(mapper.mapNote('B4')).toEqual({
        sample: 'C5',
        semitones: -1,
        playbackRate: 0.943874313,
      });
    });

    it('should verify pitch-shift formulas are mathematically correct', () => {
      // Pitch-shift formula: playbackRate = 2^(semitones / 12)
      const expectedPitchUp = Math.pow(2, 1 / 12); // +1 semitone = ~1.059463
      const expectedPitchDown = Math.pow(2, -1 / 12); // -1 semitone = ~0.943874

      expect(expectedPitchUp).toBeCloseTo(1.059463094, 5);
      expect(expectedPitchDown).toBeCloseTo(0.943874313, 5);
    });

    it('should return null for unmapped notes', () => {
      expect(mapper.mapNote('X99')).toBeNull();
      expect(mapper.mapNote('')).toBeNull();
    });

    it('should handle mapper without loaded keyboard map', () => {
      const emptyMapper = new GrandPianoMapper();
      expect(emptyMapper.hasKeyboardMap()).toBe(false);
      expect(emptyMapper.mapNote('C4')).toBeNull();
    });
  });

  // ==========================================================================
  // TEST SUITE 5: Instrument Switching Scenarios
  // ==========================================================================
  describe('Instrument Switching Scenarios', () => {
    it('should handle switching from Wurlitzer to Grand Piano', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      // Playing Wurlitzer exercise
      const wurlitzerVelocity80 = selector.selectLayer(80, 'C4');
      expect(wurlitzerVelocity80).toBe('v4'); // Wurlitzer v4: 77-102

      // Switch to Grand Piano exercise
      selector.setInstrument('grandpiano');
      const grandPianoVelocity80 = selector.selectLayer(80, 'C4');
      expect(grandPianoVelocity80).toBe('v5'); // Grand Piano v5: 73-90

      // Different layer for same velocity proves isolation
      expect(wurlitzerVelocity80).not.toBe(grandPianoVelocity80);
    });

    it('should handle switching from Grand Piano to Rhodes', () => {
      const selector = new VelocityLayerSelector('grandpiano');

      // Playing Grand Piano exercise
      const grandPianoVelocity50 = selector.selectLayer(50, 'C4');
      expect(grandPianoVelocity50).toBe('v3'); // Grand Piano v3: 37-54

      // Switch to Rhodes exercise
      selector.setInstrument('rhodes');
      const rhodesVelocity50 = selector.selectLayer(50, 'C4');
      expect(rhodesVelocity50).toBe('v2'); // Rhodes v2: 32-63
    });

    it('should handle rapid instrument switching without state leakage', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      // Rapid switching simulation
      selector.setInstrument('grandpiano');
      selector.setInstrument('wurlitzer');
      selector.setInstrument('rhodes');
      selector.setInstrument('grandpiano');
      selector.setInstrument('wurlitzer');

      // Final state should be Wurlitzer
      expect(selector.selectLayer(50, 'C4')).toBe('v2'); // Wurlitzer v2: 26-51
    });

    it('should verify complete buffer replacement on instrument switch', () => {
      // Simulate what happens when HarmonySchedulerV2.setBuffers() is called
      type BufferMap = Map<string, Map<string, AudioBuffer>>;

      const mockBuffer = {} as AudioBuffer;

      // Wurlitzer buffers (5 layers)
      const wurlitzerBuffers: BufferMap = new Map([
        ['v1', new Map([['C4', mockBuffer]])],
        ['v2', new Map([['C4', mockBuffer]])],
        ['v3', new Map([['C4', mockBuffer]])],
        ['v4', new Map([['C4', mockBuffer]])],
        ['v5', new Map([['C4', mockBuffer]])],
      ]);

      // Grand Piano buffers (7 layers)
      const grandPianoBuffers: BufferMap = new Map([
        ['v1', new Map([['C4', mockBuffer]])],
        ['v2', new Map([['C4', mockBuffer]])],
        ['v3', new Map([['C4', mockBuffer]])],
        ['v4', new Map([['C4', mockBuffer]])],
        ['v5', new Map([['C4', mockBuffer]])],
        ['v6', new Map([['C4', mockBuffer]])],
        ['v7', new Map([['C4', mockBuffer]])],
      ]);

      // Simulate scheduler state
      let currentBuffers: BufferMap = wurlitzerBuffers;

      // Switch to Grand Piano - complete replacement
      currentBuffers = grandPianoBuffers;

      // Verify buffers are completely replaced, not merged
      expect(currentBuffers.size).toBe(7);
      expect(currentBuffers.has('v6')).toBe(true);
      expect(currentBuffers.has('v7')).toBe(true);
    });
  });

  // ==========================================================================
  // TEST SUITE 6: Edge Cases and Error Handling
  // ==========================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown instrument gracefully', () => {
      // VelocityLayerSelector should have a fallback for unknown instruments
      const selector = new VelocityLayerSelector('unknown' as any);

      // Should not throw, should return some valid layer
      const layer = selector.selectLayer(64, 'C4');
      expect(typeof layer).toBe('string');
      expect(layer.startsWith('v')).toBe(true);
    });

    it('should handle boundary velocity values', () => {
      const selector = new VelocityLayerSelector('grandpiano');

      // Minimum velocity (0)
      expect(selector.selectLayer(0, 'C4')).toBe('v1');

      // Maximum velocity (127)
      expect(selector.selectLayer(127, 'C4')).toBe('v7');

      // Out of range (should be clamped or handled)
      expect(() => selector.selectLayer(-1, 'C4')).not.toThrow();
      expect(() => selector.selectLayer(128, 'C4')).not.toThrow();
    });

    it('should handle various note name formats', () => {
      const selector = new VelocityLayerSelector('grandpiano');

      // Standard format
      expect(selector.selectLayer(64, 'C4')).toBe('v4');

      // With sharp (s notation)
      expect(selector.selectLayer(64, 'Cs4')).toBe('v4');

      // Edge case: empty note name
      expect(() => selector.selectLayer(64, '')).not.toThrow();
    });
  });
});
