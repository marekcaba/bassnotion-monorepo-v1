import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  Gig,
  TakeResult,
  CreateGigInput,
  SubmitTakeInput,
  PlaybackContext,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

/** Raw `gigs` row (snake_case as stored). `training_goals` is the optional joined goal (slug),
 *  present only on reads that select it; Supabase returns a nested object for a FK embed. */
interface GigRow {
  id: string;
  goal_id: string;
  created_by: string | null;
  gig_type: string;
  title: string;
  instructions: string | null;
  cycle_day: number;
  station: string;
  exercise_id: string | null;
  exercise_name: string | null;
  scale_key: string | null;
  tempo_bpm: number | null;
  record_loops: number;
  is_active: boolean;
  created_at: string;
  /** Embedded goal (when the read joins it via `training_goals(slug)`). */
  training_goals?: { slug: string | null } | null;
}

/** Raw `take_results` row (snake_case as stored). */
interface TakeResultRow {
  id: string;
  user_id: string;
  gig_id: string | null;
  station: string;
  exercise_name: string | null;
  scale_key: string | null;
  tempo_bpm: number | null;
  timing_score: number | null;
  pitch_score: number | null;
  jitter_ms: number | null;
  offset_ms: number | null;
  note_count: number | null;
  audio_path: string | null;
  audio_bytes: number | null;
  playback_context: unknown | null;
  submitted_at: string;
}

/** Args for appending a take result (server stamps id/submittedAt; audioPath/audioBytes are
 *  supplied by the controller after the upload). */
interface InsertTakeResult extends SubmitTakeInput {
  userId: string;
  audioPath: string | null;
  audioBytes: number | null;
}

/**
 * Repository for the gym GIG-SUBMISSION tables:
 *   - `gigs`         (admin-authored, goal-bound deliverables; students read the gigs for
 *                     the goals they're enrolled in)
 *   - `take_results` (append-only — submitted, graded takes + audio path)
 *
 * The backend Supabase client uses the SERVICE-ROLE key, so it bypasses RLS; the row-level
 * access check is enforced at the controller/service layer (every read is scoped to the
 * authenticated user's enrollments, every write validates enrollment first). All mapping is
 * explicit snake↔camel (no generic transformers — the `gig_id` vs `gigId` trap is real).
 * Mirrors TrainingEngineRepository exactly.
 */
@Injectable()
export class TakeRecordingsRepository {
  private readonly staticLogger = createStructuredLogger(
    TakeRecordingsRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  // ── take_results (append-only) ──────────────────────────────────────────────

  /** Append one submitted take result. Never updates — the table has no UPDATE policy. */
  async insertTakeResult(input: InsertTakeResult): Promise<TakeResult> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('take_results')
      .insert({
        user_id: input.userId,
        gig_id: input.gigId ?? null,
        station: input.station ?? 'scales',
        exercise_name: input.exerciseName ?? null,
        scale_key: input.scaleKey ?? null,
        tempo_bpm: input.tempoBpm ?? null,
        timing_score: input.timingScore ?? null,
        pitch_score: input.pitchScore ?? null,
        jitter_ms: input.jitterMs ?? null,
        offset_ms: input.offsetMs ?? null,
        note_count: input.noteCount ?? null,
        audio_path: input.audioPath,
        audio_bytes: input.audioBytes,
        playback_context: input.playbackContext ?? null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to insert take result', error as Error, {
        userId: input.userId,
        gigId: input.gigId,
        correlationId,
      });
      throw error;
    }

