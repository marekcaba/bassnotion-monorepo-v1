import { Injectable, Inject } from '@nestjs/common';
import type { IResultCreatorRepository } from './repositories/result-creator.repository.js';
import { Creator } from './entities/creator.entity.js';
import { ChannelUrl } from './value-objects/channel-url.vo.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';

export interface CreatorStats {
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
  private readonly staticLogger = createStructuredLogger(CreatorsService.name);

  constructor(
    @Inject('IResultCreatorRepository')
    private readonly creatorRepository: IResultCreatorRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get all unique creator channel URLs from tutorials
   */
  async getAllCreatorChannels(): Promise<Array<{ url: string; name: string }>> {
    try {
      const result = await this.creatorRepository.getAllUniqueChannelUrls();

      if (!result.ok) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.error('Error fetching creator channels:', result.error, {
          correlationId,
        });
        return [];
      }

      return result.value;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error in getAllCreatorChannels:', error as Error, {
        correlationId,
      });
      return [];
    }
  }

  /**
   * Fetch YouTube channel statistics for multiple channels at once
   */
  async fetchYouTubeChannelStats(
    channelIds: string[],
  ): Promise<YouTubeChannelResponse> {
    // Handle empty channel IDs
    if (!channelIds || channelIds.length === 0) {
      return { items: [] };
    }

    // Try YouTube API key first, then fall back to Google OAuth credentials
    const apiKey =
      process.env.YOUTUBE_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_CLIENT_ID; // As last resort for development

    if (!apiKey) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.warn(
        'YouTube API key not configured. Please set YOUTUBE_API_KEY, GOOGLE_API_KEY, or ensure Google OAuth is configured.',
        { correlationId },
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

        const data = (await response.json()) as YouTubeChannelResponse;
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
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching YouTube channel stats:', error as Error, {
        correlationId,
      });
      return { items: [] };
    }
  }

  /**
   * Daily batch job to update all creator statistics
   */
  async updateAllCreatorStats(): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    logger.info('Starting daily creator stats update batch job', {
      correlationId,
    });

    try {
      // 1. Get all creator channels from tutorials
      const creatorChannels = await this.getAllCreatorChannels();
      logger.info(`Found ${creatorChannels.length} unique creator channels`, {
        correlationId,
      });

      if (creatorChannels.length === 0) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.warn('No creator channels found to update', { correlationId });
        return;
      }

      // 2. Extract channel IDs and create/update creators
      const creatorsToUpdate: Creator[] = [];

      for (const channel of creatorChannels) {
        try {
          const channelUrl = ChannelUrl.create(channel.url);
          const channelId = channelUrl.extractChannelId();

          if (!channelId) {
            const logger =
              this.requestContext?.getLogger() || this.staticLogger;
            const correlationId = this.requestContext?.getCorrelationId();
            logger.warn(`Could not extract channel ID from ${channel.url}`, {
              correlationId,
            });
            continue;
          }

          // Check if creator exists
          const existingResult =
            await this.creatorRepository.findByChannelUrl(channelUrl);

          let creator: Creator;
          if (existingResult.ok && existingResult.value) {
            creator = existingResult.value;
          } else {
            // Create new creator
            creator = Creator.create({
              channelUrl,
              channelId,
              creatorName: channel.name,
            });
          }

          creatorsToUpdate.push(creator);
        } catch (error) {
          const logger = this.requestContext?.getLogger() || this.staticLogger;
          const correlationId = this.requestContext?.getCorrelationId();
          logger.error(
            `Error processing channel ${channel.url}:`,
            error as Error,
            { correlationId },
          );
        }
      }

      // 3. Get channel IDs for YouTube API
      const channelIds = creatorsToUpdate
        .map((c) => c.channelId)
        .filter((id): id is string => Boolean(id));

      logger.info(`Processing ${channelIds.length} valid channel IDs`, {
        correlationId,
      });

      // 4. Fetch YouTube data in batches
      const youtubeData = await this.fetchYouTubeChannelStats(channelIds);
      logger.info(
        `Fetched data for ${youtubeData.items?.length || 0} channels`,
        { correlationId },
      );

      // 5. Update creators with YouTube data
      const updatedCreators: Creator[] = [];

      for (const creator of creatorsToUpdate) {
        const youtubeChannel = youtubeData.items?.find(
          (item) => item.id === creator.channelId,
        );

        if (youtubeChannel) {
          const subscriberCount = parseInt(
            youtubeChannel.statistics.subscriberCount,
            10,
          );

          creator.updateStats({
            subscriberCount,
            creatorName: youtubeChannel.snippet.title,
            thumbnailUrl:
              youtubeChannel.snippet.thumbnails.medium?.url ||
              youtubeChannel.snippet.thumbnails.default?.url,
          });
        } else {
          // Mark as fetched even if no data found
          creator.markAsFetched();
        }

        updatedCreators.push(creator);
      }

      // 6. Save/update all creators
      const saveResults = await Promise.allSettled(
        updatedCreators.map(async (creator) => {
          // Check if it's a new creator or existing
          const exists = await this.creatorRepository.exists(creator.id);
          if (exists.ok && exists.value) {
            return this.creatorRepository.update(creator);
          } else {
            return this.creatorRepository.save(creator);
          }
        }),
      );

      const successCount = saveResults.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failureCount = saveResults.filter(
        (r) => r.status === 'rejected',
      ).length;

      logger.info(
        `Successfully updated ${successCount} creator stats, ${failureCount} failures`,
        { correlationId },
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        'Error in updateAllCreatorStats batch job:',
        error as Error,
        { correlationId },
      );
      throw error;
    }
  }

  /**
   * Get cached creator stats from database
   */
  async getCreatorStats(channelUrl: string): Promise<CreatorStats | null> {
    try {
      const url = ChannelUrl.create(channelUrl);
      const result = await this.creatorRepository.findByChannelUrl(url);

      if (!result.ok || !result.value) {
        return null;
      }

      const creator = result.value;
      return {
        channelUrl: creator.channelUrl.value,
        channelId: creator.channelId,
        creatorName: creator.creatorName,
        subscriberCount: creator.subscriberCount,
        subscriberCountFormatted:
          creator.subscriberCountFormatted || 'No subscriber data',
        thumbnailUrl: creator.thumbnailUrl,
      };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching creator stats:', error as Error, {
        correlationId,
      });
      return null;
    }
  }

  /**
   * Check if creator stats are stale (older than 24 hours)
   */
  async getStaleCreatorChannels(): Promise<string[]> {
    try {
      const result = await this.creatorRepository.findStaleCreators(24);

      if (!result.ok) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.error(
          'Error checking stale creator stats:',
          result.error as Error,
          { correlationId },
        );
        return [];
      }

      return result.value.map((creator) => creator.channelUrl.value);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error in getStaleCreatorChannels:', error as Error, {
        correlationId,
      });
      return [];
    }
  }
}
