/**
 * N8nPayloadProcessor Behavior Tests
 *
 * Tests the AI workflow processing behaviors including asset manifest extraction,
 * payload validation, caching, and Epic 2 architecture coordination.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { N8nPayloadProcessor } from '../N8nPayloadProcessor.js';

// Type definitions for tests
interface N8nPayloadConfig {
  tutorialSpecificMidi: {
    basslineUrl: string;
    chordsUrl: string;
  };
  libraryMidi: {
    drumPatternId: string;
    metronomeStyleId?: string;
  };
  audioSamples: {
    bassNotes: string[];
    drumHits: string[];
    ambienceTrack?: string;
  };
  synchronization: {
    bpm: number;
    timeSignature: string;
    keySignature: string;
  };
}

interface AssetManifest {
  assets: Array<{
    type: 'midi' | 'audio';
    category: string;
    url: string;
    priority: 'high' | 'medium' | 'low';
    noteIndex?: number;
    drumPiece?: string;
  }>;
  totalCount: number;
  estimatedLoadTime: number;
}

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock console to prevent test noise
  global.console = {
    ...global.console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
};

// Scenario Builders for Epic 2 AI Workflows
const createCompleteN8nPayload = (): N8nPayloadConfig => ({
  tutorialSpecificMidi: {
    basslineUrl: 'https://cdn.bassnotion.com/midi/bassline-lesson-1.mid',
    chordsUrl: 'https://cdn.bassnotion.com/midi/chords-lesson-1.mid',
  },
  libraryMidi: {
    drumPatternId: 'rock-basic-4-4',
    metronomeStyleId: 'classic-click',
  },
  audioSamples: {
    bassNotes: [
      'https://cdn.bassnotion.com/samples/bass-e1.wav',
      'https://cdn.bassnotion.com/samples/bass-a1.wav',
      'https://cdn.bassnotion.com/samples/bass-d2.wav',
      'https://cdn.bassnotion.com/samples/bass-g2.wav',
    ],
    drumHits: [
      'https://cdn.bassnotion.com/samples/kick-808.wav',
      'https://cdn.bassnotion.com/samples/snare-crisp.wav',
      'https://cdn.bassnotion.com/samples/hihat-closed.wav',
    ],
    ambienceTrack: 'https://cdn.bassnotion.com/ambient/studio-room.wav',
  },
  synchronization: {
    bpm: 120,
    timeSignature: '4/4',
    keySignature: 'C major',
  },
});

const createMinimalN8nPayload = (): N8nPayloadConfig => ({
  tutorialSpecificMidi: {
    basslineUrl: 'https://cdn.bassnotion.com/midi/bassline-basic.mid',
    chordsUrl: 'https://cdn.bassnotion.com/midi/chords-basic.mid',
  },
  libraryMidi: {
    drumPatternId: 'simple-beat',
  },
  audioSamples: {
    bassNotes: ['https://cdn.bassnotion.com/samples/bass-basic.wav'],
    drumHits: [],
  },
  synchronization: {
    bpm: 100,
    timeSignature: '4/4',
    keySignature: 'C major',
  },
});

const createInvalidN8nPayload = (): Partial<N8nPayloadConfig> => ({
  tutorialSpecificMidi: {
    basslineUrl: '', // Invalid empty URL
    chordsUrl: 'https://cdn.bassnotion.com/midi/chords.mid',
  },
  libraryMidi: {
    drumPatternId: '', // Invalid empty ID
  },
  audioSamples: {
    bassNotes: [], // No bass samples
    drumHits: [],
  },
  synchronization: {
    bpm: -50, // Invalid negative BPM
    timeSignature: '',
    keySignature: '',
  },
});

const createLargePayload = (): N8nPayloadConfig => ({
  tutorialSpecificMidi: {
    basslineUrl: 'https://cdn.bassnotion.com/midi/complex-bassline.mid',
    chordsUrl: 'https://cdn.bassnotion.com/midi/jazz-chords.mid',
  },
  libraryMidi: {
    drumPatternId: 'complex-jazz-pattern',
    metronomeStyleId: 'woodblock-subdivisions',
  },
  audioSamples: {
    bassNotes: Array.from(
      { length: 88 },
      (_, i) => `https://cdn.bassnotion.com/samples/bass-note-${i + 1}.wav`,
    ),
    drumHits: Array.from(
      { length: 20 },
      (_, i) => `https://cdn.bassnotion.com/samples/drum-${i + 1}.wav`,
    ),
    ambienceTrack: 'https://cdn.bassnotion.com/ambient/concert-hall.wav',
  },
  synchronization: {
    bpm: 140,
    timeSignature: '7/8',
    keySignature: 'Bb minor',
  },
});

// Mock Audio Data
const createMockAudioBuffer = () => {
  const buffer = new ArrayBuffer(1024);
  return buffer;
};

const createMockWebAudioBuffer = () => {
  // Mock AudioBuffer for testing
  return {
    length: 1024,
    numberOfChannels: 2,
    sampleRate: 44100,
    duration: 0.023,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
  } as unknown as AudioBuffer;
};

// Test Helpers
const expectValidAssetManifest = (manifest: AssetManifest) => {
  expect(manifest).toBeDefined();
  expect(typeof manifest.totalCount).toBe('number');
  expect(typeof manifest.estimatedLoadTime).toBe('number');
  expect(Array.isArray(manifest.assets)).toBe(true);
  expect(manifest.totalCount).toBe(manifest.assets.length);
  expect(manifest.estimatedLoadTime).toBeGreaterThanOrEqual(0);

  manifest.assets.forEach((asset) => {
    expect(asset).toBeDefined();
    expect(['midi', 'audio']).toContain(asset.type);
    expect([
      'bassline',
      'chords',
      'drums',
      'metronome',
      'bass-sample',
      'drum-sample',
      'ambience',
    ]).toContain(asset.category);
    expect(typeof asset.url).toBe('string');
    expect(asset.url.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(asset.priority);
  });
};

const expectValidLoadingState = (state: any) => {
  expect(state).toBeDefined();
  expect(state.midiFiles).toBeInstanceOf(Map);
  expect(state.audioSamples).toBeInstanceOf(Map);
  expect(typeof state.totalAssets).toBe('number');
  expect(typeof state.loadedAssets).toBe('number');
  expect(state.loadedAssets).toBeLessThanOrEqual(state.totalAssets);
  expect(state.totalAssets).toBeGreaterThanOrEqual(0);
  expect(state.loadedAssets).toBeGreaterThanOrEqual(0);
};

const expectValidValidationResult = (result: any) => {
  expect(result).toBeDefined();
  expect(typeof result.isValid).toBe('boolean');
  expect(Array.isArray(result.errors)).toBe(true);
  expect(Array.isArray(result.warnings)).toBe(true);

  result.errors.forEach((error: any) => {
    expect(typeof error).toBe('string');
    expect(error.length).toBeGreaterThan(0);
  });

  result.warnings.forEach((warning: any) => {
    expect(typeof warning).toBe('string');
    expect(warning.length).toBeGreaterThan(0);
  });
};

// Behavior Tests
describe('N8nPayloadProcessor Behaviors', () => {
  let processor: N8nPayloadProcessor;

  beforeEach(() => {
    setupTestEnvironment();
    // Reset singleton for each test
    (N8nPayloadProcessor as any).instance = null;
    processor = N8nPayloadProcessor.getInstance();
  });

  afterEach(() => {
    processor.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization Behaviors', () => {
    it('should provide singleton instance', () => {
      const instance1 = N8nPayloadProcessor.getInstance();
      const instance2 = N8nPayloadProcessor.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(N8nPayloadProcessor);
    });

    it('should initialize with default configuration', () => {
      const config = processor.getConfig();

      expect(config).toBeDefined();
      expect(typeof config.enableCaching).toBe('boolean');
      expect(typeof config.maxCacheSize).toBe('number');
      expect(typeof config.assetTimeout).toBe('number');
      expect(typeof config.retryAttempts).toBe('number');
      expect(typeof config.fallbackEnabled).toBe('boolean');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        enableCaching: false,
        maxCacheSize: 50 * 1024 * 1024,
        assetTimeout: 15000,
        retryAttempts: 5,
        fallbackEnabled: false,
      };

      const customProcessor = N8nPayloadProcessor.getInstance(customConfig);
      const resultConfig = customProcessor.getConfig();

      expect(resultConfig.enableCaching).toBe(false);
      expect(resultConfig.maxCacheSize).toBe(50 * 1024 * 1024);
      expect(resultConfig.assetTimeout).toBe(15000);
    });

    it('should track loading state from initialization', () => {
      const state = processor.getLoadingState();

      expectValidLoadingState(state);
      expect(state.totalAssets).toBe(0);
      expect(state.loadedAssets).toBe(0);
    });
  });

  describe('Asset Manifest Extraction Behaviors', () => {
    it('should extract complete asset manifest from full payload', () => {
      const payload = createCompleteN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      expectValidAssetManifest(manifest);
      expect(manifest.totalCount).toBeGreaterThan(8); // MIDI + bass + drums + ambience

      // Verify Epic 2 Section 9 - Tutorial MIDI assets
      const basslineAsset = manifest.assets.find(
        (a) => a.category === 'bassline',
      );
      const chordsAsset = manifest.assets.find((a) => a.category === 'chords');
      expect(basslineAsset).toBeDefined();
      expect(chordsAsset).toBeDefined();
      expect(basslineAsset?.priority).toBe('high');
      expect(chordsAsset?.priority).toBe('high');

      // Verify library MIDI assets
      const drumAsset = manifest.assets.find((a) => a.category === 'drums');
      const metronomeAsset = manifest.assets.find(
        (a) => a.category === 'metronome',
      );
      expect(drumAsset).toBeDefined();
      expect(metronomeAsset).toBeDefined();

      // Verify Epic 2 Section 7.2 - Audio samples
      const bassSamples = manifest.assets.filter(
        (a) => a.category === 'bass-sample',
      );
      const drumSamples = manifest.assets.filter(
        (a) => a.category === 'drum-sample',
      );
      expect(bassSamples.length).toBe(4);
      expect(drumSamples.length).toBe(3);

      // Verify Epic 2 Section 7.5 - Ambience
      const ambienceAsset = manifest.assets.find(
        (a) => a.category === 'ambience',
      );
      expect(ambienceAsset).toBeDefined();
      expect(ambienceAsset?.priority).toBe('low');
    });

    it('should handle minimal payload gracefully', () => {
      const payload = createMinimalN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      expectValidAssetManifest(manifest);
      expect(manifest.totalCount).toBeGreaterThanOrEqual(3); // bassline + chords + drums minimum

      // Should still include required tutorial MIDI
      const basslineAsset = manifest.assets.find(
        (a) => a.category === 'bassline',
      );
      const chordsAsset = manifest.assets.find((a) => a.category === 'chords');
      expect(basslineAsset).toBeDefined();
      expect(chordsAsset).toBeDefined();
    });

    it('should assign correct priorities to asset types', () => {
      const payload = createCompleteN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      // Tutorial MIDI should be high priority
      const tutorialAssets = manifest.assets.filter(
        (a) => a.category === 'bassline' || a.category === 'chords',
      );
      tutorialAssets.forEach((asset) => {
        expect(asset.priority).toBe('high');
      });

      // Bass samples should be high priority
      const bassSamples = manifest.assets.filter(
        (a) => a.category === 'bass-sample',
      );
      bassSamples.forEach((asset) => {
        expect(asset.priority).toBe('high');
      });

      // Drum and metronome should be medium priority
      const mediumAssets = manifest.assets.filter(
        (a) =>
          a.category === 'drums' ||
          a.category === 'metronome' ||
          a.category === 'drum-sample',
      );
      mediumAssets.forEach((asset) => {
        expect(asset.priority).toBe('medium');
      });

      // Ambience should be low priority
      const ambienceAssets = manifest.assets.filter(
        (a) => a.category === 'ambience',
      );
      ambienceAssets.forEach((asset) => {
        expect(asset.priority).toBe('low');
      });
    });

    it('should calculate realistic load time estimates', () => {
      const smallPayload = createMinimalN8nPayload();
      const largePayload = createLargePayload();

      const smallManifest = processor.extractAssetManifest(smallPayload as any);
      const largeManifest = processor.extractAssetManifest(largePayload as any);

      expect(smallManifest.estimatedLoadTime).toBeGreaterThan(0);
      expect(largeManifest.estimatedLoadTime).toBeGreaterThan(
        smallManifest.estimatedLoadTime,
      );
    });

    it('should update loading state when extracting manifest', () => {
      const payload = createCompleteN8nPayload();

      const initialState = processor.getLoadingState();
      expect(initialState.totalAssets).toBe(0);

      const manifest = processor.extractAssetManifest(payload as any);

      const updatedState = processor.getLoadingState();
      expect(updatedState.totalAssets).toBe(manifest.totalCount);
      expect(updatedState.loadedAssets).toBe(0);
    });
  });

  describe('Payload Validation Behaviors', () => {
    it('should validate complete payload as valid', () => {
      const payload = createCompleteN8nPayload();

      const result = processor.validatePayload(payload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing tutorial MIDI URLs', () => {
      const payload = createCompleteN8nPayload();
      payload.tutorialSpecificMidi.basslineUrl = '';
      payload.tutorialSpecificMidi.chordsUrl = '';

      const result = processor.validatePayload(payload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing bassline URL in tutorial MIDI');
      expect(result.errors).toContain('Missing chords URL in tutorial MIDI');
    });

    it('should detect missing library MIDI IDs', () => {
      const payload = createCompleteN8nPayload();
      payload.libraryMidi.drumPatternId = '';

      const result = processor.validatePayload(payload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Missing drum pattern ID in library MIDI',
      );
    });

    it('should warn about missing optional components', () => {
      const payload = createCompleteN8nPayload();
      delete payload.libraryMidi.metronomeStyleId;
      payload.audioSamples.drumHits = [];

      const result = processor.validatePayload(payload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(true); // Still valid without optional components
      expect(result.warnings).toContain(
        'Missing metronome style ID - using default',
      );
      expect(result.warnings).toContain('No drum hit samples provided');
    });

    it('should validate synchronization settings', () => {
      const invalidPayload = createInvalidN8nPayload() as N8nPayloadConfig;

      const result = processor.validatePayload(invalidPayload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid BPM in synchronization settings',
      );
      expect(result.warnings).toContain(
        'Missing time signature - using 4/4 default',
      );
      expect(result.warnings).toContain(
        'Missing key signature - using C major default',
      );
    });

    it('should detect missing audio samples', () => {
      const payload = createCompleteN8nPayload();
      payload.audioSamples.bassNotes = [];

      const result = processor.validatePayload(payload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No bass note samples provided');
    });

    it('should provide comprehensive validation for complex payloads', () => {
      const largePayload = createLargePayload();

      const result = processor.validatePayload(largePayload as any);

      expectValidValidationResult(result);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Asset Caching Behaviors', () => {
    it('should cache loaded assets', () => {
      const testUrl = 'https://cdn.bassnotion.com/test-audio.wav';
      const mockData = createMockAudioBuffer();

      processor.markAssetLoaded(testUrl, mockData);

      const cachedData = processor.getCachedAsset(testUrl);
      expect(cachedData).toBe(mockData);
    });

    it('should return null for non-cached assets', () => {
      const nonExistentUrl = 'https://cdn.bassnotion.com/non-existent.wav';

      const cachedData = processor.getCachedAsset(nonExistentUrl);

      expect(cachedData).toBeNull();
    });

    it('should track cache size accurately', () => {
      const initialSize = processor.getCacheSize();
      expect(initialSize).toBe(0);

      const testUrl = 'https://cdn.bassnotion.com/test.wav';
      const mockData = createMockAudioBuffer();

      processor.markAssetLoaded(testUrl, mockData);

      const newSize = processor.getCacheSize();
      expect(newSize).toBeGreaterThan(initialSize);
    });

    it('should handle different asset types in cache', () => {
      const audioUrl = 'https://cdn.bassnotion.com/audio.wav';
      const audioData = createMockAudioBuffer();
      const webAudioUrl = 'https://cdn.bassnotion.com/webaudio.wav';
      const webAudioData = createMockWebAudioBuffer();

      processor.markAssetLoaded(audioUrl, audioData);
      processor.markAssetLoaded(webAudioUrl, webAudioData);

      expect(processor.getCachedAsset(audioUrl)).toBe(audioData);
      expect(processor.getCachedAsset(webAudioUrl)).toBe(webAudioData);
    });

    it('should clear cache completely', () => {
      const testUrl = 'https://cdn.bassnotion.com/test.wav';
      const mockData = createMockAudioBuffer();

      processor.markAssetLoaded(testUrl, mockData);
      expect(processor.getCachedAsset(testUrl)).toBe(mockData);
      expect(processor.getCacheSize()).toBeGreaterThan(0);

      processor.clearCache();

      expect(processor.getCachedAsset(testUrl)).toBeNull();
      expect(processor.getCacheSize()).toBe(0);
    });
  });

  describe('Loading Progress Behaviors', () => {
    it('should track loading progress accurately', () => {
      const payload = createCompleteN8nPayload();
      processor.extractAssetManifest(payload as any);

      const initialProgress = processor.getLoadingProgress();
      expect(initialProgress).toBe(0);

      // Mark some assets as loaded
      processor.markAssetLoaded('test-url-1', createMockAudioBuffer());
      processor.markAssetLoaded('test-url-2', createMockAudioBuffer());

      const updatedProgress = processor.getLoadingProgress();
      expect(updatedProgress).toBeGreaterThan(0);
      expect(updatedProgress).toBeLessThanOrEqual(100);
    });

    it('should update loading state when assets are marked loaded', () => {
      const payload = createMinimalN8nPayload();
      processor.extractAssetManifest(payload as any);

      const initialState = processor.getLoadingState();
      const initialLoaded = initialState.loadedAssets;

      processor.markAssetLoaded('test-url', createMockAudioBuffer());

      const updatedState = processor.getLoadingState();
      expect(updatedState.loadedAssets).toBe(initialLoaded + 1);
    });

    it('should handle loading state with no assets', () => {
      const progress = processor.getLoadingProgress();
      expect(progress).toBe(0);

      const state = processor.getLoadingState();
      expect(state.totalAssets).toBe(0);
      expect(state.loadedAssets).toBe(0);
    });

    it('should maintain loading state integrity', () => {
      const payload = createLargePayload();
      const manifest = processor.extractAssetManifest(payload as any);

      // Load all assets
      manifest.assets.forEach((asset, index) => {
        processor.markAssetLoaded(
          `${asset.url}-${index}`,
          createMockAudioBuffer(),
        );
      });

      const finalProgress = processor.getLoadingProgress();
      const finalState = processor.getLoadingState();

      expect(finalState.loadedAssets).toBeLessThanOrEqual(
        finalState.totalAssets,
      );
      expect(finalProgress).toBeLessThanOrEqual(100);
    });
  });

  describe('Configuration Management Behaviors', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        enableCaching: false,
        maxCacheSize: 200 * 1024 * 1024,
        assetTimeout: 60000,
      };

      processor.updateConfig(newConfig);

      const config = processor.getConfig();
      expect(config.enableCaching).toBe(false);
      expect(config.maxCacheSize).toBe(200 * 1024 * 1024);
      expect(config.assetTimeout).toBe(60000);
    });

    it('should merge partial configuration updates', () => {
      const originalConfig = processor.getConfig();
      const originalRetries = originalConfig.retryAttempts;

      processor.updateConfig({ assetTimeout: 45000 });

      const updatedConfig = processor.getConfig();
      expect(updatedConfig.assetTimeout).toBe(45000);
      expect(updatedConfig.retryAttempts).toBe(originalRetries); // Unchanged
    });

    it('should maintain configuration consistency', () => {
      processor.updateConfig({
        enableCaching: true,
        maxCacheSize: 0, // Edge case
      });

      const config = processor.getConfig();
      expect(config.enableCaching).toBe(true);
      expect(config.maxCacheSize).toBe(0);
    });
  });

  describe('Epic 2 Architecture Integration Behaviors', () => {
    it('should support Epic 2 Section 9 tutorial MIDI workflow', () => {
      const payload = createCompleteN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      // Epic 2 requires bassline and chords as high-priority tutorial MIDI
      const tutorialMidi = manifest.assets.filter(
        (a) => a.category === 'bassline' || a.category === 'chords',
      );

      expect(tutorialMidi.length).toBe(2);
      tutorialMidi.forEach((asset) => {
        expect(asset.type).toBe('midi');
        expect(asset.priority).toBe('high');
        expect(asset.url).toContain('bassnotion.com');
      });
    });

    it('should support Epic 2 Section 7.2 audio samples workflow', () => {
      const payload = createCompleteN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      // Epic 2 requires bass notes and drum hits
      const bassSamples = manifest.assets.filter(
        (a) => a.category === 'bass-sample',
      );
      const drumSamples = manifest.assets.filter(
        (a) => a.category === 'drum-sample',
      );

      expect(bassSamples.length).toBeGreaterThan(0);
      expect(drumSamples.length).toBeGreaterThan(0);

      bassSamples.forEach((asset) => {
        expect(asset.type).toBe('audio');
        expect(asset.priority).toBe('high');
        expect(typeof asset.noteIndex).toBe('number');
      });

      drumSamples.forEach((asset) => {
        expect(asset.type).toBe('audio');
        expect(asset.priority).toBe('medium');
        expect(typeof asset.drumPiece).toBe('string');
      });
    });

    it('should support Epic 2 Section 7.5 ambience workflow', () => {
      const payload = createCompleteN8nPayload();

      const manifest = processor.extractAssetManifest(payload as any);

      const ambienceAssets = manifest.assets.filter(
        (a) => a.category === 'ambience',
      );
      expect(ambienceAssets.length).toBe(1);

      const ambienceAsset = ambienceAssets[0];
      expect(ambienceAsset?.type).toBe('audio');
      expect(ambienceAsset?.priority).toBe('low');
    });

    it('should handle complex Epic 2 workflows with many assets', () => {
      const largePayload = createLargePayload();

      const manifest = processor.extractAssetManifest(largePayload as any);
      const validation = processor.validatePayload(largePayload as any);

      expect(manifest.totalCount).toBeGreaterThan(100); // 88 bass + 20 drums + MIDI + ambience
      expect(validation.isValid).toBe(true);
      expect(manifest.estimatedLoadTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Behaviors', () => {
    it('should handle malformed payload gracefully', () => {
      const malformedPayload = {} as N8nPayloadConfig;

      expect(() =>
        processor.validatePayload(malformedPayload as any),
      ).not.toThrow();

      const result = processor.validatePayload(malformedPayload as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle asset caching with invalid data', () => {
      const invalidUrl = '';
      const validData = createMockAudioBuffer();

      expect(() =>
        processor.markAssetLoaded(invalidUrl, validData),
      ).not.toThrow();

      const cached = processor.getCachedAsset(invalidUrl);
      expect(cached).toBe(validData); // Should still cache even with empty URL
    });

    it('should handle configuration with invalid values', () => {
      const invalidConfig = {
        maxCacheSize: -1000,
        assetTimeout: -5000,
        retryAttempts: -10,
      };

      expect(() => processor.updateConfig(invalidConfig)).not.toThrow();

      const config = processor.getConfig();
      expect(config.maxCacheSize).toBe(-1000); // Accepts but doesn't validate
    });

    it('should handle asset manifest with empty payload', () => {
      const emptyPayload = {
        tutorialSpecificMidi: { basslineUrl: '', chordsUrl: '' },
        libraryMidi: { drumPatternId: '' },
        audioSamples: { bassNotes: [], drumHits: [] },
        synchronization: { bpm: 0, timeSignature: '', keySignature: '' },
      } as N8nPayloadConfig;

      expect(() =>
        processor.extractAssetManifest(emptyPayload as any),
      ).not.toThrow();

      const manifest = processor.extractAssetManifest(emptyPayload as any);
      expectValidAssetManifest(manifest);
    });
  });

  describe('Lifecycle Management Behaviors', () => {
    it('should dispose cleanly', () => {
      const testUrl = 'https://cdn.bassnotion.com/test.wav';
      processor.markAssetLoaded(testUrl, createMockAudioBuffer());

      expect(processor.getCacheSize()).toBeGreaterThan(0);

      processor.dispose();

      // Should clear internal state
      expect(() => processor.getLoadingState()).not.toThrow();
    });

    it('should handle multiple dispose calls', () => {
      processor.dispose();
      processor.dispose();
      processor.dispose();

      // Should not throw errors
      expect(() => processor.getConfig()).not.toThrow();
    });

    it('should maintain functionality after configuration changes', () => {
      processor.updateConfig({ enableCaching: false });

      const payload = createCompleteN8nPayload();
      const manifest = processor.extractAssetManifest(payload as any);
      const validation = processor.validatePayload(payload as any);

      expectValidAssetManifest(manifest);
      expectValidValidationResult(validation);
    });

    it('should handle rapid successive operations', () => {
      const payload = createCompleteN8nPayload();

      // Rapid operations
      for (let i = 0; i < 10; i++) {
        processor.extractAssetManifest(payload as any);
        processor.validatePayload(payload as any);
        processor.markAssetLoaded(`test-${i}`, createMockAudioBuffer());
      }

      const state = processor.getLoadingState();
      const progress = processor.getLoadingProgress();

      expectValidLoadingState(state);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });
});
