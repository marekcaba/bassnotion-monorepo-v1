import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  ScaleBlueprintRecord,
  ScaleTypeId,
  ScalePositionShape,
  ScaleRhythmValue,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** The raw `scale_blueprints` row (snake_case) as Supabase returns it. */
interface ScaleBlueprintRow {
  scale_type: string;
  positions: ScalePositionShape[];
  rhythm: string;
  updated_at: string;
}

/**
 * ScaleBlueprintsRepository — read/write the admin-authored `scale_blueprints`
 * table (the gym Scales tool's box shapes + practice rhythm). Backend client is
 * service-role (bypasses RLS); the AdminGuard on the controller is the real
 * write boundary. Mapping is explicit snake↔camel.
 */
@Injectable()
export class ScaleBlueprintsRepository {
  private readonly staticLogger = createStructuredLogger(
    ScaleBlueprintsRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /** All blueprints, one per scale type. */
  async listAll(): Promise<ScaleBlueprintRecord[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scale_blueprints')
      .select('*')
      .order('scale_type', { ascending: true });
    if (error) {
      logger.error('Failed to list scale blueprints', error as Error, {
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return (data ?? []).map((r) => this.mapRow(r as ScaleBlueprintRow));
  }

  /** One scale's blueprint, or null if no row exists yet (runtime falls back to seeds). */
  async findByType(
    scaleType: ScaleTypeId,
  ): Promise<ScaleBlueprintRecord | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const { data, error } = await this.supabaseService
      .getClient()
      .from('scale_blueprints')
      .select('*')
      .eq('scale_type', scaleType)
      .maybeSingle();
    if (error) {
      logger.error('Failed to read scale blueprint', error as Error, {
        scaleType,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return data ? this.mapRow(data as ScaleBlueprintRow) : null;
  }

  /**
   * Upsert a scale's blueprint (the editor PATCHes the whole shape). Creating the
   * row if the seed migration hasn't run, updating it otherwise. Returns the row.
   */
  async upsert(
    scaleType: ScaleTypeId,
    patch: { positions?: ScalePositionShape[]; rhythm?: ScaleRhythmValue },
  ): Promise<ScaleBlueprintRecord> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const row: Record<string, unknown> = {
      scale_type: scaleType,
      updated_at: new Date().toISOString(),
    };
    if (patch.positions !== undefined) row.positions = patch.positions;
    if (patch.rhythm !== undefined) row.rhythm = patch.rhythm;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('scale_blueprints')
      .upsert(row, { onConflict: 'scale_type' })
      .select()
      .single();
    if (error) {
      logger.error('Failed to upsert scale blueprint', error as Error, {
        scaleType,
        correlationId: this.requestContext?.getCorrelationId(),
      });
      throw error;
    }
    return this.mapRow(data as ScaleBlueprintRow);
  }

  private mapRow(row: ScaleBlueprintRow): ScaleBlueprintRecord {
    return {
      scaleType: row.scale_type as ScaleTypeId,
      positions: row.positions ?? [],
      rhythm: (row.rhythm as ScaleRhythmValue) ?? '8n',
      updatedAt: row.updated_at,
    };
  }
}
