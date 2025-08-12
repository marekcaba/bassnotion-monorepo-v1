import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorsController } from '../creators.controller.js';
import type { CreatorStats } from '../creators.service.js';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let mockCreatorsService: any;

  beforeEach(() => {
    // Mock CreatorsService
    mockCreatorsService = {
      getCreatorStats: vi.fn(),
      updateAllCreatorStats: vi.fn(),
      getStaleCreatorChannels: vi.fn(),
      getAllCreatorChannels: vi.fn(),
    };

    // Create controller instance
    controller = new CreatorsController(mockCreatorsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getCreatorStats', () => {
    const mockChannelUrl = 'https://www.youtube.com/channel/UC123456789';
    const mockCreatorStats: CreatorStats = {
      channelUrl: mockChannelUrl,
      channelId: 'UC123456789',
      creatorName: 'Bass Master',
      subscriberCount: 1500000,
      subscriberCountFormatted: '1.5M subscribers',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
    };

    it('should return creator stats successfully', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockResolvedValue(mockCreatorStats);

      // Act
      const result = await controller.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        success: true,
        data: mockCreatorStats,
      });
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        mockChannelUrl,
      );
    });

    it('should return error when channelUrl is missing', async () => {
      // Act
      const result = await controller.getCreatorStats('');

      // Assert
      expect(result).toEqual({
        error: 'channelUrl query parameter is required',
      });
      expect(mockCreatorsService.getCreatorStats).not.toHaveBeenCalled();
    });

    it('should return error when channelUrl is undefined', async () => {
      // Act
      const result = await controller.getCreatorStats(undefined as any);

      // Assert
      expect(result).toEqual({
        error: 'channelUrl query parameter is required',
      });
      expect(mockCreatorsService.getCreatorStats).not.toHaveBeenCalled();
    });

    it('should return fallback when creator stats not found', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        error: 'Creator stats not found',
        fallback: {
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        },
      });
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        mockChannelUrl,
      );
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act
      const result = await controller.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        error: 'Failed to fetch creator stats',
        fallback: {
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        },
      });
    });

    it('should handle partial creator stats', async () => {
      // Arrange
      const partialStats: CreatorStats = {
        channelUrl: mockChannelUrl,
        channelId: null,
        creatorName: 'Partial Creator',
        subscriberCount: undefined,
        subscriberCountFormatted: undefined,
        thumbnailUrl: undefined,
      };
      mockCreatorsService.getCreatorStats.mockResolvedValue(partialStats);

      // Act
      const result = await controller.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        success: true,
        data: partialStats,
      });
    });

    it('should handle URL with special characters', async () => {
      // Arrange
      const specialUrl = 'https://www.youtube.com/@special-creator_123';
      mockCreatorsService.getCreatorStats.mockResolvedValue(mockCreatorStats);

      // Act
      const result = await controller.getCreatorStats(specialUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        specialUrl,
      );
    });

    it('should handle very long URLs', async () => {
      // Arrange
      const longUrl =
        'https://www.youtube.com/channel/' + 'UC' + 'A'.repeat(100);
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(longUrl);

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(longUrl);
    });

    it('should handle unexpected service response formats', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockResolvedValue({
        // Malformed response - missing required fields
        someField: 'value',
      });

      // Act
      const result = await controller.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ someField: 'value' });
    });
  });

  describe('triggerBatchUpdate', () => {
    it('should trigger batch update successfully', async () => {
      // Arrange
      mockCreatorsService.updateAllCreatorStats.mockResolvedValue(undefined);
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        mockDate.toISOString(),
      );

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Batch update completed successfully',
        timestamp: '2024-01-01T12:00:00.000Z',
      });
      expect(mockCreatorsService.updateAllCreatorStats).toHaveBeenCalled();
    });

    it('should handle batch update errors', async () => {
      // Arrange
      const errorMessage = 'YouTube API rate limit exceeded';
      mockCreatorsService.updateAllCreatorStats.mockRejectedValue(
        new Error(errorMessage),
      );
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        mockDate.toISOString(),
      );

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result).toEqual({
        error: 'Batch update failed',
        message: errorMessage,
        timestamp: '2024-01-01T12:00:00.000Z',
      });
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      mockCreatorsService.updateAllCreatorStats.mockRejectedValue(
        'String error',
      );
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        mockDate.toISOString(),
      );

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result).toEqual({
        error: 'Batch update failed',
        message: 'Unknown error',
        timestamp: '2024-01-01T12:00:00.000Z',
      });
    });

    it('should handle service throwing null/undefined', async () => {
      // Arrange
      mockCreatorsService.updateAllCreatorStats.mockRejectedValue(null);
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        mockDate.toISOString(),
      );

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result).toEqual({
        error: 'Batch update failed',
        message: 'Unknown error',
        timestamp: '2024-01-01T12:00:00.000Z',
      });
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockCreatorsService.updateAllCreatorStats.mockRejectedValue(timeoutError);

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result.error).toBe('Batch update failed');
      expect(result.message).toBe('Request timeout');
    });

    it('should provide valid timestamp format', async () => {
      // Arrange
      mockCreatorsService.updateAllCreatorStats.mockResolvedValue(undefined);

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('getHealthStatus', () => {
    const mockAllChannels = [
      { url: 'https://www.youtube.com/channel/UC123', name: 'Channel 1' },
      { url: 'https://www.youtube.com/channel/UC456', name: 'Channel 2' },
      { url: 'https://www.youtube.com/channel/UC789', name: 'Channel 3' },
    ];

    const mockStaleChannels = [
      'https://www.youtube.com/channel/UC123',
      'https://www.youtube.com/channel/UC456',
    ];

    it('should return health status successfully', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue(
        mockStaleChannels,
      );
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(
        mockAllChannels,
      );
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
        mockDate.toISOString(),
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        success: true,
        stats: {
          totalChannels: 3,
          staleChannels: 2,
          freshChannels: 1,
          lastUpdate: '2024-01-01T12:00:00.000Z',
        },
        needsUpdate: true,
      });
      expect(mockCreatorsService.getStaleCreatorChannels).toHaveBeenCalled();
      expect(mockCreatorsService.getAllCreatorChannels).toHaveBeenCalled();
    });

    it('should indicate no update needed when all channels are fresh', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue([]);
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(
        mockAllChannels,
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats?.staleChannels).toBe(0);
      expect(result.stats?.freshChannels).toBe(3);
      expect(result.needsUpdate).toBe(false);
    });

    it('should handle empty channel lists', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue([]);
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue([]);

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        success: true,
        stats: {
          totalChannels: 0,
          staleChannels: 0,
          freshChannels: 0,
          lastUpdate: expect.any(String),
        },
        needsUpdate: false,
      });
    });

    it('should handle service errors for stale channels', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockRejectedValue(
        new Error('Database error'),
      );
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(
        mockAllChannels,
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        error: 'Failed to check health status',
        message: 'Database error',
      });
    });

    it('should handle service errors for all channels', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue(
        mockStaleChannels,
      );
      mockCreatorsService.getAllCreatorChannels.mockRejectedValue(
        new Error('Network error'),
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        error: 'Failed to check health status',
        message: 'Network error',
      });
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockRejectedValue(
        'String error',
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        error: 'Failed to check health status',
        message: 'Unknown error',
      });
    });

    it('should handle null/undefined exceptions', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockRejectedValue(null);

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toEqual({
        error: 'Failed to check health status',
        message: 'Unknown error',
      });
    });

    it('should calculate fresh channels correctly', async () => {
      // Arrange
      const tenChannels = Array.from({ length: 10 }, (_, i) => ({
        url: `https://www.youtube.com/channel/UC${i}`,
        name: `Channel ${i}`,
      }));
      const threeStaleChannels = [
        'https://www.youtube.com/channel/UC1',
        'https://www.youtube.com/channel/UC3',
        'https://www.youtube.com/channel/UC7',
      ];

      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(tenChannels);
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue(
        threeStaleChannels,
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats?.totalChannels).toBe(10);
      expect(result.stats?.staleChannels).toBe(3);
      expect(result.stats?.freshChannels).toBe(7);
      expect(result.needsUpdate).toBe(true);
    });

    it('should provide valid timestamp format', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue([]);
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue([]);

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result.stats?.lastUpdate).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent error format across endpoints', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockRejectedValue(
        new Error('Service error'),
      );
      mockCreatorsService.updateAllCreatorStats.mockRejectedValue(
        new Error('Service error'),
      );
      mockCreatorsService.getStaleCreatorChannels.mockRejectedValue(
        new Error('Service error'),
      );

      // Act
      const statsResult = await controller.getCreatorStats('test-url');
      const batchResult = await controller.triggerBatchUpdate();
      const healthResult = await controller.getHealthStatus();

      // Assert
      expect(statsResult).toHaveProperty('error');
      expect(statsResult).toHaveProperty('fallback');
      expect(batchResult).toHaveProperty('error');
      expect(batchResult).toHaveProperty('message');
      expect(healthResult).toHaveProperty('error');
      expect(healthResult).toHaveProperty('message');
    });

    it('should return consistent success format for stats endpoint', async () => {
      // Arrange
      const mockStats: CreatorStats = {
        channelUrl: 'test-url',
        channelId: 'test-id',
        creatorName: 'Test Creator',
        subscriberCount: 1000,
        subscriberCountFormatted: '1.0K subscribers',
        thumbnailUrl: 'test-thumbnail',
      };
      mockCreatorsService.getCreatorStats.mockResolvedValue(mockStats);

      // Act
      const result = await controller.getCreatorStats('test-url');

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
      expect(result).not.toHaveProperty('fallback');
    });

    it('should return consistent success format for batch update endpoint', async () => {
      // Arrange
      mockCreatorsService.updateAllCreatorStats.mockResolvedValue(undefined);

      // Act
      const result = await controller.triggerBatchUpdate();

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result).not.toHaveProperty('error');
    });

    it('should return consistent success format for health endpoint', async () => {
      // Arrange
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue([]);
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue([]);

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('needsUpdate');
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const mockStats: CreatorStats = {
        channelUrl: 'test-url',
        channelId: 'test-id',
        creatorName: 'Test Creator',
        subscriberCount: 1000,
        subscriberCountFormatted: '1.0K subscribers',
        thumbnailUrl: 'test-thumbnail',
      };
      mockCreatorsService.getCreatorStats.mockResolvedValue(mockStats);

      // Act - Simulate 10 concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        controller.getCreatorStats('test-url'),
      );
      const results = await Promise.all(requests);

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockStats);
      });
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledTimes(10);
    });

    it('should complete operations within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      await controller.getCreatorStats('test-url');
      const endTime = Date.now();

      // Assert - Should complete within 1 second (generous for unit test)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle memory-intensive operations', async () => {
      // Arrange
      const largeChannelList = Array.from({ length: 1000 }, (_, i) => ({
        url: `https://www.youtube.com/channel/UC${i}`,
        name: `Channel ${i}`,
      }));
      const largeStaleList = Array.from(
        { length: 500 },
        (_, i) => `https://www.youtube.com/channel/UC${i}`,
      );

      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(
        largeChannelList,
      );
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue(
        largeStaleList,
      );

      // Act
      const result = await controller.getHealthStatus();

      // Assert
      expect(result.success).toBe(true);
      expect(result.stats?.totalChannels).toBe(1000);
      expect(result.stats?.staleChannels).toBe(500);
      expect(result.stats?.freshChannels).toBe(500);
    });

    it('should handle malformed service responses gracefully', async () => {
      // Arrange
      mockCreatorsService.getCreatorStats.mockResolvedValue(undefined);

      // Act
      const result = await controller.getCreatorStats('test-url');

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(result.fallback).toBeDefined();
    });

    it('should handle service returning unexpected data types', async () => {
      // Arrange
      mockCreatorsService.getAllCreatorChannels.mockResolvedValue(
        'not-an-array' as any,
      );
      mockCreatorsService.getStaleCreatorChannels.mockResolvedValue(123 as any);

      // Act & Assert - Should not throw
      await expect(controller.getHealthStatus()).resolves.toBeDefined();
    });
  });

  describe('Input Validation & Security', () => {
    it('should handle SQL injection attempts in channel URL', async () => {
      // Arrange
      const maliciousUrl = "'; DROP TABLE creator_stats; --";
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(maliciousUrl);

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        maliciousUrl,
      );
    });

    it('should handle extremely long URLs', async () => {
      // Arrange
      const longUrl = 'https://www.youtube.com/channel/' + 'A'.repeat(10000);
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(longUrl);

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(longUrl);
    });

    it('should handle URLs with special characters', async () => {
      // Arrange
      const specialUrl = 'https://www.youtube.com/@creator%20with%20spaces';
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(specialUrl);

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        specialUrl,
      );
    });

    it('should handle Unicode characters in URLs', async () => {
      // Arrange
      const unicodeUrl = 'https://www.youtube.com/@créateur-français-🎵';
      mockCreatorsService.getCreatorStats.mockResolvedValue(null);

      // Act
      const result = await controller.getCreatorStats(unicodeUrl);

      // Assert
      expect(result.error).toBe('Creator stats not found');
      expect(mockCreatorsService.getCreatorStats).toHaveBeenCalledWith(
        unicodeUrl,
      );
    });
  });
});
