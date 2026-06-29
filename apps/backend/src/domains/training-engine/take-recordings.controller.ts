import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  Gig,
  TakeResult,
  TakeResultWithSignedUrl,
  SubmitTakeInput,
} from '@bassnotion/contracts';
import { submitTakeSchema } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { RateLimitGuard } from '../../shared/guards/rate-limit.guard.js';
import {
  UploadRateLimit,
  PublicApiRateLimit,
} from '../../shared/decorators/rate-limit.decorator.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../user/auth/types/auth.types.js';
import { CorrelationId } from '../../shared/decorators/correlation-id.decorator.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';
import { TakeRecordingsRepository } from './repositories/take-recordings.repository.js';

/** Private bucket the submitted take audio lives in. Reads are signed-URL only. */
const TAKE_AUDIO_BUCKET = 'user-take-audio';

/** App-layer hard cap on a submitted take (defence-in-depth alongside the bucket's own
 *  2MB storage cap). A ~30s Opus clip is ~250-500KB, so 2MB is generous headroom + a wall. */
const MAX_TAKE_BYTES = 2 * 1024 * 1024;

/** TTL for the per-take signed read URLs handed to the history view. Short on purpose —
 *  the URL is access-controlled at issuance, not DRM. */
const SIGNED_URL_TTL_SECONDS = 3600;

/** Accepted upload mimetypes (Opus in an Ogg/WebM container; octet-stream for browsers
 *  that don't tag the blob). Mirrors the bucket's allowed_mime_types. */
const ALLOWED_MIME_TYPES = ['audio/ogg', 'audio/webm', 'application/octet-stream'];

/**
 * Student-facing gym GIG SUBMISSIONS — the admin-authored, goal-bound deliverable flow.
 *   - GET  gigs   → the gigs the student inherits via the goals they're enrolled in.
 *   - GET  takes  → the student's submitted, graded history, each with a fresh signed
 *                   audio URL.
 *   - POST submit → the multipart submit: one graded take + its tiny Opus clip.
 *
 * Authenticated; every read/write is scoped to the authenticated user. The submit path is
 * additionally upload-rate-limited and enforces a HARD streaming size cap + verifies the
 * student is ENROLLED in the fulfilled gig's goal before it touches storage. Open gym
 * practice is NOT stored here — only these deliberate submissions.
 */
@Controller('api/v1/training-engine/recordings')
@UseGuards(AuthGuard)
export class TakeRecordingsController {
  private readonly staticLogger = createStructuredLogger(
    TakeRecordingsController.name,
  );

  constructor(
    private readonly repo: TakeRecordingsRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  /** The gigs the student inherits via their enrolled goals (soonest in the cycle first). */
  @Get('gigs')
  @UseGuards(AuthGuard, RateLimitGuard)
  @PublicApiRateLimit()
  @HttpCode(HttpStatus.OK)
  async getGigs(
    @CurrentUser() user: AuthUser,
  ): Promise<{ gigs: Gig[] }> {
    return { gigs: await this.repo.getGigsForUser(user.id) };
  }

  /**
   * ONE gig by id, for the perform route (/gigs/[goalSlug]/[gigId]). Scoped to enrollment:
   * the student must be enrolled in the gig's goal (otherwise 404 — don't leak existence of a
   * gig on a goal they're not in). Also attaches the student's existing take for this gig (if
   * any), so the perform page can render the prior grade and frame the action as a resubmit.
   */
  @Get('gigs/:id')
  @UseGuards(AuthGuard, RateLimitGuard)
  @PublicApiRateLimit()
  @HttpCode(HttpStatus.OK)
  async getGig(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ): Promise<{ gig: Gig; existingTake: TakeResultWithSignedUrl | null }> {
    const gig = await this.repo.getGigById(id);
    if (!gig) {
      throw new NotFoundException('Gig not found');
    }
    const enrolled = await this.repo.isUserEnrolledInGoal(user.id, gig.goalId);
    if (!enrolled) {
      // Treat not-enrolled as not-found — don't reveal the gig exists.
      throw new NotFoundException('Gig not found');
    }

    const prior = await this.repo.getTakeForUserGig(user.id, id);
    const existingTake = prior
      ? await this.attachSignedUrl(prior, correlationId)
      : null;

    return { gig, existingTake };
  }

  /** The student's submitted takes (history), each with a fresh signed audio URL. */
  @Get('takes')
  @UseGuards(AuthGuard, RateLimitGuard)
  @PublicApiRateLimit()
  @HttpCode(HttpStatus.OK)
  async getTakes(
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ): Promise<{ takes: TakeResultWithSignedUrl[] }> {
    const takes = await this.repo.getTakeResultsForUser(user.id);

    // Mint a short-lived signed read URL for each take that has stored audio. The user
    // already owns every row (the query is user-scoped), so no per-row ownership check.
    const withUrls = await Promise.all(
      takes.map(async (take) => this.attachSignedUrl(take, correlationId)),
    );

    return { takes: withUrls };
  }

  /**
   * THE MULTIPART SUBMIT — one graded take + its tiny Opus clip.
   *
   * SECURITY — the 2MB cap is enforced DURING streaming, not after: we read the upload
   * stream chunk-by-chunk, accumulate a running byte count, and the moment it would exceed
   * MAX_TAKE_BYTES we destroy the stream and reject. We never buffer an oversized body into
   * memory (the "buffer-everything-then-check" anti-pattern is a DoS vector — it lets an
   * attacker pin arbitrary memory before the check runs).
   */
  @Post('submit')
  @UseGuards(AuthGuard, RateLimitGuard)
  @UploadRateLimit()
  @HttpCode(HttpStatus.OK)
  async submit(
    @Req() req: FastifyRequest,
    @CurrentUser() user: AuthUser,
    @CorrelationId() correlationId?: string,
  ): Promise<{ take: TakeResult }> {
    const logger = this.staticLogger;

    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No audio file uploaded');
    }

    const { file: fileStream, mimetype, fields } = data;

    // Validate the mimetype up front — before we read a single byte.
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      // Drain/destroy so the connection isn't left half-read.
      fileStream.destroy();
      throw new BadRequestException(
        `Invalid audio type: ${mimetype} (must be one of ${ALLOWED_MIME_TYPES.join(', ')})`,
      );
    }