    return this.mapTakeResultRow(data as TakeResultRow);
  }

  /** All of a user's submitted takes, newest first (the history trend). */
  async getTakeResultsForUser(userId: string): Promise<TakeResult[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('take_results')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch take results', error as Error, {
        userId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []).map((row) => this.mapTakeResultRow(row as TakeResultRow));
  }

  /** One take by id (for the signed-url ownership check), or null. */
  async getTakeResultById(id: string): Promise<TakeResult | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('take_results')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch take result by id', error as Error, {
        id,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapTakeResultRow(data as TakeResultRow) : null;
  }

  /** The user's existing take for a gig, if any (the one a resubmit REPLACES). One-take-per-gig
   *  is enforced by a partial unique index, so this is at most one row. */
  async getTakeForUserGig(
    userId: string,
    gigId: string,
  ): Promise<TakeResult | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('take_results')
      .select('*')
      .eq('user_id', userId)
      .eq('gig_id', gigId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch take for user+gig', error as Error, {
        userId,
        gigId,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapTakeResultRow(data as TakeResultRow) : null;
  }

  /** Delete one take row by id (the replace-on-resubmit path removes the prior take). The
   *  caller deletes the audio object separately. */
  async deleteTakeResult(id: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('take_results')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete take result', error as Error, {
        id,
        correlationId,
      });
      throw error;
    }
  }

  // ── gigs ────────────────────────────────────────────────────────────────────

  /** Create an admin-authored, goal-bound gig. `createdBy` is the admin's id. */
  async createGig(
    input: CreateGigInput & { createdBy: string },
  ): Promise<Gig> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('gigs')
      .insert({
        goal_id: input.goalId,
        created_by: input.createdBy,
        gig_type: input.gigType ?? 'recording',
        title: input.title,
        instructions: input.instructions ?? null,
        cycle_day: input.cycleDay,
        station: input.station ?? 'scales',
        exercise_id: input.exerciseId ?? null,
        exercise_name: input.exerciseName ?? null,
        scale_key: input.scaleKey ?? null,
        tempo_bpm: input.tempoBpm ?? null,
        record_loops: input.recordLoops ?? 2,
      })
      .select('*, training_goals(slug)')
      .single();

    if (error) {
      logger.error('Failed to create gig', error as Error, {
        goalId: input.goalId,
        createdBy: input.createdBy,
        correlationId,
      });
      throw error;
    }

    return this.mapGigRow(data as GigRow);
  }

  /**
   * ADMIN: every gig (active + soft-disabled), newest-cycle-then-newest-created first, for the
   * builder's management list. Optionally scoped to one goal. Service-role read — no enrollment
   * filter, this is admin-only at the controller (AdminGuard).
   */
  async adminListGigs(goalId?: string): Promise<Gig[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    let query = this.supabaseService
      .getClient()
      .from('gigs')
      .select('*, training_goals(slug)')
      .order('cycle_day', { ascending: true })
      .order('created_at', { ascending: false });
    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to list gigs (admin)', error as Error, {
        goalId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []).map((row) => this.mapGigRow(row as GigRow));
  }

  /**
   * ADMIN: update an existing gig's editable fields. Only the keys present in `patch` are
   * written (partial update); goal_id is intentionally NOT editable (re-target = delete + create,
   * since the FK + enrollment semantics shift). Returns the updated gig, or null if not found.
   */
  async updateGig(
    id: string,
    patch: Partial<Omit<CreateGigInput, 'goalId'>> & { isActive?: boolean },
  ): Promise<Gig | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Map only the provided camelCase keys to snake_case columns.
    const update: Record<string, unknown> = {};
    if (patch.gigType !== undefined) update.gig_type = patch.gigType;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.instructions !== undefined)
      update.instructions = patch.instructions ?? null;
    if (patch.cycleDay !== undefined) update.cycle_day = patch.cycleDay;
    if (patch.station !== undefined) update.station = patch.station;
    if (patch.exerciseId !== undefined)
      update.exercise_id = patch.exerciseId ?? null;
    if (patch.exerciseName !== undefined)
      update.exercise_name = patch.exerciseName ?? null;
    if (patch.scaleKey !== undefined) update.scale_key = patch.scaleKey ?? null;
    if (patch.tempoBpm !== undefined) update.tempo_bpm = patch.tempoBpm ?? null;
    if (patch.recordLoops !== undefined)
      update.record_loops = patch.recordLoops;
    if (patch.isActive !== undefined) update.is_active = patch.isActive;

    if (Object.keys(update).length === 0) {
      // Nothing to change — return the current row.
      return this.getGigById(id);
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('gigs')
      .update(update)
      .eq('id', id)
      .select('*, training_goals(slug)')
      .maybeSingle();

    if (error) {
      logger.error('Failed to update gig', error as Error, {
        id,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapGigRow(data as GigRow) : null;
  }

  /**
   * ADMIN: hard-delete a gig. take_results.gig_id is ON DELETE SET NULL, so submitted takes
   * survive (their gig pointer just nulls out) — no take history is lost.
   */
  async deleteGig(id: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { error } = await this.supabaseService
      .getClient()
      .from('gigs')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete gig', error as Error, {
        id,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * The active gigs the user inherits — i.e. gigs for the goals the user is ENROLLED in,
   * ordered by cycle_day. Replicates the migration's RLS in service-role land: first fetch
   * the user's enrolled goal_ids from goal_enrollments, then fetch active gigs for those
   * goals (the same two-step `.in()` pattern the main repo uses).
   */
  async getGigsForUser(userId: string): Promise<Gig[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    const client = this.supabaseService.getClient();

    // 1. The goals this user is enrolled in.
    const { data: enrollments, error: enrollError } = await client
      .from('goal_enrollments')
      .select('goal_id')
      .eq('user_id', userId);

    if (enrollError) {
      logger.error('Failed to fetch enrollments for gigs', enrollError as Error, {
        userId,
        correlationId,
      });
      throw enrollError;
    }

    const goalIds = (enrollments ?? []).map(
      (e) => (e as { goal_id: string }).goal_id,
    );
    if (goalIds.length === 0) {
      return [];
    }

    // 2. The active gigs for those goals, soonest in the cycle first.
    const { data, error } = await client
      .from('gigs')
      .select('*, training_goals(slug)')
      .in('goal_id', goalIds)
      .eq('is_active', true)
      .order('cycle_day', { ascending: true });

    if (error) {
      logger.error('Failed to fetch gigs', error as Error, {
        userId,
        correlationId,
      });
      throw error;
    }

    return (data ?? []).map((row) => this.mapGigRow(row as GigRow));
  }

  /** One gig by id (for the enrollment check on submit), or null. */
  async getGigById(id: string): Promise<Gig | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('gigs')
      .select('*, training_goals(slug)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch gig by id', error as Error, {
        id,
        correlationId,
      });
      throw error;
    }

    return data ? this.mapGigRow(data as GigRow) : null;
  }

  /**
   * Whether a user is enrolled in a goal — the gig-submission access check (replaces the
   * old "assignment.userId === user.id" ownership check now that gigs are goal-bound).
   */
  async isUserEnrolledInGoal(
    userId: string,
    goalId: string,
  ): Promise<boolean> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('goal_enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to check goal enrollment', error as Error, {
        userId,
        goalId,
        correlationId,
      });
      throw error;
    }

    return data != null;
  }

  // ── mappers (explicit snake↔camel) ──────────────────────────────────────────

  private mapTakeResultRow(row: TakeResultRow): TakeResult {
    return {
      id: row.id,
      userId: row.user_id,
      gigId: row.gig_id,
      station: row.station,
      exerciseName: row.exercise_name,
      scaleKey: row.scale_key,
      tempoBpm: row.tempo_bpm,
      timingScore: row.timing_score,
      pitchScore: row.pitch_score,
      jitterMs: row.jitter_ms,
      offsetMs: row.offset_ms,
      noteCount: row.note_count,
      audioPath: row.audio_path,
      audioBytes: row.audio_bytes,
      playbackContext: (row.playback_context as PlaybackContext | null) ?? null,
      submittedAt: row.submitted_at,
    };
  }

  private mapGigRow(row: GigRow): Gig {
    return {
      id: row.id,
      goalId: row.goal_id,
      goalSlug: row.training_goals?.slug ?? null,
      createdBy: row.created_by,
      gigType: row.gig_type,
      title: row.title,
      instructions: row.instructions,
      cycleDay: row.cycle_day,
      station: row.station,
      exerciseId: row.exercise_id,
      exerciseName: row.exercise_name,
      scaleKey: row.scale_key,
      tempoBpm: row.tempo_bpm,
      recordLoops: row.record_loops,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}
