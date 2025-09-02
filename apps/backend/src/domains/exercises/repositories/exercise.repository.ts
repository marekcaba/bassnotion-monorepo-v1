import { Injectable, Inject } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  IExerciseRepository,
  PaginatedResult,
  PaginationOptions } from './exercise.repository.interface.js';
import { Exercise } from '../entities/exercise.entity.js';
import { ExerciseId } from '../value-objects/exercise-id.vo.js';
import { Difficulty } from '../value-objects/difficulty.vo.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

interface ExerciseRecord {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  duration: number;
  bpm: number;
  key: string;
  notes: any[]; // Schema doesn't match ExerciseNote type yet
  tags: string[];
  is_active: boolean;
  midi_file_path?: string;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ExerciseRepository implements IExerciseRepository {
  private readonly staticLogger = createStructuredLogger(ExerciseRepository.name);

  constructor(
    private readonly supabase: SupabaseClient,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findById(id: ExerciseId): Promise<Exercise | null> {
    try {
      const { data, error } = await this.supabase
        .from('exercises')
        .select('*')
        .eq('id', id.value)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.debug(`Exercise not found with id: ${id.value}`, { correlationId });
        return null;
      }

      return this.mapToEntity(data as ExerciseRecord);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error finding exercise by id ${id.value}:`, error as Error, { correlationId });
      throw new Error(
        `Failed to find exercise: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async findAll(
    options: PaginationOptions,
  ): Promise<PaginatedResult<Exercise>> {
    try {
      const offset = (options.page - 1) * options.limit;

      const { data, error, count } = await this.supabase
        .from('exercises')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('title', { ascending: true })
        .range(offset, offset + options.limit - 1);

      if (error) {
        throw new Error(`Failed to fetch exercises: ${error.message}`);
      }

      const exercises = (data || []).map((record) =>
        this.mapToEntity(record as ExerciseRecord),
      );

      return {
        items: exercises,
        total: count || 0,
        page: options.page,
        limit: options.limit };
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching all exercises:', error as Error, { correlationId });
      throw error;
    }
  }

  async findByDifficulty(difficulty: Difficulty): Promise<Exercise[]> {
    try {
      const { data, error } = await this.supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .eq('difficulty', difficulty.value)
        .order('title', { ascending: true });

      if (error) {
        throw new Error(
          `Failed to fetch exercises by difficulty: ${error.message}`,
        );
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as ExerciseRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error fetching exercises by difficulty ${difficulty.value}:`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async search(query: string): Promise<Exercise[]> {
    try {
      const { data, error } = await this.supabase
        .from('exercises')
        .select('*')
        .eq('is_active', true)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('title', { ascending: true });

      if (error) {
        throw new Error(`Failed to search exercises: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as ExerciseRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error searching exercises with query "${query}":`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async save(exercise: Exercise): Promise<void> {
    try {
      const data = exercise.toPersistence();
      const { error } = await this.supabase.from('exercises').insert(data);

      if (error) {
        throw new Error(`Failed to save exercise: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully saved exercise: ${exercise.id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving exercise:', error as Error, { correlationId });
      throw error;
    }
  }

  async update(exercise: Exercise): Promise<void> {
    try {
      const data = exercise.toPersistence();
      const { error } = await this.supabase
        .from('exercises')
        .update(data)
        .eq('id', exercise.id.value);

      if (error) {
        throw new Error(`Failed to update exercise: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully updated exercise: ${exercise.id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error updating exercise ${exercise.id.value}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async delete(id: ExerciseId): Promise<void> {
    try {
      // Soft delete by setting is_active to false
      const { error } = await this.supabase
        .from('exercises')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id.value);

      if (error) {
        throw new Error(`Failed to delete exercise: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(`Successfully deleted exercise: ${id.value}`, { correlationId });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(`Error deleting exercise ${id.value}:`, error as Error, { correlationId });
      throw error;
    }
  }

  async exists(id: ExerciseId): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .eq('id', id.value)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to check exercise existence: ${error.message}`);
      }

      return (count ?? 0) > 0;
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error(
        `Error checking existence of exercise ${id.value}:`,
        error as Error,
        { correlationId }
      );
      throw error;
    }
  }

  async findByIds(ids: ExerciseId[]): Promise<Exercise[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const idValues = ids.map((id) => id.value);
      const { data, error } = await this.supabase
        .from('exercises')
        .select('*')
        .in('id', idValues)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to fetch exercises by ids: ${error.message}`);
      }

      return (data || []).map((record) =>
        this.mapToEntity(record as ExerciseRecord),
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error fetching exercises by ids:', error as Error, { correlationId });
      throw error;
    }
  }

  async saveMany(exercises: Exercise[]): Promise<void> {
    if (exercises.length === 0) return;

    try {
      const data = exercises.map((exercise) => exercise.toPersistence());
      const { error } = await this.supabase.from('exercises').insert(data);

      if (error) {
        throw new Error(`Failed to save exercises batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully saved ${exercises.length} exercises in batch`,
        { correlationId }
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error saving exercises batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async updateMany(exercises: Exercise[]): Promise<void> {
    if (exercises.length === 0) return;

    try {
      // Supabase doesn't support bulk updates natively, so we use a transaction-like approach
      const updates = exercises.map((exercise) =>
        this.supabase
          .from('exercises')
          .update(exercise.toPersistence())
          .eq('id', exercise.id.value),
      );

      const results = await Promise.all(updates);

      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        throw new Error(
          `Failed to update exercises batch: ${errors.map((e) => e.error?.message).join(', ')}`,
        );
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully updated ${exercises.length} exercises in batch`,
        { correlationId }
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error updating exercises batch:', error as Error, { correlationId });
      throw error;
    }
  }

  async deleteMany(ids: ExerciseId[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const idValues = ids.map((id) => id.value);
      const { error } = await this.supabase
        .from('exercises')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', idValues);

      if (error) {
        throw new Error(`Failed to delete exercises batch: ${error.message}`);
      }

      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.debug(
        `Successfully deleted ${ids.length} exercises in batch`,
        { correlationId }
      );
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error deleting exercises batch:', error as Error, { correlationId });
      throw error;
    }
  }

  private mapToEntity(record: ExerciseRecord): Exercise {
    return Exercise.reconstitute({
      id: ExerciseId.create(record.id),
      title: record.title,
      description: record.description,
      difficulty: Difficulty.create(record.difficulty),
      duration: record.duration,
      bpm: record.bpm,
      key: record.key,
      notes: record.notes || [],
      tags: record.tags || [],
      isActive: record.is_active,
      midiFilePath: record.midi_file_path,
      originalFilename: record.original_filename,
      fileSize: record.file_size,
      uploadedAt: record.uploaded_at ? new Date(record.uploaded_at) : undefined,
      createdBy: record.created_by,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at) });
  }
}