    // ── STREAMING SIZE GUARD (the security-critical loop) ──────────────────────
    const chunks: Buffer[] = [];
    let byteCount = 0;
    for await (const chunk of fileStream) {
      byteCount += chunk.length;
      if (byteCount > MAX_TAKE_BYTES) {
        // Abort IMMEDIATELY — destroy the stream and reject. We do NOT keep reading or
        // hold the oversized buffer.
        fileStream.destroy();
        logger.warn('Take submission exceeded size cap — aborted mid-stream', {
          userId: user.id,
          byteCount,
          maxBytes: MAX_TAKE_BYTES,
          correlationId,
        });
        throw new PayloadTooLargeException(
          `Audio too large (max ${MAX_TAKE_BYTES} bytes)`,
        );
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    // ───────────────────────────────────────────────────────────────────────────

    if (buffer.length === 0) {
      throw new BadRequestException('Empty audio file');
    }

    // Parse + validate the non-file metadata off the multipart text fields.
    const meta = this.parseTakeMetadata(fields);

    // ACCESS — if this take fulfils a gig, the student must be ENROLLED in that gig's goal
    // (gigs are goal-bound, not user-bound: a student may only submit against a gig they
    // actually inherit). Replaces the old per-user ownership check.
    if (meta.gigId) {
      const gig = await this.repo.getGigById(meta.gigId);
      if (!gig) {
        throw new BadRequestException('Gig not found');
      }
      const enrolled = await this.repo.isUserEnrolledInGoal(
        user.id,
        gig.goalId,
      );
      if (!enrolled) {
        logger.warn('Take submit blocked — user not enrolled in gig goal', {
          userId: user.id,
          gigId: meta.gigId,
          goalId: gig.goalId,
          correlationId,
        });
        throw new ForbiddenException('You are not enrolled in this gig');
      }
    }

    // REPLACE-ON-RESUBMIT — a gig is a single deliverable, so the latest take replaces any
    // prior one. Look up the existing take FIRST; we delete its DB row before inserting (the
    // partial unique index on (user_id, gig_id) would otherwise block the insert), then delete
    // its audio object AFTER the new row lands so a mid-flight failure never strands the student
    // with no take. (Free-practice submits have no gigId → no prior to replace.)
    let priorAudioPath: string | null = null;
    if (meta.gigId) {
      const prior = await this.repo.getTakeForUserGig(user.id, meta.gigId);
      if (prior) {
        priorAudioPath = prior.audioPath;
        await this.repo.deleteTakeResult(prior.id);
      }
    }

    // Store the audio in the PRIVATE bucket, namespaced under the user's id.
    const audioPath = `${user.id}/${Date.now()}.ogg`;
    const contentType = mimetype === 'application/octet-stream' ? 'audio/ogg' : mimetype;
    await this.supabaseService.uploadToPrivateBucket(
      TAKE_AUDIO_BUCKET,
      audioPath,
      buffer,
      contentType,
      { upsert: false },
    );

    const take = await this.repo.insertTakeResult({
      ...meta,
      userId: user.id,
      audioPath,
      audioBytes: buffer.length,
    });

    // The new take is committed — now drop the replaced take's audio (best-effort; a failure
    // here only orphans one small object, it doesn't fail the submit).
    if (priorAudioPath) {
      try {
        await this.supabaseService.deleteFile(TAKE_AUDIO_BUCKET, priorAudioPath);
      } catch (error) {
        logger.warn('Failed to delete replaced take audio (orphaned)', {
          userId: user.id,
          priorAudioPath,
          error: (error as Error)?.message,
          correlationId,
        });
      }
    }

    logger.info('Take submitted', {
      userId: user.id,
      takeId: take.id,
      gigId: meta.gigId,
      replaced: priorAudioPath != null,
      audioBytes: buffer.length,
      correlationId,
    });

    return { take };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  /** Enrich a take with a fresh signed read URL for its audio (null when no clip). */
  private async attachSignedUrl(
    take: TakeResult,
    correlationId?: string,
  ): Promise<TakeResultWithSignedUrl> {
    if (!take.audioPath) {
      return { ...take, audioUrl: null };
    }
    try {
      const { url } = await this.supabaseService.createSignedReadUrl(
        TAKE_AUDIO_BUCKET,
        take.audioPath,
        SIGNED_URL_TTL_SECONDS,
      );
      return { ...take, audioUrl: url };
    } catch (error) {
      // A missing/unsignable object shouldn't fail the whole history list — degrade to
      // null for that one take.
      this.staticLogger.warn('Failed to sign take audio URL', {
        takeId: take.id,
        audioPath: take.audioPath,
        error: (error as Error)?.message,
        correlationId,
      });
      return { ...take, audioUrl: null };
    }
  }

  /**
   * Read + coerce the take metadata off the multipart text fields, then validate via the
   * shared Zod schema. Multipart field values arrive as strings, so the numeric grade fields
   * are coerced before validation.
   */
  private parseTakeMetadata(
    fields: Record<string, unknown>,
  ): SubmitTakeInput {
    const raw: Record<string, unknown> = {
      gigId: this.readField(fields, 'gigId'),
      station: this.readField(fields, 'station'),
      exerciseName: this.readField(fields, 'exerciseName'),
      scaleKey: this.readField(fields, 'scaleKey'),
      tempoBpm: this.toNumber(this.readField(fields, 'tempoBpm')),
      timingScore: this.toNumber(this.readField(fields, 'timingScore')),
      pitchScore: this.toNumber(this.readField(fields, 'pitchScore')),
      jitterMs: this.toNumber(this.readField(fields, 'jitterMs')),
      offsetMs: this.toNumber(this.readField(fields, 'offsetMs')),
      noteCount: this.toNumber(this.readField(fields, 'noteCount')),
      // The reconstruction recipe rides as a JSON STRING on the multipart body — parse it here so
      // the Zod schema validates the OBJECT. A malformed string is dropped (the take still saves;
      // it just won't be replayable-in-context), never a 400 on the whole submit.
      playbackContext: this.parseJsonField(
        this.readField(fields, 'playbackContext'),
      ),
    };

    // Drop undefined keys so schema defaults/nullish behave (station default, etc.).
    const cleaned = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== undefined),
    );

    const parsed = submitTakeSchema.safeParse(cleaned);
    if (!parsed.success) {
      throw new BadRequestException(
        `Invalid take metadata: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    return parsed.data;
  }

  /** Pull a single text-field value off the @fastify/multipart `fields` map. */
  private readField(
    fields: Record<string, unknown>,
    name: string,
  ): string | undefined {
    const entry = fields?.[name] as { value?: unknown } | undefined;
    if (!entry || entry.value === undefined || entry.value === null) {
      return undefined;
    }
    const value = String(entry.value).trim();
    return value === '' ? undefined : value;
  }

  /** Coerce a string field to a finite number, or undefined if absent/non-numeric. */
  private toNumber(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }

  /** Parse a JSON-string multipart field into an object, or undefined if absent/malformed.
   *  Best-effort: a bad value is dropped (the take still saves), never throws. */
  private parseJsonField(value: string | undefined): unknown {
    if (value === undefined) return undefined;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
}
