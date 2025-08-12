import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorsService } from '../creators.service.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CreatorsService', () => {
  let service: CreatorsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create comprehensive mock for Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        single: vi.fn(),
        upsert: vi.fn(),
      })),
    };

    // Mock Supabase service
    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    // Create service instance
    service = new CreatorsService(mockSupabaseService);

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
    const mockTutorials = [
      {
        creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
        creator_name: 'Bass Player 1',
      },
      {
        creator_channel_url: 'https://www.youtube.com/channel/UC987654321',
        creator_name: 'Bass Player 2',
      },
      {
        creator_channel_url: 'https://www.youtube.com/channel/UC123456789', // Duplicate
        creator_name: 'Bass Player 1',
      },
      {
        creator_channel_url: null,
        creator_name: 'No Channel',
      },
    ];

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
      }));
    });

    it('should return unique creator channels', async () => {
      // Arrange - Create a mock chain that properly handles two .not() calls
      const finalPromise = Promise.resolve({
        data: mockTutorials,
        error: null,
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });

      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          url: 'https://www.youtube.com/channel/UC123456789',
          name: 'Bass Player 1',
        },
        {
          url: 'https://www.youtube.com/channel/UC987654321',
          name: 'Bass Player 2',
        },
      ]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutorials');
    });

    it('should handle empty results', async () => {
      // Arrange
      const finalPromise = Promise.resolve({ data: [], error: null });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });

      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      const finalPromise = Promise.resolve({
        data: null,
        error: { message: 'Database error' },
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });

      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle null data response', async () => {
      // Arrange
      const finalPromise = Promise.resolve({ data: null, error: null });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });

      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should filter out entries with null values', async () => {
      // Arrange
      const tutorialsWithNulls = [
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Valid Creator',
        },
        {
          creator_channel_url: null,
          creator_name: 'No URL',
        },
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC987654321',
          creator_name: null,
        },
      ];

      const finalPromise = Promise.resolve({
        data: tutorialsWithNulls,
        error: null,
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });

      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      const result = await service.getAllCreatorChannels();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: 'https://www.youtube.com/channel/UC123456789',
        name: 'Valid Creator',
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYouTubeResponse),
      });

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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYouTubeResponse),
      });

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

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ items: mockYouTubeResponse.items.slice(0, 50) }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ items: mockYouTubeResponse.items.slice(50) }),
        });

      // Act
      const result = await service.fetchYouTubeChannelStats(largeChannelList);

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(51); // 50 + 1 from mocked responses
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

      // Mock database upsert
      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('creator_stats');
    });

    it('should handle empty creator channels', async () => {
      // Arrange
      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue([]);

      // Act
      await service.updateAllCreatorStats();

      // Assert
      expect(service.fetchYouTubeChannelStats).not.toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
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

    it('should handle database upsert errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi
          .fn()
          .mockResolvedValue({ error: { message: 'Upsert failed' } }),
      }));

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
      expect(mockSupabaseClient.from).toHaveBeenCalled();
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

      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));

      // Act
      await service.updateAllCreatorStats();

      // Assert
      const upsertCall = mockSupabaseClient.from().upsert;
      expect(upsertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriber_count: 1500000,
          subscriber_count_formatted: '1.5M subscribers',
        }),
        { onConflict: 'channel_url' },
      );
    });
  });

  describe('getCreatorStats', () => {
    const mockChannelUrl = 'https://www.youtube.com/channel/UC123456789';
    const mockDbData = {
      channel_url: mockChannelUrl,
      channel_id: 'UC123456789',
      creator_name: 'Bass Player 1',
      subscriber_count: 1000000,
      subscriber_count_formatted: '1.0M subscribers',
      thumbnail_url: 'https://example.com/thumb.jpg',
    };

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDbData, error: null }),
      }));
    });

    it('should return creator stats from database', async () => {
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
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('creator_stats');
    });

    it('should return null when stats not found', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when database error occurs', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }));

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle partial data correctly', async () => {
      // Arrange
      const partialData = {
        channel_url: mockChannelUrl,
        channel_id: null,
        creator_name: 'Partial Creator',
        subscriber_count: null,
        subscriber_count_formatted: null,
        thumbnail_url: null,
      };

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: partialData, error: null }),
      }));

      // Act
      const result = await service.getCreatorStats(mockChannelUrl);

      // Assert
      expect(result).toEqual({
        channelUrl: mockChannelUrl,
        channelId: null,
        creatorName: 'Partial Creator',
        subscriberCount: null,
        subscriberCountFormatted: null,
        thumbnailUrl: null,
      });
    });
  });

  describe('getStaleCreatorChannels', () => {
    const mockStaleChannels = [
      { channel_url: 'https://www.youtube.com/channel/UC123456789' },
      { channel_url: 'https://www.youtube.com/channel/UC987654321' },
    ];

    beforeEach(() => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: mockStaleChannels, error: null }),
      }));
    });

    it('should return stale creator channels', async () => {
      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([
        'https://www.youtube.com/channel/UC123456789',
        'https://www.youtube.com/channel/UC987654321',
      ]);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('creator_stats');
    });

    it('should handle empty results', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }));

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle null data response', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act
      const result = await service.getStaleCreatorChannels();

      // Assert
      expect(result).toEqual([]);
    });

    it('should use correct timestamp for stale check', async () => {
      // Arrange
      const now = new Date('2024-01-02T00:00:00Z');
      const expected24HoursAgo = new Date('2024-01-01T00:00:00Z').toISOString();
      vi.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const ltMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const selectMock = vi.fn().mockReturnValue({ lt: ltMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      // Act
      await service.getStaleCreatorChannels();

      // Assert
      expect(ltMock).toHaveBeenCalledWith(
        'last_fetched_at',
        expected24HoursAgo,
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

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

      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));

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

  describe('Subscriber Count Formatting (Private Method)', () => {
    // Testing the private method indirectly through updateAllCreatorStats
    it('should format subscriber counts correctly', async () => {
      // Arrange
      const testChannels = [
        { url: 'https://www.youtube.com/channel/UC123', name: 'Test' },
      ];
      const mockResponse = {
        items: [
          {
            id: 'UC123',
            statistics: { subscriberCount: '1500000' },
            snippet: { title: 'Test', thumbnails: {} },
          },
        ],
      };

      vi.spyOn(service, 'getAllCreatorChannels').mockResolvedValue(
        testChannels,
      );
      vi.spyOn(service, 'fetchYouTubeChannelStats').mockResolvedValue(
        mockResponse,
      );

      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));

      // Act
      await service.updateAllCreatorStats();

      // Assert
      const upsertCall = mockSupabaseClient.from().upsert;
      expect(upsertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriber_count_formatted: '1.5M subscribers',
        }),
        { onConflict: 'channel_url' },
      );
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

      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));

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

      mockSupabaseClient.from.mockImplementation(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));

      // Act & Assert - Should not throw
      await expect(service.updateAllCreatorStats()).resolves.toBeUndefined();
    });
  });
});
