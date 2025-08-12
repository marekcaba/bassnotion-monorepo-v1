import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorsController } from '../creators.controller.js';
import { CreatorsService } from '../creators.service.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Creators Integration Tests', () => {
  let controller: CreatorsController;
  let service: CreatorsService;
  let mockSupabaseService: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Create comprehensive Supabase client mock
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

    mockSupabaseService = {
      getClient: vi.fn().mockReturnValue(mockSupabaseClient),
    };

    // Create service and controller instances directly (simplified approach)
    service = new CreatorsService(mockSupabaseService);
    controller = new CreatorsController(service);

    // Reset environment variables
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;

    // Clear fetch mock
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Creator Stats Workflow', () => {
    const mockTutorials = [
      {
        creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
        creator_name: 'Bass Master Pro',
      },
      {
        creator_channel_url: 'https://www.youtube.com/@modernbassist',
        creator_name: 'Modern Bassist',
      },
      {
        creator_channel_url: 'https://www.youtube.com/c/JazzBassAcademy',
        creator_name: 'Jazz Bass Academy',
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
            title: 'Bass Master Pro Official',
            thumbnails: {
              medium: { url: 'https://yt3.ggpht.com/bass-master-thumb.jpg' },
            },
          },
        },
        {
          id: 'modernbassist',
          statistics: {
            subscriberCount: '750000',
          },
          snippet: {
            title: 'Modern Bassist',
            thumbnails: {
              default: {
                url: 'https://yt3.ggpht.com/modern-bassist-thumb.jpg',
              },
            },
          },
        },
        {
          id: 'JazzBassAcademy',
          statistics: {
            subscriberCount: '250000',
          },
          snippet: {
            title: 'Jazz Bass Academy',
            thumbnails: {
              high: { url: 'https://yt3.ggpht.com/jazz-bass-thumb.jpg' },
            },
          },
        },
      ],
    };

    const mockCreatorStatsDb = {
      channel_url: 'https://www.youtube.com/channel/UC123456789',
      channel_id: 'UC123456789',
      creator_name: 'Bass Master Pro Official',
      subscriber_count: 1500000,
      subscriber_count_formatted: '1.5M subscribers',
      thumbnail_url: 'https://yt3.ggpht.com/bass-master-thumb.jpg',
      last_fetched_at: '2024-01-01T12:00:00Z',
    };

    it('should complete full creator stats management workflow', async () => {
      // Arrange - Set up all mocks for the complete workflow

      // 1. Mock tutorial data fetch for getAllCreatorChannels
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: mockTutorials,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        return {};
      });

      // 2. Mock YouTube API
      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockYouTubeResponse),
      });

      // 3. Mock database upsert for stats storage
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: mockTutorials,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockCreatorStatsDb, error: null }),
            lt: vi.fn().mockResolvedValue({
              data: [
                { channel_url: 'https://www.youtube.com/channel/UC123456789' },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      // Act & Assert - Execute complete workflow

      // Step 1: Get health status (initial state)
      const initialHealth = await controller.getHealthStatus();
      expect(initialHealth.success).toBe(true);
      expect(initialHealth.stats?.totalChannels).toBe(3);
      expect(initialHealth.stats?.staleChannels).toBe(1);
      expect(initialHealth.needsUpdate).toBe(true);

      // Step 2: Trigger batch update to fetch fresh data
      const batchResult = await controller.triggerBatchUpdate();
      expect(batchResult.success).toBe(true);
      expect(batchResult.message).toBe('Batch update completed successfully');

      // Verify YouTube API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=UC123456789,modernbassist,JazzBassAcademy&key=test-api-key',
      );

      // Step 3: Verify data was stored in database
      const upsertCalls = mockSupabaseClient.from().upsert;
      expect(upsertCalls).toHaveBeenCalledTimes(3); // Once for each creator

      // Step 4: Get specific creator stats
      const creatorStatsResult = await controller.getCreatorStats(
        'https://www.youtube.com/channel/UC123456789',
      );
      expect(creatorStatsResult.success).toBe(true);
      expect(creatorStatsResult.data).toEqual({
        channelUrl: 'https://www.youtube.com/channel/UC123456789',
        channelId: 'UC123456789',
        creatorName: 'Bass Master Pro Official',
        subscriberCount: 1500000,
        subscriberCountFormatted: '1.5M subscribers',
        thumbnailUrl: 'https://yt3.ggpht.com/bass-master-thumb.jpg',
      });

      // Step 5: Verify health status after update
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }), // No stale channels
          };
        }
        return {};
      });

      const finalHealth = await controller.getHealthStatus();
      expect(finalHealth.success).toBe(true);
      expect(finalHealth.stats?.staleChannels).toBe(0);
      expect(finalHealth.needsUpdate).toBe(false);
    });

    it('should handle YouTube API failures gracefully in workflow', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: mockTutorials,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'API quota exceeded',
      });

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert
      expect(batchResult.success).toBe(true); // Should still succeed

      // Verify that creators were still processed even without YouTube data
      const upsertCalls = mockSupabaseClient.from().upsert;
      expect(upsertCalls).toHaveBeenCalledTimes(3);

      // Verify creators were stored with partial data (no subscriber counts)
      expect(upsertCalls).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Bass Master Pro',
          subscriber_count: undefined,
          subscriber_count_formatted: undefined,
        }),
        { onConflict: 'channel_url' },
      );
    });

    it('should handle missing API key workflow', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: mockTutorials,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      // No API key set

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert
      expect(batchResult.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled(); // No API call without key

      // Should still process creators with available data
      const upsertCalls = mockSupabaseClient.from().upsert;
      expect(upsertCalls).toHaveBeenCalledTimes(3);
    });

    it('should handle large batch processing efficiently', async () => {
      // Arrange - Create 100 creators to test batching
      const largeTutorialSet = Array.from({ length: 100 }, (_, i) => ({
        creator_channel_url: `https://www.youtube.com/channel/UC${i.toString().padStart(9, '0')}`,
        creator_name: `Creator ${i}`,
      }));

      const largeYouTubeResponse1 = {
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `UC${i.toString().padStart(9, '0')}`,
          statistics: { subscriberCount: '10000' },
          snippet: {
            title: `Creator ${i}`,
            thumbnails: {
              default: { url: `https://example.com/thumb${i}.jpg` },
            },
          },
        })),
      };

      const largeYouTubeResponse2 = {
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `UC${(i + 50).toString().padStart(9, '0')}`,
          statistics: { subscriberCount: '15000' },
          snippet: {
            title: `Creator ${i + 50}`,
            thumbnails: {
              default: { url: `https://example.com/thumb${i + 50}.jpg` },
            },
          },
        })),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: largeTutorialSet,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      process.env.YOUTUBE_API_KEY = 'test-api-key';
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(largeYouTubeResponse1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(largeYouTubeResponse2),
        });

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert
      expect(batchResult.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Two batches of 50 each

      // Verify all creators were processed
      const upsertCalls = mockSupabaseClient.from().upsert;
      expect(upsertCalls).toHaveBeenCalledTimes(100);
    });
  });

  describe('Creator Discovery & Management Workflow', () => {
    it('should discover creators from tutorials and maintain stats', async () => {
      // Arrange
      const tutorialsWithMixedData = [
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Verified Creator',
        },
        {
          creator_channel_url: null,
          creator_name: 'No Channel Creator',
        },
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC987654321',
          creator_name: null,
        },
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789', // Duplicate
          creator_name: 'Verified Creator',
        },
      ];

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: tutorialsWithMixedData,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        return {};
      });

      // Act - Get all creator channels through service
      const allChannels = await service.getAllCreatorChannels();

      // Assert - Should filter and deduplicate
      expect(allChannels).toHaveLength(1);
      expect(allChannels[0]).toEqual({
        url: 'https://www.youtube.com/channel/UC123456789',
        name: 'Verified Creator',
      });

      // Act - Get through controller endpoint (testing health check)
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      });

      const healthResult = await controller.getHealthStatus();

      // Assert
      expect(healthResult.success).toBe(true);
      expect(healthResult.stats?.totalChannels).toBe(1);
      expect(healthResult.needsUpdate).toBe(false);
    });

    it('should handle stale data detection and refresh workflow', async () => {
      // Arrange
      const staleChannelUrl = 'https://www.youtube.com/channel/UC123456789';
      const freshChannelUrl = 'https://www.youtube.com/channel/UC987654321';

      const allChannels = [
        { url: staleChannelUrl, name: 'Stale Creator' },
        { url: freshChannelUrl, name: 'Fresh Creator' },
      ];

      const staleChannels = [staleChannelUrl];

      // Mock health check calls
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          const finalPromise = Promise.resolve({
            data: allChannels,
            error: null,
          });
          const secondNotMock = vi.fn().mockReturnValue(finalPromise);
          const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
          const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
          return { select: selectMock };
        }
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({
              data: staleChannels.map((url) => ({ channel_url: url })),
              error: null,
            }),
          };
        }
        return {};
      });

      // Act
      const healthResult = await controller.getHealthStatus();

      // Assert
      expect(healthResult.success).toBe(true);
      expect(healthResult.stats?.totalChannels).toBe(2);
      expect(healthResult.stats?.staleChannels).toBe(1);
      expect(healthResult.stats?.freshChannels).toBe(1);
      expect(healthResult.needsUpdate).toBe(true);
    });
  });

  describe('Error Recovery & Resilience', () => {
    it('should recover from partial database failures', async () => {
      // Arrange
      const mockTutorials = [
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Creator 1',
        },
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC987654321',
          creator_name: 'Creator 2',
        },
      ];

      const finalPromise = Promise.resolve({
        data: mockTutorials,
        error: null,
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      // Mock partial database failure - first upsert fails, second succeeds
      let upsertCallCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockImplementation(() => {
              upsertCallCount++;
              if (upsertCallCount === 1) {
                return Promise.resolve({
                  error: { message: 'Database timeout' },
                });
              }
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      });

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert - Should complete successfully despite partial failures
      expect(batchResult.success).toBe(true);
    });

    it('should handle YouTube API rate limiting gracefully', async () => {
      // Arrange
      const mockTutorials = [
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Creator 1',
        },
      ];

      const finalPromise = Promise.resolve({
        data: mockTutorials,
        error: null,
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert - Should handle rate limiting gracefully
      expect(batchResult.success).toBe(true);
    });

    it('should handle network failures and timeouts', async () => {
      // Arrange
      const mockTutorials = [
        {
          creator_channel_url: 'https://www.youtube.com/channel/UC123456789',
          creator_name: 'Creator 1',
        },
      ];

      const finalPromise = Promise.resolve({
        data: mockTutorials,
        error: null,
      });
      const secondNotMock = vi.fn().mockReturnValue(finalPromise);
      const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
      const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
      mockSupabaseClient.from.mockReturnValue({ select: selectMock });

      process.env.YOUTUBE_API_KEY = 'test-api-key';
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      // Act
      const batchResult = await controller.triggerBatchUpdate();

      // Assert - Should handle network failures gracefully
      expect(batchResult.success).toBe(true);
    });
  });

  describe('Data Consistency & Validation', () => {
    it('should maintain data consistency across service calls', async () => {
      // Arrange
      const channelUrl = 'https://www.youtube.com/channel/UC123456789';
      const mockDbData = {
        channel_url: channelUrl,
        channel_id: 'UC123456789',
        creator_name: 'Consistent Creator',
        subscriber_count: 1000000,
        subscriber_count_formatted: '1.0M subscribers',
        thumbnail_url: 'https://example.com/thumb.jpg',
        last_fetched_at: '2024-01-01T12:00:00Z',
      };

      // Mock service calls
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue({ data: mockDbData, error: null }),
          };
        }
        return {};
      });

      // Act - Call multiple times
      const stats1 = await service.getCreatorStats(channelUrl);
      const stats2 = await service.getCreatorStats(channelUrl);
      const controllerResult = await controller.getCreatorStats(channelUrl);

      // Assert - All calls should return consistent data
      expect(stats1).toEqual(stats2);
      expect(controllerResult.success).toBe(true);
      expect(controllerResult.data?.creatorName).toBe('Consistent Creator');
      expect(controllerResult.data?.subscriberCount).toBe(1000000);
    });

    it('should validate channel URL formats correctly', async () => {
      // Arrange
      const testUrls = [
        'https://www.youtube.com/channel/UC123456789',
        'https://www.youtube.com/@username',
        'https://www.youtube.com/c/customname',
        'https://www.youtube.com/user/olduser',
        'https://youtube.com/channel/UC123456789', // No www
        'http://www.youtube.com/channel/UC123456789', // HTTP instead of HTTPS
      ];

      // Mock database responses
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      // Act & Assert
      for (const url of testUrls) {
        const result = await controller.getCreatorStats(url);
        expect(result.error).toBe('Creator stats not found');
        expect(result.fallback).toBeDefined();
      }
    });

    it('should handle subscriber count edge cases correctly', async () => {
      // Arrange - Test various subscriber counts and their formatting
      const testCases = [
        { count: 0, expected: '0 subscribers' },
        { count: 1, expected: '1 subscribers' },
        { count: 999, expected: '999 subscribers' },
        { count: 1000, expected: '1.0K subscribers' },
        { count: 1500, expected: '1.5K subscribers' },
        { count: 999999, expected: '1000.0K subscribers' },
        { count: 1000000, expected: '1.0M subscribers' },
        { count: 2500000, expected: '2.5M subscribers' },
      ];

      for (const { count, expected } of testCases) {
        const mockTutorials = [
          {
            creator_channel_url: 'https://www.youtube.com/channel/UC123',
            name: 'Test',
          },
        ];
        const mockYouTubeResponse = {
          items: [
            {
              id: 'UC123',
              statistics: { subscriberCount: count.toString() },
              snippet: { title: 'Test', thumbnails: {} },
            },
          ],
        };

        const finalPromise = Promise.resolve({
          data: mockTutorials,
          error: null,
        });
        const secondNotMock = vi.fn().mockReturnValue(finalPromise);
        const firstNotMock = vi.fn().mockReturnValue({ not: secondNotMock });
        const selectMock = vi.fn().mockReturnValue({ not: firstNotMock });
        mockSupabaseClient.from.mockReturnValue({ select: selectMock });

        process.env.YOUTUBE_API_KEY = 'test-api-key';
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockYouTubeResponse),
        });

        mockSupabaseClient.from.mockImplementation((table: string) => {
          if (table === 'creator_stats') {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {};
        });

        // Act
        await service.updateAllCreatorStats();

        // Assert
        const upsertCall = mockSupabaseClient.from().upsert;
        expect(upsertCall).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriber_count_formatted: expected,
          }),
          { onConflict: 'channel_url' },
        );

        // Reset mocks for next iteration
        vi.clearAllMocks();
        mockFetch.mockClear();
      }
    });
  });

  describe('Performance & Scalability', () => {
    it('should handle large-scale operations efficiently', async () => {
      // Arrange
      const startTime = Date.now();
      const largeChannelSet = Array.from({ length: 500 }, (_, i) => ({
        url: `https://www.youtube.com/channel/UC${i.toString().padStart(9, '0')}`,
        name: `Creator ${i}`,
      }));

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'tutorials') {
          return {
            select: vi.fn().mockReturnThis(),
            not: vi
              .fn()
              .mockReturnValueOnce({ data: largeChannelSet, error: null }),
          };
        }
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {};
      });

      // Act
      const healthResult = await controller.getHealthStatus();
      const endTime = Date.now();

      // Assert
      expect(healthResult.success).toBe(true);
      expect(healthResult.stats?.totalChannels).toBe(500);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent API calls efficiently', async () => {
      // Arrange
      const channelUrl = 'https://www.youtube.com/channel/UC123456789';

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            channel_url: channelUrl,
            channel_id: 'UC123456789',
            creator_name: 'Concurrent Test Creator',
            subscriber_count: 1000000,
            subscriber_count_formatted: '1.0M subscribers',
            thumbnail_url: 'https://example.com/thumb.jpg',
          },
          error: null,
        }),
      }));

      // Act - Simulate 20 concurrent requests
      const concurrentRequests = Array.from({ length: 20 }, () =>
        controller.getCreatorStats(channelUrl),
      );
      const results = await Promise.all(concurrentRequests);

      // Assert
      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data?.creatorName).toBe('Concurrent Test Creator');
      });
    });
  });

  describe('API Contract Compliance', () => {
    it('should return properly typed responses across all endpoints', async () => {
      // Arrange
      const channelUrl = 'https://www.youtube.com/channel/UC123456789';

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'creator_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            lt: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (table === 'tutorials') {
          return {
            select: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnValueOnce({ data: [], error: null }),
          };
        }
        return {};
      });

      // Act
      const statsResponse = await controller.getCreatorStats(channelUrl);
      const batchResponse = await controller.triggerBatchUpdate();
      const healthResponse = await controller.getHealthStatus();

      // Assert - Verify response structure compliance

      // Stats endpoint
      expect(statsResponse).toHaveProperty('error');
      expect(statsResponse).toHaveProperty('fallback');
      expect(statsResponse.fallback).toHaveProperty('creatorName');
      expect(statsResponse.fallback).toHaveProperty('subscriberCountFormatted');

      // Batch endpoint
      expect(batchResponse).toHaveProperty('success', true);
      expect(batchResponse).toHaveProperty('message');
      expect(batchResponse).toHaveProperty('timestamp');
      expect(batchResponse.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      // Health endpoint
      expect(healthResponse).toHaveProperty('success', true);
      expect(healthResponse).toHaveProperty('stats');
      expect(healthResponse).toHaveProperty('needsUpdate');
      expect(healthResponse.stats).toHaveProperty('totalChannels');
      expect(healthResponse.stats).toHaveProperty('staleChannels');
      expect(healthResponse.stats).toHaveProperty('freshChannels');
      expect(healthResponse.stats).toHaveProperty('lastUpdate');
    });

    it('should maintain backwards compatibility', async () => {
      // Arrange
      const legacyChannelUrl = 'https://www.youtube.com/user/legacy-user';

      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            channel_url: legacyChannelUrl,
            channel_id: 'legacy-user',
            creator_name: 'Legacy Creator',
            subscriber_count: null, // Legacy data might have nulls
            subscriber_count_formatted: null,
            thumbnail_url: null,
          },
          error: null,
        }),
      }));

      // Act
      const result = await controller.getCreatorStats(legacyChannelUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.channelUrl).toBe(legacyChannelUrl);
      expect(result.data?.subscriberCount).toBeNull();
    });
  });
});
