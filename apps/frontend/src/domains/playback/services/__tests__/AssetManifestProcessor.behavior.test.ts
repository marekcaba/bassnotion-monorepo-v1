/**
 * AssetManifestProcessor Behavior Tests
 *
 * Tests the asset manifest processing behaviors including dependency resolution,
 * optimization strategies, loading prioritization, and validation.
 *
 * Enhanced with Epic 2 workflow specifics, performance testing, and edge cases.
 *
 * Focus: What the service DOES, not how it's implemented
 */

import { describe, test, expect, beforeEach } from 'vitest';
import type {
  AssetManifest,
  AssetReference,
  ProcessedAssetManifest,
  AssetDependency,
  AssetOptimization,
  AssetLoadingGroup,
} from '../../types/audio.js';
import { AssetManifestProcessor } from '../AssetManifestProcessor.js';

// Test Environment Setup
const setupTestEnvironment = () => {
  // Mock navigator for device detection
  const mockConnection = {
    effectiveType: '4g',
  };

  (global as any).navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    connection: mockConnection,
  };

  // Mock Audio constructor for format detection
  (global as any).Audio = function () {
    return {
      canPlayType: (type: string) => {
        if (type.includes('ogg')) return 'probably';
        if (type.includes('webm')) return 'maybe';
        if (type.includes('flac')) return '';
        return 'probably';
      },
    };
  };
};

// Epic 2 Workflow Mock Data
const createEpic2AssetManifest = (): AssetManifest => ({
  assets: [
    // Tutorial MIDI files
    {
      type: 'midi',
      category: 'bassline',
      url: 'https://cdn.example.com/bassline.mid',
      priority: 'high',
    },
    {
      type: 'midi',
      category: 'chords',
      url: 'https://cdn.example.com/chords.mid',
      priority: 'high',
    },
    // Library MIDI
    {
      type: 'midi',
      category: 'drums',
      url: 'https://cdn.example.com/drums.mid',
      priority: 'medium',
    },
    {
      type: 'midi',
      category: 'metronome',
      url: 'https://cdn.example.com/metronome.mid',
      priority: 'medium',
    },
    // Audio samples
    {
      type: 'audio',
      category: 'bass-sample',
      url: 'https://cdn.example.com/bass-c.wav',
      priority: 'high',
      noteIndex: 0,
    },
    {
      type: 'audio',
      category: 'bass-sample',
      url: 'https://cdn.example.com/bass-e.wav',
      priority: 'high',
      noteIndex: 1,
    },
    {
      type: 'audio',
      category: 'drum-sample',
      url: 'https://cdn.example.com/kick.wav',
      priority: 'medium',
      drumPiece: 'kick',
    },
    {
      type: 'audio',
      category: 'drum-sample',
      url: 'https://cdn.example.com/snare.wav',
      priority: 'medium',
      drumPiece: 'snare',
    },
    // Optional ambience
    {
      type: 'audio',
      category: 'ambience',
      url: 'https://cdn.example.com/ambience.wav',
      priority: 'low',
    },
  ],
  totalCount: 9,
  estimatedLoadTime: 2500,
});

// Scenario Builders
const createAssetManifest = (
  options: {
    includeMidi?: boolean;
    includeAudio?: boolean;
    includeDependencies?: boolean;
    includeAmbience?: boolean;
    assetCount?: number;
  } = {},
): AssetManifest => {
  const assets: AssetReference[] = [];

  if (options.includeMidi !== false) {
    assets.push(
      {
        type: 'midi',
        category: 'chords',
        url: 'https://example.com/chords.mid',
        priority: 'high',
      },
      {
        type: 'midi',
        category: 'bassline',
        url: 'https://example.com/bassline.mid',
        priority: 'high',
      },
      {
        type: 'midi',
        category: 'drums',
        url: 'https://example.com/drums.mid',
        priority: 'medium',
      },
    );
  }

  if (options.includeAudio !== false) {
    assets.push(
      {
        type: 'audio',
        category: 'bass-sample',
        url: 'https://example.com/bass1.wav',
        priority: 'high',
      },
      {
        type: 'audio',
        category: 'bass-sample',
        url: 'https://example.com/bass2.wav',
        priority: 'medium',
      },
      {
        type: 'audio',
        category: 'drum-sample',
        url: 'https://example.com/kick.wav',
        priority: 'high',
      },
    );
  }

  if (options.includeAmbience) {
    assets.push({
      type: 'audio',
      category: 'ambience',
      url: 'https://example.com/ambient.wav',
      priority: 'low',
    });
  }

  return {
    assets: assets.slice(0, options.assetCount || assets.length),
    totalCount: assets.length,
    estimatedLoadTime: 5000,
  };
};

