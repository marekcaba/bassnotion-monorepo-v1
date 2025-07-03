import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

interface CreatorStats {
  channelUrl: string;
  channelId?: string | null;
  creatorName: string;
  subscriberCount?: number;
  subscriberCountFormatted?: string;
  thumbnailUrl?: string;
}

interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    statistics: {
      subscriberCount: string;
    };
    snippet: {
      title: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
  }>;
}

@Injectable()
export class CreatorsService {
  private readonly logger = new Logger(CreatorsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Extract YouTube channel ID from various URL formats
   */
  private extractChannelId(channelUrl: string): string | null {
    if (!channelUrl) return null;

    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = channelUrl.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  /**
   * Format subscriber count for display (e.g., 1.2M, 234K)
   */
  private formatSubscriberCount(count: number): string {
    if (count >= 1000000) {
      const millions = (count / 1000000).toFixed(1);
      return `${millions}M subscribers`;
    } else if (count >= 1000) {
      const thousands = (count / 1000).toFixed(1);
      return `${thousands}K subscribers`;
    } else {
      return `${count} subscribers`;
    }
  }

  /**
   * Get all unique creator channel URLs from tutorials
   */
  async getAllCreatorChannels(): Promise<Array<{ url: string; name: string }>> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('tutorials')
        .select('creator_channel_url, creator_name')
        .not('creator_channel_url', 'is', null)
        .not('creator_name', 'is', null);

      if (error) {
        this.logger.error('Error fetching creator channels:', error);
        return [];
      }

      // Remove duplicates and return unique channels
      const uniqueChannels = new Map<string, string>();
      data?.forEach((tutorial: any) => {
        if (tutorial.creator_channel_url && tutorial.creator_name) {
          uniqueChannels.set(
            tutorial.creator_channel_url,
            tutorial.creator_name,
          );
        }
      });

      return Array.from(uniqueChannels.entries()).map(([url, name]) => ({
        url,
        name,
      }));
    } catch (error) {
      this.logger.error('Error in getAllCreatorChannels:', error);
      return [];
    }
  }

  /**
   * Fetch YouTube channel statistics for multiple channels at once
   */
  async fetchYouTubeChannelStats(
    channelIds: string[],
  ): Promise<YouTubeChannelResponse> {
    // Try YouTube API key first, then fall back to Google OAuth credentials
    const apiKey =
      process.env.YOUTUBE_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_CLIENT_ID; // As last resort for development

    if (!apiKey) {
      this.logger.warn(
        'YouTube API key not configured. Please set YOUTUBE_API_KEY, GOOGLE_API_KEY, or ensure Google OAuth is configured.',
      );
      return { items: [] };
    }

    try {
      // YouTube API allows up to 50 channel IDs per request
      const batchSize = 50;
      const allItems: YouTubeChannelResponse['items'] = [];

      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);
        const idsParam = batch.join(',');

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${idsParam}&key=${apiKey}`,
        );

        if (!response.ok) {
          throw new Error(`YouTube API error: ${response.statusText}`);
        }

        const data: YouTubeChannelResponse = await response.json();
        if (data.items) {
          allItems.push(...data.items);
        }

        // Rate limiting: small delay between batches
        if (i + batchSize < channelIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return { items: allItems };
    } catch (error) {
      this.logger.error('Error fetching YouTube channel stats:', error);
      return { items: [] };
    }
  }

  /**
   * Daily batch job to update all creator statistics
   */
  async updateAllCreatorStats(): Promise<void> {
    this.logger.log('Starting daily creator stats update batch job');

    try {
      // 1. Get all creator channels from tutorials
      const creatorChannels = await this.getAllCreatorChannels();
      this.logger.log(
        `Found ${creatorChannels.length} unique creator channels`,
      );

      if (creatorChannels.length === 0) {
        this.logger.warn('No creator channels found to update');
        return;
      }

      // 2. Extract channel IDs
      const channelData = creatorChannels
        .map((channel) => ({
          url: channel.url,
          name: channel.name,
          channelId: this.extractChannelId(channel.url),
        }))
        .filter((item) => item.channelId);

      const channelIds = channelData
        .map((item) => item.channelId)
        .filter((id): id is string => Boolean(id));
      this.logger.log(`Extracted ${channelIds.length} valid channel IDs`);

      // 3. Fetch YouTube data in batches
      const youtubeData = await this.fetchYouTubeChannelStats(channelIds);
      this.logger.log(
        `Fetched data for ${youtubeData.items?.length || 0} channels`,
      );

      // 4. Prepare data for database update
      const creatorStats: CreatorStats[] = channelData.map((channel) => {
        const youtubeChannel = youtubeData.items?.find(
          (item) => item.id === channel.channelId,
        );

        const subscriberCount = youtubeChannel
          ? parseInt(youtubeChannel.statistics.subscriberCount, 10)
          : undefined;

        return {
          channelUrl: channel.url,
          channelId: channel.channelId,
          creatorName: youtubeChannel?.snippet.title || channel.name,
          subscriberCount,
          subscriberCountFormatted: subscriberCount
            ? this.formatSubscriberCount(subscriberCount)
            : undefined,
          thumbnailUrl:
            youtubeChannel?.snippet.thumbnails.medium?.url ||
            youtubeChannel?.snippet.thumbnails.default?.url,
        };
      });

      // 5. Update database with upsert (insert or update)
      for (const stats of creatorStats) {
        const { error } = await this.supabase
          .getClient()
          .from('creator_stats')
          .upsert(
            {
              channel_url: stats.channelUrl,
              channel_id: stats.channelId,
              creator_name: stats.creatorName,
              subscriber_count: stats.subscriberCount,
              subscriber_count_formatted: stats.subscriberCountFormatted,
              thumbnail_url: stats.thumbnailUrl,
              last_fetched_at: new Date().toISOString(),
            },
            { onConflict: 'channel_url' },
          );

        if (error) {
          this.logger.error(
            `Error updating stats for ${stats.channelUrl}:`,
            error,
          );
        }
      }

      this.logger.log(
        `Successfully updated creator stats for ${creatorStats.length} channels`,
      );
    } catch (error) {
      this.logger.error('Error in updateAllCreatorStats batch job:', error);
      throw error;
    }
  }

  /**
   * Get cached creator stats from database
   */
  async getCreatorStats(channelUrl: string): Promise<CreatorStats | null> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('creator_stats')
        .select('*')
        .eq('channel_url', channelUrl)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        channelUrl: data.channel_url,
        channelId: data.channel_id,
        creatorName: data.creator_name,
        subscriberCount: data.subscriber_count,
        subscriberCountFormatted: data.subscriber_count_formatted,
        thumbnailUrl: data.thumbnail_url,
      };
    } catch (error) {
      this.logger.error('Error fetching creator stats:', error);
      return null;
    }
  }

  /**
   * Check if creator stats are stale (older than 24 hours)
   */
  async getStaleCreatorChannels(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .getClient()
        .from('creator_stats')
        .select('channel_url')
        .lt(
          'last_fetched_at',
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        );

      if (error) {
        this.logger.error('Error checking stale creator stats:', error);
        return [];
      }

      return data?.map((item: any) => item.channel_url) || [];
    } catch (error) {
      this.logger.error('Error in getStaleCreatorChannels:', error);
      return [];
    }
  }
}
