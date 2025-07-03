import { apiClient } from '@/lib/api-client';

export interface CreatorStats {
  channelUrl: string;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  subscriberCountFormatted?: string;
  thumbnailUrl?: string;
}

export interface CreatorStatsResponse {
  success?: boolean;
  data?: CreatorStats;
  error?: string;
  fallback?: {
    creatorName: string;
    subscriberCountFormatted: string;
  };
}

/**
 * Get cached creator statistics from backend
 */
export async function getCreatorStats(
  channelUrl: string,
): Promise<CreatorStatsResponse> {
  try {
    if (!channelUrl) {
      return {
        error: 'Channel URL is required',
        fallback: {
          creatorName: 'Creator',
          subscriberCountFormatted: 'Subscribe',
        },
      };
    }

    const encodedChannelUrl = encodeURIComponent(channelUrl);
    const response = await apiClient.get<CreatorStatsResponse>(
      `/api/creators/stats?channelUrl=${encodedChannelUrl}`,
    );

    return response;
  } catch (error) {
    console.error('Error fetching creator stats:', error);
    return {
      error: 'Failed to fetch creator stats',
      fallback: {
        creatorName: 'Creator',
        subscriberCountFormatted: 'Subscribe',
      },
    };
  }
}

/**
 * Trigger manual batch update of all creator statistics
 */
export async function triggerBatchUpdate(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await apiClient.post<{
      success: boolean;
      message?: string;
      error?: string;
    }>('/api/creators/batch-update');
    return response;
  } catch (error) {
    console.error('Error triggering batch update:', error);
    return {
      success: false,
      error: 'Failed to trigger batch update',
    };
  }
}

/**
 * Check health status of creator stats system
 */
export async function getCreatorHealthStatus(): Promise<{
  success: boolean;
  stats?: {
    totalChannels: number;
    staleChannels: number;
    freshChannels: number;
    lastUpdate: string;
  };
  needsUpdate?: boolean;
  error?: string;
}> {
  try {
    const response = await apiClient.get<{
      success: boolean;
      stats?: {
        totalChannels: number;
        staleChannels: number;
        freshChannels: number;
        lastUpdate: string;
      };
      needsUpdate?: boolean;
      error?: string;
    }>('/api/creators/health');
    return response;
  } catch (error) {
    console.error('Error checking creator health:', error);
    return {
      success: false,
      error: 'Failed to check creator health',
    };
  }
}
