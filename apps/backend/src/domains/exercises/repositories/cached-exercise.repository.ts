import { Injectable } from '@nestjs/common';
import {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions } from './exercise.repository.interface.js';
import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { ExerciseRepository } from './exercise.repository.js';

@Injectable()
export class CachedExerciseRepository implements IExerciseRepository {
  private readonly TTL = 3600; // 1 hour

  constructor(
    public readonly repository: ExerciseRepository,
    private readonly cache: CacheService,
  ) {}

  async findById(id: ExerciseId): Promise<Exercise | null> {
    const key = this.getExerciseKey(id);

    return this.cache
      .wrap(
        key,
        async () => {
          const exercise = await this.repository.findById(id);
          return exercise ? exercise.toPersistence() : null;
        },
        this.TTL,
      )
      .then((data) => {
        if (!data) return null;
        return this.reconstitute(data);
      });
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Exercise>> {
    const key = this.getPaginationKey(options);

    return this.cache
      .wrap(
        key,
        async () => {
          const result = await this.repository.findAll(options);
          return {
            ...result,
            items: result.items.map((e) => e.toPersistence()) };
        },
        this.TTL / 2, // 30 minutes for list queries
      )
      .then((result) => ({
        ...result,
        items: result.items.map((data) => this.reconstitute(data)) }));
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Exercise[]> {
    const key = this.getDifficultyKey(difficulty);

    return this.cache
      .wrap(
        key,
        async () => {
          const exercises = await this.repository.findByDifficulty(difficulty);
          return exercises.map((e) => e.toPersistence());
        },
        this.TTL,
      )
      .then((items) => items.map((data) => this.reconstitute(data)));
  }

  async search(query: string): Promise<Exercise[]> {
    // Don't cache search results as they're too dynamic
    return this.repository.search(query);
  }

  async save(exercise: Exercise): Promise<void> {
    await this.repository.save(exercise);
    await this.invalidateCache(exercise);
  }

  async update(exercise: Exercise): Promise<void> {
    await this.repository.update(exercise);
    await this.invalidateCache(exercise);
  }

  async delete(id: ExerciseId): Promise<void> {
    await this.repository.delete(id);
    await this.cache.del(this.getExerciseKey(id));
    await this.invalidateLists();
  }

  async exists(id: ExerciseId): Promise<boolean> {
    const key = this.getExistsKey(id);

    return this.cache.wrap(key, () => this.repository.exists(id), this.TTL);
  }

  async findByIds(ids: ExerciseId[]): Promise<Exercise[]> {
    if (ids.length === 0) return [];

    // Try to get as many from cache as possible
    const results = await Promise.all(ids.map((id) => this.findById(id)));

    return results.filter((e): e is Exercise => e !== null);
  }

  async saveMany(exercises: Exercise[]): Promise<void> {
    await this.repository.saveMany(exercises);

    // Invalidate cache for all saved exercises
    await Promise.all(
      exercises.map((exercise) => this.invalidateCache(exercise)),
    );
  }

  async updateMany(exercises: Exercise[]): Promise<void> {
    await this.repository.updateMany(exercises);

    // Invalidate cache for all updated exercises
    await Promise.all(
      exercises.map((exercise) => this.invalidateCache(exercise)),
    );
  }

  async deleteMany(ids: ExerciseId[]): Promise<void> {
    await this.repository.deleteMany(ids);

    // Invalidate cache for all deleted exercises
    await Promise.all(ids.map((id) => this.cache.del(this.getExerciseKey(id))));
    await this.invalidateLists();
  }

  // Cache key generators
  private getExerciseKey(id: ExerciseId): string {
    return `exercise:${id.value}`;
  }

  private getPaginationKey(options: PaginationOptions): string {
    return `exercises:page:${options.page}:limit:${options.limit}`;
  }

  private getDifficultyKey(difficulty: Difficulty): string {
    return `exercises:difficulty:${difficulty.value}`;
  }

  private getExistsKey(id: ExerciseId): string {
    return `exercise:exists:${id.value}`;
  }

  // Cache invalidation
  private async invalidateCache(exercise: Exercise): Promise<void> {
    await this.cache.del(this.getExerciseKey(exercise.id));
    await this.cache.del(this.getExistsKey(exercise.id));
    await this.cache.del(this.getDifficultyKey(exercise.difficulty));
    await this.invalidateLists();
  }

  private async invalidateLists(): Promise<void> {
    // Invalidate all paginated results
    await this.cache.invalidatePattern('exercises:page:*');
    await this.cache.invalidatePattern('exercises:difficulty:*');
  }

  private reconstitute(data: any): Exercise {
    return Exercise.reconstitute({
      id: ExerciseId.create(data.id),
      title: data.title,
      description: data.description,
      difficulty: Difficulty.create(data.difficulty),
      duration: data.duration,
      bpm: data.bpm,
      key: data.key,
      notes: data.notes || [],
      tags: data.tags || [],
      isActive: data.is_active,
      midiFilePath: data.midi_file_path,
      originalFilename: data.original_filename,
      fileSize: data.file_size,
      uploadedAt: data.uploaded_at ? new Date(data.uploaded_at) : undefined,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at) });
  }
}
