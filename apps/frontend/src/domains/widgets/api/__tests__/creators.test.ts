/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCreatorStats,
  triggerBatchUpdate,
  getCreatorHealthStatus,
  type CreatorStats,
  type CreatorStatsResponse,
} from '../creators';
import { apiClient } from '@/lib/api-client';

// Create a more robust mock setup following existing patterns
const createMockResponse = (data: any, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
});

// Mock the apiClient
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Creators API', () => {
  const mockApiClient = apiClient as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('getCreatorStats', () => {
    const validChannelUrl = 'https://youtube.com/channel/UC1234567890';
    const mockCreatorData: CreatorStats = {
      channelUrl: validChannelUrl,
      channelId: 'UC1234567890',
      creatorName: 'Test Creator',
      subscriberCount: 150000,
      subscriberCountFormatted: '150K',
      thumbnailUrl: 'https://example.com/avatar.jpg',
    };

    const mockSuccessResponse: CreatorStatsResponse = {
      success: true,
      data: mockCreatorData,
    };

    describe('Successful API Calls', () => {
      it('should fetch creator stats successfully with valid URL', async () => {
        // Arrange
        mockApiClient.get.mockResolvedValue(mockSuccessResponse);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/api/creators/stats?channelUrl=${encodeURIComponent(validChannelUrl)}`,
        );
        expect(result).toEqual(mockSuccessResponse);
        expect(result.success).toBe(true);
        expect(result.data?.creatorName).toBe('Test Creator');
        expect(result.data?.subscriberCountFormatted).toBe('150K');
      });

      it('should properly encode special characters in channel URL', async () => {
        // Arrange
        const specialChannelUrl =
          'https://youtube.com/channel/@creator-name%20with spaces';
        mockApiClient.get.mockResolvedValue(mockSuccessResponse);

        // Act
        await getCreatorStats(specialChannelUrl);

        // Assert
        expect(mockApiClient.get).toHaveBeenCalledWith(
          `/api/creators/stats?channelUrl=${encodeURIComponent(specialChannelUrl)}`,
        );
      });

      it('should handle response with minimal data', async () => {
        // Arrange
        const minimalResponse: CreatorStatsResponse = {
          success: true,
          data: {
            channelUrl: validChannelUrl,
            creatorName: 'Minimal Creator',
          },
        };
        mockApiClient.get.mockResolvedValue(minimalResponse);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.creatorName).toBe('Minimal Creator');
        expect(result.data?.subscriberCount).toBeUndefined();
        expect(result.data?.thumbnailUrl).toBeUndefined();
      });

      it('should handle response with all optional fields', async () => {
        // Arrange
        const fullResponse: CreatorStatsResponse = {
          success: true,
          data: {
            channelUrl: validChannelUrl,
            channelId: 'UC1234567890',
            creatorName: 'Full Creator',
            subscriberCount: 1500000,
            subscriberCountFormatted: '1.5M',
            thumbnailUrl: 'https://example.com/full-avatar.jpg',
          },
        };
        mockApiClient.get.mockResolvedValue(fullResponse);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.channelId).toBe('UC1234567890');
        expect(result.data?.subscriberCount).toBe(1500000);
        expect(result.data?.subscriberCountFormatted).toBe('1.5M');
        expect(result.data?.thumbnailUrl).toBe(
          'https://example.com/full-avatar.jpg',
        );
      });
    });

    describe('Input Validation', () => {
      it('should return error for empty channel URL', async () => {
        // Act
        const result = await getCreatorStats('');

        // Assert
        expect(mockApiClient.get).not.toHaveBeenCalled();
        expect(result.error).toBe('Channel URL is required');
        expect(result.fallback).toEqual({
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        });
      });

      it('should return error for null channel URL', async () => {
        // Act
        const result = await getCreatorStats(null as any);

        // Assert
        expect(mockApiClient.get).not.toHaveBeenCalled();
        expect(result.error).toBe('Channel URL is required');
        expect(result.fallback).toEqual({
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        });
      });

      it('should return error for undefined channel URL', async () => {
        // Act
        const result = await getCreatorStats(undefined as any);

        // Assert
        expect(mockApiClient.get).not.toHaveBeenCalled();
        expect(result.error).toBe('Channel URL is required');
        expect(result.fallback).toEqual({
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        });
      });
    });

    describe('Error Handling', () => {
      it('should handle API client throwing an error', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockApiClient.get.mockRejectedValue(new Error('Network error'));

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error fetching creator stats:"'),
        );
        expect(result.error).toBe('Failed to fetch creator stats');
        expect(result.fallback).toEqual({
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        });

        consoleErrorSpy.mockRestore();
      });

      it('should handle API error responses', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        const apiError = {
          message: 'Creator not found',
          status: 404,
        };
        mockApiClient.get.mockRejectedValue(apiError);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error fetching creator stats:"'),
        );
        expect(result.error).toBe('Failed to fetch creator stats');
        expect(result.fallback).toEqual({
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        });

        consoleErrorSpy.mockRestore();
      });

      it('should handle response with success: false', async () => {
        // Arrange
        const errorResponse: CreatorStatsResponse = {
          success: false,
          error: 'Channel not found',
          fallback: {
            creatorName: 'Unknown Creator',
            subscriberCountFormatted: 'Subscribe',
          },
        };
        mockApiClient.get.mockResolvedValue(errorResponse);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Channel not found');
        expect(result.fallback?.creatorName).toBe('Unknown Creator');
      });

      it('should handle response with missing data', async () => {
        // Arrange
        const emptyResponse: CreatorStatsResponse = {
          success: true,
        };
        mockApiClient.get.mockResolvedValue(emptyResponse);

        // Act
        const result = await getCreatorStats(validChannelUrl);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data).toBeUndefined();
      });
    });

    describe('URL Edge Cases', () => {
      const urlTestCases = [
        {
          name: 'YouTube channel URL with @handle',
          url: 'https://youtube.com/@testcreator',
        },
        {
          name: 'YouTube channel URL with custom URL',
          url: 'https://youtube.com/c/testcreator',
        },
        {
          name: 'YouTube channel URL with user',
          url: 'https://youtube.com/user/testcreator',
        },
        {
          name: 'YouTube channel URL with query parameters',
          url: 'https://youtube.com/channel/UC1234567890?tab=videos',
        },
        {
          name: 'URL with special characters',
          url: 'https://youtube.com/channel/UC1234567890#featured',
        },
      ];

      urlTestCases.forEach(({ name, url }) => {
        it(`should handle ${name}`, async () => {
          // Arrange
          mockApiClient.get.mockResolvedValue(mockSuccessResponse);

          // Act
          await getCreatorStats(url);

          // Assert
          expect(mockApiClient.get).toHaveBeenCalledWith(
            `/api/creators/stats?channelUrl=${encodeURIComponent(url)}`,
          );
        });
      });
    });
  });

  describe('triggerBatchUpdate', () => {
    describe('Successful API Calls', () => {
      it('should trigger batch update successfully', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          message: 'Batch update triggered successfully',
        };
        mockApiClient.post.mockResolvedValue(mockResponse);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(mockApiClient.post).toHaveBeenCalledWith(
          '/api/creators/batch-update',
        );
        expect(result).toEqual(mockResponse);
        expect(result.success).toBe(true);
        expect(result.message).toBe('Batch update triggered successfully');
      });

      it('should handle response without message', async () => {
        // Arrange
        const mockResponse = {
          success: true,
        };
        mockApiClient.post.mockResolvedValue(mockResponse);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBeUndefined();
      });

      it('should handle response with custom message', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          message: 'Update scheduled and will complete in 5 minutes',
        };
        mockApiClient.post.mockResolvedValue(mockResponse);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toBe(
          'Update scheduled and will complete in 5 minutes',
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle API client throwing an error', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockApiClient.post.mockRejectedValue(new Error('Network error'));

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error triggering batch update:"'),
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to trigger batch update');

        consoleErrorSpy.mockRestore();
      });

      it('should handle API error responses', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        const apiError = {
          message: 'Unauthorized',
          status: 401,
        };
        mockApiClient.post.mockRejectedValue(apiError);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error triggering batch update:"'),
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to trigger batch update');

        consoleErrorSpy.mockRestore();
      });

      it('should handle response with success: false', async () => {
        // Arrange
        const errorResponse = {
          success: false,
          error: 'Update already in progress',
        };
        mockApiClient.post.mockResolvedValue(errorResponse);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Update already in progress');
      });

      it('should handle response with both error and message', async () => {
        // Arrange
        const errorResponse = {
          success: false,
          message: 'Partial update completed',
          error: 'Some channels failed to update',
        };
        mockApiClient.post.mockResolvedValue(errorResponse);

        // Act
        const result = await triggerBatchUpdate();

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toBe('Partial update completed');
        expect(result.error).toBe('Some channels failed to update');
      });
    });
  });

  describe('getCreatorHealthStatus', () => {
    const mockHealthStats = {
      totalChannels: 150,
      staleChannels: 12,
      freshChannels: 138,
      lastUpdate: '2024-01-15T10:30:00Z',
    };

    describe('Successful API Calls', () => {
      it('should fetch health status successfully', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          stats: mockHealthStats,
          needsUpdate: false,
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(mockApiClient.get).toHaveBeenCalledWith('/api/creators/health');
        expect(result).toEqual(mockResponse);
        expect(result.success).toBe(true);
        expect(result.stats?.totalChannels).toBe(150);
        expect(result.stats?.staleChannels).toBe(12);
        expect(result.stats?.freshChannels).toBe(138);
        expect(result.needsUpdate).toBe(false);
      });

      it('should handle response indicating update needed', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          stats: {
            ...mockHealthStats,
            staleChannels: 50,
            freshChannels: 100,
          },
          needsUpdate: true,
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.success).toBe(true);
        expect(result.needsUpdate).toBe(true);
        expect(result.stats?.staleChannels).toBe(50);
      });

      it('should handle response without stats', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          needsUpdate: false,
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.success).toBe(true);
        expect(result.stats).toBeUndefined();
        expect(result.needsUpdate).toBe(false);
      });

      it('should handle response with only some stats fields', async () => {
        // Arrange
        const partialStats = {
          totalChannels: 100,
          lastUpdate: '2024-01-15T10:30:00Z',
        };
        const mockResponse = {
          success: true,
          stats: partialStats,
        };
        mockApiClient.get.mockResolvedValue(mockResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.success).toBe(true);
        expect(result.stats?.totalChannels).toBe(100);
        expect(result.stats?.staleChannels).toBeUndefined();
        expect(result.stats?.freshChannels).toBeUndefined();
        expect(result.stats?.lastUpdate).toBe('2024-01-15T10:30:00Z');
      });
    });

    describe('Error Handling', () => {
      it('should handle API client throwing an error', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        mockApiClient.get.mockRejectedValue(new Error('Network timeout'));

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error checking creator health:"'),
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to check creator health');

        consoleErrorSpy.mockRestore();
      });

      it('should handle API error responses', async () => {
        // Arrange
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        const apiError = {
          message: 'Service unavailable',
          status: 503,
        };
        mockApiClient.get.mockRejectedValue(apiError);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Error checking creator health:"'),
        );
        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to check creator health');

        consoleErrorSpy.mockRestore();
      });

      it('should handle response with success: false', async () => {
        // Arrange
        const errorResponse = {
          success: false,
          error: 'Health check service is down',
        };
        mockApiClient.get.mockResolvedValue(errorResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.success).toBe(false);
        expect(result.error).toBe('Health check service is down');
      });

      it('should handle malformed response data', async () => {
        // Arrange
        const malformedResponse = {
          success: true,
          stats: null,
          needsUpdate: 'invalid',
        };
        mockApiClient.get.mockResolvedValue(malformedResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.success).toBe(true);
        expect(result.stats).toBeNull();
        expect(result.needsUpdate).toBe('invalid');
      });
    });

    describe('Date Handling', () => {
      it('should handle different date formats in lastUpdate', async () => {
        // Arrange
        const isoDateResponse = {
          success: true,
          stats: {
            ...mockHealthStats,
            lastUpdate: '2024-01-15T10:30:00.000Z',
          },
        };
        mockApiClient.get.mockResolvedValue(isoDateResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.stats?.lastUpdate).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should handle null lastUpdate', async () => {
        // Arrange
        const nullDateResponse = {
          success: true,
          stats: {
            ...mockHealthStats,
            lastUpdate: null,
          },
        };
        mockApiClient.get.mockResolvedValue(nullDateResponse);

        // Act
        const result = await getCreatorHealthStatus();

        // Assert
        expect(result.stats?.lastUpdate).toBeNull();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed success and error responses across functions', async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // getCreatorStats succeeds
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: { channelUrl: 'test', creatorName: 'Test' },
      });

      // triggerBatchUpdate fails
      mockApiClient.post.mockRejectedValueOnce(new Error('Network error'));

      // getCreatorHealthStatus succeeds
      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        needsUpdate: true,
      });

      // Act
      const [statsResult, updateResult, healthResult] = await Promise.all([
        getCreatorStats('https://youtube.com/test'),
        triggerBatchUpdate(),
        getCreatorHealthStatus(),
      ]);

      // Assert
      expect(statsResult.success).toBe(true);
      expect(updateResult.success).toBe(false);
      expect(healthResult.success).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    it('should handle concurrent API calls correctly', async () => {
      // Arrange
      const channelUrl1 = 'https://youtube.com/channel/1';
      const channelUrl2 = 'https://youtube.com/channel/2';

      mockApiClient.get
        .mockResolvedValueOnce({
          success: true,
          data: { channelUrl: channelUrl1, creatorName: 'Creator 1' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { channelUrl: channelUrl2, creatorName: 'Creator 2' },
        });

      // Act
      const [result1, result2] = await Promise.all([
        getCreatorStats(channelUrl1),
        getCreatorStats(channelUrl2),
      ]);

      // Assert
      expect(result1.data?.creatorName).toBe('Creator 1');
      expect(result2.data?.creatorName).toBe('Creator 2');
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Environment Configuration', () => {
    it('should work with different API base URLs', async () => {
      // Arrange - This test ensures the mocking works regardless of environment
      process.env.NEXT_PUBLIC_API_URL = 'https://api.production.com';
      mockApiClient.get.mockResolvedValue({ success: true });

      // Act
      await getCreatorStats('https://youtube.com/test');

      // Assert
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/creators/stats?channelUrl=https%3A%2F%2Fyoutube.com%2Ftest',
      );
    });
  });
});