const createMobileEnvironment = () => {
  (global as any).navigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    connection: { effectiveType: '3g' },
  };
};

const createLowEndEnvironment = () => {
  (global as any).navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 4.4.2; SM-G7102)',
    connection: { effectiveType: '2g' },
  };
};

// Test Helpers
const expectManifestProcessed = (
  processed: ProcessedAssetManifest,
  original: AssetManifest,
) => {
  expect(processed.assets).toEqual(original.assets);
  expect(processed.totalCount).toBe(original.totalCount);
  expect(processed.dependencies).toBeDefined();
  expect(processed.loadingGroups).toBeDefined();
  expect(processed.optimizations).toBeDefined();
  expect(processed.totalSize).toBeGreaterThan(0);
  expect(processed.criticalPath).toBeDefined();
};

const expectValidLoadingGroups = (groups: AssetLoadingGroup[]) => {
  expect(groups).toBeInstanceOf(Array);
  expect(groups.length).toBeGreaterThan(0);

  // Should be sorted by priority (descending)
  for (let i = 1; i < groups.length; i++) {
    expect(groups[i - 1]!.priority).toBeGreaterThanOrEqual(groups[i]!.priority);
  }

  // Each group should have valid structure
  groups.forEach((group) => {
    expect(group.id).toBeTruthy();
    expect(group.priority).toBeGreaterThan(0);
    expect(group.assets).toBeInstanceOf(Array);
    expect(typeof group.parallelLoadable).toBe('boolean');
    expect(typeof group.requiredForPlayback).toBe('boolean');
  });
};

const expectValidDependencies = (deps: AssetDependency[]) => {
  expect(deps).toBeInstanceOf(Array);

  deps.forEach((dep) => {
    expect(dep.assetUrl).toBeTruthy();
    expect(dep.dependsOn).toBeInstanceOf(Array);
    expect(['required', 'optional', 'performance']).toContain(
      dep.dependencyType,
    );
  });
};

const expectValidOptimizations = (
  optimizations: Map<string, AssetOptimization>,
) => {
  expect(optimizations).toBeInstanceOf(Map);
  expect(optimizations.size).toBeGreaterThan(0);

  // Check entries using Array.from to avoid iterator issues
  const entries = Array.from(optimizations.entries());
  entries.forEach(([url, optimization]) => {
    expect(url).toBeTruthy();
    expect(['none', 'low', 'medium', 'high']).toContain(
      optimization.compressionLevel,
    );
    expect(['maximum', 'balanced', 'efficient', 'minimal']).toContain(
      optimization.qualityTarget,
    );
    expect(typeof optimization.deviceOptimized).toBe('boolean');
    expect(typeof optimization.networkOptimized).toBe('boolean');
  });
};

