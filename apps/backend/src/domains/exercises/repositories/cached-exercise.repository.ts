import { Injectable } from '@nestjs/common';
import {
  IExerciseRepository,
  PaginationOptions,
} from './exercise.repository.interface.js';
import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CachedRepository } from '../../../infrastructure/cache/cached-repository.base.js';
import { ExerciseRepository } from './exercise.repository.js';

/**
 * Cached exercise note data structure.
 */
interface CachedExerciseNote {
  id: string;
  timestamp: number;
  string: number;
  fret: number;
  duration: number;
  note: string;
  color: string;
  techniques?: unknown[];
  [key: string]: unknown;
}

/**
 * Cached exercise data structure (snake_case from database/cache).
 * This interface matches the output of Exercise.toPersistence().
 */
interface CachedExerciseData {
  id: string;
  tutorial_id?: string;
  title: string;
  description: string;
  difficulty: string; // DifficultyLevel string value ('beginner', 'intermediate', 'advanced')
  duration: number;
  duration_beats?: number;
  total_bars?: number;
  bpm: number;
  key: string;
  time_signature?: { numerator: number; denominator: number };
  notes: CachedExerciseNote[];
  tags: string[];
  is_active: boolean;
  midi_file_path?: string;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
  drummer_midi_url?: string;
  bassline_midi_url?: string;
  harmony_midi_url?: string;
  metronome_midi_url?: string;
  harmony_notes?: unknown[];
  harmony_control_changes?: unknown[];
  harmony_instrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad';
  drum_pattern?: unknown[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cached decorator for ExerciseRepository.
 *
 * Extends CachedRepository base class to provide consistent caching behavior
 * while implementing domain-specific methods like findByDifficulty.
 *
 * Cache key patterns:
 * - exercise:{id} - Single entity
 * - exercise:exists:{id} - Existence check
 * - exercises:page:{n}:limit:{m} - Pagination
 * - exercises:difficulty:{level} - By difficulty
 */
@Injectable()
export class CachedExerciseRepository
  extends CachedRepository<Exercise, ExerciseId, ExerciseRepository>
  implements IExerciseRepository
{
  constructor(repository: ExerciseRepository, cache: CacheService) {
    super(repository, cache, { ttl: 3600 }); // 1 hour default TTL
  }

  // ============================================================================
  // Domain-Specific Methods
  // ============================================================================

  /**
   * Find exercises by difficulty level with caching.
   */
  async findByDifficulty(difficulty: Difficulty): Promise<Exercise[]> {
    const key = this.getDifficultyKey(difficulty);
    return this.findListByCriteria(key, () =>
      this.repository.findByDifficulty(difficulty),
    );
  }

  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================

  protected reconstitute(data: unknown): Exercise {
    const d = data as CachedExerciseData;
    return Exercise.reconstitute({
      id: ExerciseId.create(d.id),
      tutorialId: d.tutorial_id,
      title: d.title,
      description: d.description,
      difficulty: Difficulty.create(d.difficulty),
      duration: d.duration,
      durationBeats: d.duration_beats,
      totalBars: d.total_bars,
      bpm: d.bpm,
      key: d.key,
      timeSignature: d.time_signature,
      notes: d.notes || [],
      tags: d.tags || [],
      isActive: d.is_active,
      midiFilePath: d.midi_file_path,
      originalFilename: d.original_filename,
      fileSize: d.file_size,
      uploadedAt: d.uploaded_at ? new Date(d.uploaded_at) : undefined,
      drummerMidiUrl: d.drummer_midi_url,
      basslineMidiUrl: d.bassline_midi_url,
      harmonyMidiUrl: d.harmony_midi_url,
      metronomeMidiUrl: d.metronome_midi_url,
      harmonyNotes: d.harmony_notes,
      harmonyControlChanges: d.harmony_control_changes,
      harmonyInstrument: d.harmony_instrument,
      drumPattern: d.drum_pattern,
      createdBy: d.created_by,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    });
  }

  protected toPersistence(entity: Exercise): unknown {
    return entity.toPersistence();
  }

  protected getEntityKey(id: ExerciseId): string {
    return `exercise:${id.value}`;
  }

  protected getExistsKey(id: ExerciseId): string {
    return `exercise:exists:${id.value}`;
  }

  protected getPaginationKey(options: PaginationOptions): string {
    return `exercises:page:${options.page}:limit:${options.limit}`;
  }

  protected getEntityId(entity: Exercise): ExerciseId {
    return entity.id;
  }

  protected async invalidateEntityCache(exercise: Exercise): Promise<void> {
    await Promise.all([
      this.cache.del(this.getEntityKey(exercise.id)),
      this.cache.del(this.getExistsKey(exercise.id)),
      this.cache.del(this.getDifficultyKey(exercise.difficulty)),
    ]);
    await this.invalidateLists();
  }

  protected async invalidateLists(): Promise<void> {
    await this.cache.invalidatePattern('exercises:page:*');
    await this.cache.invalidatePattern('exercises:difficulty:*');
  }

  // ============================================================================
  // Domain-Specific Cache Keys
  // ============================================================================

  private getDifficultyKey(difficulty: Difficulty): string {
    return `exercises:difficulty:${difficulty.value}`;
  }
}
