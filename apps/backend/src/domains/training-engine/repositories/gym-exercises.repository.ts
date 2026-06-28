import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type { GymExercise } from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** Raw `gym_exercises` row (snake_case) as Supabase returns it. */
interface GymExerciseRow {
  id: string;
  kind: string;
  name: string;
  description: string;
  equipment: string;
  scale_type: string | null;
  payload: unknown;
  updated_at: string;
}

/**
 * GymExercisesRepository — read/write admin-authored gym equipment exercises
 * (`gym_exercises`). Generic over equipment (scale paths today, grooves later) — the
 * payload is opaque JSON. Backend client is service-role; AdminGuard is the real
 * write boundary. Draft-friendly: no content validation here.
 */
@Injectable()
export class GymExercisesRepository {
  private readonly staticLogger = createStructuredLogger(
    GymExercisesRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /** List exercises, optionally filtered by equipment + kind (newest first). */
  async list(filters?: {
    equipment?: string;
    kind?: string;
  }): Promise<GymExercise[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    let query = this.supabaseService
      .getClient()
      .from('gym_exercises')
      .select('*')
      .order('updated_at', { ascending: false });
    if (filters?.equipment) query = query.eq('equipment', filters.equipment);
    if (filters?.kind) query = query.eq('kind', filters.kind);
    const { data, error } = await query;
    if (error) {
      logger.error('Failed to list gym exercises', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return (data ?? []).map((r) => this.mapRow(r as GymExerciseRow));
  }

  async findById(id: string): Promise<GymExercise | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gym_exercises')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      logger.error('Failed to read gym exercise', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapRow(data as GymExerciseRow) : null;
  }

  async insert(row: Record<string, unknown>): Promise<GymExercise> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gym_exercises')
      .insert(row)
      .select()
      .single();
    if (error) {
      logger.error('Failed to insert gym exercise', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return this.mapRow(data as GymExerciseRow);
  }

  async update(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<GymExercise | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('gym_exercises')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      logger.error('Failed to update gym exercise', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapRow(data as GymExerciseRow) : null;
  }

  async remove(id: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { error } = await this.supabaseService
      .getClient()
      .from('gym_exercises')
      .delete()
      .eq('id', id);
    if (error) {
      logger.error('Failed to delete gym exercise', error as Error, {
        id,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
  }

  private mapRow(row: GymExerciseRow): GymExercise {
    return {
      id: row.id,
      kind: row.kind as GymExercise['kind'],
      name: row.name,
      description: row.description,
      equipment: row.equipment,
      scaleType: row.scale_type,
      payload: row.payload,
      updatedAt: row.updated_at,
    };
  }
}
