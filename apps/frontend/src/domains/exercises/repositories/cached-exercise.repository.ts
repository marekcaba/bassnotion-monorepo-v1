import { Result } from '@/shared/types/result';
import { Exercise } from '../entities/exercise.entity';
import { ExerciseId } from '../value-objects/exercise-id.vo';
import { Difficulty } from '../value-objects/difficulty.vo';
import {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions,
  SearchOptions,
} from './exercise.repository.interface';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CachedExerciseRepository implements IExerciseRepository {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly repository: IExerciseRepository) {}

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

  async findById(id: ExerciseId): Promise<Result<Exercise>> {
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Exercise>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findById(id);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findAll(
    options?: PaginationOptions,
  ): Promise<Result<PaginatedResult<Exercise>>> {
    const cacheKey = this.getCacheKey('findAll', [options]);
    const cached = this.getCached<Result<PaginatedResult<Exercise>>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findAll(options);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Result<Exercise[]>> {
    const cacheKey = this.getCacheKey('findByDifficulty', [difficulty.value]);
    const cached = this.getCached<Result<Exercise[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findByDifficulty(difficulty);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async findByTag(tag: string): Promise<Result<Exercise[]>> {
    const cacheKey = this.getCacheKey('findByTag', [tag]);
    const cached = this.getCached<Result<Exercise[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findByTag(tag);
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async search(options: SearchOptions): Promise<Result<Exercise[]>> {
    // Don't cache search results as they are too dynamic
    return this.repository.search(options);
  }

  async findByIds(ids: ExerciseId[]): Promise<Result<Exercise[]>> {
    // Try to get individual exercises from cache first
    const cachedExercises: Exercise[] = [];
    const missingIds: ExerciseId[] = [];

    for (const id of ids) {
      const cacheKey = this.getCacheKey('findById', [id.value]);
      const cached = this.getCached<Result<Exercise>>(cacheKey);

      if (cached && cached.isSuccess && cached.value) {
        cachedExercises.push(cached.value);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length === 0) {
      return Result.ok(cachedExercises);
    }

    const result = await this.repository.findByIds(missingIds);
    if (result.isSuccess && result.value) {
      // Cache individual exercises
      for (const exercise of result.value) {
        const cacheKey = this.getCacheKey('findById', [exercise.id.value]);
        this.setCached(cacheKey, Result.ok(exercise));
      }

      return Result.ok([...cachedExercises, ...result.value]);
    }

    return result;
  }

  async findActive(): Promise<Result<Exercise[]>> {
    const cacheKey = this.getCacheKey('findActive', []);
    const cached = this.getCached<Result<Exercise[]>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.findActive();
    if (result.isSuccess) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async save(exercise: Exercise): Promise<Result<Exercise>> {
    const result = await this.repository.save(exercise);

    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache(['findAll', 'findActive', 'count']);

      // Cache the new exercise
      const cacheKey = this.getCacheKey('findById', [result.value!.id.value]);
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async update(exercise: Exercise): Promise<Result<Exercise>> {
    const result = await this.repository.update(exercise);

    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache([
        'findAll',
        'findByDifficulty',
        'findByTag',
        'findActive',
        `findById:${JSON.stringify([exercise.id.value])}`,
      ]);

      // Cache the updated exercise
      const cacheKey = this.getCacheKey('findById', [result.value!.id.value]);
      this.setCached(cacheKey, result);
    }

    return result;
  }

  async delete(id: ExerciseId): Promise<Result<void>> {
    const result = await this.repository.delete(id);

    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }

    return result;
  }

  async saveMany(exercises: Exercise[]): Promise<Result<Exercise[]>> {
    const result = await this.repository.saveMany(exercises);

    if (result.isSuccess) {
      // Invalidate relevant caches
      this.invalidateCache(['findAll', 'findActive', 'count']);

      // Cache individual exercises
      if (result.value) {
        for (const exercise of result.value) {
          const cacheKey = this.getCacheKey('findById', [exercise.id.value]);
          this.setCached(cacheKey, Result.ok(exercise));
        }
      }
    }

    return result;
  }

  async deleteMany(ids: ExerciseId[]): Promise<Result<void>> {
    const result = await this.repository.deleteMany(ids);

    if (result.isSuccess) {
      // Invalidate all caches
      this.invalidateCache();
    }

    return result;
  }

  async exists(id: ExerciseId): Promise<Result<boolean>> {
    // Check if we have it cached
    const cacheKey = this.getCacheKey('findById', [id.value]);
    const cached = this.getCached<Result<Exercise>>(cacheKey);

    if (cached && cached.isSuccess) {
      return Result.ok(true);
    }

    return this.repository.exists(id);
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

  async countByDifficulty(difficulty: Difficulty): Promise<Result<number>> {
    const cacheKey = this.getCacheKey('countByDifficulty', [difficulty.value]);
    const cached = this.getCached<Result<number>>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.repository.countByDifficulty(difficulty);
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
