import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ICreatorRepository,
  PaginatedResult,
  PaginationOptions } from './creator.repository.interface.js';
import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

interface CreatorRecord {
  id: string;
  channel_url: string;
  channel_id?: string | null;
  creator_name: string;
  subscriber_count?: number;
  subscriber_count_formatted?: string;
  thumbnail_url?: string;
  last_fetched_at?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CreatorRepository implements ICreatorRepository {
  private readonly staticLogger = createStructuredLogger(CreatorRepository.name);

  constructor(
    private readonly supabase: SupabaseClient,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: CreatorId): Promise<Creator | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .eq('id', id.value)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(`Creator not found with id: ${id.value}`, { correlationId });
        return null;
      }

      return this.mapToEntity(data as CreatorRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error finding creator by id ${id.value}:`, error as Error, { correlationId });
      throw new Error(
        `Failed to find creator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Creator | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .eq('channel_url', channelUrl.value)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(
          `Creator not found with channel URL: ${channelUrl.value}`,
          { correlationId }
        );
        return null;
      }

      return this.mapToEntity(data as CreatorRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error finding creator by channel URL ${channelUrl.value}:`,
        error as Error,
        { correlationId }
      );
      throw new Error(
        `Failed to find creator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<Creator>> {
    try {
      const offset = (options.page - 1) * options.limit;

      const { data, error, count } = await this.supabase
        .from('creator_stats')
        .select('*', { count: 'exact' })
        .order('subscriber_count', { ascending: false, nullsFirst: false })
        .range(offset, offset + options.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch creators: ${error.message}`);
      }

      const creators = (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );

      return {
        items: creators,
        total: count || 0,
        page: options.page,
        limit: options.limit };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching all creators:', error as Error, { correlationId });
      throw error;
    }
  }

  async findByChannelId(channelId: string): Promise<Creator | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .eq('channel_id', channelId)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(`Creator not found with channel ID: ${channelId}`, { correlationId });
        return null;
      }

      return this.mapToEntity(data as CreatorRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error finding creator by channel ID ${channelId}:`,
        error as Error,
        { correlationId }
      );
      throw new Error(
        `Failed to find creator: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findByCreatorName(name: string): Promise<Creator[]> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .ilike('creator_name', `%${name}%`)
        .order('subscriber_count', { ascending: false, nullsFirst: false });

      if (error) {
        throw new Error(`Failed to fetch creators by name: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error fetching creators by name ${name}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async findStaleCreators(hoursThreshold: number): Promise<Creator[]> {
    try {
      const thresholdDate = new Date(
        Date.now() - hoursThreshold * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .or(`last_fetched_at.is.null,last_fetched_at.lt.${thresholdDate}`)
        .order('last_fetched_at', { ascending: true, nullsFirst: true });

      if (error) {
        throw new Error(`Failed to fetch stale creators: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching stale creators:', error as Error, { correlationId });
      throw error;
    }
  }

  async findTopCreators(limit: number): Promise<Creator[]> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .order('subscriber_count', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch top creators: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching top creators:', error as Error, { correlationId });
      throw error;
    }
  }

  async search(query: string): Promise<Creator[]> {
    try {
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .or(`creator_name.ilike.%${query}%,channel_url.ilike.%${query}%`)
        .order('subscriber_count', { ascending: false, nullsFirst: false });

      if (error) {
        throw new Error(`Failed to search creators: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error searching creators with query "${query}":`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async save(creator: Creator): Promise<void> {
    try {
      const data = creator.toPersistence();
      const { error } = await this.supabase.from('creator_stats').insert(data);

      if (error) {
        throw new Error(`Failed to save creator: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully saved creator: ${creator.id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving creator:', error as Error, { correlationId });
      throw error;
    }
  }

  async update(creator: Creator): Promise<void> {
    try {
      const data = creator.toPersistence();
      const { error } = await this.supabase
        .from('creator_stats')
        .update(data)
        .eq('id', creator.id.value);

      if (error) {
        throw new Error(`Failed to update creator: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully updated creator: ${creator.id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error updating creator ${creator.id.value}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async delete(id: CreatorId): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('creator_stats')
        .delete()
        .eq('id', id.value);

      if (error) {
        throw new Error(`Failed to delete creator: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted creator: ${id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error deleting creator ${id.value}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async exists(id: CreatorId): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('creator_stats')
        .select('id', { count: 'exact', head: true })
        .eq('id', id.value);

      if (error) {
        throw new Error(`Failed to check creator existence: ${error.message}`);
      }

      return (count ?? 0) > 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error checking existence of creator ${id.value}:`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('creator_stats')
        .select('id', { count: 'exact', head: true })
        .eq('channel_url', channelUrl.value);

      if (error) {
        throw new Error(
          `Failed to check creator existence by channel URL: ${error.message}`,
        );
      }

      return (count ?? 0) > 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error checking existence of creator by channel URL ${channelUrl.value}:`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async findByIds(ids: CreatorId[]): Promise<Creator[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const idValues = ids.map((id) => id.value);
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to fetch creators by ids: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching creators by ids:', error as Error, { correlationId });
      throw error;
    }
  }

  async findByChannelUrls(urls: ChannelUrl[]): Promise<Creator[]> {
    try {
      if (urls.length === 0) {
        return [];
      }

      const urlValues = urls.map((url) => url.value);
      const { data, error } = await this.supabase
        .from('creator_stats')
        .select('*')
        .in('channel_url', urlValues);

      if (error) {
        throw new Error(
          `Failed to fetch creators by channel URLs: ${error.message}`,
        );
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as CreatorRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching creators by channel URLs:', error as Error, { correlationId });
      throw error;
    }
  }

  async saveMany(creators: Creator[]): Promise<void> {
    if (creators.length === 0) return;

    try {
      const data = creators.map((creator) => creator.toPersistence());
      const { error } = await this.supabase.from('creator_stats').insert(data);

      if (error) {
        throw new Error(`Failed to save creators batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully saved ${creators.length} creators in batch`,
        { correlationId }
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving creators batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async updateMany(creators: Creator[]): Promise<void> {
    if (creators.length === 0) return;

    try {
      // Supabase doesn't support bulk updates natively, so we use upsert
      const data = creators.map((creator) => creator.toPersistence());
      const { error } = await this.supabase
        .from('creator_stats')
        .upsert(data, { onConflict: 'id' });

      if (error) {
        throw new Error(`Failed to update creators batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully updated ${creators.length} creators in batch`,
        { correlationId }
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating creators batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async deleteMany(ids: CreatorId[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const idValues = ids.map((id) => id.value);
      const { error } = await this.supabase
        .from('creator_stats')
        .delete()
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to delete creators batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted ${ids.length} creators in batch`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error deleting creators batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async getAllUniqueChannelUrls(): Promise<
    Array<{ url: string; name: string }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('tutorials')
        .select('creator_channel_url, creator_name')
        .not('creator_channel_url', 'is', null)
        .not('creator_name', 'is', null);

      if (error) {
        throw new Error(
          `Failed to fetch unique channel URLs: ${error.message}`,
        );
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
        name }));
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching unique channel URLs:', error as Error, { correlationId });
      throw error;
    }
  }

  async countBySubscriberRange(min: number, max: number): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('creator_stats')
        .select('id', { count: 'exact', head: true })
        .gte('subscriber_count', min)
        .lte('subscriber_count', max);

      if (error) {
        throw new Error(
          `Failed to count creators by subscriber range: ${error.message}`,
        );
      }

      return count ?? 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      
      logger.error(
        `Error counting creators by subscriber range ${min}-${max}:`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  private mapToEntity(record: CreatorRecord): Creator {
    return Creator.reconstitute({
      id: CreatorId.create(record.id),
      channelUrl: ChannelUrl.create(record.channel_url),
      channelId: record.channel_id,
      creatorName: record.creator_name,
      subscriberCount: record.subscriber_count,
      subscriberCountFormatted: record.subscriber_count_formatted,
      thumbnailUrl: record.thumbnail_url,
      lastFetchedAt: record.last_fetched_at
        ? new Date(record.last_fetched_at)
        : undefined,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at) });
  }
}
