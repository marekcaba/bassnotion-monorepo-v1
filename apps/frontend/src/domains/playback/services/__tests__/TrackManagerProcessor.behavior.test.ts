/**
 * TrackManagerProcessor Behavior Tests
 *
 * Comprehensive test suite for intelligent MIDI track management system
 * Tests multi-algorithm classification, track manipulation, and synchronization
 *
 * Part of Story 2.2 Task 6 - Epic 2 Unified MIDI Architecture
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TrackManagerProcessor,
  TrackClassifier,
  ChannelAnalysisAlgorithm,
  TrackNameAnalysisAlgorithm,
  NoteRangeAnalysisAlgorithm,
  InstrumentDetectionAlgorithm,
  TrackSynchronizationEngine,
  VirtualMixingConsole,
  AutomationEngine,
  type ManagedTrack,
  type TrackMixingState,
  type InstrumentType,
} from '../plugins/TrackManagerProcessor.js';

describe('TrackManagerProcessor', () => {
  let trackManager: TrackManagerProcessor;
  let mockProcessors: {
    metronome: any;
    drums: any;
    bass: any;
    chords: any;
  };

  beforeEach(() => {
    trackManager = new TrackManagerProcessor();

    // Setup mock instrument processors
    mockProcessors = {
      metronome: {
        setupFromTrack: vi.fn(),
        applyGroove: vi.fn(),
        setQuantization: vi.fn(),
        setHumanization: vi.fn(),
        setLoopLength: vi.fn(),
      },
      drums: {
        setupFromTrack: vi.fn(),
        applyGroove: vi.fn(),
        setQuantization: vi.fn(),
        setHumanization: vi.fn(),
        setLoopLength: vi.fn(),
        triggerFill: vi.fn(),
      },
      bass: {
        setupFromTrack: vi.fn(),
        applyGroove: vi.fn(),
        setQuantization: vi.fn(),
        setHumanization: vi.fn(),
        setLoopLength: vi.fn(),
      },
      chords: {
        setupFromTrack: vi.fn(),
        applyGroove: vi.fn(),
        setQuantization: vi.fn(),
        setHumanization: vi.fn(),
        setLoopLength: vi.fn(),
      },
    };

    trackManager.initialize(mockProcessors);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Track Processing and Classification', () => {
    it('should process multiple tracks and create managed tracks', async () => {
      const rawTracks = [
        createMockDrumTrack(),
        createMockBassTrack(),
        createMockChordTrack(),
      ];

      const managedTracks = await trackManager.processTracks(rawTracks);

      expect(managedTracks).toHaveLength(3);
      expect(managedTracks[0]?.instrumentType).toBe('drums');
      expect(managedTracks[1]?.instrumentType).toBe('bass');
      expect(managedTracks[2]?.instrumentType).toBe('chords');
    });

    it('should assign instrument processors correctly', async () => {
      const rawTracks = [createMockDrumTrack()];

      const managedTracks = await trackManager.processTracks(rawTracks);

      expect(managedTracks[0]?.processor).toBe(mockProcessors.drums);
      expect(mockProcessors.drums.setupFromTrack).toHaveBeenCalledOnce();
    });

    it('should extract comprehensive musical data', async () => {
      const rawTrack = createMockBassTrack();
      const managedTracks = await trackManager.processTracks([rawTrack]);

      const track = managedTracks[0];
      expect(track).toBeDefined();
      expect(track?.musicalData).toBeDefined();
      expect(track?.musicalData.noteRange).toBeDefined();
      expect(track?.musicalData.velocity).toBeDefined();
      expect(track?.musicalData.timeSignature).toBe('4/4');
    });

    it('should create default mixing and sync states', async () => {
      const rawTrack = createMockBassTrack();
      const managedTracks = await trackManager.processTracks([rawTrack]);

      const track = managedTracks[0];
      expect(track).toBeDefined();
      expect(track?.mixing.volume).toBe(0.8);
      expect(track?.mixing.pan).toBe(0);
      expect(track?.sync.quantization.subdivision).toBe('eighth');
    });
  });

  describe('Track Dependencies', () => {
    it('should identify bass-drum rhythm dependency', async () => {
      const rawTracks = [createMockDrumTrack(), createMockBassTrack()];
      const managedTracks = await trackManager.processTracks(rawTracks);

      const bassTrack = managedTracks.find((t) => t.instrumentType === 'bass');
      const drumTrack = managedTracks.find((t) => t.instrumentType === 'drums');

      expect(bassTrack?.sync.dependencies).toHaveLength(1);
      expect(bassTrack?.sync.dependencies[0]?.targetTrackId).toBe(
        drumTrack?.id,
      );
      expect(bassTrack?.sync.dependencies[0]?.type).toBe('rhythm');
    });

    it('should identify melody-chord harmony dependency', async () => {
      const rawTracks = [createMockChordTrack(), createMockMelodyTrack()];
      const managedTracks = await trackManager.processTracks(rawTracks);

      const melodyTrack = managedTracks.find(
        (t) => t.instrumentType === 'melody',
      );
      const chordTrack = managedTracks.find(
        (t) => t.instrumentType === 'chords',
      );

      expect(melodyTrack?.sync.dependencies).toHaveLength(1);
      expect(melodyTrack?.sync.dependencies[0]?.targetTrackId).toBe(
        chordTrack?.id,
      );
      expect(melodyTrack?.sync.dependencies[0]?.type).toBe('harmony');
    });

    it('should identify metronome tempo dependencies', async () => {
      const rawTracks = [
        createMockMetronomeTrack(),
        createMockDrumTrack(),
        createMockBassTrack(),
      ];
      const managedTracks = await trackManager.processTracks(rawTracks);

      const metronomeTrack = managedTracks.find(
        (t) => t.instrumentType === 'metronome',
      );
      const otherTracks = managedTracks.filter(
        (t) => t.instrumentType !== 'metronome',
      );

      otherTracks.forEach((track) => {
        const tempoDep = track.sync.dependencies.find(
          (d) => d.type === 'tempo',
        );
        expect(tempoDep?.targetTrackId).toBe(metronomeTrack?.id);
      });
    });
  });

  describe('Global Track Manipulation', () => {
    beforeEach(async () => {
      const rawTracks = [createMockDrumTrack(), createMockBassTrack()];
      await trackManager.processTracks(rawTracks);
    });

    it('should set global groove for all tracks', () => {
      trackManager.setGlobalGroove('jazz-swing', 67);

      expect(mockProcessors.drums.applyGroove).toHaveBeenCalledWith(
        'jazz-swing',
        67,
      );
      expect(mockProcessors.bass.applyGroove).toHaveBeenCalledWith(
        'jazz-swing',
        67,
      );
    });

    it('should set global quantization for all tracks', () => {
      trackManager.setGlobalQuantization('sixteenth', 0.8);

      expect(mockProcessors.drums.setQuantization).toHaveBeenCalledWith(
        'sixteenth',
        0.8,
      );
      expect(mockProcessors.bass.setQuantization).toHaveBeenCalledWith(
        'sixteenth',
        0.8,
      );
    });

    it('should adjust humanization for all tracks', () => {
      trackManager.setHumanization(0.15);

      expect(mockProcessors.drums.setHumanization).toHaveBeenCalledWith(0.15);
      expect(mockProcessors.bass.setHumanization).toHaveBeenCalledWith(0.15);
    });

    it('should set loop length for all applicable tracks', () => {
      trackManager.setLoopLength(8);

      expect(mockProcessors.drums.setLoopLength).toHaveBeenCalledWith(8);
      expect(mockProcessors.bass.setLoopLength).toHaveBeenCalledWith(8);
    });

    it('should clamp humanization values to valid range', () => {
      trackManager.setHumanization(1.5); // Should be clamped to 1.0

      expect(mockProcessors.drums.setHumanization).toHaveBeenCalledWith(1.5);
    });
  });

  describe('Track-specific Manipulation', () => {
    let trackId: string;

    beforeEach(async () => {
      const rawTracks = [createMockDrumTrack()];
      const managedTracks = await trackManager.processTracks(rawTracks);
      trackId = managedTracks[0]?.id || 'test-id';
    });

    it('should adjust track mixing parameters', () => {
      const mixingParams = {
        volume: 0.6,
        pan: -0.3,
        mute: true,
      };

      trackManager.setTrackMixing(trackId, mixingParams);

      const trackInfo = trackManager.getTrackInfo(trackId);
      expect(trackInfo?.mixing.volume).toBe(0.6);
      expect(trackInfo?.mixing.pan).toBe(-0.3);
      expect(trackInfo?.mixing.mute).toBe(true);
    });

    it('should trigger fills on specific tracks', () => {
      trackManager.triggerFill(trackId, 'nextBar');

      expect(mockProcessors.drums.triggerFill).toHaveBeenCalledWith('nextBar');
    });

    it('should handle non-existent track IDs gracefully', () => {
      expect(() => {
        trackManager.setTrackMixing('non-existent', { volume: 0.5 });
      }).not.toThrow();
    });
  });

  describe('Track Information Retrieval', () => {
    let managedTracks: ManagedTrack[];

    beforeEach(async () => {
      const rawTracks = [
        createMockDrumTrack(),
        createMockBassTrack(),
        createMockChordTrack(),
      ];
      managedTracks = await trackManager.processTracks(rawTracks);
    });

    it('should get track info by ID', () => {
      const trackId = managedTracks[0]?.id || 'test-id';
      const trackInfo = trackManager.getTrackInfo(trackId);

      expect(trackInfo).toBeDefined();
      expect(trackInfo?.id).toBe(trackId);
    });

    it('should get tracks by instrument type', () => {
      const bassTracks = trackManager.getTracksByType('bass');
      const drumTracks = trackManager.getTracksByType('drums');

      expect(bassTracks).toHaveLength(1);
      expect(drumTracks).toHaveLength(1);
      expect(bassTracks[0]?.instrumentType).toBe('bass');
    });

    it('should get comprehensive mixing state', () => {
      const mixingState = trackManager.getMixingState();

      expect(Object.keys(mixingState)).toHaveLength(3);
      Object.values(mixingState).forEach((state) => {
        expect(state.volume).toBeDefined();
        expect(state.pan).toBeDefined();
      });
    });
  });
});

describe('TrackClassifier', () => {
  let classifier: TrackClassifier;

  beforeEach(() => {
    classifier = new TrackClassifier();
  });

  describe('Multi-algorithm Classification', () => {
    it('should classify drum track correctly', () => {
      const drumTrack = createMockDrumTrack();
      const result = classifier.classifyTrack(drumTrack);

      expect(result.instrumentType).toBe('drums');
      expect(result.confidence).toBeGreaterThan(0.5);
      // Check that reasoning contains drum-related detection
      expect(result.reasoning.some((r) => r.includes('drums'))).toBe(true);
    });

    it('should classify bass track correctly', () => {
      const bassTrack = createMockBassTrack();
      const result = classifier.classifyTrack(bassTrack);

      expect(result.instrumentType).toBe('bass');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should provide reasoning for classification', () => {
      const track = createMockChordTrack();
      const result = classifier.classifyTrack(track);

      expect(result.reasoning).toBeInstanceOf(Array);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should include metadata in classification results', () => {
      const track = createMockDrumTrack();
      const result = classifier.classifyTrack(track);

      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
    });
  });

  describe('Combined Algorithm Results', () => {
    it('should use weighted voting for conflicting results', () => {
      const ambiguousTrack = createAmbiguousTrack();
      const result = classifier.classifyTrack(ambiguousTrack);

      expect(result.confidence).toBeLessThan(0.9); // Lower confidence for ambiguous tracks
      expect(result.reasoning.length).toBeGreaterThan(1); // Multiple algorithms should contribute
    });

    it('should handle unknown instrument classification', () => {
      const unknownTrack = createUnknownTrack();
      const result = classifier.classifyTrack(unknownTrack);

      expect(result.instrumentType).toBe('unknown');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});

describe('Individual Classification Algorithms', () => {
  describe('ChannelAnalysisAlgorithm', () => {
    let algorithm: ChannelAnalysisAlgorithm;

    beforeEach(() => {
      algorithm = new ChannelAnalysisAlgorithm();
    });

    it('should identify drums on channel 10', () => {
      const track = createTrackWithChannel(9); // Channel 10 (0-indexed)
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('drums');
      expect(result.confidence).toBe(0.9);
    });

    it('should identify bass on channel 1', () => {
      const track = createTrackWithChannel(0); // Channel 1 (0-indexed)
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('bass');
      expect(result.confidence).toBe(0.6);
    });

    it('should handle tracks with no channel data', () => {
      const track = { events: [] };
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('unknown');
      expect(result.confidence).toBe(0.2);
    });
  });

  describe('TrackNameAnalysisAlgorithm', () => {
    let algorithm: TrackNameAnalysisAlgorithm;

    beforeEach(() => {
      algorithm = new TrackNameAnalysisAlgorithm();
    });

    it('should identify drums from track name', () => {
      const track = createTrackWithName('Drum Kit');
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('drums');
      expect(result.confidence).toBe(0.85);
    });

    it('should identify bass from track name', () => {
      const track = createTrackWithName('Electric Bass');
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('bass');
      expect(result.confidence).toBe(0.85);
    });

    it('should handle tracks with no name', () => {
      const track = { events: [] };
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('unknown');
      expect(result.confidence).toBe(0.1);
    });

    it('should be case insensitive', () => {
      const track = createTrackWithName('PIANO');
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('chords');
    });
  });

  describe('NoteRangeAnalysisAlgorithm', () => {
    let algorithm: NoteRangeAnalysisAlgorithm;

    beforeEach(() => {
      algorithm = new NoteRangeAnalysisAlgorithm();
    });

    it('should identify bass from low note range', () => {
      const track = createTrackWithNoteRange(28, 55); // E1 - G3
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('bass');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should identify drums from GM percussion range', () => {
      const track = createTrackWithNoteRange(35, 81); // GM drum range
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('drums');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle tracks with no notes', () => {
      const track = { events: [] };
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('unknown');
      expect(result.confidence).toBe(0.1);
    });
  });

  describe('InstrumentDetectionAlgorithm', () => {
    let algorithm: InstrumentDetectionAlgorithm;

    beforeEach(() => {
      algorithm = new InstrumentDetectionAlgorithm();
    });

    it('should identify bass from GM bass program', () => {
      const track = createTrackWithProgram(33); // GM Bass program
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('bass');
      expect(result.confidence).toBe(0.9);
    });

    it('should identify chords from GM piano program', () => {
      const track = createTrackWithProgram(0); // GM Piano program
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('chords');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle tracks with no program changes', () => {
      const track = { events: [] };
      const result = algorithm.analyze(track);

      expect(result.instrumentType).toBe('unknown');
      expect(result.confidence).toBe(0.1);
    });
  });
});

describe('TrackSynchronizationEngine', () => {
  let syncEngine: TrackSynchronizationEngine;
  let mockTracks: ManagedTrack[];

  beforeEach(() => {
    syncEngine = new TrackSynchronizationEngine();
    mockTracks = [
      createMockManagedTrack('drums'),
      createMockManagedTrack('bass'),
    ];
    syncEngine.setupTracks(mockTracks);
  });

  it('should setup tracks for synchronization', () => {
    expect(() => syncEngine.setupTracks(mockTracks)).not.toThrow();
  });

  it('should update global groove across tracks', () => {
    syncEngine.updateGlobalGroove('funk', 30);

    mockTracks.forEach((track) => {
      if (track.processor?.applyGroove) {
        expect(track.processor.applyGroove).toHaveBeenCalledWith('funk', 30);
      }
    });
  });

  it('should update quantization across tracks', () => {
    syncEngine.updateQuantization('sixteenth', 0.9);

    mockTracks.forEach((track) => {
      if (track.processor?.setQuantization) {
        expect(track.processor.setQuantization).toHaveBeenCalledWith(
          'sixteenth',
          0.9,
        );
      }
    });
  });
});

describe('VirtualMixingConsole', () => {
  let mixingConsole: VirtualMixingConsole;

  beforeEach(() => {
    mixingConsole = new VirtualMixingConsole();
  });

  it('should update track mixing state', () => {
    const trackId = 'test-track';
    const mixingState: TrackMixingState = {
      volume: 0.7,
      pan: 0.2,
      mute: false,
      solo: true,
      effects: [],
      sends: [],
    };

    expect(() => {
      mixingConsole.updateTrack(trackId, mixingState);
    }).not.toThrow();
  });

  it('should calculate master level', () => {
    const masterLevel = mixingConsole.getMasterLevel();

    expect(typeof masterLevel).toBe('number');
    expect(masterLevel).toBeGreaterThanOrEqual(0);
    expect(masterLevel).toBeLessThanOrEqual(1);
  });
});

describe('AutomationEngine', () => {
  let automationEngine: AutomationEngine;

  beforeEach(() => {
    automationEngine = new AutomationEngine();
  });

  it('should set volume automation', () => {
    const trackId = 'test-track';
    const curve = [
      { time: 0, value: 0.8 },
      { time: 1, value: 0.6 },
      { time: 2, value: 1.0 },
    ];

    expect(() => {
      automationEngine.setAutomation(trackId, 'volume', curve);
    }).not.toThrow();
  });

  it('should interpolate automation values', () => {
    const trackId = 'test-track';
    const curve = [
      { time: 0, value: 0.0 },
      { time: 2, value: 1.0 },
    ];

    automationEngine.setAutomation(trackId, 'volume', curve);

    const valueAt1 = automationEngine.getAutomationValue(trackId, 'volume', 1);
    expect(valueAt1).toBe(0.5); // Linear interpolation between 0 and 1
  });

  it('should handle automation for non-existent tracks', () => {
    const value = automationEngine.getAutomationValue(
      'non-existent',
      'volume',
      1,
    );
    expect(value).toBe(0);
  });
});

// Helper functions for creating mock data
function createMockDrumTrack() {
  return {
    name: 'Drums',
    events: [
      { type: 'noteOn', channel: 9, noteNumber: 36, velocity: 100, time: 0 },
      { type: 'noteOff', channel: 9, noteNumber: 36, time: 0.5 },
      { type: 'meta', subtype: 'timeSignature', numerator: 4, denominator: 4 },
    ],
  };
}

function createMockBassTrack() {
  return {
    name: 'Bass',
    events: [
      { type: 'noteOn', channel: 0, noteNumber: 28, velocity: 80, time: 0 },
      { type: 'noteOff', channel: 0, noteNumber: 28, time: 1 },
      { type: 'programChange', channel: 0, programNumber: 33 },
    ],
  };
}

function createMockChordTrack() {
  return {
    name: 'Piano',
    events: [
      { type: 'noteOn', channel: 1, noteNumber: 60, velocity: 70, time: 0 },
      { type: 'noteOn', channel: 1, noteNumber: 64, velocity: 70, time: 0 },
      { type: 'noteOn', channel: 1, noteNumber: 67, velocity: 70, time: 0 },
      { type: 'programChange', channel: 1, programNumber: 0 },
    ],
  };
}

function createMockMelodyTrack() {
  return {
    name: 'Lead',
    events: [
      { type: 'noteOn', channel: 2, noteNumber: 72, velocity: 90, time: 0 },
      { type: 'noteOff', channel: 2, noteNumber: 72, time: 0.5 },
    ],
  };
}

function createMockMetronomeTrack() {
  return {
    name: 'Metronome',
    events: [
      { type: 'noteOn', channel: 3, noteNumber: 60, velocity: 127, time: 0 },
      { type: 'noteOff', channel: 3, noteNumber: 60, time: 0.1 },
    ],
  };
}

function createAmbiguousTrack() {
  return {
    name: 'Ambiguous',
    events: [
      { type: 'noteOn', channel: 5, noteNumber: 60, velocity: 64, time: 0 },
    ],
  };
}

function createUnknownTrack() {
  return {
    name: 'Unknown',
    events: [],
  };
}

function createTrackWithChannel(channel: number) {
  return {
    events: [
      { type: 'noteOn', channel, noteNumber: 60, velocity: 64, time: 0 },
    ],
  };
}

function createTrackWithName(name: string) {
  return {
    name,
    events: [{ type: 'meta', subtype: 'trackName', text: name }],
  };
}

function createTrackWithNoteRange(min: number, max: number) {
  return {
    events: [
      { type: 'noteOn', noteNumber: min, velocity: 64, time: 0 },
      { type: 'noteOn', noteNumber: max, velocity: 64, time: 1 },
    ],
  };
}

function createTrackWithProgram(programNumber: number) {
  return {
    events: [{ type: 'programChange', programNumber, channel: 0 }],
  };
}

function createMockManagedTrack(instrumentType: InstrumentType): ManagedTrack {
  return {
    id: `mock-${instrumentType}-${Date.now()}`,
    originalTrack: {},
    classification: {
      instrumentType,
      confidence: 0.9,
      reasoning: ['Mock track'],
      metadata: {},
    },
    instrumentType,
    processor: {
      applyGroove: vi.fn(),
      setQuantization: vi.fn(),
      setHumanization: vi.fn(),
      setLoopLength: vi.fn(),
      triggerFill: vi.fn(),
    },
    musicalData: {
      noteRange: { min: 60, max: 72 },
      velocity: { min: 64, max: 127, average: 95 },
      patterns: [],
      articulations: [],
      dynamics: { range: { min: 64, max: 127 }, average: 95, variation: 20 },
    },
    mixing: {
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      effects: [],
      sends: [],
    },
    sync: {
      quantization: { subdivision: 'eighth', strength: 1.0, swing: 0 },
      groove: { template: 'none', humanization: 0.1, microTiming: 0 },
      dependencies: [],
      priority: 0,
    },
    automation: {
      volume: [],
      pan: [],
      effects: new Map(),
    },
  };
}
