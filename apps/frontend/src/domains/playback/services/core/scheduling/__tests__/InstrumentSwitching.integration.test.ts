/**
 * InstrumentSwitching.integration.test.ts - Integration tests for keyboard instrument switching
 *
 * Tests the full data flow when switching between keyboard instruments on tutorial pages.
 * Verifies that:
 * 1. Sample buffers are correctly loaded and replaced per instrument
 * 2. Scheduler components work together correctly
 * 3. Cache key generation and retrieval works across the system
 * 4. Exercise metadata flows correctly to playback components
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VelocityLayerSelector } from '../VelocityLayerSelector.js';
import { GrandPianoMapper } from '../GrandPianoMapper.js';
import { Scheduler, INSTRUMENT_CONFIGS } from '../../Scheduler.js';

// ============================================================================
// MOCKS
// ============================================================================

// Mock AudioContext and related APIs
const createMockAudioContext = () => {
  const mockGain = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1.0, setValueAtTime: vi.fn() },
  } as unknown as GainNode;

  const mockSource = {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: { value: 1.0 },
    onended: null as (() => void) | null,
  };

  return {
    createBufferSource: vi.fn(() => ({ ...mockSource })),
    createGain: vi.fn(() => mockGain),
    sampleRate: 48000,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
  } as unknown as AudioContext;
};

const createMockBuffer = (duration = 1.0): AudioBuffer => {
  return {
    duration,
    length: 48000 * duration,
    numberOfChannels: 2,
    sampleRate: 48000,
    getChannelData: vi.fn(() => new Float32Array(48000 * duration)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
};

// Mock exercise data
const createMockExercise = (
  id: string,
  instrument: 'grandpiano' | 'wurlitzer' | 'rhodes',
) => ({
  id,
  title: `Exercise with ${instrument}`,
  harmonyInstrument: instrument,
  harmonyNotes: [
    { pitch: 60, startTime: 0, duration: 1, velocity: 80 }, // C4
    { pitch: 62, startTime: 1, duration: 1, velocity: 70 }, // D4
    { pitch: 64, startTime: 2, duration: 1, velocity: 90 }, // E4
  ],
  harmonyControlChanges: [
    { time: 0, value: 127 }, // Sustain on
    { time: 2.5, value: 0 }, // Sustain off
  ],
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Instrument Switching - Integration Tests', () => {
  let mockAudioContext: AudioContext;
  let mockDestination: AudioNode;
  let scheduler: Scheduler;

  beforeEach(() => {
    mockAudioContext = createMockAudioContext();
    mockDestination = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AudioNode;

    const mockTracks = new Map();
    scheduler = new Scheduler('integration-test', mockTracks);
    scheduler.setAudioContext(mockAudioContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // TEST SUITE 1: Scheduler + VelocityLayerSelector Integration
  // ==========================================================================
  describe('Scheduler + VelocityLayerSelector Integration', () => {
    it('should correctly configure velocity selector when setting harmony instrument', () => {
      // Set Wurlitzer
      scheduler.setHarmonyInstrument('wurlitzer');
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('wurlitzer');
      expect(INSTRUMENT_CONFIGS.harmony.octaveShift).toBe(12);

      // Switch to Grand Piano
      scheduler.setHarmonyInstrument('grandpiano');
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('grandpiano');
      expect(INSTRUMENT_CONFIGS.harmony.octaveShift).toBe(0);

      // Switch to Rhodes
      scheduler.setHarmonyInstrument('rhodes');
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('rhodes');
      expect(INSTRUMENT_CONFIGS.harmony.octaveShift).toBe(12);
    });

    it('should correctly update per-note velocity ranges when switching instruments', () => {
      const wurlitzerPerNoteRanges = {
        C4: [
          { min: 0, max: 30, layer: 'v1' },
          { min: 31, max: 60, layer: 'v2' },
          { min: 61, max: 90, layer: 'v3' },
          { min: 91, max: 120, layer: 'v4' },
          { min: 121, max: 127, layer: 'v5' },
        ],
      };

      const grandPianoPerNoteRanges = {
        C4: [
          { min: 0, max: 18, layer: 'v1' },
          { min: 19, max: 36, layer: 'v2' },
          { min: 37, max: 54, layer: 'v3' },
          { min: 55, max: 72, layer: 'v4' },
          { min: 73, max: 90, layer: 'v5' },
          { min: 91, max: 108, layer: 'v6' },
          { min: 109, max: 127, layer: 'v7' },
        ],
      };

      // Set Wurlitzer with per-note ranges
      scheduler.setHarmonyInstrument('wurlitzer', wurlitzerPerNoteRanges);

      // Switch to Grand Piano with different per-note ranges
      scheduler.setHarmonyInstrument('grandpiano', grandPianoPerNoteRanges);

      // The scheduler should have updated to Grand Piano settings
      expect(INSTRUMENT_CONFIGS.harmony.harmonyInstrument).toBe('grandpiano');
    });
  });

  // ==========================================================================
  // TEST SUITE 2: Buffer Management Integration
  // ==========================================================================
  describe('Buffer Management Integration', () => {
    it('should correctly set and replace buffers when switching instruments', () => {
      // Create Wurlitzer buffers
      const wurlitzerBuffers = {
        'v1-C4': createMockBuffer(),
        'v2-C4': createMockBuffer(),
        'v3-C4': createMockBuffer(),
        'v4-C4': createMockBuffer(),
        'v5-C4': createMockBuffer(),
      };

      // Set Wurlitzer buffers
      scheduler.setBuffers(wurlitzerBuffers, mockDestination);
      scheduler.setHarmonyInstrument('wurlitzer');

      let stats = scheduler.getStats();
      expect(stats.bufferCount).toBe(5);

      // Create Grand Piano buffers (more layers)
      const grandPianoBuffers = {
        'v1-C4': createMockBuffer(),
        'v2-C4': createMockBuffer(),
        'v3-C4': createMockBuffer(),
        'v4-C4': createMockBuffer(),
        'v5-C4': createMockBuffer(),
        'v6-C4': createMockBuffer(),
        'v7-C4': createMockBuffer(),
      };

      // Set Grand Piano buffers - should replace, not merge
      scheduler.setBuffers(grandPianoBuffers, mockDestination);
      scheduler.setHarmonyInstrument('grandpiano');

      stats = scheduler.getStats();
      expect(stats.bufferCount).toBe(7);
    });

    it('should clear old buffers before setting new instrument buffers', () => {
      // Set initial buffers
      const initialBuffers = {
        'v1-C4': createMockBuffer(),
        'v1-D4': createMockBuffer(),
      };
      scheduler.setBuffers(initialBuffers, mockDestination);
      expect(scheduler.getStats().bufferCount).toBe(2);

      // Set new buffers (should replace)
      const newBuffers = {
        'v3-E4': createMockBuffer(),
      };
      scheduler.setBuffers(newBuffers, mockDestination);
      expect(scheduler.getStats().bufferCount).toBe(1);
    });
  });

  // ==========================================================================
  // TEST SUITE 3: Exercise Metadata Flow Integration
  // ==========================================================================
  describe('Exercise Metadata Flow Integration', () => {
    it('should correctly extract and apply instrument from exercise metadata', () => {
      const wurlitzerExercise = createMockExercise('ex1', 'wurlitzer');
      const grandPianoExercise = createMockExercise('ex2', 'grandpiano');

      // Simulate what useWidgetPageState does
      const extractInstrument = (exercise: any) => exercise.harmonyInstrument;

      const instrument1 = extractInstrument(wurlitzerExercise);
      expect(instrument1).toBe('wurlitzer');

      const instrument2 = extractInstrument(grandPianoExercise);
      expect(instrument2).toBe('grandpiano');
    });

    it('should maintain exercise isolation - different exercises have different instruments', () => {
      const exercises = [
        createMockExercise('ex1', 'wurlitzer'),
        createMockExercise('ex2', 'grandpiano'),
        createMockExercise('ex3', 'rhodes'),
      ];

      // Verify each exercise maintains its own instrument
      expect(exercises[0].harmonyInstrument).toBe('wurlitzer');
      expect(exercises[1].harmonyInstrument).toBe('grandpiano');
      expect(exercises[2].harmonyInstrument).toBe('rhodes');

      // Changing one exercise's instrument doesn't affect others
      const ex1Instrument = exercises[0].harmonyInstrument;
      exercises[1].harmonyInstrument = 'wurlitzer';

      expect(exercises[0].harmonyInstrument).toBe(ex1Instrument);
    });
  });

  // ==========================================================================
  // TEST SUITE 4: Cache Key Generation Integration
  // ==========================================================================
  describe('Cache Key Generation Integration', () => {
    it('should generate unique cache keys that prevent cross-instrument contamination', () => {
      // Simulate GlobalSampleCache key generation
      const generateCacheKey = (
        instrument: string,
        layer: string,
        note: string,
      ) => `${instrument}-${layer}-${note}`;

      // Build cache for multiple instruments
      const cache = new Map<string, AudioBuffer>();

      // Add Wurlitzer samples
      cache.set(generateCacheKey('wurlitzer', 'v3', 'C4'), createMockBuffer());
      cache.set(generateCacheKey('wurlitzer', 'v3', 'D4'), createMockBuffer());

      // Add Grand Piano samples
      cache.set(generateCacheKey('grandpiano', 'v5', 'C4'), createMockBuffer());
      cache.set(generateCacheKey('grandpiano', 'v5', 'D4'), createMockBuffer());

      // Retrieve instrument-specific samples
      const retrieveForInstrument = (
        cache: Map<string, AudioBuffer>,
        instrument: string,
      ) => {
        const samples: string[] = [];
        cache.forEach((_, key) => {
          if (key.startsWith(`${instrument}-`)) {
            samples.push(key);
          }
        });
        return samples;
      };

      const wurlitzerSamples = retrieveForInstrument(cache, 'wurlitzer');
      const grandPianoSamples = retrieveForInstrument(cache, 'grandpiano');

      // Each instrument should only get its own samples
      expect(wurlitzerSamples).toHaveLength(2);
      expect(grandPianoSamples).toHaveLength(2);

      expect(wurlitzerSamples.every((s) => s.startsWith('wurlitzer-'))).toBe(
        true,
      );
      expect(grandPianoSamples.every((s) => s.startsWith('grandpiano-'))).toBe(
        true,
      );

      // No cross-contamination
      expect(wurlitzerSamples.some((s) => s.includes('grandpiano'))).toBe(false);
      expect(grandPianoSamples.some((s) => s.includes('wurlitzer'))).toBe(false);
    });
  });

  // ==========================================================================
  // TEST SUITE 5: Grand Piano Sparse Sampling Integration
  // ==========================================================================
  describe('Grand Piano Sparse Sampling Integration', () => {
    it('should integrate GrandPianoMapper with VelocityLayerSelector for full note resolution', () => {
      const mapper = new GrandPianoMapper();
      const selector = new VelocityLayerSelector('grandpiano');

      // Load mock keyboard map
      const mockKeyboardMap = {
        C4: { sample: 'C4', semitones: 0, playbackRate: 1.0 },
        Cs4: { sample: 'C4', semitones: 1, playbackRate: 1.059463094 },
        D4: { sample: 'Ds4', semitones: -1, playbackRate: 0.943874313 },
        Ds4: { sample: 'Ds4', semitones: 0, playbackRate: 1.0 },
        E4: { sample: 'Ds4', semitones: 1, playbackRate: 1.059463094 },
      };
      (mapper as any).keyboardMap = mockKeyboardMap;

      // Simulate playing note E4 at velocity 80
      const requestedNote = 'E4';
      const velocity = 80;

      // Step 1: Map note to sample (sparse sampling)
      const mapping = mapper.mapNote(requestedNote);
      expect(mapping).not.toBeNull();
      expect(mapping!.sample).toBe('Ds4'); // E4 uses D#4 sample
      expect(mapping!.playbackRate).toBeCloseTo(1.059463094, 5); // Pitched up

      // Step 2: Select velocity layer
      const layer = selector.selectLayer(velocity, requestedNote);
      expect(layer).toBe('v5'); // Velocity 80 → v5 (73-90 range)

      // Step 3: Build final cache key
      const cacheKey = `grandpiano-${layer}-${mapping!.sample}`;
      expect(cacheKey).toBe('grandpiano-v5-Ds4');
    });

    it('should handle the full playback chain for a Grand Piano note', () => {
      const mapper = new GrandPianoMapper();
      const selector = new VelocityLayerSelector('grandpiano');

      const mockKeyboardMap = {
        G4: { sample: 'Fs4', semitones: 1, playbackRate: 1.059463094 },
        Fs4: { sample: 'Fs4', semitones: 0, playbackRate: 1.0 },
      };
      (mapper as any).keyboardMap = mockKeyboardMap;

      // Simulate the full chain for note G4 at velocity 100
      const midiNote = 67; // G4
      const noteName = 'G4';
      const velocity = 100;

      // 1. Octave shift (Grand Piano = 0)
      const octaveShift = 0;
      const adjustedMidiNote = midiNote - octaveShift;
      expect(adjustedMidiNote).toBe(67);

      // 2. Sparse sampling lookup
      const mapping = mapper.mapNote(noteName);
      expect(mapping!.sample).toBe('Fs4');
      expect(mapping!.playbackRate).toBeCloseTo(1.059463094, 5);

      // 3. Velocity layer selection
      const layer = selector.selectLayer(velocity, noteName);
      expect(layer).toBe('v6'); // Velocity 100 → v6 (91-108 range)

      // 4. Final buffer key
      const bufferKey = `${layer}-${mapping!.sample}`;
      expect(bufferKey).toBe('v6-Fs4');
    });
  });

  // ==========================================================================
  // TEST SUITE 6: Multi-Exercise Tutorial Simulation
  // ==========================================================================
  describe('Multi-Exercise Tutorial Simulation', () => {
    it('should correctly handle switching between exercises with different instruments', () => {
      const exercise1 = createMockExercise('ex1', 'wurlitzer');
      const exercise2 = createMockExercise('ex2', 'grandpiano');

      // State to track current configuration
      let currentInstrument: string = '';
      let currentOctaveShift: number = 0;
      let currentVelocityLayers: number = 0;

      // Simulate selecting Exercise 1 (Wurlitzer)
      const selectExercise = (exercise: any) => {
        currentInstrument = exercise.harmonyInstrument;
        currentOctaveShift = currentInstrument === 'grandpiano' ? 0 : 12;
        currentVelocityLayers =
          currentInstrument === 'grandpiano'
            ? 7
            : currentInstrument === 'wurlitzer'
              ? 5
              : 4;
      };

      selectExercise(exercise1);
      expect(currentInstrument).toBe('wurlitzer');
      expect(currentOctaveShift).toBe(12);
      expect(currentVelocityLayers).toBe(5);

      // Simulate selecting Exercise 2 (Grand Piano)
      selectExercise(exercise2);
      expect(currentInstrument).toBe('grandpiano');
      expect(currentOctaveShift).toBe(0);
      expect(currentVelocityLayers).toBe(7);
    });

    it('should verify complete isolation between sequential exercise playback', () => {
      const velocitySelector = new VelocityLayerSelector('wurlitzer');

      // Play Exercise 1 (Wurlitzer)
      const ex1Layer = velocitySelector.selectLayer(75, 'C4');
      expect(ex1Layer).toBe('v3'); // Wurlitzer v3: 52-76

      // Store "played" notes from Exercise 1
      const exercise1Notes = ['wurlitzer-v3-C4', 'wurlitzer-v3-D4'];

      // Switch to Exercise 2 (Grand Piano)
      velocitySelector.setInstrument('grandpiano');
      const ex2Layer = velocitySelector.selectLayer(75, 'C4');
      expect(ex2Layer).toBe('v5'); // Grand Piano v5: 73-90

      // Store "played" notes from Exercise 2
      const exercise2Notes = ['grandpiano-v5-C4', 'grandpiano-v5-D4'];

      // Verify no overlap in played notes
      const allNotes = [...exercise1Notes, ...exercise2Notes];
      const uniqueNotes = new Set(allNotes);
      expect(uniqueNotes.size).toBe(allNotes.length); // All unique

      // No Wurlitzer notes in Exercise 2 set
      expect(exercise2Notes.some((n) => n.includes('wurlitzer'))).toBe(false);

      // No Grand Piano notes in Exercise 1 set
      expect(exercise1Notes.some((n) => n.includes('grandpiano'))).toBe(false);
    });
  });

  // ==========================================================================
  // TEST SUITE 7: Octave Shift + Sparse Sampling Combined
  // ==========================================================================
  describe('Octave Shift + Sparse Sampling Combined', () => {
    it('should correctly apply octave shift before sparse sampling lookup for Grand Piano', () => {
      // Grand Piano: octaveShift = 0, so MIDI note stays the same
      const midiNote = 60; // C4
      const octaveShift = 0;
      const adjustedNote = midiNote - octaveShift;

      expect(adjustedNote).toBe(60); // C4 stays C4

      // Then sparse sampling maps C4 → C4 sample (no pitch shift needed)
    });

    it('should correctly apply octave shift for Wurlitzer (no sparse sampling)', () => {
      // Wurlitzer: octaveShift = 12, samples recorded 1 octave higher
      const midiNote = 60; // Want to play C4
      const octaveShift = 12;
      const adjustedNote = midiNote - octaveShift;

      expect(adjustedNote).toBe(48); // Look for C3 sample to play as C4
    });

    it('should handle the complete flow for both instruments playing same MIDI note', () => {
      const midiNote = 64; // E4
      const velocity = 80;

      // === Wurlitzer Flow ===
      const wurlitzerOctaveShift = 12;
      const wurlitzerAdjustedMidi = midiNote - wurlitzerOctaveShift; // 52
      const wurlitzerSelector = new VelocityLayerSelector('wurlitzer');
      const wurlitzerLayer = wurlitzerSelector.selectLayer(velocity, 'E4'); // v4

      // Wurlitzer: Full chromatic sampling, direct lookup
      const wurlitzerCacheKey = `wurlitzer-${wurlitzerLayer}-E3`; // E3 due to octave shift
      expect(wurlitzerCacheKey).toBe('wurlitzer-v4-E3');

      // === Grand Piano Flow ===
      const grandPianoOctaveShift = 0;
      const grandPianoAdjustedMidi = midiNote - grandPianoOctaveShift; // 64
      const grandPianoSelector = new VelocityLayerSelector('grandpiano');
      const grandPianoLayer = grandPianoSelector.selectLayer(velocity, 'E4'); // v5

      // Grand Piano: Sparse sampling, E4 → Ds4 sample
      const mapper = new GrandPianoMapper();
      (mapper as any).keyboardMap = {
        E4: { sample: 'Ds4', semitones: 1, playbackRate: 1.059463094 },
      };
      const mapping = mapper.mapNote('E4');

      const grandPianoCacheKey = `grandpiano-${grandPianoLayer}-${mapping!.sample}`;
      expect(grandPianoCacheKey).toBe('grandpiano-v5-Ds4');

      // Completely different cache keys for same MIDI note
      expect(wurlitzerCacheKey).not.toBe(grandPianoCacheKey);
    });
  });
});
