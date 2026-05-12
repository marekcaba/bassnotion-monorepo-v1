import { CacheService } from './cache.service.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Base interface for repositories that can be wrapped with caching.
 * Defines the minimum contract required for the CachedRepository to function.
 */
export interface IBaseRepository<TEntity, TId> {
  findById(id: TId): Promise<TEntity | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<TEntity>>;
  search(query: string): Promise<TEntity[]>;
  save(entity: TEntity): Promise<void>;
  update(entity: TEntity): Promise<void>;
  delete(id: TId): Promise<void>;
  exists(id: TId): Promise<boolean>;
  findByIds(ids: TId[]): Promise<TEntity[]>;
  saveMany(entities: TEntity[]): Promise<void>;
  updateMany(entities: TEntity[]): Promise<void>;
  deleteMany(ids: TId[]): Promise<void>;
}

/**
 * Configuration options for the cached repository
 */
export interface CachedRepositoryConfig {
  /** Time-to-live for cache entries in seconds (default: 3600 = 1 hour) */
  ttl?: number;
  /** TTL multiplier for list/pagination queries (default: 0.5 = half of ttl) */
  listTtlMultiplier?: number;
  /** Whether to pre-fetch entity on delete to invalidate related caches (default: true) */
  preFetchOnDelete?: boolean;
}

const DEFAULT_CONFIG: Required<CachedRepositoryConfig> = {
  ttl: 3600, // 1 hour
  listTtlMultiplier: 0.5, // 30 minutes for lists
  preFetchOnDelete: true,
};

/**
 * Generic base class for cached repositories.
 *
 * This class implements the common caching patterns found across all cached repositories:
 * - Cache wrapping for reads with configurable TTL
 * - Cache invalidation on writes
 * - Batch operations with individual cache management
 * - Search pass-through (not cached due to dynamic nature)
 *
 * Subclasses must implement the abstract methods to provide domain-specific:
 * - Entity reconstitution from cached data
 * - Cache key generation
 * - Entity-to-persistence conversion
 * - Cache invalidation patterns
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class CachedExerciseRepository
 *   extends CachedRepository<Exercise, ExerciseId, ExerciseRepository>
 *   implements IExerciseRepository
 * {
 *   constructor(repository: ExerciseRepository, cache: CacheService) {
 *     super(repository, cache, { ttl: 3600 });
 *   }
 *
 *   // Implement abstract methods...
 * }
 * ```
 *
 * @typeParam TEntity - The domain entity type (e.g., Exercise, User)
 * @typeParam TId - The value object ID type (e.g., ExerciseId, UserId)
 * @typeParam TRepository - The underlying repository type that extends IBaseRepository
 */
export abstract class CachedRepository<
  TEntity,
  TId,
  TRepository extends IBaseRepository<TEntity, TId>,
