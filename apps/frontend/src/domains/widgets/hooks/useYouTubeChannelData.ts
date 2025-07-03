import { useQuery } from '@tanstack/react-query';
import { getCreatorStats, type CreatorStatsResponse } from '../api/creators';

interface YouTubeChannelData {
  channelId: string | null;
  subscriberCount: string;
  creatorName: string;
  isLoading: boolean;
  error: Error | null;
}

export function useYouTubeChannelData(
  channelUrl?: string,
  fallbackCreatorName?: string,
): YouTubeChannelData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['creator-stats', channelUrl],
    queryFn: async (): Promise<CreatorStatsResponse> => {
      if (!channelUrl) {
        return {
          error: 'No channel URL provided',
          fallback: {
            creatorName: fallbackCreatorName || 'Creator',
            subscriberCountFormatted: 'Subscribe',
          },
        };
      }

      return await getCreatorStats(channelUrl);
    },
    enabled: !!channelUrl,
    staleTime: 1000 * 60 * 30, // 30 minutes (since backend caches for 24h)
    retry: 1, // Only retry once on failure
  });

  // Handle loading state
  if (isLoading) {
    return {
      channelId: null,
      subscriberCount: 'Loading...',
      creatorName: fallbackCreatorName || 'Creator',
      isLoading: true,
      error: null,
    };
  }

  // Handle error or no data
  if (error || !data || data.error) {
    const fallbackData = data?.fallback || {
      creatorName: fallbackCreatorName || 'Creator',
      subscriberCountFormatted: 'Subscribe',
    };

    return {
      channelId: null,
      subscriberCount: fallbackData.subscriberCountFormatted,
      creatorName: fallbackData.creatorName,
      isLoading: false,
      error: error || new Error(data?.error || 'Failed to load creator data'),
    };
  }

  // Handle successful response
  if (data.success && data.data) {
    return {
      channelId: data.data.channelId || null,
      subscriberCount: data.data.subscriberCountFormatted || 'Subscribe',
      creatorName: data.data.creatorName,
      isLoading: false,
      error: null,
    };
  }

  // Fallback case
  const fallbackData = data.fallback || {
    creatorName: fallbackCreatorName || 'Creator',
    subscriberCountFormatted: 'Subscribe',
  };

  return {
    channelId: null,
    subscriberCount: fallbackData.subscriberCountFormatted,
    creatorName: fallbackData.creatorName,
    isLoading: false,
    error: null,
  };
}
