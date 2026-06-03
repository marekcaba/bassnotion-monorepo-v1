import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type {
  GetUserTutorialCompletionsResponse,
  GetPracticeStreakResponse,
} from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { ProgressService } from './progress.service.js';
import { PracticeService } from './practice.service.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

/**
 * User-scoped progress endpoints. Lives at /api/v1/users/me/... because the
 * resource isn't tied to a specific tutorial — it's "this user's progress
 * across all tutorials." Kept separate from ProgressController which is
 * under /api/v1/tutorials/:slug/... .
 */
@Controller('api/v1/users/me')
export class UserProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly practiceService: PracticeService,
  ) {}

  /**
   * GET /api/v1/users/me/tutorial-completions
   *
   * Per-tutorial rollup for the library / sidebar. Returns one summary
   * entry per active tutorial with computed isComplete + per-block dots.
   */
  @Get('tutorial-completions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserTutorialCompletions(
    @CurrentUser() user: AuthUser,
  ): Promise<GetUserTutorialCompletionsResponse> {
    return this.progressService.getUserTutorialCompletions(user.id);
  }

  /**
   * GET /api/v1/users/me/practice-streak
   *
   * The user's current consecutive-day practice streak. Read-only — does not
   * mutate (a lapsed streak reports 0 without writing).
   */
  @Get('practice-streak')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPracticeStreak(
    @CurrentUser() user: AuthUser,
  ): Promise<GetPracticeStreakResponse> {
    return this.practiceService.getStreak(user.id);
  }

  /**
   * POST /api/v1/users/me/practice-streak
   *
   * Record that the user completed a drill session today and return the updated
   * streak. Idempotent within a calendar day. Called by the frontend when the
   * drill reaches its summary screen.
   */
  @Post('practice-streak')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async recordPracticeSession(
    @CurrentUser() user: AuthUser,
  ): Promise<GetPracticeStreakResponse> {
    return this.practiceService.recordSessionCompleted(user.id);
  }
}
