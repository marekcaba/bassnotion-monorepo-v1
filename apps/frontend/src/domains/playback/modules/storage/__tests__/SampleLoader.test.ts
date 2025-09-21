import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SampleLoader } from '../loaders/SampleLoader.js';
import { SampleCache } from '../cache/SampleCache.js';
import { EventBus } from '../../shared/index.js';
import type { AudioSampleMetadata } from '@bassnotion/contracts';

// Mock fetch globally before any tests run
const mockFetch = vi.fn();

// Set up fetch mock in multiple ways to ensure it works
vi.stubGlobal('fetch', mockFetch);
(global as any).fetch = mockFetch;
(globalThis as any).fetch = mockFetch;

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
    // Completely reset the fetch mock
    mockFetch.mockReset();
    mockFetch.mockClear();
    mockFetch.mockRestore?.();

    // Re-establish the mock
    vi.stubGlobal('fetch', mockFetch);
    (global as any).fetch = mockFetch;
    (globalThis as any).fetch = mockFetch;

    eventBus = new EventBus();
    cache = new SampleCache(
      {
        maxSize: 10 * 1024 * 1024,
        maxEntries: 100,
        evictionStrategy: 'lru',
        enableAnalytics: true,
      },
      eventBus,
    );

    loader = new SampleLoader(
      {
        baseUrl: 'https://example.com/samples/',
        defaultQuality: 'high',
        maxRetries: 2,
        retryDelay: 100,
        timeout: 5000,
        enableAnalytics: true,
        enableQualityAdaptation: true,
      },
      cache,
      eventBus,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading from network', () => {
    it('should load sample from network', async () => {
      const testData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
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

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/samples/test_high.wav',
        expect.objectContaining({
          headers: { Accept: 'audio/*' },
        }),
      );
    });

    it('should handle network errors', async () => {
      // Reset the mock first
      mockFetch.mockReset();

      // Mock network error after all retries
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await loader.loadSample('test.wav');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should handle HTTP errors', async () => {
      // Reset the mock first
      mockFetch.mockReset();

      // Mock HTTP error for all retries
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await loader.loadSample('test.wav');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('404');
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should retry on failure', async () => {
      // Reset mock
      mockFetch.mockReset();

      // First attempt fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Second attempt succeeds
      const testData = new ArrayBuffer(1024);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.loadSample('test.wav', testMetadata);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should respect timeout', async () => {
      // Reset the mock first
      mockFetch.mockReset();

      // Mock fetch that simulates a timeout by rejecting with AbortError
      mockFetch.mockImplementation(() => {
        const abortError = new Error('The operation was aborted.');
        abortError.name = 'AbortError';
        return Promise.reject(abortError);
      });

      const timeoutLoader = new SampleLoader(
        {
          baseUrl: 'https://example.com/',
          defaultQuality: 'high',
          maxRetries: 0,
          retryDelay: 100,
          timeout: 100, // Very short timeout
          enableAnalytics: false,
          enableQualityAdaptation: false,
        },
        cache,
        eventBus,
      );

      const result = await timeoutLoader.loadSample('test.wav');

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
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should cache loaded samples', async () => {
      // Reset mock
      mockFetch.mockReset();

      const testData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      // First load from network
      const firstResult = await loader.loadSample('test.wav', testMetadata);
      expect(firstResult.success).toBe(true);
      expect(firstResult.fromCache).toBe(false);

      // Second load should come from cache
      const result = await loader.loadSample('test.wav');

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  describe('loading multiple samples', () => {
    it('should load multiple samples in parallel', async () => {
      // Reset mock
      mockFetch.mockReset();

      const testData1 = new ArrayBuffer(1024);
      const testData2 = new ArrayBuffer(2048);

      mockFetch
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
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      // Reset mock
      mockFetch.mockReset();

      // First sample succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as Response);

      // Second sample fails with all retries
      mockFetch.mockRejectedValue(new Error('Network error'));

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
      // Reset mock
      mockFetch.mockReset();

      const testData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.loadSample('test.wav', testMetadata, {
        quality: 'low',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/samples/test_low.wav',
        expect.any(Object),
      );
    });

    it('should use original quality when specified', async () => {
      // Reset mock
      mockFetch.mockReset();

      const testData = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);

      const result = await loader.loadSample('test.wav', testMetadata, {
        quality: 'original',
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/samples/test.wav',
        expect.any(Object),
      );
    });
  });

  describe('statistics', () => {
    it('should track loading statistics', async () => {
      // Reset mock and create fresh components to isolate this test
      mockFetch.mockReset();

      const freshEventBus = new EventBus();
      const freshCache = new SampleCache(
        {
          maxSize: 10 * 1024 * 1024,
          maxEntries: 100,
          evictionStrategy: 'lru',
          enableAnalytics: true,
        },
        freshEventBus,
      );

      const freshLoader = new SampleLoader(
        {
          baseUrl: 'https://example.com/samples/',
          defaultQuality: 'high',
          maxRetries: 0, // No retries for clearer stats
          retryDelay: 100,
          timeout: 5000,
          enableAnalytics: true,
          enableQualityAdaptation: true,
        },
        freshCache,
        freshEventBus,
      );

      const testData = new ArrayBuffer(1024);

      // One success from network
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        arrayBuffer: async () => testData,
      } as Response);
      await freshLoader.loadSample('test1.wav', testMetadata);

      // One cache hit
      freshCache.set('test2.wav', testData, testMetadata);
      await freshLoader.loadSample('test2.wav');

      // One failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await freshLoader.loadSample('test3.wav');

      const stats = freshLoader.getStats();

      expect(stats.totalLoads).toBe(3);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1); // Only successful network loads count as cache misses
      expect(stats.failures).toBe(1);
      expect(stats.cacheHitRate).toBeCloseTo(1 / 3);
      expect(stats.failureRate).toBeCloseTo(1 / 3);
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
      // Reset mock
      mockFetch.mockReset();

      const testData = new ArrayBuffer(1024);

      let resolveLoad: (value: Response) => void;
      const loadPromise = new Promise<Response>((resolve) => {
        resolveLoad = resolve;
      });

      mockFetch.mockReturnValueOnce(loadPromise);

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
      // Both should get the same result from the single fetch
      expect(result1.data).toBe(result2.data);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
    });
  });
});
