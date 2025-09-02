import { Result } from '@/shared/types/result';
import { Creator } from '../entities/creator.entity';
import { CreatorId } from '../value-objects/creator-id.vo';
import { ChannelUrl } from '../value-objects/channel-url.vo';
import {
  ICreatorRepository,
  PaginatedResult,
  PaginationOptions,
  CreatorFilters,
  CreatorSortOptions,
} from './creator.repository.interface';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CachedCreatorRepository implements ICreatorRepository {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly repository: ICreatorRepository) {}

  private getCacheKey(method: string, params: any[]): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.cacheTTL;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private invalidateCache(patterns: string[] = []): void {
    if (patterns.length === 0) {
      // Clear all cache
      this.cache.clear();
    } else {
      // Clear specific patterns
      for (const [key] of this.cache) {
        if (patterns.some(pattern => key.startsWith(pattern))) {
          this.cache.delete(key);
        }
      }
    }
  }

  async findById(id: CreatorId): Promise<Result<Creator>> {
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Creator>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findById(id);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }
    
    return result;
  }

  async findByChannelUrl(channelUrl: ChannelUrl): Promise<Result<Creator>> {
    const cacheKey = this.getCacheKey('findByChannelUrl', [channelUrl.value]);
    const cached = this.getCached<Result<Creator>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findByChannelUrl(channelUrl);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Also cache by ID for cross-reference
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [result.value.id.value]);
        this.setCached(idCacheKey, result);
      }
    }
    
    return result;
  }

  async findByChannelId(channelId: string): Promise<Result<Creator>> {
    const cacheKey = this.getCacheKey('findByChannelId', [channelId]);
    const cached = this.getCached<Result<Creator>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findByChannelId(channelId);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Also cache by ID for cross-reference
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [result.value.id.value]);
        this.setCached(idCacheKey, result);
      }
    }
    
    return result;
  }

  async findAll(options?: PaginationOptions): Promise<Result<PaginatedResult<Creator>>> {
    const cacheKey = this.getCacheKey('findAll', [options]);
    const cached = this.getCached<Result<PaginatedResult<Creator>>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findAll(options);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Cache individual creators
      if (result.value) {
        for (const creator of result.value.items) {
          const idCacheKey = this.getCacheKey('findById', [creator.id.value]);
          this.setCached(idCacheKey, Result.ok(creator));
        }
      }
    }
    
    return result;
  }

  async findByIds(ids: CreatorId[]): Promise<Result<Creator[]>> {
    // Try to get individual creators from cache first
    const cachedCreators: Creator[] = [];
    const missingIds: CreatorId[] = [];

    for (const id of ids) {
      const cacheKey = this.getCacheKey('findById', [id.value]);
      const cached = this.getCached<Result<Creator>>(cacheKey);
      
      if (cached && cached.isSuccess && cached.value) {
        cachedCreators.push(cached.value);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return Result.ok(cachedCreators);
    }

    const result = await this.repository.findByIds(missingIds);
    if (result.isSuccess && result.value) {
      // Cache individual creators
      for (const creator of result.value) {
        const cacheKey = this.getCacheKey('findById', [creator.id.value]);
        this.setCached(cacheKey, Result.ok(creator));
      }
      
      return Result.ok([...cachedCreators, ...result.value]);
    }

    return result;
  }

  async search(query: string, filters?: CreatorFilters): Promise<Result<Creator[]>> {
    // Don't cache search results as they are too dynamic
    return this.repository.search(query, filters);
  }

  async findStale(hoursThreshold?: number, limit?: number): Promise<Result<Creator[]>> {
    // Don't cache stale results as they change frequently
    return this.repository.findStale(hoursThreshold, limit);
  }

  async findVerified(options?: PaginationOptions): Promise<Result<PaginatedResult<Creator>>> {
    const cacheKey = this.getCacheKey('findVerified', [options]);
    const cached = this.getCached<Result<PaginatedResult<Creator>>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findVerified(options);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Cache individual creators
      if (result.value) {
        for (const creator of result.value.items) {
          const idCacheKey = this.getCacheKey('findById', [creator.id.value]);
          this.setCached(idCacheKey, Result.ok(creator));
        }
      }
    }
    
    return result;
  }

  async findTop(sortBy: CreatorSortOptions, limit?: number): Promise<Result<Creator[]>> {
    const cacheKey = this.getCacheKey('findTop', [sortBy, limit]);
    const cached = this.getCached<Result<Creator[]>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.findTop(sortBy, limit);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }
    
    return result;
  }

  async save(creator: Creator): Promise<Result<Creator>> {
    const result = await this.repository.save(creator);
    
    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache(['findAll', 'findVerified', 'count', 'findTop']);
      
      // Cache the new creator
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [result.value.id.value]);
        const channelUrlCacheKey = this.getCacheKey('findByChannelUrl', [result.value.channelUrl.value]);
        this.setCached(idCacheKey, result);
        this.setCached(channelUrlCacheKey, result);
        
        if (result.value.channelId) {
          const channelIdCacheKey = this.getCacheKey('findByChannelId', [result.value.channelId]);
          this.setCached(channelIdCacheKey, result);
        }
      }
    }
    
    return result;
  }

  async update(creator: Creator): Promise<Result<Creator>> {
    const result = await this.repository.update(creator);
    
    if (result.isSuccess) {
      // Invalidate all caches since creator properties might have changed
      this.invalidateCache();
      
      // Cache the updated creator
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [result.value.id.value]);
        const channelUrlCacheKey = this.getCacheKey('findByChannelUrl', [result.value.channelUrl.value]);
        this.setCached(idCacheKey, result);
        this.setCached(channelUrlCacheKey, result);
        
        if (result.value.channelId) {
          const channelIdCacheKey = this.getCacheKey('findByChannelId', [result.value.channelId]);
          this.setCached(channelIdCacheKey, result);
        }
      }
    }
    
    return result;
  }

  async delete(id: CreatorId): Promise<Result<void>> {
    const result = await this.repository.delete(id);
    
    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }
    
    return result;
  }

  async saveMany(creators: Creator[]): Promise<Result<Creator[]>> {
    const result = await this.repository.saveMany(creators);
    
    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache(['findAll', 'findVerified', 'count']);
      
      // Cache individual creators
      if (result.value) {
        for (const creator of result.value) {
          const idCacheKey = this.getCacheKey('findById', [creator.id.value]);
          const channelUrlCacheKey = this.getCacheKey('findByChannelUrl', [creator.channelUrl.value]);
          this.setCached(idCacheKey, Result.ok(creator));
          this.setCached(channelUrlCacheKey, Result.ok(creator));
        }
      }
    }
    
    return result;
  }

  async updateMany(creators: Creator[]): Promise<Result<Creator[]>> {
    const result = await this.repository.updateMany(creators);
    
    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
      
      // Cache updated creators
      if (result.value) {
        for (const creator of result.value) {
          const idCacheKey = this.getCacheKey('findById', [creator.id.value]);
          const channelUrlCacheKey = this.getCacheKey('findByChannelUrl', [creator.channelUrl.value]);
          this.setCached(idCacheKey, Result.ok(creator));
          this.setCached(channelUrlCacheKey, Result.ok(creator));
        }
      }
    }
    
    return result;
  }

  async deleteMany(ids: CreatorId[]): Promise<Result<void>> {
    const result = await this.repository.deleteMany(ids);
    
    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }
    
    return result;
  }

  async updateStats(id: CreatorId, stats: {
    subscriberCount?: number;
    videoCount?: number;
    viewCount?: number;
  }): Promise<Result<Creator>> {
    const result = await this.repository.updateStats(id, stats);
    
    if (result.isSuccess) {
      // Invalidate caches related to this creator
      const patterns = [
        `findById:${JSON.stringify([id.value])}`,
        'findTop',
        'findAll',
      ];
      this.invalidateCache(patterns);
      
      // Cache the updated creator
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [result.value.id.value]);
        this.setCached(idCacheKey, result);
      }
    }
    
    return result;
  }

  async markAsFetched(id: CreatorId): Promise<Result<void>> {
    const result = await this.repository.markAsFetched(id);
    
    if (result.isSuccess) {
      // Invalidate the creator cache to get updated lastFetchedAt
      const cacheKey = this.getCacheKey('findById', [id.value]);
      this.cache.delete(cacheKey);
    }
    
    return result;
  }

  async exists(id: CreatorId): Promise<Result<boolean>> {
    // Check if we have it cached
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Creator>>(cacheKey);
    
    if (cached && cached.isSuccess) {
      return Result.ok(true);
    }

    return this.repository.exists(id);
  }

  async existsByChannelUrl(channelUrl: ChannelUrl): Promise<Result<boolean>> {
    // Check if we have it cached
    const cacheKey = this.getCacheKey('findByChannelUrl', [channelUrl.value]);
    const cached = this.getCached<Result<Creator>>(cacheKey);
    
    if (cached && cached.isSuccess) {
      return Result.ok(true);
    }

    return this.repository.existsByChannelUrl(channelUrl);
  }

  async count(): Promise<Result<number>> {
    const cacheKey = this.getCacheKey('count', []);
    const cached = this.getCached<Result<number>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.count();
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }
    
    return result;
  }

  async countByCountry(country: string): Promise<Result<number>> {
    const cacheKey = this.getCacheKey('countByCountry', [country]);
    const cached = this.getCached<Result<number>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.countByCountry(country);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }
    
    return result;
  }

  async countVerified(): Promise<Result<number>> {
    const cacheKey = this.getCacheKey('countVerified', []);
    const cached = this.getCached<Result<number>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.repository.countVerified();
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }
    
    return result;
  }

  // Utility method to clear cache manually
  clearCache(): void {
    this.cache.clear();
  }
}