// Behavior Tests
describe('AssetManifestProcessor Behaviors', () => {
  let processor: AssetManifestProcessor;

  beforeEach(() => {
    setupTestEnvironment();
    // Reset singleton for each test
    (AssetManifestProcessor as any).instance = undefined;
    processor = AssetManifestProcessor.getInstance();
  });

  describe('Initialization Behaviors', () => {
    test('should provide singleton instance', () => {
      const instance1 = AssetManifestProcessor.getInstance();
      const instance2 = AssetManifestProcessor.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(AssetManifestProcessor);
    });

    test('should detect device capabilities on initialization', () => {
      const instance = AssetManifestProcessor.getInstance();
      expect(instance).toBeDefined();

      // Should handle device detection without errors
      const manifest = createAssetManifest();
      const processed = instance.processManifest(manifest);
      expect(processed.optimizations.size).toBeGreaterThan(0);
    });

    test('should handle missing navigator gracefully', () => {
      delete (global as any).navigator;

      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();

      expect(() => instance.processManifest(manifest)).not.toThrow();
    });

    test('should detect mobile devices correctly', () => {
      createMobileEnvironment();
      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();
      const processed = instance.processManifest(manifest);

      // Mobile optimizations should be applied
      const optimizations = Array.from(processed.optimizations.values());
      expect(optimizations.length).toBeGreaterThan(0);
      expect(optimizations[0]).toBeDefined();
    });

    test('should detect low-end devices', () => {
      createLowEndEnvironment();
      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();
      const processed = instance.processManifest(manifest);

      // All assets should have aggressive optimization
      Array.from(processed.optimizations.values()).forEach((optimization) => {
        expect(optimization.compressionLevel).toBe('high');
        expect(optimization.qualityTarget).toBe('efficient');
      });
    });
  });

  describe('Manifest Processing Behaviors', () => {
    test('should process complete manifest with all components', () => {
      const manifest = createAssetManifest({
        includeMidi: true,
        includeAudio: true,
        includeAmbience: true,
      });

      const processed = processor.processManifest(manifest);

      expectManifestProcessed(processed, manifest);
      expect(processed.dependencies.length).toBeGreaterThan(0);
      expect(processed.loadingGroups.length).toBeGreaterThan(0);
      expect(processed.optimizations.size).toBe(manifest.assets.length);
      expect(processed.criticalPath.length).toBeGreaterThan(0);
      expect(processed.totalSize).toBeGreaterThan(0);
    });

    test('should handle empty manifest', () => {
      const manifest: AssetManifest = {
        assets: [],
        totalCount: 0,
        estimatedLoadTime: 0,
      };

      const processed = processor.processManifest(manifest);

      expect(processed.assets).toEqual([]);
      expect(processed.dependencies).toEqual([]);
      expect(processed.loadingGroups).toEqual([]);
      expect(processed.optimizations.size).toBe(0);
      expect(processed.criticalPath).toEqual([]);
      expect(processed.totalSize).toBe(0);
    });

    test('should handle MIDI-only manifest', () => {
      const manifest = createAssetManifest({
        includeMidi: true,
        includeAudio: false,
      });

      const processed = processor.processManifest(manifest);

      expectManifestProcessed(processed, manifest);
      expect(processed.loadingGroups.length).toBeGreaterThan(0);
      expect(processed.totalSize).toBeGreaterThan(0);
    });

    test('should handle audio-only manifest', () => {
      const manifest = createAssetManifest({
        includeMidi: false,
        includeAudio: true,
      });

      const processed = processor.processManifest(manifest);

      expectManifestProcessed(processed, manifest);
      expect(processed.loadingGroups.length).toBeGreaterThan(0);
      expect(processed.totalSize).toBeGreaterThan(0);
    });

    test('should preserve original manifest properties', () => {
      const manifest = createAssetManifest();
      manifest.estimatedLoadTime = 12345;

      const processed = processor.processManifest(manifest);

      expect(processed.estimatedLoadTime).toBe(12345);
      expect(processed.totalCount).toBe(manifest.totalCount);
      expect(processed.assets).toEqual(manifest.assets);
    });
  });

  describe('Dependency Analysis Behaviors', () => {
    test('should create bassline-to-chords dependency', () => {
      const manifest = createAssetManifest({ includeDependencies: true });
      const processed = processor.processManifest(manifest);

      expectValidDependencies(processed.dependencies);

      const basslineDep = processed.dependencies.find(
        (d) =>
          d.assetUrl.includes('bassline') &&
          d.dependsOn.some((url) => url.includes('chords')),
      );
      expect(basslineDep).toBeDefined();
      if (basslineDep) {
        expect(basslineDep.dependencyType).toBe('required');
      }
    });

    test('should create bass-sample-to-bassline dependencies', () => {
      const manifest = createAssetManifest({ includeDependencies: true });
      const processed = processor.processManifest(manifest);

      const bassSampleDeps = processed.dependencies.filter(
        (d) => d.assetUrl.includes('bass') && d.assetUrl.includes('.wav'),
      );
      expect(bassSampleDeps.length).toBeGreaterThan(0);

      bassSampleDeps.forEach((dep) => {
        expect(dep.dependsOn.some((url) => url.includes('bassline'))).toBe(
          true,
        );
        expect(dep.dependencyType).toBe('required');
      });
    });

    test('should create drum-sample-to-drums performance dependencies', () => {
      const manifest = createAssetManifest({ includeDependencies: true });
      const processed = processor.processManifest(manifest);

      const drumSampleDeps = processed.dependencies.filter((d) =>
        d.assetUrl.includes('kick'),
      );

      if (drumSampleDeps.length > 0) {
        drumSampleDeps.forEach((dep) => {
          expect(dep.dependsOn.some((url) => url.includes('drums'))).toBe(true);
          expect(dep.dependencyType).toBe('performance');
        });
      }
    });

    test('should mark ambience as independent', () => {
      const manifest = createAssetManifest({ includeAmbience: true });
      const processed = processor.processManifest(manifest);

      const ambienceDep = processed.dependencies.find((d) =>
        d.assetUrl.includes('ambient'),
      );

      if (ambienceDep) {
        expect(ambienceDep.dependsOn).toEqual([]);
        expect(ambienceDep.dependencyType).toBe('optional');
      }
    });

    test('should handle assets without dependencies', () => {
      const manifest = createAssetManifest({
        includeMidi: false,
        includeAudio: false,
      });
      manifest.assets = [
        {
          type: 'audio',
          category: 'metronome' as any,
          url: 'https://example.com/metronome.wav',
          priority: 'medium',
        },
      ];

      const processed = processor.processManifest(manifest);

      expect(processed.dependencies).toEqual([]);
    });
  });

  describe('Loading Group Creation Behaviors', () => {
    test('should create prioritized loading groups', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      expectValidLoadingGroups(processed.loadingGroups);
    });

    test('should separate critical MIDI into sequential group', () => {
      const manifest = createAssetManifest({ includeMidi: true });
      const processed = processor.processManifest(manifest);

      const criticalMidiGroup = processed.loadingGroups.find(
        (g) => g.id === 'critical-midi',
      );

      if (criticalMidiGroup) {
        expect(criticalMidiGroup.priority).toBe(100);
        expect(criticalMidiGroup.parallelLoadable).toBe(false);
        expect(criticalMidiGroup.requiredForPlayback).toBe(true);
        expect(criticalMidiGroup.assets.every((a) => a.type === 'midi')).toBe(
          true,
        );
      }
    });

    test('should group essential audio samples for parallel loading', () => {
      const manifest = createAssetManifest({ includeAudio: true });
      const processed = processor.processManifest(manifest);

      const essentialGroup = processed.loadingGroups.find(
        (g) => g.id === 'essential-samples',
      );

      if (essentialGroup) {
        expect(essentialGroup.priority).toBe(90);
        expect(essentialGroup.parallelLoadable).toBe(true);
        expect(essentialGroup.requiredForPlayback).toBe(true);
        expect(
          essentialGroup.assets.every(
            (a) => a.type === 'audio' && a.priority === 'high',
          ),
        ).toBe(true);
      }
    });

    test('should create supporting assets group', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const supportingGroup = processed.loadingGroups.find(
        (g) => g.id === 'supporting-assets',
      );

      if (supportingGroup) {
        expect(supportingGroup.priority).toBe(50);
        expect(supportingGroup.parallelLoadable).toBe(true);
        expect(supportingGroup.requiredForPlayback).toBe(false);
        expect(
          supportingGroup.assets.every((a) => a.priority === 'medium'),
        ).toBe(true);
      }
    });

    test('should create optional enhancements group', () => {
      const manifest = createAssetManifest({ includeAmbience: true });
      const processed = processor.processManifest(manifest);

      const optionalGroup = processed.loadingGroups.find(
        (g) => g.id === 'optional-enhancements',
      );

      if (optionalGroup) {
        expect(optionalGroup.priority).toBe(10);
        expect(optionalGroup.parallelLoadable).toBe(true);
        expect(optionalGroup.requiredForPlayback).toBe(false);
        expect(optionalGroup.assets.every((a) => a.priority === 'low')).toBe(
          true,
        );
      }
    });

    test('should sort groups by priority descending', () => {
      const manifest = createAssetManifest({ includeAmbience: true });
      const processed = processor.processManifest(manifest);

      for (let i = 1; i < processed.loadingGroups.length; i++) {
        expect(processed.loadingGroups[i - 1]!.priority).toBeGreaterThanOrEqual(
          processed.loadingGroups[i]!.priority,
        );
      }
    });
  });

  describe('Optimization Strategy Behaviors', () => {
    test('should generate optimizations for all assets', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      expectValidOptimizations(processed.optimizations);
      expect(processed.optimizations.size).toBe(manifest.assets.length);
    });

    test('should apply aggressive optimization for low-end devices', () => {
      createLowEndEnvironment();
      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();
      const processed = instance.processManifest(manifest);

      Array.from(processed.optimizations.values()).forEach((optimization) => {
        expect(optimization.compressionLevel).toBe('high');
        expect(optimization.qualityTarget).toBe('efficient');
        expect(optimization.deviceOptimized).toBe(true);
        expect(optimization.networkOptimized).toBe(true);
      });
    });

    test('should optimize for slow networks', () => {
      (global as any).navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        connection: { effectiveType: '2g' },
      };

      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();
      const processed = instance.processManifest(manifest);

      Array.from(processed.optimizations.values()).forEach((optimization) => {
        expect(optimization.networkOptimized).toBe(true);
        expect(['medium', 'high']).toContain(optimization.compressionLevel);
      });
    });

    test('should prioritize quality for high-priority assets on capable devices', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const highPriorityAsset = manifest.assets.find(
        (a) => a.priority === 'high',
      );
      if (highPriorityAsset) {
        const optimization = processed.optimizations.get(highPriorityAsset.url);
        expect(optimization).toBeDefined();
        if (optimization) {
          expect(optimization.qualityTarget).toBe('maximum');
          expect(optimization.compressionLevel).toBe('low');
        }
      }
    });

    test('should balance quality for medium-priority assets', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const mediumPriorityAssets = manifest.assets.filter(
        (a) => a.priority === 'medium',
      );
      mediumPriorityAssets.forEach((asset) => {
        const optimization = processed.optimizations.get(asset.url);
        if (optimization) {
          expect(optimization.qualityTarget).toBe('balanced');
          expect(optimization.compressionLevel).toBe('medium');
        }
      });
    });

    test('should minimize quality for low-priority assets', () => {
      const manifest = createAssetManifest({ includeAmbience: true });
      const processed = processor.processManifest(manifest);

      const lowPriorityAssets = manifest.assets.filter(
        (a) => a.priority === 'low',
      );
      lowPriorityAssets.forEach((asset) => {
        const optimization = processed.optimizations.get(asset.url);
        if (optimization) {
          expect(optimization.qualityTarget).toBe('minimal');
          expect(optimization.compressionLevel).toBe('high');
        }
      });
    });
  });

  describe('Critical Path Calculation Behaviors', () => {
    test('should identify bassline in critical path', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      expect(processed.criticalPath.length).toBeGreaterThan(0);
      expect(
        processed.criticalPath.some((url) => url.includes('bassline')),
      ).toBe(true);
    });

    test('should include bass sample in critical path', () => {
      const manifest = createAssetManifest({ includeAudio: true });
      const processed = processor.processManifest(manifest);

      expect(
        processed.criticalPath.some(
          (url) => url.includes('bass') && url.includes('.wav'),
        ),
      ).toBe(true);
    });

    test('should prioritize chord dependencies', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const chordsIndex = processed.criticalPath.findIndex((url) =>
        url.includes('chords'),
      );
      const basslineIndex = processed.criticalPath.findIndex((url) =>
        url.includes('bassline'),
      );

      if (chordsIndex !== -1 && basslineIndex !== -1) {
        expect(chordsIndex).toBeLessThan(basslineIndex);
      }
    });

    test('should handle missing critical assets gracefully', () => {
      const manifest = createAssetManifest({
        includeMidi: false,
        includeAudio: false,
      });

      const processed = processor.processManifest(manifest);

      expect(processed.criticalPath).toEqual([]);
    });

    test('should create minimal viable playback path', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      // Critical path should be short and focused
      expect(processed.criticalPath.length).toBeLessThanOrEqual(4);
      expect(processed.criticalPath.length).toBeGreaterThan(0);
    });
  });

  describe('Size Estimation Behaviors', () => {
    test('should estimate MIDI file sizes', () => {
      const manifest = createAssetManifest({
        includeMidi: true,
        includeAudio: false,
      });

      const processed = processor.processManifest(manifest);

      // Should estimate ~25KB per MIDI file
      const midiCount = manifest.assets.filter((a) => a.type === 'midi').length;
      expect(processed.totalSize).toBeCloseTo(midiCount * 25000, -3);
    });

    test('should estimate audio sample sizes', () => {
      const manifest = createAssetManifest({
        includeMidi: false,
        includeAudio: true,
      });

      const processed = processor.processManifest(manifest);

      expect(processed.totalSize).toBeGreaterThan(100000); // Should be significant for audio
    });

    test('should estimate ambience track sizes correctly', () => {
      const manifest = createAssetManifest({
        includeMidi: false,
        includeAudio: false,
        includeAmbience: true,
      });

      const processed = processor.processManifest(manifest);

      // Should estimate ~2MB for ambience
      expect(processed.totalSize).toBeCloseTo(2000000, -5);
    });

    test('should sum all asset sizes', () => {
      const manifest = createAssetManifest({
        includeMidi: true,
        includeAudio: true,
        includeAmbience: true,
      });

      const processed = processor.processManifest(manifest);

      expect(processed.totalSize).toBeGreaterThan(100000);
      expect(processed.totalSize).toBeLessThan(50000000); // Reasonable upper bound
    });

    test('should handle empty manifest size estimation', () => {
      const manifest: AssetManifest = {
        assets: [],
        totalCount: 0,
        estimatedLoadTime: 0,
      };

      const processed = processor.processManifest(manifest);

      expect(processed.totalSize).toBe(0);
    });
  });

  describe('Validation Behaviors', () => {
    test('should validate complete processed manifest', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const validation = processor.validateProcessedManifest(processed);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should detect missing critical path', () => {
      const processed = {
        ...createAssetManifest(),
        dependencies: [],
        loadingGroups: [],
        optimizations: new Map(),
        totalSize: 0,
        criticalPath: [],
      };

      const validation = processor.validateProcessedManifest(processed);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'No critical path defined - minimum viable playback not possible',
      );
    });

    test('should detect missing loading groups', () => {
      const processed = {
        ...createAssetManifest(),
        dependencies: [],
        loadingGroups: [],
        optimizations: new Map(),
        totalSize: 0,
        criticalPath: ['test.mid'],
      };

      const validation = processor.validateProcessedManifest(processed);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'No loading groups defined - asset loading strategy unclear',
      );
    });

    test('should warn about large total size', () => {
      const processed = {
        ...createAssetManifest(),
        dependencies: [],
        loadingGroups: [
          {
            id: 'test',
            priority: 1,
            assets: [],
            parallelLoadable: true,
            requiredForPlayback: false,
          },
        ],
        optimizations: new Map(),
        totalSize: 60 * 1024 * 1024, // 60MB
        criticalPath: ['test.mid'],
      };

      const validation = processor.validateProcessedManifest(processed);

      expect(validation.warnings).toContain(
        'Total asset size exceeds 50MB - consider optimization',
      );
    });

    test('should handle circular dependencies gracefully', () => {
      // Create a manifest that could potentially create circular deps
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const validation = processor.validateProcessedManifest(processed);

      // Real processor shouldn't create circular deps, but validation should handle it
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
    });

    test('should provide comprehensive validation results', () => {
      const manifest = createAssetManifest();
      const processed = processor.processManifest(manifest);

      const validation = processor.validateProcessedManifest(processed);

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  describe('Error Handling Behaviors', () => {
    test('should handle malformed asset references', () => {
      const manifest: AssetManifest = {
        assets: [
          {
            type: 'audio' as any,
            category: 'invalid' as any,
            url: '',
            priority: 'high',
          },
        ],
        totalCount: 1,
        estimatedLoadTime: 1000,
      };

      expect(() => processor.processManifest(manifest)).not.toThrow();
    });

    test('should handle missing navigator connection', () => {
      (global as any).navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();

      expect(() => instance.processManifest(manifest)).not.toThrow();
    });

    test('should handle missing Audio constructor', () => {
      delete (global as any).Audio;

      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();

      expect(() => instance.processManifest(manifest)).not.toThrow();
    });

    test('should handle invalid user agent', () => {
      (global as any).navigator = {
        userAgent: '',
        connection: { effectiveType: '4g' },
      };

      const instance = AssetManifestProcessor.getInstance();
      const manifest = createAssetManifest();

      expect(() => instance.processManifest(manifest)).not.toThrow();
    });

    test('should handle assets with missing properties', () => {
      const manifest: AssetManifest = {
        assets: [
          {
            type: 'midi',
            category: 'bassline',
            url: 'https://example.com/test.mid',
          } as any,
        ],
        totalCount: 1,
        estimatedLoadTime: 1000,
      };

      expect(() => processor.processManifest(manifest)).not.toThrow();
    });
  });

  describe('Epic 2 Workflow Behaviors', () => {
    test('should process complete Epic 2 asset manifest', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      expectManifestProcessed(processed, epic2Manifest);
      expect(processed.assets).toHaveLength(9);
      expect(processed.dependencies.length).toBeGreaterThan(0);
      expect(processed.loadingGroups.length).toBeGreaterThan(0);
      expect(processed.optimizations.size).toBe(9);
      expect(processed.criticalPath.length).toBeGreaterThan(0);
    });

    test('should identify Epic 2 bassline dependency on chords', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const basslineDep = processed.dependencies.find((dep) =>
        dep.assetUrl.includes('bassline.mid'),
      );

      expect(basslineDep).toBeDefined();
      expect(basslineDep?.dependsOn).toContain(
        'https://cdn.example.com/chords.mid',
      );
      expect(basslineDep?.dependencyType).toBe('required');
    });

    test('should identify Epic 2 bass sample dependencies on bassline MIDI', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const bassSampleDeps = processed.dependencies.filter(
        (dep) =>
          dep.assetUrl.includes('bass-') && dep.assetUrl.includes('.wav'),
      );

      expect(bassSampleDeps).toHaveLength(2);
      bassSampleDeps.forEach((dep) => {
        expect(dep.dependsOn).toContain('https://cdn.example.com/bassline.mid');
        expect(dep.dependencyType).toBe('required');
      });
    });

    test('should identify Epic 2 drum sample performance dependencies', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const drumSampleDeps = processed.dependencies.filter(
        (dep) =>
          dep.assetUrl.includes('kick.wav') ||
          dep.assetUrl.includes('snare.wav'),
      );

      expect(drumSampleDeps).toHaveLength(2);
      drumSampleDeps.forEach((dep) => {
        expect(dep.dependsOn).toContain('https://cdn.example.com/drums.mid');
        expect(dep.dependencyType).toBe('performance');
      });
    });

    test('should mark Epic 2 ambience as independent optional asset', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const ambienceDep = processed.dependencies.find((dep) =>
        dep.assetUrl.includes('ambience.wav'),
      );

      expect(ambienceDep).toBeDefined();
      expect(ambienceDep?.dependsOn).toHaveLength(0);
      expect(ambienceDep?.dependencyType).toBe('optional');
    });

    test('should create Epic 2 critical MIDI loading group', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const criticalMidiGroup = processed.loadingGroups.find(
        (group) => group.id === 'critical-midi',
      );

      expect(criticalMidiGroup).toBeDefined();
      expect(criticalMidiGroup?.priority).toBe(100);
      expect(criticalMidiGroup?.assets).toHaveLength(2);
      expect(criticalMidiGroup?.parallelLoadable).toBe(false);
      expect(criticalMidiGroup?.requiredForPlayback).toBe(true);
    });

    test('should create Epic 2 essential samples loading group', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const essentialSamplesGroup = processed.loadingGroups.find(
        (group) => group.id === 'essential-samples',
      );

      expect(essentialSamplesGroup).toBeDefined();
      expect(essentialSamplesGroup?.priority).toBe(90);
      expect(essentialSamplesGroup?.assets).toHaveLength(2);
      expect(essentialSamplesGroup?.parallelLoadable).toBe(true);
      expect(essentialSamplesGroup?.requiredForPlayback).toBe(true);
    });

    test('should prioritize Epic 2 loading groups correctly', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const priorities = processed.loadingGroups.map((group) => group.priority);
      const sortedPriorities = [...priorities].sort((a, b) => b - a);

      expect(priorities).toEqual(sortedPriorities);
    });

    test('should respect Epic 2 dependency order in critical path', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const chordsIndex = processed.criticalPath.indexOf(
        'https://cdn.example.com/chords.mid',
      );
      const basslineIndex = processed.criticalPath.indexOf(
        'https://cdn.example.com/bassline.mid',
      );

      if (chordsIndex !== -1 && basslineIndex !== -1) {
        expect(chordsIndex).toBeLessThan(basslineIndex);
      }
    });
  });

  describe('Performance and Consistency Behaviors', () => {
    test('should process large manifests efficiently', () => {
      const largeAssets = Array.from({ length: 100 }, (_, i) => {
        const priority = i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low';
        return {
          type: 'audio' as const,
          category: 'bass-sample' as const,
          url: `https://cdn.example.com/sample-${i}.wav`,
          priority: priority as 'high' | 'medium' | 'low',
          noteIndex: i,
        };
      });

      const largeManifest: AssetManifest = {
        assets: largeAssets,
        totalCount: 100,
        estimatedLoadTime: 50000,
      };

      const startTime = performance.now();
      const result = processor.processManifest(largeManifest);
      const processingTime = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.assets).toHaveLength(100);
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should maintain consistency across multiple processing calls', () => {
      const epic2Manifest = createEpic2AssetManifest();

      const result1 = processor.processManifest(epic2Manifest);
      const result2 = processor.processManifest(epic2Manifest);

      expect(result1.dependencies).toEqual(result2.dependencies);
      expect(result1.loadingGroups).toEqual(result2.loadingGroups);
      expect(result1.criticalPath).toEqual(result2.criticalPath);
      expect(result1.totalSize).toEqual(result2.totalSize);
    });

    test('should handle duplicate URLs gracefully', () => {
      const duplicateManifest: AssetManifest = {
        assets: [
          {
            type: 'midi',
            category: 'bassline',
            url: 'https://cdn.example.com/duplicate.mid',
            priority: 'high',
          },
          {
            type: 'midi',
            category: 'chords',
            url: 'https://cdn.example.com/duplicate.mid',
            priority: 'high',
          },
        ],
        totalCount: 2,
        estimatedLoadTime: 1000,
      };

      expect(() => processor.processManifest(duplicateManifest)).not.toThrow();
      const result = processor.processManifest(duplicateManifest);
      expect(result).toBeDefined();
    });

    test('should maintain singleton behavior', () => {
      const instance1 = AssetManifestProcessor.getInstance();
      const instance2 = AssetManifestProcessor.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1 === instance2).toBe(true);
    });

    test('should maintain state across singleton getInstance calls', () => {
      const instance1 = AssetManifestProcessor.getInstance();
      const instance2 = AssetManifestProcessor.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1 === instance2).toBe(true);
    });
  });

  describe('Enhanced Validation Behaviors', () => {
    test('should detect circular dependencies in Epic 2 workflow', () => {
      const circularManifest: ProcessedAssetManifest = {
        ...createEpic2AssetManifest(),
        dependencies: [
          {
            assetUrl: 'https://cdn.example.com/asset1.mid',
            dependsOn: ['https://cdn.example.com/asset2.mid'],
            dependencyType: 'required',
          },
          {
            assetUrl: 'https://cdn.example.com/asset2.mid',
            dependsOn: ['https://cdn.example.com/asset1.mid'],
            dependencyType: 'required',
          },
        ],
        loadingGroups: [],
        optimizations: new Map(),
        totalSize: 1000,
        criticalPath: [],
      };

      const validation = processor.validateProcessedManifest(circularManifest);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate Epic 2 processed manifest successfully', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);
      const validation = processor.validateProcessedManifest(processed);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should provide comprehensive validation for Epic 2 workflows', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);
      const validation = processor.validateProcessedManifest(processed);

      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('errors');
      expect(validation).toHaveProperty('warnings');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });

  describe('Enhanced Optimization Behaviors', () => {
    test('should apply appropriate optimization for Epic 2 high priority assets', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const highPriorityAssets = epic2Manifest.assets.filter(
        (asset) => asset.priority === 'high',
      );

      highPriorityAssets.forEach((asset) => {
        const optimization = processed.optimizations.get(asset.url);
        expect(optimization?.qualityTarget).toMatch(/maximum|balanced/);
      });
    });

    test('should apply appropriate optimization for Epic 2 low priority assets', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const lowPriorityAssets = epic2Manifest.assets.filter(
        (asset) => asset.priority === 'low',
      );

      lowPriorityAssets.forEach((asset) => {
        const optimization = processed.optimizations.get(asset.url);
        expect(optimization?.compressionLevel).toMatch(/medium|high/);
        expect(optimization?.qualityTarget).toMatch(/efficient|minimal/);
      });
    });

    test('should generate optimizations for all Epic 2 assets', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      expect(processed.optimizations.size).toBe(epic2Manifest.assets.length);

      epic2Manifest.assets.forEach((asset) => {
        expect(processed.optimizations.has(asset.url)).toBe(true);

        const optimization = processed.optimizations.get(asset.url);
        expect(optimization).toBeDefined();
        expect(optimization?.compressionLevel).toMatch(/none|low|medium|high/);
        expect(optimization?.qualityTarget).toMatch(
          /maximum|balanced|efficient|minimal/,
        );
        expect(typeof optimization?.deviceOptimized).toBe('boolean');
        expect(typeof optimization?.networkOptimized).toBe('boolean');
      });
    });
  });

  describe('Enhanced Critical Path Behaviors', () => {
    test('should identify Epic 2 critical path for minimum viable playback', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      expect(processed.criticalPath).toBeDefined();
      expect(processed.criticalPath.length).toBeGreaterThan(0);

      expect(
        processed.criticalPath.some((url) => url.includes('chords.mid')),
      ).toBe(true);
      expect(
        processed.criticalPath.some((url) => url.includes('bassline.mid')),
      ).toBe(true);
    });

    test('should prioritize Epic 2 high priority assets in critical path', () => {
      const epic2Manifest = createEpic2AssetManifest();
      const processed = processor.processManifest(epic2Manifest);

      const highPriorityUrls = epic2Manifest.assets
        .filter((asset) => asset.priority === 'high')
        .map((asset) => asset.url);

      const criticalHighPriorityCount = processed.criticalPath.filter((url) =>
        highPriorityUrls.includes(url),
      ).length;

      expect(criticalHighPriorityCount).toBeGreaterThan(0);
    });
  });
});
