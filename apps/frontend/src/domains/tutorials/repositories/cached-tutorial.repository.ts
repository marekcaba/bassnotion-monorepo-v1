import { Result } from '@/shared/types/result';
import { Tutorial } from '../entities/tutorial.entity';
import { TutorialId } from '../value-objects/tutorial-id.vo';
import { TutorialSlug } from '../value-objects/tutorial-slug.vo';
import { TutorialLevel } from '../value-objects/tutorial-level.vo';
import {
  ITutorialRepository,
  PaginatedResult,
  PaginationOptions,
  TutorialFilters,
} from './tutorial.repository.interface';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CachedTutorialRepository implements ITutorialRepository {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly repository: ITutorialRepository) {}

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
        if (patterns.some((pattern) => key.startsWith(pattern))) {
          this.cache.delete(key);
        }
      }
    }
  }

  async findById(id: TutorialId): Promise<Result<Tutorial>> {
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Tutorial>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findById(id);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findBySlug(slug: TutorialSlug): Promise<Result<Tutorial>> {
    const cacheKey = this.getCacheKey('findBySlug', [slug.value]);
    const cached = this.getCached<Result<Tutorial>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findBySlug(slug);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Also cache by ID for cross-reference
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [
          result.value.id.value,
        ]);
        this.setCached(idCacheKey, result);
      }
    }

    return result;
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    const cacheKey = this.getCacheKey('findAll', [options]);
    const cached = this.getCached<Result<PaginatedResult<Tutorial>>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findAll(options);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Cache individual tutorials
      if (result.value) {
        for (const tutorial of result.value.items) {
          const idCacheKey = this.getCacheKey('findById', [tutorial.id.value]);
          this.setCached(idCacheKey, Result.ok(tutorial));
        }
      }
    }

    return result;
  }

  async findByLevel(level: TutorialLevel): Promise<Result<Tutorial[]>> {
    const cacheKey = this.getCacheKey('findByLevel', [level.value]);
    const cached = this.getCached<Result<Tutorial[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findByLevel(level);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findByTag(tag: string): Promise<Result<Tutorial[]>> {
    const cacheKey = this.getCacheKey('findByTag', [tag]);
    const cached = this.getCached<Result<Tutorial[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findByTag(tag);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findByAuthor(authorName: string): Promise<Result<Tutorial[]>> {
    const cacheKey = this.getCacheKey('findByAuthor', [authorName]);
    const cached = this.getCached<Result<Tutorial[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findByAuthor(authorName);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async search(
    query: string,
    filters?: TutorialFilters,
  ): Promise<Result<Tutorial[]>> {
    // Don't cache search results as they are too dynamic
    return this.repository.search(query, filters);
  }

  async findByIds(ids: TutorialId[]): Promise<Result<Tutorial[]>> {
    // Try to get individual tutorials from cache first
    const cachedTutorials: Tutorial[] = [];
    const missingIds: TutorialId[] = [];

    for (const id of ids) {
      const cacheKey = this.getCacheKey('findById', [id.value]);
      const cached = this.getCached<Result<Tutorial>>(cacheKey);

      if (cached && cached.isSuccess && cached.value) {
        cachedTutorials.push(cached.value);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return Result.ok(cachedTutorials);
    }

    const result = await this.repository.findByIds(missingIds);
    if (result.isSuccess && result.value) {
      // Cache individual tutorials
      for (const tutorial of result.value) {
        const cacheKey = this.getCacheKey('findById', [tutorial.id.value]);
        this.setCached(cacheKey, Result.ok(tutorial));
      }

      return Result.ok([...cachedTutorials, ...result.value]);
    }

    return result;
  }

  async findPublished(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Tutorial>>> {
    const cacheKey = this.getCacheKey('findPublished', [options]);
    const cached = this.getCached<Result<PaginatedResult<Tutorial>>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findPublished(options);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
      // Cache individual tutorials
      if (result.value) {
        for (const tutorial of result.value.items) {
          const idCacheKey = this.getCacheKey('findById', [tutorial.id.value]);
          this.setCached(idCacheKey, Result.ok(tutorial));
        }
      }
    }

    return result;
  }

  async findRelated(
    tutorialId: TutorialId,
    limit?: number,
  ): Promise<Result<Tutorial[]>> {
    const cacheKey = this.getCacheKey('findRelated', [tutorialId.value, limit]);
    const cached = this.getCached<Result<Tutorial[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findRelated(tutorialId, limit);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async save(tutorial: Tutorial): Promise<Result<Tutorial>> {
    const result = await this.repository.save(tutorial);

    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache([
        'findAll',
        'findPublished',
        'count',
        'findByLevel',
        'findByTag',
        'findByAuthor',
      ]);

      // Cache the new tutorial
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [
          result.value.id.value,
        ]);
        const slugCacheKey = this.getCacheKey('findBySlug', [
          result.value.slug.value,
        ]);
        this.setCached(idCacheKey, result);
        this.setCached(slugCacheKey, result);
      }
    }

    return result;
  }

  async update(tutorial: Tutorial): Promise<Result<Tutorial>> {
    const result = await this.repository.update(tutorial);

    if (result.isSuccess) {
      // Invalidate all caches since tutorial properties might have changed
      this.invalidateCache();

      // Cache the updated tutorial
      if (result.value) {
        const idCacheKey = this.getCacheKey('findById', [
          result.value.id.value,
        ]);
        const slugCacheKey = this.getCacheKey('findBySlug', [
          result.value.slug.value,
        ]);
        this.setCached(idCacheKey, result);
        this.setCached(slugCacheKey, result);
      }
    }

    return result;
  }

  async delete(id: TutorialId): Promise<Result<void>> {
    const result = await this.repository.delete(id);

    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }

    return result;
  }

  async saveMany(tutorials: Tutorial[]): Promise<Result<Tutorial[]>> {
    const result = await this.repository.saveMany(tutorials);

    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache(['findAll', 'findPublished', 'count']);

      // Cache individual tutorials
      if (result.value) {
        for (const tutorial of result.value) {
          const idCacheKey = this.getCacheKey('findById', [tutorial.id.value]);
          const slugCacheKey = this.getCacheKey('findBySlug', [
            tutorial.slug.value,
          ]);
          this.setCached(idCacheKey, Result.ok(tutorial));
          this.setCached(slugCacheKey, Result.ok(tutorial));
        }
      }
    }

    return result;
  }

  async deleteMany(ids: TutorialId[]): Promise<Result<void>> {
    const result = await this.repository.deleteMany(ids);

    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }

    return result;
  }

  async exists(id: TutorialId): Promise<Result<boolean>> {
    // Check if we have it cached
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Tutorial>>(cacheKey);

    if (cached && cached.isSuccess) {
      return Result.ok(true);
    }

    return this.repository.exists(id);
  }

  async existsBySlug(slug: TutorialSlug): Promise<Result<boolean>> {
    // Check if we have it cached
    const cacheKey = this.getCacheKey('findBySlug', [slug.value]);
    const cached = this.getCached<Result<Tutorial>>(cacheKey);

    if (cached && cached.isSuccess) {
      return Result.ok(true);
    }

    return this.repository.existsBySlug(slug);
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

  async countByLevel(level: TutorialLevel): Promise<Result<number>> {
    const cacheKey = this.getCacheKey('countByLevel', [level.value]);
    const cached = this.getCached<Result<number>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.countByLevel(level);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async incrementViewCount(id: TutorialId): Promise<Result<void>> {
    // Don't cache this operation
    const result = await this.repository.incrementViewCount(id);

    if (result.isSuccess) {
      // Invalidate the tutorial cache to get updated view count
      const cacheKey = this.getCacheKey('findById', [id.value]);
      this.cache.delete(cacheKey);
    }

    return result;
  }

  // Utility method to clear cache manually
  clearCache(): void {
    this.cache.clear();
  }
}
