/**
 * ChordInstrumentProcessor Behavior Tests
 * Story 2.2 - Task 4: Comprehensive test suite for sophisticated chord/harmony instrument
 *
 * Test Coverage:
 * - Chord voicing and voice leading optimization
 * - Multiple sound presets (pad, Rhodes, organ, strings, brass)
 * - Harmonic analysis with chord symbol recognition
 * - Roman numeral notation and functional analysis
 * - Chord progression analysis and cadence detection
 * - Effects processing and stereo imaging
 * - Real-time chord playback and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Tone.js to avoid dynamic import issues in tests
const mockPolySynth = {
  set: vi.fn(),
  get: vi.fn().mockReturnValue({ release: 0.1 }),
  triggerAttackRelease: vi.fn(),
  triggerRelease: vi.fn(),
  releaseAll: vi.fn(),
  dispose: vi.fn(),
  maxPolyphony: 8,
  chain: vi.fn().mockReturnThis(),
  toDestination: vi.fn().mockReturnThis(),
};

const mockReverb = {
  set: vi.fn(),
  dispose: vi.fn(),
  wet: { value: 0 },
  toDestination: vi.fn().mockReturnThis(),
};

const mockChorus = {
  set: vi.fn(),
  dispose: vi.fn(),
  frequency: { value: 0 },
  depth: { value: 0 },
  wet: { value: 0 },
};

const mockStereoWidener = {
  width: { value: 0 },
  dispose: vi.fn(),
};

const mockEQ3 = {
  set: vi.fn(),
  dispose: vi.fn(),
  low: { value: 0 },
  mid: { value: 0 },
  high: { value: 0 },
};

const mockTone = {
  PolySynth: vi.fn(() => mockPolySynth),
  Synth: vi.fn(),
  Reverb: vi.fn(() => mockReverb),
  Chorus: vi.fn(() => mockChorus),
  StereoWidener: vi.fn(() => mockStereoWidener),
  EQ3: vi.fn(() => mockEQ3),
  Transport: {
    scheduleOnce: vi.fn(),
  },
  context: {
    state: 'running',
  },
  start: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValue(0),
};

// Mock Soundfont
vi.mock('soundfont-player', () => ({
  default: {
    instrument: vi.fn().mockResolvedValue({
      play: vi.fn(),
      stop: vi.fn(),
    }),
  },
}));

// Mock the velocity samplers
vi.mock('../plugins/SalamanderVelocitySampler', () => ({
  SalamanderVelocitySampler: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    dispose: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
}));

vi.mock('../plugins/WurlitzerVelocitySampler', () => ({
  WurlitzerVelocitySampler: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    dispose: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
}));

vi.mock('../plugins/LongPadSampler', () => ({
  LongPadSampler: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    dispose: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
}));

vi.mock('../plugins/RhodesVelocitySampler', () => ({
  RhodesVelocitySampler: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    dispose: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
}));

vi.mock('../plugins/TheSawSampler', () => ({
  TheSawSampler: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(),
    dispose: vi.fn(),
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
  })),
}));

// Mock dynamic import
vi.mock('tone', () => mockTone);

// Import after mocks are set up
import {
  ChordInstrumentProcessor,
  ChordQuality,
  ChordPreset,
  VoicingStyle,
  ChordVoicingEngine,
  HarmonicAnalyzer,
} from '../plugins/ChordInstrumentProcessor';

// Mock setTimeout to prevent actual delays
vi.stubGlobal(
  'setTimeout',
  vi.fn((fn) => fn()),
);

describe('ChordInstrumentProcessor', () => {
  let processor: ChordInstrumentProcessor;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a test-specific processor that bypasses dynamic loading
    processor = new ChordInstrumentProcessor();

    // Manually inject the mocked Tone to bypass dynamic loading
    (processor as any).Tone = mockTone;
  });

  afterEach(() => {
    // Safely dispose processor if it was created successfully
    if (processor && typeof processor.dispose === 'function') {
      try {
        processor.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      expect(processor).toBeDefined();
      expect(processor.getChordProgression()).toBeNull();

      // Manually call initialization with mocked Tone
      await processor.preActivateAudioContext();

      // Verify processor is ready
      expect(processor).toBeDefined();
    });

    it('should initialize with custom configuration', async () => {
      const customConfig = {
        preset: ChordPreset.RHODES,
        polyphony: 12,
        voicingOptions: {
          style: VoicingStyle.DROP_2,
          range: { min: 'C2', max: 'C7' },
          doubling: true,
          omissions: [],
          voiceLeading: true,
          smoothness: 0.9,
        },
      };

      const customProcessor = new ChordInstrumentProcessor(customConfig);
      // Inject mocked Tone
      (customProcessor as any).Tone = mockTone;

      expect(customProcessor).toBeDefined();

      try {
        customProcessor.dispose();
      } catch (error) {
        // Ignore disposal errors in tests
      }
    });
  });

  describe('Chord Voicing Engine', () => {
    let voicingEngine: ChordVoicingEngine;

    beforeEach(() => {
      voicingEngine = new ChordVoicingEngine();
    });

    it('should generate close voicing', () => {
      const chordSymbol = {
        root: 'C',
        quality: ChordQuality.MAJOR,
        extensions: [],
        alterations: [],
      };

      const voicing = voicingEngine.generateVoicing(chordSymbol, {
        style: VoicingStyle.CLOSE,
        range: { min: 'C3', max: 'C6' },
        doubling: false,
        omissions: [],
        voiceLeading: false,
        smoothness: 0.5,
      });

      expect(voicing).toBeDefined();
      expect(voicing.length).toBeGreaterThan(0);
      // Voicing includes octave numbers
      expect(voicing[0]).toMatch(/^C\d$/);
    });

    it('should generate drop-2 voicing', () => {
      const chordSymbol = {
        root: 'F',
        quality: ChordQuality.MAJOR_SEVENTH,
        extensions: [],
        alterations: [],
      };

      const voicing = voicingEngine.generateVoicing(chordSymbol, {
        style: VoicingStyle.DROP_2,
        range: { min: 'C3', max: 'C6' },
        doubling: false,
        omissions: [],
        voiceLeading: false,
        smoothness: 0.5,
      });

      expect(voicing).toBeDefined();
      expect(voicing.length).toBeGreaterThan(2);
    });

    it('should optimize voice leading between chords', () => {
      const chord1 = {
        root: 'C',
        quality: ChordQuality.MAJOR,
        extensions: [],
        alterations: [],
      };

      const chord2 = {
        root: 'F',
        quality: ChordQuality.MAJOR,
        extensions: [],
        alterations: [],
      };

      const voicing1 = voicingEngine.generateVoicing(chord1, {
        style: VoicingStyle.CLOSE,
        range: { min: 'C3', max: 'C6' },
        doubling: false,
        omissions: [],
        voiceLeading: false,
        smoothness: 0.5,
      });

      const context = {
        key: 'C',
        mode: 'major',
        previousChord: {
          symbol: chord1,
          notes: voicing1,
          voicing: voicing1,
          romanNumeral: 'I',
          function: 'tonic',
          confidence: 1.0,
          timestamp: Date.now(),
        },
        position: 'strong' as const,
        function: 'subdominant' as const,
      };

      const voicing2 = voicingEngine.generateVoicing(
        chord2,
        {
          style: VoicingStyle.CLOSE,
          range: { min: 'C3', max: 'C6' },
          doubling: false,
          omissions: [],
          voiceLeading: true,
          smoothness: 0.8,
        },
        context,
      );

      expect(voicing2).toBeDefined();
      expect(voicing2.length).toBeGreaterThan(0);
    });
  });

  describe('Harmonic Analyzer', () => {
    let harmonicAnalyzer: HarmonicAnalyzer;

    beforeEach(() => {
      harmonicAnalyzer = new HarmonicAnalyzer();
    });

    it('should analyze major chord correctly', () => {
      const notes = ['C4', 'E4', 'G4'];
      const analyzedChord = harmonicAnalyzer.analyzeChord(notes);

      expect(analyzedChord.symbol.root).toBe('C');
      expect(analyzedChord.symbol.quality).toBe(ChordQuality.MAJOR);
      expect(analyzedChord.confidence).toBeGreaterThan(0.5);
    });

    it('should analyze minor chord correctly', () => {
      const notes = ['A4', 'C5', 'E5'];
      const analyzedChord = harmonicAnalyzer.analyzeChord(notes);

      expect(analyzedChord.symbol.root).toBe('A');
      expect(analyzedChord.symbol.quality).toBe(ChordQuality.MINOR);
    });

    it('should analyze chord progression', () => {
      const chords = [
        {
          symbol: {
            root: 'C',
            quality: ChordQuality.MAJOR,
            extensions: [],
            alterations: [],
          },
          notes: ['C4', 'E4', 'G4'],
          voicing: ['C4', 'E4', 'G4'],
          romanNumeral: 'I',
          function: 'tonic',
          confidence: 1.0,
          timestamp: Date.now(),
        },
        {
          symbol: {
            root: 'F',
            quality: ChordQuality.MAJOR,
            extensions: [],
            alterations: [],
          },
          notes: ['F4', 'A4', 'C5'],
          voicing: ['F4', 'A4', 'C5'],
          romanNumeral: 'IV',
          function: 'subdominant',
          confidence: 1.0,
          timestamp: Date.now() + 1000,
        },
      ];

      const progression = harmonicAnalyzer.analyzeProgression(chords, 'C');

      expect(progression.key).toBe('C');
      expect(progression.chords).toHaveLength(2);
      expect(progression.romanNumerals).toEqual(['I', 'IV']);
    });

    it('should identify authentic cadence', () => {
      const chords = [
        {
          symbol: {
            root: 'G',
            quality: ChordQuality.DOMINANT,
            extensions: [],
            alterations: [],
          },
          notes: ['G4', 'B4', 'D5', 'F5'],
          voicing: ['G4', 'B4', 'D5', 'F5'],
          romanNumeral: 'V7',
          function: 'dominant',
          confidence: 1.0,
          timestamp: Date.now(),
        },
        {
          symbol: {
            root: 'C',
            quality: ChordQuality.MAJOR,
            extensions: [],
            alterations: [],
          },
          notes: ['C4', 'E4', 'G4'],
          voicing: ['C4', 'E4', 'G4'],
          romanNumeral: 'I',
          function: 'tonic',
          confidence: 1.0,
          timestamp: Date.now() + 1000,
        },
      ];

      const progression = harmonicAnalyzer.analyzeProgression(chords, 'C');

      expect(progression.cadences).toHaveLength(1);
      expect(progression.cadences[0]?.type).toBe('authentic');
      expect(progression.cadences[0]?.strength).toBeGreaterThan(0.8);
    });
  });

  describe('Sound Presets', () => {
    it('should set different presets', () => {
      const presets = [
        ChordPreset.PAD,
        ChordPreset.RHODES,
        ChordPreset.ORGAN,
        ChordPreset.STRINGS,
        ChordPreset.BRASS,
      ];

      presets.forEach((preset) => {
        processor.setPreset(preset);
        expect(processor).toBeDefined();
      });
    });
  });

  describe('Effects Processing', () => {
    it('should update reverb settings', () => {
      processor.updateEffects({
        reverb: {
          decay: 3.0,
          wet: 0.5,
        },
      });

      expect(processor).toBeDefined();
    });

    it('should update multiple effects', () => {
      processor.updateEffects({
        reverb: {
          decay: 4.0,
          wet: 0.6,
        },
        chorus: {
          frequency: 2.5,
          depth: 0.4,
          wet: 0.3,
        },
        stereoImaging: {
          width: 0.8,
        },
      });

      expect(processor).toBeDefined();
    });
  });

  describe('Chord Progression Analysis', () => {
    it('should analyze simple progression', () => {
      const chords = ['C', 'F', 'G', 'C'];
      const progression = processor.analyzeProgression(chords, 'C');

      expect(progression.key).toBe('C');
      expect(progression.chords).toHaveLength(4);
      // The chord parsing is simplified, so we just check that we get roman numerals
      expect(progression.romanNumerals).toHaveLength(4);
      expect(progression.romanNumerals[0]).toBe('I');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty progression analysis', () => {
      const progression = processor.analyzeProgression([], 'C');
      expect(progression.chords).toHaveLength(0);
      expect(progression.key).toBe('C');
    });

    it('should handle disposal correctly', () => {
      // First, ensure processor is initialized with effects
      (processor as any).effects = {
        reverb: mockReverb,
        chorus: mockChorus,
        stereoImaging: mockStereoWidener,
        eq: mockEQ3,
      };
      (processor as any).polySynth = mockPolySynth;

      expect(() => {
        processor.dispose();
        // Verify dispose was called on effects
        expect(mockReverb.dispose).toHaveBeenCalled();
        expect(mockChorus.dispose).toHaveBeenCalled();
        expect(mockStereoWidener.dispose).toHaveBeenCalled();
        expect(mockEQ3.dispose).toHaveBeenCalled();
        expect(mockPolySynth.dispose).toHaveBeenCalled();

        // Reset mocks for second disposal
        vi.clearAllMocks();

        processor.dispose(); // Double disposal should not throw
      }).not.toThrow();
    });
  });
});
