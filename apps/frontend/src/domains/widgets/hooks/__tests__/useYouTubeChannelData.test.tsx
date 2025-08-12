/**
 * @vitest-environment jsdom
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useYouTubeChannelData } from '../useYouTubeChannelData';
import * as creatorsApi from '../../api/creators';
import type { CreatorStatsResponse } from '../../api/creators';

// Mock the creators API module
vi.mock('../../api/creators');

const mockedGetCreatorStats = vi.mocked(creatorsApi.getCreatorStats);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useYouTubeChannelData', () => {
  const validChannelUrl = 'https://youtube.com/channel/UC1234567890';
  const fallbackCreatorName = 'Test Fallback Creator';

  const mockSuccessResponse: CreatorStatsResponse = {
    success: true,
    data: {
      channelUrl: validChannelUrl,
      channelId: 'UC1234567890',
      creatorName: 'Awesome Creator',
      subscriberCount: 150000,
      subscriberCountFormatted: '150K',
      thumbnailUrl: 'https://example.com/avatar.jpg',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should return loading state initially', () => {
      // Arrange
      mockedGetCreatorStats.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves to test loading state
          }),
      );

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Loading...');
      expect(result.current.creatorName).toBe(fallbackCreatorName);
      expect(result.current.error).toBe(null);
    });

    it('should use default creator name when no fallback provided during loading', () => {
      // Arrange
      mockedGetCreatorStats.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves
          }),
      );

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.creatorName).toBe('Creator');
    });

    it('should handle loading state with no channel URL', () => {
      // Act
      const { result } = renderHook(() => useYouTubeChannelData(), {
        wrapper: createWrapper(),
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe('Creator');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to load creator data');
    });
  });

  describe('Successful Data Fetching', () => {
    it('should return creator data when API call succeeds', async () => {
      // Arrange
      mockedGetCreatorStats.mockResolvedValue(mockSuccessResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe('UC1234567890');
      expect(result.current.subscriberCount).toBe('150K');
      expect(result.current.creatorName).toBe('Awesome Creator');
      expect(result.current.error).toBe(null);
    });

    it('should handle creator data with minimal fields', async () => {
      // Arrange
      const minimalResponse: CreatorStatsResponse = {
        success: true,
        data: {
          channelUrl: validChannelUrl,
          creatorName: 'Minimal Creator',
        },
      };
      mockedGetCreatorStats.mockResolvedValue(minimalResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe('Minimal Creator');
      expect(result.current.error).toBe(null);
    });

    it('should handle creator data without subscriber count', async () => {
      // Arrange
      const noSubsResponse: CreatorStatsResponse = {
        success: true,
        data: {
          channelUrl: validChannelUrl,
          channelId: 'UC1234567890',
          creatorName: 'No Subs Creator',
          subscriberCount: undefined,
          subscriberCountFormatted: undefined,
        },
      };
      mockedGetCreatorStats.mockResolvedValue(noSubsResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe('UC1234567890');
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe('No Subs Creator');
      expect(result.current.error).toBe(null);
    });

    it('should call getCreatorStats with correct channel URL', async () => {
      // Arrange
      mockedGetCreatorStats.mockResolvedValue(mockSuccessResponse);

      // Act
      renderHook(() => useYouTubeChannelData(validChannelUrl), {
        wrapper: createWrapper(),
      });

      // Assert
      await waitFor(() => {
        expect(mockedGetCreatorStats).toHaveBeenCalledWith(validChannelUrl);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Arrange
      const apiError = new Error('Network error');
      mockedGetCreatorStats.mockRejectedValue(apiError);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe(fallbackCreatorName);
      expect(result.current.error).toBe(apiError);
    });

    it('should handle response with error field', async () => {
      // Arrange
      const errorResponse: CreatorStatsResponse = {
        success: false,
        error: 'Channel not found',
        fallback: {
          creatorName: 'Unknown Creator',
          subscriberCountFormatted: 'Subscribe',
        },
      };
      mockedGetCreatorStats.mockResolvedValue(errorResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe('Unknown Creator');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Channel not found');
    });

    it('should handle response without data', async () => {
      // Arrange
      const emptyResponse: CreatorStatsResponse = {
        success: true,
      };
      mockedGetCreatorStats.mockResolvedValue(emptyResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe(fallbackCreatorName);
      expect(result.current.error).toBe(null);
    });

    it('should use fallback data when provided in error response', async () => {
      // Arrange
      const errorWithFallback: CreatorStatsResponse = {
        success: false,
        error: 'API rate limit exceeded',
        fallback: {
          creatorName: 'Fallback Creator',
          subscriberCountFormatted: '1M',
        },
      };
      mockedGetCreatorStats.mockResolvedValue(errorWithFallback);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('1M');
      expect(result.current.creatorName).toBe('Fallback Creator');
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('API rate limit exceeded');
    });

    it('should handle error without fallback data gracefully', async () => {
      // Arrange
      const errorWithoutFallback: CreatorStatsResponse = {
        success: false,
        error: 'Unknown error',
      };
      mockedGetCreatorStats.mockResolvedValue(errorWithoutFallback);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe(fallbackCreatorName);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Unknown error');
    });
  });

  describe('Fallback Behavior', () => {
    it('should handle success response without data gracefully', async () => {
      // Arrange
      const successWithoutData: CreatorStatsResponse = {
        success: true,
        fallback: {
          creatorName: 'Fallback from Success',
          subscriberCountFormatted: '500K',
        },
      };
      mockedGetCreatorStats.mockResolvedValue(successWithoutData);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('500K');
      expect(result.current.creatorName).toBe('Fallback from Success');
      expect(result.current.error).toBe(null);
    });

    it('should use provided fallback creator name when no other fallback available', async () => {
      // Arrange
      const responseWithoutFallback: CreatorStatsResponse = {
        success: true,
      };
      mockedGetCreatorStats.mockResolvedValue(responseWithoutFallback);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, 'Custom Fallback Name'),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creatorName).toBe('Custom Fallback Name');
      expect(result.current.subscriberCount).toBe('Subscribe');
    });

    it('should use default creator name when no fallback provided anywhere', async () => {
      // Arrange
      const responseWithoutFallback: CreatorStatsResponse = {
        success: true,
      };
      mockedGetCreatorStats.mockResolvedValue(responseWithoutFallback);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.creatorName).toBe('Creator');
      expect(result.current.subscriberCount).toBe('Subscribe');
    });
  });

  describe('Query Configuration', () => {
    it('should not make API call when channel URL is not provided', () => {
      // Act
      renderHook(() => useYouTubeChannelData(), {
        wrapper: createWrapper(),
      });

      // Assert
      expect(mockedGetCreatorStats).not.toHaveBeenCalled();
    });

    it('should not make API call when channel URL is empty string', () => {
      // Act
      renderHook(() => useYouTubeChannelData(''), {
        wrapper: createWrapper(),
      });

      // Assert
      expect(mockedGetCreatorStats).not.toHaveBeenCalled();
    });

    it('should handle channel URL change', async () => {
      // Arrange
      const firstUrl = 'https://youtube.com/channel/first';
      const secondUrl = 'https://youtube.com/channel/second';

      const firstResponse: CreatorStatsResponse = {
        success: true,
        data: {
          channelUrl: firstUrl,
          creatorName: 'First Creator',
        },
      };

      const secondResponse: CreatorStatsResponse = {
        success: true,
        data: {
          channelUrl: secondUrl,
          creatorName: 'Second Creator',
        },
      };

      mockedGetCreatorStats
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      // Act
      const { result, rerender } = renderHook(
        ({ url }) => useYouTubeChannelData(url),
        {
          wrapper: createWrapper(),
          initialProps: { url: firstUrl },
        },
      );

      // Assert first call
      await waitFor(() => {
        expect(result.current.creatorName).toBe('First Creator');
      });

      // Act - change URL
      rerender({ url: secondUrl });

      // Assert second call
      await waitFor(() => {
        expect(result.current.creatorName).toBe('Second Creator');
      });

      expect(mockedGetCreatorStats).toHaveBeenCalledTimes(2);
      expect(mockedGetCreatorStats).toHaveBeenNthCalledWith(1, firstUrl);
      expect(mockedGetCreatorStats).toHaveBeenNthCalledWith(2, secondUrl);
    });

    it('should handle fallback creator name change', async () => {
      // Arrange
      const errorResponse: CreatorStatsResponse = {
        success: false,
        error: 'Not found',
      };
      mockedGetCreatorStats.mockResolvedValue(errorResponse);

      // Act
      const { result, rerender } = renderHook(
        ({ fallback }) => useYouTubeChannelData(validChannelUrl, fallback),
        {
          wrapper: createWrapper(),
          initialProps: { fallback: 'First Fallback' },
        },
      );

      // Assert first fallback
      await waitFor(() => {
        expect(result.current.creatorName).toBe('First Fallback');
      });

      // Act - change fallback
      rerender({ fallback: 'Second Fallback' });

      // Assert second fallback
      await waitFor(() => {
        expect(result.current.creatorName).toBe('Second Fallback');
      });
    });
  });

  describe('Query Caching', () => {
    it('should use cached data for same channel URL', async () => {
      // Arrange
      mockedGetCreatorStats.mockResolvedValue(mockSuccessResponse);
      const wrapper = createWrapper(); // Use same wrapper for both renders

      // Act - First render
      const { result: result1 } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper,
        },
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Act - Second render with same URL (same query client)
      const { result: result2 } = renderHook(
        () => useYouTubeChannelData(validChannelUrl),
        {
          wrapper,
        },
      );

      // Assert
      expect(result2.current.creatorName).toBe('Awesome Creator');
      expect(mockedGetCreatorStats).toHaveBeenCalledTimes(1); // Should not call API again due to caching
    });
  });

  describe('Edge Cases', () => {
    it('should handle null channel URL gracefully', () => {
      // Act
      const { result } = renderHook(() => useYouTubeChannelData(null as any), {
        wrapper: createWrapper(),
      });

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe('Creator');
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should handle undefined fallback creator name', async () => {
      // Arrange
      const errorResponse: CreatorStatsResponse = {
        success: false,
        error: 'Test error',
      };
      mockedGetCreatorStats.mockResolvedValue(errorResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, undefined),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.creatorName).toBe('Creator');
      });
    });

    it('should handle empty string fallback creator name', async () => {
      // Arrange
      const errorResponse: CreatorStatsResponse = {
        success: false,
        error: 'Test error',
      };
      mockedGetCreatorStats.mockResolvedValue(errorResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, ''),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.creatorName).toBe('Creator');
      });
    });

    it('should handle malformed API response', async () => {
      // Arrange
      const malformedResponse = {
        someRandomField: 'value',
      } as any;
      mockedGetCreatorStats.mockResolvedValue(malformedResponse);

      // Act
      const { result } = renderHook(
        () => useYouTubeChannelData(validChannelUrl, fallbackCreatorName),
        {
          wrapper: createWrapper(),
        },
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.channelId).toBe(null);
      expect(result.current.subscriberCount).toBe('Subscribe');
      expect(result.current.creatorName).toBe(fallbackCreatorName);
      expect(result.current.error).toBe(null);
    });
  });

  describe('Performance', () => {
    it('should handle rapid prop changes without issues', async () => {
      // Arrange
      const urls = [
        'https://youtube.com/channel/1',
        'https://youtube.com/channel/2',
        'https://youtube.com/channel/3',
      ];

      mockedGetCreatorStats.mockImplementation((url) =>
        Promise.resolve({
          success: true,
          data: {
            channelUrl: url,
            creatorName: `Creator for ${url}`,
          },
        }),
      );

      // Act
      const { rerender } = renderHook(({ url }) => useYouTubeChannelData(url), {
        wrapper: createWrapper(),
        initialProps: { url: urls[0] },
      });

      // Rapidly change URLs
      urls.forEach((url) => {
        rerender({ url });
      });

      // Assert - Should not throw or cause issues
      expect(mockedGetCreatorStats).toHaveBeenCalledTimes(urls.length);
    });
  });
});
