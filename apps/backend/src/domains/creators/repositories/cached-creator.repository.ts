import { Injectable } from '@nestjs/common';
import {
  ICreatorRepository,
  PaginationOptions,
} from './creator.repository.interface.js';
import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CachedRepository } from '../../../infrastructure/cache/cached-repository.base.js';
import { CreatorRepository } from './creator.repository.js';

/**
 * Cached creator data structure (snake_case from database/cache).
 * This interface matches the output of Creator.toPersistence().
 */
interface CachedCreatorData {
  id: string;
  channel_url: string;
  channel_id?: string;
  creator_name: string;
  subscriber_count?: number;
  subscriber_count_formatted?: string;
  thumbnail_url?: string;
  last_fetched_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cached decorator for CreatorRepository.
 *
 * Extends CachedRepository base class to provide consistent caching behavior
 * while implementing domain-specific methods like findByChannelUrl, findTopCreators, etc.
 *
 * Cache key patterns:
 * - creator:{id} - Single entity
 * - creator:channel-url:{url} - By channel URL
 * - creator:channel-id:{id} - By channel ID
 * - creator:exists:{id} - Existence check
 * - creator:channel-url:exists:{url} - Channel URL existence
 * - creators:list:page:{n}:limit:{m} - Pagination
 * - creators:name:{name} - By creator name
 * - creators:top:{limit} - Top creators by subscriber count
 * - creators:unique-channel-urls - All unique channel URLs
 * - creators:subscriber-range:{min}-{max} - Count by subscriber range
 */
@Injectable()
export class CachedCreatorRepository
  extends CachedRepository<Creator, CreatorId, CreatorRepository>
  implements ICreatorRepository
{
  constructor(repository: CreatorRepository, cache: CacheService) {
    super(repository, cache, { ttl: 3600 }); // 1 hour default TTL
  }

  // ============================================================================
  // Domain-Specific Methods
  // ============================================================================

  /**
   * Find a creator by channel URL with caching.
   */
  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Creator | null> {
    return this.findByAlternateKey(this.getChannelUrlKey(channelUrl), () =>
      this.repository.findByChannelUrl(channelUrl),
    );
  }

  /**
   * Find a creator by channel ID with caching.
   */
  async findByChannelId(channelId: string): Promise<Creator | null> {
    return this.findByAlternateKey(this.getChannelIdKey(channelId), () =>
      this.repository.findByChannelId(channelId),
    );
  }

  /**
   * Find creators by name with caching (half TTL for search results).
   */
  async findByCreatorName(name: string): Promise<Creator[]> {
    return this.findListByCriteria(
      this.getCreatorNameKey(name),
      () => this.repository.findByCreatorName(name),
      this.listTtl, // 30 minutes for search results
    );
  }

  /**
   * Find stale creators. NOT cached - needs fresh data.
   */
  async findStaleCreators(hoursThreshold: number): Promise<Creator[]> {
    return this.repository.findStaleCreators(hoursThreshold);
  }

  /**
   * Find top creators by subscriber count with caching.
   */
  async findTopCreators(limit: number): Promise<Creator[]> {
    return this.findListByCriteria(this.getTopCreatorsKey(limit), () =>
      this.repository.findTopCreators(limit),
    );
  }

  /**
   * Check if a creator exists by channel URL with caching.
   */
  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<boolean> {
    return this.existsByAlternateKey(this.getChannelUrlExistsKey(channelUrl), () =>
      this.repository.existsByChannelUrl(channelUrl),
    );
  }

  /**
   * Find creators by multiple channel URLs using cached individual lookups.
   */
  async findByChannelUrls(urls: ChannelUrl[]): Promise<Creator[]> {
    if (urls.length === 0) return [];

    const results = await Promise.all(
      urls.map((url) => this.findByChannelUrl(url)),
    );

    return results.filter(
      (creator): creator is Creator => creator !== null,
    );
  }

  /**
   * Get all unique channel URLs with extended caching (2 hours).
   */
  async getAllUniqueChannelUrls(): Promise<
    Array<{ url: string; name: string }>
  > {
    return this.cacheValue(
      'creators:unique-channel-urls',
      () => this.repository.getAllUniqueChannelUrls(),
      this.ttl * 2, // 2 hours as this data changes less frequently
    );
  }

  /**
   * Count creators by subscriber range with caching.
   */
  async countBySubscriberRange(min: number, max: number): Promise<number> {
    return this.cacheValue(
      this.getSubscriberRangeKey(min, max),
      () => this.repository.countBySubscriberRange(min, max),
    );
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected reconstitute(data: unknown): Creator {
    const d = data as CachedCreatorData;
    return Creator.reconstitute({
      id: CreatorId.create(d.id),
      channelUrl: ChannelUrl.create(d.channel_url),
      channelId: d.channel_id,
      creatorName: d.creator_name,
      subscriberCount: d.subscriber_count,
      subscriberCountFormatted: d.subscriber_count_formatted,
      thumbnailUrl: d.thumbnail_url,
      lastFetchedAt: d.last_fetched_at
        ? new Date(d.last_fetched_at)
        : undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    });
  }

  protected toPersistence(entity: Creator): unknown {
    return entity.toPersistence();
  }

  protected getEntityKey(id: CreatorId): string {
    return `creator:${id.value}`;
  }

  protected getExistsKey(id: CreatorId): string {
    return `creator:exists:${id.value}`;
  }

  protected getPaginationKey(options: PaginationOptions): string {
    return `creators:list:page:${options.page}:limit:${options.limit}`;
  }

  protected getEntityId(entity: Creator): CreatorId {
    return entity.id;
  }

  protected async invalidateEntityCache(creator: Creator): Promise<void> {
    await Promise.all([
      this.cache.del(this.getEntityKey(creator.id)),
      this.cache.del(this.getChannelUrlKey(creator.channelUrl)),
      this.cache.del(this.getExistsKey(creator.id)),
      this.cache.del(this.getChannelUrlExistsKey(creator.channelUrl)),
      creator.channelId
        ? this.cache.del(this.getChannelIdKey(creator.channelId))
        : Promise.resolve(),
    ]);
  }

  protected async invalidateLists(): Promise<void> {
    await Promise.all([
      this.cache.del('creators:list:*'),
      this.cache.del('creators:top:*'),
      this.cache.del('creators:unique-channel-urls'),
    ]);
  }

  // ============================================================================
  // Domain-Specific Cache Keys
  // ============================================================================

  private getChannelUrlKey(channelUrl: ChannelUrl): string {
    return `creator:channel-url:${channelUrl.value}`;
  }

  private getChannelIdKey(channelId: string): string {
    return `creator:channel-id:${channelId}`;
  }

  private getChannelUrlExistsKey(channelUrl: ChannelUrl): string {
    return `creator:channel-url:exists:${channelUrl.value}`;
  }

  private getCreatorNameKey(name: string): string {
    return `creators:name:${name.toLowerCase()}`;
  }

  private getTopCreatorsKey(limit: number): string {
    return `creators:top:${limit}`;
  }

  private getSubscriberRangeKey(min: number, max: number): string {
    return `creators:subscriber-range:${min}-${max}`;
  }
}
