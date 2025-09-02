import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SampleLoader } from '../loaders/SampleLoader.js';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus } from '../../../services/core/EventBus.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

// Mock fetch
global.fetch = vi.fn();

describe('SampleLoader', () => {
  let loader: SampleLoader;
  let cache: SampleCache;
  let eventBus: EventBus;
  
  const testMetadata: AudioSampleMetadata = {
    sampleId: 'test-sample',
    name: 'Test Sample',
    fileSize: 1024,
    duration: 1.5,
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    format: 'wav',
  };

  beforeEach(() => {
    eventBus = new EventBus();
    cache = new SampleCache({
      maxSize: 10 * 1024 * 1024,
      maxEntries: 100,
      evictionStrategy: 'lru',
      enableAnalytics: true,
    }, eventBus);
    
    loader = new SampleLoader({
      baseUrl: 'https://example.com/samples/',
      defaultQuality: 'high',
      maxRetries: 2,
      retryDelay: 100,
      timeout: 5000,
      enableAnalytics: true,
      enableQualityAdaptation: true,
    }, cache, eventBus);

    // Reset fetch mock
    vi.mocked(fetch).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading from network', () => {
    it('should load sample from network', async () => {
      const testData = new ArrayBuffer(1024);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.loadSample('test.wav', testMetadata);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(testData);
      expect(result.fromCache).toBe(false);
      expect(result.size).toBe(1024);
      
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/samples/test_high.wav',
        expect.objectContaining({
          headers: { 'Accept': 'audio/*' },
        })
      );
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await loader.loadSample('test.wav');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle HTTP errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await loader.loadSample('test.wav');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('404');
    });

    it('should retry on failure', async () => {
      // First attempt fails
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      
      // Second attempt succeeds
      const testData = new ArrayBuffer(1024);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.loadSample('test.wav', testMetadata);
      
      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should respect timeout', async () => {
      // Create a promise that never resolves
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      const loader = new SampleLoader({
        baseUrl: 'https://example.com/',
        defaultQuality: 'high',
        maxRetries: 0,
        retryDelay: 100,
        timeout: 100, // Very short timeout
        enableAnalytics: false,
        enableQualityAdaptation: false,
      });

      const result = await loader.loadSample('test.wav');
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });

  describe('loading from cache', () => {
    it('should load from cache if available', async () => {
      const testData = new ArrayBuffer(1024);
      
      // Pre-populate cache
      cache.set('test.wav', testData, testMetadata);
      
      const result = await loader.loadSample('test.wav');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(testData);
      expect(result.fromCache).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should cache loaded samples', async () => {
      const testData = new ArrayBuffer(1024);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      // First load from network
      await loader.loadSample('test.wav', testMetadata);
      
      // Second load should come from cache
      const result = await loader.loadSample('test.wav');
      
      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('loading multiple samples', () => {
    it('should load multiple samples in parallel', async () => {
      const testData1 = new ArrayBuffer(1024);
      const testData2 = new ArrayBuffer(2048);
      
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => testData1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => testData2,
        } as Response);

      const samples = [
        { id: 'sample1', url: 'test1.wav', metadata: testMetadata },
        { id: 'sample2', url: 'test2.wav', metadata: testMetadata },
      ];

      const results = await loader.loadMultiple(samples);
      
      expect(results.size).toBe(2);
      expect(results.get('sample1')?.success).toBe(true);
      expect(results.get('sample2')?.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => new ArrayBuffer(1024),
        } as Response)
        .mockRejectedValueOnce(new Error('Network error'));

      const samples = [
        { id: 'sample1', url: 'test1.wav' },
        { id: 'sample2', url: 'test2.wav' },
      ];

      const results = await loader.loadMultiple(samples);
      
      expect(results.size).toBe(2);
      expect(results.get('sample1')?.success).toBe(true);
      expect(results.get('sample2')?.success).toBe(false);
    });
  });

  describe('quality adaptation', () => {
    it('should adapt quality based on options', async () => {
      const testData = new ArrayBuffer(1024);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      await loader.loadSample('test.wav', testMetadata, { quality: 'low' });
      
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/samples/test_low.wav',
        expect.any(Object)
      );
    });

    it('should use original quality when specified', async () => {
      const testData = new ArrayBuffer(1024);
      
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      await loader.loadSample('test.wav', testMetadata, { quality: 'original' });
      
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/samples/test.wav',
        expect.any(Object)
      );
    });
  });

  describe('statistics', () => {
    it('should track loading statistics', async () => {
      const testData = new ArrayBuffer(1024);
      
      // One success from network
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);
      await loader.loadSample('test1.wav', testMetadata);
      
      // One cache hit
      cache.set('test2.wav', testData, testMetadata);
      await loader.loadSample('test2.wav');
      
      // One failure
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      await loader.loadSample('test3.wav');
      
      const stats = loader.getStats();
      
      expect(stats.totalLoads).toBe(3);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.cacheHitRate).toBeCloseTo(1/3);
      expect(stats.failureRate).toBeCloseTo(1/3);
    });

    it('should clear statistics', () => {
      loader.clearStats();
      
      const stats = loader.getStats();
      expect(stats.totalLoads).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.failures).toBe(0);
    });
  });

  describe('preventing duplicate loads', () => {
    it('should not load same sample multiple times concurrently', async () => {
      const testData = new ArrayBuffer(1024);
      
      let resolveLoad: (value: Response) => void;
      const loadPromise = new Promise<Response>((resolve) => {
        resolveLoad = resolve;
      });
      
      vi.mocked(fetch).mockReturnValueOnce(loadPromise);

      // Start two loads for the same sample
      const load1 = loader.loadSample('test.wav', testMetadata);
      const load2 = loader.loadSample('test.wav', testMetadata);
      
      // Resolve the fetch
      resolveLoad!({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);
      
      const [result1, result2] = await Promise.all([load1, load2]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1); // Only one fetch
    });
  });
});