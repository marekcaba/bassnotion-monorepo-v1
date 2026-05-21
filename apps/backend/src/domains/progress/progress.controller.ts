import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { GetTutorialProgressResponse } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { ProgressService } from './progress.service.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

/** POST .../blocks/:blockId/complete body */
interface CompleteBlockBody {
  /** Optional per-block payload (e.g. quiz score) */
  data?: Record<string, unknown>;
}

/** POST .../exercises/:exerciseId/practice body */
interface RecordPracticeBody {
  /** Tempo the user was practicing at, in BPM. Optional. */
  tempoBpm?: number;
}

@Controller('api/v1/tutorials')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * GET /api/v1/tutorials/:slug/progress
   *
   * Returns the current user's progress for the given tutorial, with
   * server-computed unlock state per block. The frontend uses this as the
   * single source of truth for what's completed and what's accessible.
   */
  @Get(':slug/progress')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTutorialProgress(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
  ): Promise<GetTutorialProgressResponse> {
    return this.progressService.getTutorialProgress(user.id, slug);
  }

  /**
   * POST /api/v1/tutorials/:slug/blocks/:blockId/complete
   *
   * Mark a block complete for the current user. Idempotent. Server enforces
   * the unlock rule — completing a block whose prerequisites aren't yet
   * complete throws NotFound (avoids leaking gating details).
   *
   * Returns the freshly computed full progress so the frontend can replace
   * its cache without a follow-up GET.
   */
  @Post(':slug/blocks/:blockId/complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeBlock(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('blockId') blockId: string,
    @Body() body: CompleteBlockBody,
  ): Promise<GetTutorialProgressResponse> {
    return this.progressService.completeBlock(
      user.id,
      slug,
      blockId,
      body?.data,
    );
  }

  /**
   * POST /api/v1/tutorials/:slug/exercises/:exerciseId/practice
   *
   * Record one practice rep for an exercise. Increments completion_count
   * (capped at 10) and updates last_tempo_bpm. If this rep causes the
   * parent exercise block to hit the all-exercises-meet-threshold rule,
   * the block is auto-completed.
   *
   * Returns the freshly computed full progress.
   */
  @Post(':slug/exercises/:exerciseId/practice')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async recordPractice(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Param('exerciseId') exerciseId: string,
    @Body() body: RecordPracticeBody,
  ): Promise<GetTutorialProgressResponse> {
    return this.progressService.recordPractice(
      user.id,
      slug,
      exerciseId,
      body?.tempoBpm,
    );
  }
}
