import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorsService } from '../creators.service.js';
import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';
import { ResultUtils } from '../../shared/result.js';
import type { IResultCreatorRepository } from '../repositories/result-creator.repository.js';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let mockRepository: IResultCreatorRepository;
  let mockFetch: any;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Mock repository
    mockRepository = {
      findById: vi.fn(),
      findByChannelUrl: vi.fn(),
      findStaleCreators: vi.fn(),
      getAllUniqueChannelUrls: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      findAll: vi.fn(),
      saveMany: vi.fn(),
      deleteMany: vi.fn(),
      findByChannelId: vi.fn(),
      findByCreatorName: vi.fn(),
      findTopCreators: vi.fn(),
      search: vi.fn(),
      existsByChannelUrl: vi.fn(),
      findByIds: vi.fn(),
      findByChannelUrls: vi.fn(),
      updateMany: vi.fn(),
      countBySubscriberRange: vi.fn(),
    };

    // Create mock RequestContextService
    const mockRequestContext = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };

    // Create service instance
    service = new CreatorsService(mockRepository, mockRequestContext as any);

    // Reset environment variables
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;

    // Reset fetch mock
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('getAllCreatorChannels', () => {
    it('should return unique creator channels', async () => {
      // Arrange
      const mockChannels = [
        {
          url: 'https://www.youtube.com/channel/UC123456789',
          name: 'Bass Player 1',
        },
        {
          url: 'https://www.youtube.com/channel/UC987654321',
          name: 'Bass Player 2',
        },
      ];

      vi.mocked(mockRepository.getAllUniqueChannelUrls).mockResolvedValue(
        ResultUtils.ok(mockChannels),
      );

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockChannels);
      expect(mockRepository.getAllUniqueChannelUrls).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      // Arrange
      vi.mocked(mockRepository.getAllUniqueChannelUrls).mockResolvedValue(
        ResultUtils.ok([]),
      );

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      vi.mocked(mockRepository.getAllUniqueChannelUrls).mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.getAllUniqueChannelUrls).mockRejectedValue(
        new Error('Service unavailable'),
      );

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('fetchYouTubeChannelStats', () => {
    const mockChannelIds = ['UC123456789', 'UC987654321'];
    const mockYouTubeResponse = {
      items: [
        {
          id: 'UC123456789',
          statistics: {
            subscriberCount: '1000000',
          },
          snippet: {
            title: 'Bass Channel 1',
            thumbnails: {
              medium: { url: 'https://example.com/thumb1.jpg' },
            },
          },
        },
        {
          id: 'UC987654321',
          statistics: {
            subscriberCount: '500000',
          },
          snippet: {
            title: 'Bass Channel 2',
            thumbnails: {
              default: { url: 'https://example.com/thumb2.jpg' },
            },
          },
        },
      ],
    };

    it('should fetch YouTube channel statistics successfully', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockYouTubeResponse),
        }),
      );

      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual(mockYouTubeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=UC123456789,UC987654321&key=test-api-key',
      );
    });

    it('should handle missing API key gracefully', async () => {
      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual({ items: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use alternative API key environment variables', async () => {
      // Arrange
      process.env.GOOGLE_API_KEY = 'google-api-key';
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockYouTubeResponse),
        }),
      );

      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual(mockYouTubeResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=google-api-key'),
      );
    });

    it('should handle YouTube API errors', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual({ items: [] });
    });

    it('should handle network errors', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual({ items: [] });
    });

    it('should batch requests for large channel lists', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      const largeChannelList = Array.from(
        { length: 75 },
        (_, i) => `UC${i.toString().padStart(9, '0')}`,
      );

      // Create mock responses for batch requests
      const firstBatchItems = Array.from({ length: 50 }, (_, i) => ({
        id: `UC${i.toString().padStart(9, '0')}`,
        statistics: { subscriberCount: '1000000' },
        snippet: {
          title: `Channel ${i}`,
          thumbnails: { medium: { url: `https://example.com/thumb${i}.jpg` } },
        },
      }));

      const secondBatchItems = Array.from({ length: 25 }, (_, i) => ({
        id: `UC${(i + 50).toString().padStart(9, '0')}`,
        statistics: { subscriberCount: '500000' },
        snippet: {
          title: `Channel ${i + 50}`,
          thumbnails: {
            medium: { url: `https://example.com/thumb${i + 50}.jpg` },
          },
        },
      }));

      mockFetch
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: firstBatchItems }),
          }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: secondBatchItems }),
          }),
        );

      // Act
      const result = await service.fetchYouTubeChannelStats(largeChannelList);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(75); // 50 + 25 from mocked responses
    });

    it('should handle empty channel IDs array', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';

      // Act
      const result = await service.fetchYouTubeChannelStats([]);

      // Assert
      expect(result).toEqual({ items: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle malformed JSON response', async () => {
      // Arrange
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      // Act
      const result = await service.fetchYouTubeChannelStats(mockChannelIds);

      // Assert
      expect(result).toEqual({ items: [] });
    });
  });

  describe('updateAllCreatorStats', () => {
    const mockCreatorChannels = [
      {
        url: 'https://www.youtube.com/channel/UC123456789',
        name: 'Bass Player 1',
      },
      {
        url: 'https://www.youtube.com/@bassplayer2',
        name: 'Bass Player 2',
      },
    ];

    const mockYouTubeResponse = {
      items: [
        {
          id: 'UC123456789',
          statistics: {
            subscriberCount: '1500000',
          },
          snippet: {
            title: 'Updated Bass Channel 1',
            thumbnails: {
              medium: { url: 'https://example.com/thumb1-new.jpg' },
            },
          },
        },
      ],
    };

    beforeEach(() => {
      // Mock getAllCreatorChannels
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        mockCreatorChannels,
      );

      // Mock fetchYouTubeChannelStats
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue(
        mockYouTubeResponse,
      );

      // Mock repository methods
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));
      vi.mocked(mockRepository.save).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      vi.mocked(mockRepository.update).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(null),
      );
    });

    it('should successfully update all creator stats', async () => {
      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.getAllCreatorChannels).toHaveBeenCalled();
      expect(service.fetchYouTubeChannelStats).toHaveBeenCalledWith([
        'UC123456789',
        'bassplayer2',
      ]);
      // Verify that creators were saved/updated
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle empty creator channels', async () => {
      // Arrange
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue([]);

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.fetchYouTubeChannelStats).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should filter out invalid channel IDs', async () => {
      // Arrange
      const invalidChannels = [
        { url: 'https://invalid-url.com', name: 'Invalid' },
        { url: 'https://www.youtube.com/channel/UC123456789', name: 'Valid' },
      ];
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        invalidChannels,
      );

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.fetchYouTubeChannelStats).toHaveBeenCalledWith([
        'UC123456789',
      ]);
    });

    it('should handle database save errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.save).mockResolvedValue(
        ResultUtils.fail(new Error('Save failed')),
      );
      vi.mocked(mockRepository.update).mockResolvedValue(
        ResultUtils.fail(new Error('Update failed')),
      );
      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));

      // Act & Assert - Should not throw
      await expect(service.updateAllCreatorStats()).resolves.toBeUndefined();
    });

    it('should handle YouTube API failures gracefully', async () => {
      // Arrange
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue({
        items: [],
      });

      // Act
      await service.updateAllCreatorStats();

      // Assert
      // Should still attempt to save/update even without YouTube data
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle getAllCreatorChannels failure', async () => {
      // Arrange
      vi.spyOn(service, 'getAllCreatorChannels').mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.updateAllCreatorStats()).rejects.toThrow(
        'Database error',
      );
    });

    it('should format subscriber counts correctly', async () => {
      // Arrange
      const mockChannels = [
        {
          url: 'https://www.youtube.com/channel/UC123456789',
          name: 'Test Channel',
        },
      ];
      const mockResponseWithStats = {
        items: [
          {
            id: 'UC123456789',
            statistics: {
              subscriberCount: '1500000',
            },
            snippet: {
              title: 'Test Channel',
              thumbnails: { medium: { url: 'https://example.com/thumb.jpg' } },
            },
          },
        ],
      };
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        mockChannels,
      );
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue(
        mockResponseWithStats,
      );

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriberCount: 1500000,
        }),
      );
    });
  });

  describe('getCreatorStats', () => {
    const mockChannelUrl = 'https://www.youtube.com/channel/UC123456789';

    it('should return creator stats from database', async () => {
      // Arrange
      const mockCreator = Creator.reconstitute({
        id: CreatorId.create('123e4567-e89b-12d3-a456-426614174000'),
        channelUrl: ChannelUrl.create(mockChannelUrl),
        channelId: 'UC123456789',
        creatorName: 'Bass Player 1',
        subscriberCount: 1000000,
        subscriberCountFormatted: '1.0M subscribers',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        lastFetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(mockCreator),
      );

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        channelUrl: mockChannelUrl,
        channelId: 'UC123456789',
        creatorName: 'Bass Player 1',
        subscriberCount: 1000000,
        subscriberCountFormatted: '1.0M subscribers',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
      expect(mockRepository.findByChannelUrl).toHaveBeenCalledWith(
        expect.any(ChannelUrl),
      );
    });

    it('should return null when stats not found', async () => {
      // Arrange
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when database error occurs', async () => {
      // Arrange
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.fail(new Error('Not found')),
      );

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.findByChannelUrl).mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle partial data correctly', async () => {
      // Arrange
      const partialCreator = Creator.reconstitute({
        id: CreatorId.create('123e4567-e89b-12d3-a456-426614174000'),
        channelUrl: ChannelUrl.create(mockChannelUrl),
        channelId: undefined,
        creatorName: 'Partial Creator',
        subscriberCount: undefined,
        subscriberCountFormatted: undefined,
        thumbnailUrl: undefined,
        lastFetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(partialCreator),
      );

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        channelUrl: mockChannelUrl,
        channelId: undefined,
        creatorName: 'Partial Creator',
        subscriberCount: undefined,
        subscriberCountFormatted: 'No subscriber data',
        thumbnailUrl: undefined,
      });
    });
  });

  describe('getStaleCreatorChannels', () => {
    it('should return stale creator channels', async () => {
      // Arrange
      const staleCreators = [
        Creator.reconstitute({
          id: CreatorId.create('111e4567-e89b-12d3-a456-426614174111'),
          channelUrl: ChannelUrl.create(
            'https://www.youtube.com/channel/UC123456789',
          ),
          channelId: 'UC123456789',
          creatorName: 'Stale Creator 1',
          lastFetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        Creator.reconstitute({
          id: CreatorId.create('222e4567-e89b-12d3-a456-426614174222'),
          channelUrl: ChannelUrl.create(
            'https://www.youtube.com/channel/UC987654321',
          ),
          channelId: 'UC987654321',
          creatorName: 'Stale Creator 2',
          lastFetchedAt: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      vi.mocked(mockRepository.findStaleCreators).mockResolvedValue(
        ResultUtils.ok(staleCreators),
      );

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([
        'https://www.youtube.com/channel/UC123456789',
        'https://www.youtube.com/channel/UC987654321',
      ]);
      expect(mockRepository.findStaleCreators).toHaveBeenCalledWith(24);
    });

    it('should handle empty results', async () => {
      // Arrange
      vi.mocked(mockRepository.findStaleCreators).mockResolvedValue(
        ResultUtils.ok([]),
      );

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      vi.mocked(mockRepository.findStaleCreators).mockResolvedValue(
        ResultUtils.fail(new Error('Database error')),
      );

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle null data response', async () => {
      // Arrange
      vi.mocked(mockRepository.findStaleCreators).mockResolvedValue(
        ResultUtils.ok([]),
      );

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.findStaleCreators).mockRejectedValue(
        new Error('Service unavailable'),
      );

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('Channel ID Extraction (Private Method)', () => {
    // Testing the private method indirectly through updateAllCreatorStats
    it('should extract channel IDs from various YouTube URL formats', async () => {
      // Arrange
      const channelsWithVariousUrls = [
        {
          url: 'https://www.youtube.com/channel/UC123456789',
          name: 'Channel Format',
        },
        { url: 'https://www.youtube.com/c/customname', name: 'Custom Format' },
        { url: 'https://www.youtube.com/@username', name: 'Handle Format' },
        {
          url: 'https://www.youtube.com/user/oldusername',
          name: 'User Format',
        },
        { url: 'https://invalid-url.com', name: 'Invalid URL' },
      ];

      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        channelsWithVariousUrls,
      );
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue({
        items: [],
      });

      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));
      vi.mocked(mockRepository.save).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.fetchYouTubeChannelStats).toHaveBeenCalledWith([
        'UC123456789',
        'customname',
        'username',
        'oldusername',
      ]);
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should complete operations within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue([]);

      // Act
      await service.updateAllCreatorStats();
      const endTime = Date.now();

      // Assert - Should complete within 1 second (generous for unit test)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle very large channel lists efficiently', async () => {
      // Arrange
      const largeChannelList = Array.from({ length: 200 }, (_, i) => ({
        url: `https://www.youtube.com/channel/UC${i.toString().padStart(9, '0')}`,
        name: `Creator ${i}`,
      }));

      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        largeChannelList,
      );
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue({
        items: [],
      });

      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));
      vi.mocked(mockRepository.save).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.fetchYouTubeChannelStats).toHaveBeenCalled();
    });

    it('should handle malformed URLs gracefully', async () => {
      // Arrange
      const malformedUrls = [
        { url: '', name: 'Empty URL' },
        { url: 'not-a-url', name: 'Invalid URL' },
        { url: 'https://example.com', name: 'Non-YouTube URL' },
        { url: 'https://www.youtube.com/watch?v=123', name: 'Video URL' },
      ];

      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        malformedUrls,
      );
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue({
        items: [],
      });

      vi.mocked(mockRepository.exists).mockResolvedValue(ResultUtils.ok(false));
      vi.mocked(mockRepository.save).mockResolvedValue(
        ResultUtils.ok(undefined),
      );
      vi.mocked(mockRepository.findByChannelUrl).mockResolvedValue(
        ResultUtils.ok(null),
      );

      // Act & Assert - Should not throw
      await expect(service.updateAllCreatorStats()).resolves.toBeUndefined();
    });
  });
});
