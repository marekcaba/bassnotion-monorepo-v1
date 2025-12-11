import { Injectable } from '@nestjs/common';
import {
  ICreatorRepository,
  PaginatedResult,
  PaginationOptions,
} from './creator.repository.interface.js';
import { Creator } from '../entities/creator.entity.js';
import { CreatorId } from '../value-objects/creator-id.vo.js';
import { ChannelUrl } from '../value-objects/channel-url.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CreatorRepository } from './creator.repository.js';

@Injectable()
export class CachedCreatorRepository implements ICreatorRepository {
  private readonly TTL = 3600; // 1 hour for creator data

  constructor(
    public readonly repository: CreatorRepository,
    private readonly cache: CacheService,
  ) {}

  async findById(id: CreatorId): Promise<Creator | null> {
    const key = this.getCreatorKey(id);

    return this.cache
      .wrap(
        key,
        async () => {
          const creator = await this.repository.findById(id);
          return creator ? creator.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Creator | null> {
    const key = this.getChannelUrlKey(channelUrl);

    return this.cache
      .wrap(
        key,
        async () => {
          const creator = await this.repository.findByChannelUrl(channelUrl);
          return creator ? creator.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<Creator>> {
    const key = this.getPaginationKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findAll(options);
          return {
            ...result,
            items: result.items.map((c) => c.toPersistence()),
          };
        },
        this.TTL / 2, // 30 minutes for list queries
      )
      .then((result) => ({
        ...result,
        items: result.items.map((data) => this.reconstitute(data)),
      }));
  }

  async findByChannelId(channelId: string): Promise<Creator | null> {
    const key = this.getChannelIdKey(channelId);

    return this.cache
      .wrap(
        key,
        async () => {
          const creator = await this.repository.findByChannelId(channelId);
          return creator ? creator.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findByCreatorName(name: string): Promise<Creator[]> {
    const key = this.getCreatorNameKey(name);

    return this.cache
      .wrap(
        key,
        async () => {
          const creators = await this.repository.findByCreatorName(name);
          return creators.map((c) => c.toPersistence());
        },
        this.TTL / 2, // 30 minutes for search results
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async findStaleCreators(hoursThreshold: number): Promise<Creator[]> {
    // Don't cache stale creators query as it needs fresh data
    return this.repository.findStaleCreators(hoursThreshold);
  }

  async findTopCreators(limit: number): Promise<Creator[]> {
    const key = this.getTopCreatorsKey(limit);

    return this.cache
      .wrap(
        key,
        async () => {
          const creators = await this.repository.findTopCreators(limit);
          return creators.map((c) => c.toPersistence());
        },
        this.TTL,
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async search(query: string): Promise<Creator[]> {
    // Don't cache search results as they're too dynamic
    return this.repository.search(query);
  }

  async save(creator: Creator): Promise<void> {
    await this.repository.save(creator);
    await this.invalidateCache(creator);
  }

  async update(creator: Creator): Promise<void> {
    await this.repository.update(creator);
    await this.invalidateCache(creator);
  }

  async delete(id: CreatorId): Promise<void> {
    // Get the creator first to invalidate all related caches
    const creator = await this.repository.findById(id);
    await this.repository.delete(id);

    if (creator) {
      await this.invalidateCache(creator);
    }
    await this.cache.del(this.getCreatorKey(id));
    await this.invalidateLists();
  }

  async exists(id: CreatorId): Promise<boolean> {
    const key = this.getExistsKey(id);

    return this.cache.wrap(key, () => this.repository.exists(id), this.TTL);
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<boolean> {
    const key = this.getChannelUrlExistsKey(channelUrl);

    return this.cache.wrap(
      key,
      () => this.repository.existsByChannelUrl(channelUrl),
      this.TTL,
    );
  }

  async findByIds(ids: CreatorId[]): Promise<Creator[]> {
    if (ids.length === 0) return [];

    // For batch operations, we'll check cache for each individual item
    // and only fetch missing ones from the database
    const cachedResults: (Creator | null)[] = await Promise.all(
      ids.map((id) => this.findById(id)),
    );

    return cachedResults.filter(
      (creator): creator is Creator => creator !== null,
    );
  }

  async findByChannelUrls(urls: ChannelUrl[]): Promise<Creator[]> {
    if (urls.length === 0) return [];

    // Similar to findByIds, check cache first
    const cachedResults: (Creator | null)[] = await Promise.all(
      urls.map((url) => this.findByChannelUrl(url)),
    );

    return cachedResults.filter(
      (creator): creator is Creator => creator !== null,
    );
  }

  async saveMany(creators: Creator[]): Promise<void> {
    await this.repository.saveMany(creators);

    // Invalidate cache for all saved creators
    await Promise.all(creators.map((creator) => this.invalidateCache(creator)));
    await this.invalidateLists();
  }

  async updateMany(creators: Creator[]): Promise<void> {
    await this.repository.updateMany(creators);

    // Invalidate cache for all updated creators
    await Promise.all(creators.map((creator) => this.invalidateCache(creator)));
    await this.invalidateLists();
  }

  async deleteMany(ids: CreatorId[]): Promise<void> {
    // Get creators first to invalidate their caches
    const creators = await this.repository.findByIds(ids);
    await this.repository.deleteMany(ids);

    // Invalidate cache for all deleted creators
    await Promise.all([
      ...creators.map((creator) => this.invalidateCache(creator)),
      ...ids.map((id) => this.cache.del(this.getCreatorKey(id))),
    ]);
    await this.invalidateLists();
  }

  async getAllUniqueChannelUrls(): Promise<
    Array<{ url: string; name: string }>
  > {
    const key = 'creators:unique-channel-urls';

    return this.cache.wrap(
      key,
      () => this.repository.getAllUniqueChannelUrls(),
      this.TTL * 2, // 2 hours as this data changes less frequently
    );
  }

  async countBySubscriberRange(min: number, max: number): Promise<number> {
    const key = this.getSubscriberRangeKey(min, max);

    return this.cache.wrap(
      key,
      () => this.repository.countBySubscriberRange(min, max),
      this.TTL,
    );
  }

  private async invalidateCache(creator: Creator): Promise<void> {
    await Promise.all([
      this.cache.del(this.getCreatorKey(creator.id)),
      this.cache.del(this.getChannelUrlKey(creator.channelUrl)),
      this.cache.del(this.getExistsKey(creator.id)),
      this.cache.del(this.getChannelUrlExistsKey(creator.channelUrl)),
      creator.channelId
        ? this.cache.del(this.getChannelIdKey(creator.channelId))
        : Promise.resolve(),
    ]);
  }

  private async invalidateLists(): Promise<void> {
    // Invalidate all paginated results and top creators
    await Promise.all([
      this.cache.del('creators:list:*'),
      this.cache.del('creators:top:*'),
      this.cache.del('creators:unique-channel-urls'),
    ]);
  }

  private reconstitute(data: any): Creator {
    return Creator.reconstitute({
      id: CreatorId.create(data.id),
      channelUrl: ChannelUrl.create(data.channel_url),
      channelId: data.channel_id,
      creatorName: data.creator_name,
      subscriberCount: data.subscriber_count,
      subscriberCountFormatted: data.subscriber_count_formatted,
      thumbnailUrl: data.thumbnail_url,
      lastFetchedAt: data.last_fetched_at
        ? new Date(data.last_fetched_at)
        : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    });
  }

  private getCreatorKey(id: CreatorId): string {
    return `creator:${id.value}`;
  }

  private getChannelUrlKey(channelUrl: ChannelUrl): string {
    return `creator:channel-url:${channelUrl.value}`;
  }

  private getChannelIdKey(channelId: string): string {
    return `creator:channel-id:${channelId}`;
  }

  private getExistsKey(id: CreatorId): string {
    return `creator:exists:${id.value}`;
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

  private getPaginationKey(options: PaginationOptions): string {
    return `creators:list:page:${options.page}:limit:${options.limit}`;
  }

  private getSubscriberRangeKey(min: number, max: number): string {
    return `creators:subscriber-range:${min}-${max}`;
  }
}