> {
  protected readonly ttl: number;
  protected readonly listTtl: number;
  protected readonly preFetchOnDelete: boolean;

  constructor(
    public readonly repository: TRepository,
    protected readonly cache: CacheService,
    config: CachedRepositoryConfig = {},
  ) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.ttl = mergedConfig.ttl;
    this.listTtl = Math.floor(mergedConfig.ttl * mergedConfig.listTtlMultiplier);
    this.preFetchOnDelete = mergedConfig.preFetchOnDelete;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Reconstitute a domain entity from cached/persisted data.
   * Called when retrieving data from cache.
   */
  protected abstract reconstitute(data: unknown): TEntity;

  /**
   * Convert a domain entity to its persistence/cacheable form.
   * Called when storing data in cache.
   */
  protected abstract toPersistence(entity: TEntity): unknown;

  /**
   * Generate the primary cache key for an entity by its ID.
   * @example `exercise:${id.value}` or `user:${id.value}`
   */
  protected abstract getEntityKey(id: TId): string;

  /**
   * Generate the cache key for entity existence checks.
   * @example `exercise:exists:${id.value}`
   */
  protected abstract getExistsKey(id: TId): string;

  /**
   * Generate the cache key for paginated list queries.
   * @example `exercises:page:${options.page}:limit:${options.limit}`
   */
  protected abstract getPaginationKey(options: PaginationOptions): string;

  /**
   * Invalidate all cache keys specific to an entity.
   * Called after save, update, or delete operations.
   * Should clear entity key, exists key, and any related keys (e.g., by-email, by-slug).
   */
  protected abstract invalidateEntityCache(entity: TEntity): Promise<void>;

  /**
   * Invalidate all list/pagination cache keys.
   * Called after batch operations or when lists need refreshing.
   */
  protected abstract invalidateLists(): Promise<void>;

  /**
   * Extract the ID from an entity (used in delete operations).
   */
  protected abstract getEntityId(entity: TEntity): TId;

  // ============================================================================
  // Common Repository Methods - Pre-implemented with caching
  // ============================================================================

  /**
   * Find an entity by ID with caching.
   * Uses cache.wrap to retrieve from cache or fetch from repository.
   */
  async findById(id: TId): Promise<TEntity | null> {
    const key = this.getEntityKey(id);

    return this.cache
      .wrap(
        key,
        async () => {
          const entity = await this.repository.findById(id);
          return entity ? this.toPersistence(entity) : null;
        },
        this.ttl,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  /**
   * Find all entities with pagination and caching.
   * Uses half TTL for list queries as they change more frequently.
   */
  async findAll(options: PaginationOptions): Promise<PaginatedResult<TEntity>> {
    const key = this.getPaginationKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findAll(options);
          return {
            ...result,
            items: result.items.map((e) => this.toPersistence(e)),
          };
        },
        this.listTtl,
      )
      .then((result) => ({
        ...result,
        items: (result.items as unknown[]).map((data) => this.reconstitute(data)),
      }));
  }

  /**
   * Search for entities. NOT cached due to dynamic nature of search queries.
   */
  async search(query: string): Promise<TEntity[]> {
    return this.repository.search(query);
  }

  /**
   * Save a new entity and invalidate related caches.
   */
  async save(entity: TEntity): Promise<void> {
    await this.repository.save(entity);
    await this.invalidateEntityCache(entity);
  }

  /**
   * Update an entity and invalidate related caches.
   */
  async update(entity: TEntity): Promise<void> {
    await this.repository.update(entity);
    await this.invalidateEntityCache(entity);
  }

  /**
   * Delete an entity by ID and invalidate related caches.
   * Optionally pre-fetches the entity to invalidate all related caches.
   */
  async delete(id: TId): Promise<void> {
    if (this.preFetchOnDelete) {
      const entity = await this.repository.findById(id);
      await this.repository.delete(id);

      if (entity) {
        await this.invalidateEntityCache(entity);
      }
    } else {
      await this.repository.delete(id);
    }

    await this.cache.del(this.getEntityKey(id));
    await this.invalidateLists();
  }

  /**
   * Check if an entity exists with caching.
   */
  async exists(id: TId): Promise<boolean> {
    const key = this.getExistsKey(id);
    return this.cache.wrap(key, () => this.repository.exists(id), this.ttl);
  }

  /**
   * Find multiple entities by IDs using cached individual lookups.
   * Leverages per-entity caching for optimal cache utilization.
   */
  async findByIds(ids: TId[]): Promise<TEntity[]> {
    if (ids.length === 0) return [];

    const results = await Promise.all(ids.map((id) => this.findById(id)));
    return results.filter((entity): entity is NonNullable<typeof entity> => entity !== null) as TEntity[];
  }

  /**
   * Save multiple entities and invalidate all related caches.
   */
  async saveMany(entities: TEntity[]): Promise<void> {
    await this.repository.saveMany(entities);

    await Promise.all(
      entities.map((entity) => this.invalidateEntityCache(entity)),
    );
    await this.invalidateLists();
  }

  /**
   * Update multiple entities and invalidate all related caches.
   */
  async updateMany(entities: TEntity[]): Promise<void> {
    await this.repository.updateMany(entities);

    await Promise.all(
      entities.map((entity) => this.invalidateEntityCache(entity)),
    );
    await this.invalidateLists();
  }

  /**
   * Delete multiple entities by IDs and invalidate all related caches.
   * Optionally pre-fetches entities to ensure complete cache invalidation.
   */
  async deleteMany(ids: TId[]): Promise<void> {
    if (this.preFetchOnDelete) {
      const entities = await this.repository.findByIds(ids);
      await this.repository.deleteMany(ids);

      await Promise.all([
        ...entities.map((entity) => this.invalidateEntityCache(entity)),
        ...ids.map((id) => this.cache.del(this.getEntityKey(id))),
      ]);
    } else {
      await this.repository.deleteMany(ids);
      await Promise.all(ids.map((id) => this.cache.del(this.getEntityKey(id))));
    }

    await this.invalidateLists();
  }

  // ============================================================================
  // Helper Methods for Subclasses
  // ============================================================================

  /**
   * Helper method for caching a single entity lookup by an alternate key.
   * Useful for findByEmail, findBySlug, etc.
   */
  protected async findByAlternateKey(
    cacheKey: string,
    fetcher: () => Promise<TEntity | null>,
  ): Promise<TEntity | null> {
    return this.cache
      .wrap(
        cacheKey,
        async () => {
          const entity = await fetcher();
          return entity ? this.toPersistence(entity) : null;
        },
        this.ttl,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  /**
   * Helper method for caching a list of entities by some criteria.
   * Useful for findByDifficulty, findByRole, etc.
   */
  protected async findListByCriteria(
    cacheKey: string,
    fetcher: () => Promise<TEntity[]>,
    ttl: number = this.ttl,
  ): Promise<TEntity[]> {
    return this.cache
      .wrap(
        cacheKey,
        async () => {
          const entities = await fetcher();
          return entities.map((e) => this.toPersistence(e));
        },
        ttl,
      )
      .then((items) =>
        (items as unknown[]).map((data) => this.reconstitute(data)),
      );
  }

  /**
   * Helper method for caching paginated results by some criteria.
   * Useful for findPublished, findByAuthor with pagination, etc.
   */
  protected async findPaginatedByCriteria(
    cacheKey: string,
    fetcher: () => Promise<PaginatedResult<TEntity>>,
    ttl: number = this.listTtl,
  ): Promise<PaginatedResult<TEntity>> {
    return this.cache
      .wrap(
        cacheKey,
        async () => {
          const result = await fetcher();
          return {
            ...result,
            items: result.items.map((e) => this.toPersistence(e)),
          };
        },
        ttl,
      )
      .then((result) => ({
        ...result,
        items: (result.items as unknown[]).map((data) => this.reconstitute(data)),
      }));
  }

  /**
   * Helper method for checking existence by an alternate key.
   * Useful for existsByEmail, existsBySlug, etc.
   */
  protected async existsByAlternateKey(
    cacheKey: string,
    checker: () => Promise<boolean>,
  ): Promise<boolean> {
    return this.cache.wrap(cacheKey, checker, this.ttl);
  }

  /**
   * Helper method for caching a simple value (count, aggregate, etc.).
   */
  protected async cacheValue<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    ttl: number = this.ttl,
  ): Promise<T> {
    return this.cache.wrap(cacheKey, fetcher, ttl);
  }
}
