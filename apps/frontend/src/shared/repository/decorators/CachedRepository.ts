/**
 * Generic cached repository decorator that adds caching to any repository
 */

import { createStructuredLogger } from '@/utils/logger';
import {
  IRepository,
  PaginationOptions,
  PaginatedResult,
} from '../base/IRepository.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CachedRepository<TEntity, TId> implements IRepository<
  TEntity,
  TId
> {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly TTL: number;
  private readonly logger = createStructuredLogger('CachedRepository');

  constructor(
    private repository: IRepository<TEntity, TId>,
    private extractId: (entity: TEntity) => string,
    options: { ttl?: number } = {},
  ) {
    this.TTL = options.ttl || 5 * 60 * 1000; // Default 5 minutes
  }

  private getCacheKey(method: string, ...args: any[]): string {
    return `${method}:${JSON.stringify(args)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug('Cache hit', { key });
    return cached.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    this.logger.debug('Cache set', { key });
  }

  private invalidateEntityCache(id: string): void {
    // Invalidate specific entity cache
    this.cache.delete(this.getCacheKey('findById', id));

    // Invalidate list caches (they might contain this entity)
    for (const key of this.cache.keys()) {
      if (key.startsWith('findAll:') || key.startsWith('findByIds:')) {
        this.cache.delete(key);
      }
    }

    this.logger.debug('Cache invalidated for entity', { id });
  }

  async findById(id: TId): Promise<TEntity> {
    const cacheKey = this.getCacheKey('findById', id);
    const cached = this.getFromCache<TEntity>(cacheKey);
    if (cached) return cached;

    const entity = await this.repository.findById(id);
    this.setCache(cacheKey, entity);

    // Also cache by entity ID for invalidation
    const entityId = this.extractId(entity);
    this.setCache(this.getCacheKey('findById', entityId), entity);

    return entity;
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<PaginatedResult<TEntity>> {
    const cacheKey = this.getCacheKey('findAll', options);
    const cached = this.getFromCache<PaginatedResult<TEntity>>(cacheKey);
    if (cached) return cached;

    const result = await this.repository.findAll(options);
    this.setCache(cacheKey, result);

    // Cache individual entities for findById
    result.items.forEach((entity) => {
      const id = this.extractId(entity);
      this.setCache(this.getCacheKey('findById', id), entity);
    });

    return result;
  }

  async save(entity: TEntity): Promise<TEntity> {
    const saved = await this.repository.save(entity);
    const id = this.extractId(saved);

    // Update cache with new entity
    this.setCache(this.getCacheKey('findById', id), saved);

    // Invalidate list caches
    this.invalidateListCaches();

    return saved;
  }

  async update(id: TId, entity: Partial<TEntity>): Promise<TEntity> {
    const updated = await this.repository.update(id, entity);
    const entityId = this.extractId(updated);

    // Update cache
    this.invalidateEntityCache(entityId);
    this.setCache(this.getCacheKey('findById', id), updated);
    this.setCache(this.getCacheKey('findById', entityId), updated);

    return updated;
  }

  async delete(id: TId): Promise<void> {
    await this.repository.delete(id);

    // Invalidate caches
    this.invalidateEntityCache(String(id));
    this.invalidateListCaches();
  }

  async findByIds(ids: TId[]): Promise<TEntity[]> {
    const cacheKey = this.getCacheKey('findByIds', ids);
    const cached = this.getFromCache<TEntity[]>(cacheKey);
    if (cached) return cached;

    // Try to get individual entities from cache
    const cachedEntities: TEntity[] = [];
    const missingIds: TId[] = [];

    for (const id of ids) {
      const entity = this.getFromCache<TEntity>(
        this.getCacheKey('findById', id),
      );
      if (entity) {
        cachedEntities.push(entity);
      } else {
        missingIds.push(id);
      }
    }

    // Fetch missing entities
    let missingEntities: TEntity[] = [];
    if (missingIds.length > 0) {
      missingEntities = await this.repository.findByIds(missingIds);

      // Cache individual entities
      missingEntities.forEach((entity) => {
        const entityId = this.extractId(entity);
        this.setCache(this.getCacheKey('findById', entityId), entity);
      });
    }

    const result = [...cachedEntities, ...missingEntities];
    this.setCache(cacheKey, result);

    return result;
  }

  async saveMany(entities: TEntity[]): Promise<TEntity[]> {
    const saved = await this.repository.saveMany(entities);

    // Update cache with new entities
    saved.forEach((entity) => {
      const id = this.extractId(entity);
      this.setCache(this.getCacheKey('findById', id), entity);
    });

    // Invalidate list caches
    this.invalidateListCaches();

    return saved;
  }

  async updateMany(
    updates: Array<{ id: TId; data: Partial<TEntity> }>,
  ): Promise<TEntity[]> {
    const updated = await this.repository.updateMany(updates);

    // Update cache
    updated.forEach((entity) => {
      const id = this.extractId(entity);
      this.invalidateEntityCache(id);
      this.setCache(this.getCacheKey('findById', id), entity);
    });

    return updated;
  }

  async deleteMany(ids: TId[]): Promise<void> {
    await this.repository.deleteMany(ids);

    // Invalidate caches
    ids.forEach((id) => this.invalidateEntityCache(String(id)));
    this.invalidateListCaches();
  }

  async exists(id: TId): Promise<boolean> {
    const cacheKey = this.getCacheKey('exists', id);
    const cached = this.getFromCache<boolean>(cacheKey);
    if (cached !== null) return cached;

    const exists = await this.repository.exists(id);
    this.setCache(cacheKey, exists);

    return exists;
  }

  async count(): Promise<number> {
    const cacheKey = this.getCacheKey('count');
    const cached = this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    const count = await this.repository.count();
    this.setCache(cacheKey, count);

    return count;
  }

  private invalidateListCaches(): void {
    for (const key of this.cache.keys()) {
      if (
        key.startsWith('findAll:') ||
        key.startsWith('findByIds:') ||
        key.startsWith('count:')
      ) {
        this.cache.delete(key);
      }
    }
    this.logger.debug('List caches invalidated');
  }

  // Utility method to clear all cache
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  // Utility method to get cache statistics
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
