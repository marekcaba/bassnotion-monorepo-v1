/**
 * SampleLoadingCircuitBreaker Tests
 *
 * Tests for the shared circuit breaker singleton that protects
 * all sample loading operations from cascading failures.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// Store original fetch
const originalFetch = globalThis.fetch;

// Create mock fetch function
let mockFetch: Mock;

// Mock EventBus before importing the module
vi.mock('../EventBus.js', () => ({
  EventBus: {
    getGlobalInstance: vi.fn().mockReturnValue({
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    }),
  },
}));

// Mock the circuit breaker integration
const mockBreakerState = { state: 'closed' as string };
const mockExecuteWithBreaker = vi.fn();
const mockGetBreaker = vi.fn();
const mockResetBreaker = vi.fn();

vi.mock('../../../modules/errors/CircuitBreakerIntegration.js', () => {
  return {
    CircuitBreakerIntegration: vi.fn().mockImplementation(() => ({
      executeWithBreaker: mockExecuteWithBreaker,
      getBreaker: mockGetBreaker,
      resetBreaker: mockResetBreaker,
    })),
    CriticalPath: {
      SAMPLE_LOADING: 'sample-loading',
      STORAGE_CONNECTION: 'storage-connection',
      AUDIO_CONTEXT_INIT: 'audio-context-init',
    },
  };
});

describe('SampleLoadingCircuitBreaker', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock fetch for each test
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    // Reset mock breaker state
    mockBreakerState.state = 'closed';

    // Setup default mock behaviors
    mockExecuteWithBreaker.mockImplementation(async (_path, operation) => {
      return operation();
    });

    mockGetBreaker.mockReturnValue({
      getState: () => mockBreakerState.state,
      getMetrics: () => ({ failureCount: 0 }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllTimers();
    vi.resetModules();
  });

  describe('SAMPLE_FETCH_TIMEOUT_MS constant', () => {
    it('should be 10 seconds', async () => {
      const { SAMPLE_FETCH_TIMEOUT_MS } =
        await import('../SampleLoadingCircuitBreaker.js');
      expect(SAMPLE_FETCH_TIMEOUT_MS).toBe(10000);
    });
  });

  describe('getSampleLoadingCircuitBreaker', () => {
    it('should return a circuit breaker instance', async () => {
      const { getSampleLoadingCircuitBreaker } =
        await import('../SampleLoadingCircuitBreaker.js');
      const breaker = getSampleLoadingCircuitBreaker();
      expect(breaker).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton)', async () => {
      const { getSampleLoadingCircuitBreaker } =
        await import('../SampleLoadingCircuitBreaker.js');
      const breaker1 = getSampleLoadingCircuitBreaker();
      const breaker2 = getSampleLoadingCircuitBreaker();
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('fetchWithTimeout', () => {
    it('should fetch successfully within timeout', async () => {
      const { fetchWithTimeout } =
        await import('../SampleLoadingCircuitBreaker.js');

      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetchWithTimeout(
        'https://example.com/sample.mp3',
        5000,
      );

      expect(response).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/sample.mp3',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          mode: 'cors',
          headers: { Accept: 'audio/*' },
        }),
      );
    });

    it('should use default timeout when not specified', async () => {
      const { fetchWithTimeout } =
        await import('../SampleLoadingCircuitBreaker.js');

      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithTimeout('https://example.com/sample.mp3');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw timeout error when fetch is aborted', async () => {
      const { fetchWithTimeout } =
        await import('../SampleLoadingCircuitBreaker.js');

      // Mock fetch that simulates abort
      mockFetch.mockImplementation(() => {
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(
        fetchWithTimeout('https://example.com/sample.mp3', 100),
      ).rejects.toThrow(/timeout/i);
    });

    it('should propagate network errors', async () => {
      const { fetchWithTimeout } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchWithTimeout('https://example.com/sample.mp3'),
      ).rejects.toThrow('Network error');
    });
  });

  describe('protectedSampleFetch', () => {
    it('should fetch successfully and return response', async () => {
      const { protectedSampleFetch } =
        await import('../SampleLoadingCircuitBreaker.js');

      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await protectedSampleFetch(
        'https://example.com/sample.mp3',
        'test-operation',
      );

      expect(response).toBe(mockResponse);
    });

    it('should throw on HTTP errors', async () => {
      const { protectedSampleFetch } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        protectedSampleFetch(
          'https://example.com/sample.mp3',
          'test-operation',
        ),
      ).rejects.toThrow(/404.*Not Found/);
    });

    it('should use custom timeout when provided', async () => {
      const { protectedSampleFetch } =
        await import('../SampleLoadingCircuitBreaker.js');

      const mockResponse = { ok: true, status: 200 };
      mockFetch.mockResolvedValueOnce(mockResponse);

      await protectedSampleFetch(
        'https://example.com/sample.mp3',
        'test-operation',
        5000,
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('executeWithSampleBreaker', () => {
    it('should execute operation through circuit breaker', async () => {
      const { executeWithSampleBreaker } =
        await import('../SampleLoadingCircuitBreaker.js');

      const operation = vi.fn().mockResolvedValue('success');

      const result = await executeWithSampleBreaker(operation, 'test-op');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should propagate operation errors', async () => {
      const { executeWithSampleBreaker } =
        await import('../SampleLoadingCircuitBreaker.js');

      const operation = vi
        .fn()
        .mockRejectedValue(new Error('Operation failed'));

      await expect(
        executeWithSampleBreaker(operation, 'test-op'),
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('isSampleLoadingAvailable', () => {
    it('should return true when circuit is closed', async () => {
      const { isSampleLoadingAvailable } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockBreakerState.state = 'closed';
      const result = isSampleLoadingAvailable();
      expect(result).toBe(true);
    });

    it('should return false when circuit is open', async () => {
      const { isSampleLoadingAvailable } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockBreakerState.state = 'open';
      const result = isSampleLoadingAvailable();
      expect(result).toBe(false);
    });

    it('should return true when circuit is half-open', async () => {
      const { isSampleLoadingAvailable } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockBreakerState.state = 'half-open';
      const result = isSampleLoadingAvailable();
      expect(result).toBe(true);
    });
  });

  describe('getSampleLoadingStatus', () => {
    it('should return available status when circuit is closed', async () => {
      const { getSampleLoadingStatus } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockBreakerState.state = 'closed';
      const status = getSampleLoadingStatus();

      expect(status.available).toBe(true);
      expect(status.message).toBeUndefined();
    });

    it('should return unavailable status with message when circuit is open', async () => {
      const { getSampleLoadingStatus } =
        await import('../SampleLoadingCircuitBreaker.js');

      mockBreakerState.state = 'open';
      const status = getSampleLoadingStatus();

      expect(status.available).toBe(false);
      expect(status.message).toContain('temporarily unavailable');
    });
  });

  describe('resetSampleLoadingCircuitBreaker', () => {
    it('should call resetBreaker on the integration', async () => {
      const { resetSampleLoadingCircuitBreaker } =
        await import('../SampleLoadingCircuitBreaker.js');

      resetSampleLoadingCircuitBreaker();

      expect(mockResetBreaker).toHaveBeenCalled();
    });
  });
});

describe('SampleLoadingCircuitBreaker Integration Scenarios', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    mockBreakerState.state = 'closed';

    mockExecuteWithBreaker.mockImplementation(async (_path, operation) => {
      return operation();
    });

    mockGetBreaker.mockReturnValue({
      getState: () => mockBreakerState.state,
      getMetrics: () => ({ failureCount: 0 }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it('should successfully load a sample', async () => {
    const { protectedSampleFetch } =
      await import('../SampleLoadingCircuitBreaker.js');

    const testData = new ArrayBuffer(1024);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: vi.fn().mockResolvedValue(testData),
    });

    const response = await protectedSampleFetch(
      'https://example.com/piano-C4.mp3',
      'harmony-C4-v10',
    );

    expect(response.ok).toBe(true);
  });

  it('should handle 500 server errors', async () => {
    const { protectedSampleFetch } =
      await import('../SampleLoadingCircuitBreaker.js');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      protectedSampleFetch(
        'https://example.com/piano-C4.mp3',
        'harmony-C4-v10',
      ),
    ).rejects.toThrow(/500.*Internal Server Error/);
  });

  it('should handle network failures', async () => {
    const { protectedSampleFetch } =
      await import('../SampleLoadingCircuitBreaker.js');

    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));

    await expect(
      protectedSampleFetch(
        'https://example.com/piano-C4.mp3',
        'harmony-C4-v10',
      ),
    ).rejects.toThrow('Failed to fetch');
  });
});
