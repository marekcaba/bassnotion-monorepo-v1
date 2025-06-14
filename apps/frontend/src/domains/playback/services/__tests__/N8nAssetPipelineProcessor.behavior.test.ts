/**
 * N8nAssetPipelineProcessor Behavior Tests
 *
 * Comprehensive test suite for Epic 2 n8n payload integration with CDN optimization
 * Part of Story 2.2: Task 7, Subtask 7.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  N8nAssetPipelineProcessor,
  type N8nIntegrationConfig,
} from '../plugins/N8nAssetPipelineProcessor.js';
import type { N8nPayloadConfig } from '../../types/audio.js';

// Mock the dependencies at module level BEFORE the describe block
vi.mock('../AssetManager.js', () => ({
  AssetManager: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../plugins/MusicalContextAnalyzer.js', () => ({
  MusicalContextAnalyzer: vi.fn(),
}));

vi.mock('../plugins/InstrumentAssetOptimizer.js', () => ({
  InstrumentAssetOptimizer: vi.fn(),
}));

describe('N8nAssetPipelineProcessor Behaviors', () => {
  let processor: N8nAssetPipelineProcessor;
  let mockAssetManager: any;
  let mockMusicalAnalyzer: any;
  let mockAssetOptimizer: any;

  beforeEach(async () => {
    // Create mock implementations
    mockAssetManager = {
      loadAsset: vi.fn().mockResolvedValue({
        url: 'test-asset.wav',
        data: new ArrayBuffer(1024),
        type: 'audio/wav',
        size: 1024,
        source: 'network',
        loadTime: 100,
      }),
    };

    mockMusicalAnalyzer = {
      analyzeComplexity: vi.fn().mockReturnValue(0.7),
      predictAssets: vi.fn().mockReturnValue(['bass-C2.wav']),
    };

    mockAssetOptimizer = {
      optimizeForDevice: vi.fn().mockReturnValue({
        quality: 'high',
        format: 'wav',
      }),
    };

    // Set up the mocks using vi.mocked
    const AssetManagerModule = await import('../AssetManager.js');
    const MusicalContextAnalyzerModule = await import(
      '../plugins/MusicalContextAnalyzer.js'
    );
    const InstrumentAssetOptimizerModule = await import(
      '../plugins/InstrumentAssetOptimizer.js'
    );

    vi.mocked(AssetManagerModule.AssetManager.getInstance).mockReturnValue(
      mockAssetManager,
    );
    vi.mocked(
      MusicalContextAnalyzerModule.MusicalContextAnalyzer,
    ).mockReturnValue(mockMusicalAnalyzer);
    vi.mocked(
      InstrumentAssetOptimizerModule.InstrumentAssetOptimizer,
    ).mockReturnValue(mockAssetOptimizer);

    processor = new N8nAssetPipelineProcessor();
  });

  afterEach(() => {
    vi.clearAllMocks();
    processor.clearRoutingHistory();
  });

  describe('Initialization Behaviors', () => {
    it('should initialize with default configuration', () => {
      const newProcessor = new N8nAssetPipelineProcessor();
      const config = newProcessor.exportConfiguration();

      expect(config.config.enableCdnOptimization).toBe(true);
      expect(config.config.enableFailoverRouting).toBe(true);
      expect(config.config.retryStrategy).toBe('adaptive');
      expect(config.config.maxRetries).toBe(3);
      expect(config.config.timeoutMs).toBe(10000);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<N8nIntegrationConfig> = {
        enableCdnOptimization: false,
        retryStrategy: 'exponential',
        maxRetries: 5,
        timeoutMs: 15000,
      };

      const newProcessor = new N8nAssetPipelineProcessor(customConfig);
      const config = newProcessor.exportConfiguration();

      expect(config.config.enableCdnOptimization).toBe(false);
      expect(config.config.retryStrategy).toBe('exponential');
      expect(config.config.maxRetries).toBe(5);
      expect(config.config.timeoutMs).toBe(15000);
    });

    it('should initialize CDN routes with proper priorities', () => {
      const config = processor.exportConfiguration();
      const routes = Object.values(config.routes);

      expect(routes).toHaveLength(3);

      // Check priorities
      const primaryRoute = routes.find((r) => r.priority === 1);
      const supabaseRoute = routes.find((r) => r.priority === 2);
      const cloudflareRoute = routes.find((r) => r.priority === 3);

      expect(primaryRoute).toBeDefined();
      expect(supabaseRoute).toBeDefined();
      expect(cloudflareRoute).toBeDefined();
    });

    it('should have healthy route status initially', () => {
      const config = processor.exportConfiguration();
      const routes = Object.values(config.routes);

      routes.forEach((route) => {
        expect(route.healthStatus).toBe('healthy');
        expect(route.successRate).toBeGreaterThan(0.95);
        expect(route.latency).toBeLessThan(100);
      });
    });
  });

  describe('CDN Routing Behaviors', () => {
    const createMockPayload = (): N8nPayloadConfig => ({
      tutorialSpecificMidi: {
        basslineUrl: 'https://example.com/bassline.mid',
        chordsUrl: 'https://example.com/chords.mid',
      },
      audioSamples: {
        bassNotes: [
          'https://example.com/bass-C2.wav',
          'https://example.com/bass-E2.wav',
        ],
        drumHits: [
          'https://example.com/kick.wav',
          'https://example.com/snare.wav',
        ],
        ambienceTrack: 'https://example.com/ambience.wav',
      },
      libraryMidi: {
        drumPatternId: 'rock-pattern-1',
        metronomeStyleId: 'classic-wood',
      },
      synchronization: {
        bpm: 120,
        keySignature: 'C',
        timeSignature: '4/4',
      },
      assetManifest: {
        totalCount: 5,
        estimatedLoadTime: 2000,
        assets: [
          {
            type: 'audio' as const,
            url: 'https://example.com/bass-C2.wav',
            category: 'bass-sample' as const,
            priority: 'high' as const,
          },
        ],
      },
    });

    it('should process n8n payload and select optimal routes', async () => {
      const payload = createMockPayload();
      const result = await processor.processN8nPayload(payload);

      expect(result.routingDecisions).toBeDefined();
      expect(result.routingDecisions.length).toBeGreaterThan(0);
      expect(result.routingDecisions[0]?.selectedRoute).toBe(
        'bassnotion-cdn-primary',
      );
      expect(result.routingDecisions[0]?.reason).toContain('Primary CDN');
    });

    it('should optimize asset URLs with CDN endpoints', async () => {
      const payload = createMockPayload();
      await processor.processN8nPayload(payload);

      expect(mockAssetManager.loadAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('cdn.bassnotion.com'),
          category: expect.any(String),
          priority: expect.any(String),
          type: expect.any(String),
        }),
        expect.any(String),
      );
    });

    it('should track routing decisions with alternatives', async () => {
      const payload = createMockPayload();
      const result = await processor.processN8nPayload(payload);

      result.routingDecisions.forEach((decision) => {
        expect(decision.alternativesConsidered).toBeDefined();
        expect(decision.latencyExpected).toBeGreaterThan(0);
        expect(decision.qualityLevel).toBeDefined();
      });
    });

    it('should maintain routing history for analytics', async () => {
      const payload = createMockPayload();
      await processor.processN8nPayload(payload);

      const metrics = processor.getRoutingMetrics();
      expect(metrics.recentDecisions.length).toBeGreaterThan(0);
      expect(metrics.totalRoutes).toBe(3);
      expect(metrics.healthyRoutes).toBe(3);
    });
  });

  describe('Failover Routing Behaviors', () => {
    it('should handle route health degradation', () => {
      // Simulate poor performance for primary route
      processor.updateRouteHealth('bassnotion-cdn-primary', 800, false);
      processor.updateRouteHealth('bassnotion-cdn-primary', 900, false);

      const metrics = processor.getRoutingMetrics();
      expect(metrics.healthyRoutes).toBeLessThan(3);
    });

    it('should mark routes as unavailable when performance is poor', () => {
      // Simulate very poor performance
      processor.updateRouteHealth('bassnotion-cdn-primary', 1200, false);
      processor.updateRouteHealth('bassnotion-cdn-primary', 1300, false);

      const config = processor.exportConfiguration();
      const primaryRoute = config.routes['bassnotion-cdn-primary'];
      expect(primaryRoute?.healthStatus).toBe('unavailable');
    });

    it('should update rolling averages for latency and success rate', () => {
      const initialConfig = processor.exportConfiguration();
      const initialLatency =
        initialConfig.routes['bassnotion-cdn-primary']?.latency;

      processor.updateRouteHealth('bassnotion-cdn-primary', 200, true);

      const updatedConfig = processor.exportConfiguration();
      const updatedLatency =
        updatedConfig.routes['bassnotion-cdn-primary']?.latency;

      expect(updatedLatency).toBeDefined();
      expect(initialLatency).toBeDefined();
      expect(updatedLatency).not.toBe(initialLatency);
      expect(updatedLatency!).toBeGreaterThan(initialLatency!);
    });

    it('should handle asset loading failures gracefully', async () => {
      // Mock ALL asset loading to fail
      mockAssetManager.loadAsset.mockRejectedValue(new Error('Network error'));

      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.failedAssets).toContain('https://example.com/bass-C2.wav');
      expect(result.processedAssets).toHaveLength(0);
    });
  });

  describe('N8n Payload Processing Behaviors', () => {
    it('should process complete Epic 2 payload successfully', async () => {
      const payload: N8nPayloadConfig = {
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
          ambienceTrack: 'https://example.com/ambience.wav',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 140,
          keySignature: 'E',
          timeSignature: '4/4',
        },
      };

      const result = await processor.processN8nPayload(payload);

      expect(result.processedAssets).toBeDefined();
      expect(result.failedAssets).toBeDefined();
      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.musicalContextInsights).toBeDefined();
    });

    it('should handle minimal payload gracefully', async () => {
      // Truly minimal payload with no musical content
      const payload = {
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.processedAssets).toBeDefined();
      expect(result.failedAssets).toBeDefined();
      expect(result.musicalContextInsights).toBeNull();
    });

    it('should generate musical context insights when MIDI is present', async () => {
      const payload = {
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.musicalContextInsights).toBeDefined();
      expect(result.musicalContextInsights.bpm).toBe(120);
      expect(result.musicalContextInsights.key).toBe('C');
      expect(result.musicalContextInsights.timeSignature).toBe('4/4');
      expect(result.musicalContextInsights.complexity).toBeGreaterThan(0);
    });

    it('should track CDN optimization savings', async () => {
      mockAssetManager.loadAsset.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  url: 'test-asset.wav',
                  data: new ArrayBuffer(1024),
                  type: 'audio/wav',
                  size: 1024,
                  source: 'network',
                  loadTime: 50,
                }),
              50,
            );
          }),
      );

      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.cdnOptimizationSavings).toBeGreaterThanOrEqual(0);
    });

    it('should track cache hit rates', async () => {
      mockAssetManager.loadAsset.mockResolvedValue({
        url: 'test-asset.wav',
        data: new ArrayBuffer(1024),
        type: 'audio/wav',
        size: 1024,
        source: 'cache',
        loadTime: 5,
      });

      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.cacheHits).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Monitoring Behaviors', () => {
    it('should track processing time accurately', async () => {
      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(typeof result.totalProcessingTime).toBe('number');
    });

    it('should provide comprehensive routing metrics', () => {
      const metrics = processor.getRoutingMetrics();

      expect(metrics.totalRoutes).toBe(3);
      expect(metrics.healthyRoutes).toBeLessThanOrEqual(metrics.totalRoutes);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.averageSuccessRate).toBeGreaterThan(0.9);
      expect(Array.isArray(metrics.recentDecisions)).toBe(true);
    });

    it('should clear routing history when requested', () => {
      // Generate some routing history first
      processor.updateRouteHealth('bassnotion-cdn-primary', 100, true);

      processor.clearRoutingHistory();

      const metrics = processor.getRoutingMetrics();
      expect(metrics.recentDecisions).toHaveLength(0);
    });

    it('should export complete configuration', () => {
      const config = processor.exportConfiguration();

      expect(config.config).toBeDefined();
      expect(config.routes).toBeDefined();
      expect(config.recentMetrics).toBeDefined();

      expect(Object.keys(config.routes)).toHaveLength(3);
      expect(config.config.enableCdnOptimization).toBe(true);
    });
  });

  describe('Error Handling Behaviors', () => {
    it('should handle malformed payload gracefully', async () => {
      // Actually malformed payload with invalid/corrupted data
      const malformedPayload = {
        audioSamples: {
          bassNotes: null, // Invalid: should be array
          drumHits: 'invalid-string', // Invalid: should be array
        },
        tutorialSpecificMidi: {
          basslineUrl: null, // Invalid: should be string
          chordsUrl: undefined, // Invalid: should be string
        },
        libraryMidi: null, // Invalid: should be object
        synchronization: {
          bpm: 'invalid', // Invalid: should be number
          keySignature: null, // Invalid: should be string
          timeSignature: undefined, // Invalid: should be string
        },
      } as any; // Use 'any' to bypass TypeScript validation for malformed data

      const result = await processor.processN8nPayload(malformedPayload);

      expect(result.processedAssets).toHaveLength(0);
      expect(result.failedAssets).toHaveLength(0);
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle asset loading failures', async () => {
      mockAssetManager.loadAsset.mockRejectedValue(
        new Error('Network timeout'),
      );

      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.failedAssets).toContain('https://example.com/bass-C2.wav');
      expect(result.processedAssets).toHaveLength(0);
    });

    it('should handle missing musical context gracefully', async () => {
      // Truly empty payload with no musical content
      const payload = {
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.musicalContextInsights).toBeNull();
      expect(result.processedAssets).toBeDefined();
    });

    it('should handle processing failures and continue', async () => {
      mockAssetManager.loadAsset
        .mockRejectedValueOnce(new Error('First asset failed'))
        .mockResolvedValueOnce({
          url: 'success-asset.wav',
          data: new ArrayBuffer(1024),
          type: 'audio/wav',
          size: 1024,
          source: 'network',
          loadTime: 100,
        });

      const payload = {
        audioSamples: {
          bassNotes: ['https://example.com/failed-asset.wav'],
          drumHits: ['https://example.com/success-asset.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      } as N8nPayloadConfig;

      const result = await processor.processN8nPayload(payload);

      expect(result.processedAssets).toBeDefined();
      expect(result.failedAssets).toBeDefined();
      expect(result.failedAssets).toContain(
        'https://example.com/failed-asset.wav',
      );
    });
  });

  describe('Musical Context Integration Behaviors', () => {
    it('should generate complexity estimation from payload', async () => {
      const highComplexityPayload: N8nPayloadConfig = {
        synchronization: {
          bpm: 180,
          timeSignature: '7/8',
          keySignature: 'C',
        },
        assetManifest: {
          totalCount: 25,
          estimatedLoadTime: 5000,
          assets: [],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/complex-bassline.mid',
          chordsUrl: 'https://example.com/complex-chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'complex-pattern-1',
          metronomeStyleId: 'electronic',
        },
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
      };

      const result = await processor.processN8nPayload(highComplexityPayload);

      expect(result.musicalContextInsights.complexity).toBeGreaterThan(0.5);
      expect(result.musicalContextInsights.bpm).toBe(180);
      expect(result.musicalContextInsights.timeSignature).toBe('7/8');
    });

    it('should generate appropriate asset recommendations', async () => {
      const jazzPayload: N8nPayloadConfig = {
        synchronization: {
          bpm: 80,
          keySignature: 'Bb',
          timeSignature: '4/4',
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/jazz-bassline.mid',
          chordsUrl: 'https://example.com/jazz-chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'jazz-pattern-1',
          metronomeStyleId: 'acoustic',
        },
        audioSamples: {
          bassNotes: ['https://example.com/bass-Bb2.wav'],
          drumHits: ['https://example.com/jazz-kick.wav'],
        },
      };

      const result = await processor.processN8nPayload(jazzPayload);

      expect(result.musicalContextInsights.recommendedAssets).toBeDefined();
      expect(
        Array.isArray(result.musicalContextInsights.recommendedAssets),
      ).toBe(true);
      expect(
        result.musicalContextInsights.recommendedAssets.length,
      ).toBeGreaterThan(0);
    });

    it('should handle different musical keys and tempos', async () => {
      const fastRockPayload: N8nPayloadConfig = {
        synchronization: {
          bpm: 160,
          keySignature: 'E',
          timeSignature: '4/4',
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/rock-bassline.mid',
          chordsUrl: 'https://example.com/rock-chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'electronic',
        },
        audioSamples: {
          bassNotes: ['https://example.com/bass-E2.wav'],
          drumHits: ['https://example.com/rock-kick.wav'],
        },
      };

      const result = await processor.processN8nPayload(fastRockPayload);

      expect(result.musicalContextInsights.bpm).toBe(160);
      expect(result.musicalContextInsights.key).toBe('E');
      expect(result.musicalContextInsights.recommendedAssets).toContain(
        'metronome-electronic.wav',
      );
      expect(result.musicalContextInsights.recommendedAssets).toContain(
        'bass-E.wav',
      );
    });
  });

  describe('Quality Adaptation Behaviors', () => {
    it('should track quality adaptations during processing', async () => {
      const qualityProcessor = new N8nAssetPipelineProcessor({
        enableQualityAdaptation: true,
      });

      const payload: N8nPayloadConfig = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      };

      const result = await qualityProcessor.processN8nPayload(payload);

      expect(result.qualityAdaptations).toBeGreaterThanOrEqual(0);
      expect(typeof result.qualityAdaptations).toBe('number');
    });

    it('should add quality parameters to optimized URLs', async () => {
      const payload: N8nPayloadConfig = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      };

      await processor.processN8nPayload(payload);

      expect(mockAssetManager.loadAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('quality=auto'),
        }),
        expect.any(String),
      );
    });

    it('should add cache optimization parameters when enabled', async () => {
      const payload: N8nPayloadConfig = {
        audioSamples: {
          bassNotes: ['https://example.com/bass-C2.wav'],
          drumHits: ['https://example.com/kick.wav'],
        },
        tutorialSpecificMidi: {
          basslineUrl: 'https://example.com/bassline.mid',
          chordsUrl: 'https://example.com/chords.mid',
        },
        libraryMidi: {
          drumPatternId: 'rock-pattern-1',
          metronomeStyleId: 'classic-wood',
        },
        synchronization: {
          bpm: 120,
          keySignature: 'C',
          timeSignature: '4/4',
        },
      };

      await processor.processN8nPayload(payload);

      expect(mockAssetManager.loadAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('cache=aggressive'),
        }),
        expect.any(String),
      );
    });
  });
});
