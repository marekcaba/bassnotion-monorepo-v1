import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type {
  RepResult,
  TutorialBlock,
  GoalEnrollment,
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
} from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { TrainingEngineService } from './training-engine.service.js';
import { RecordRepResultDto } from './dto/record-rep-result.dto.js';

const VALID_DOORS: GraduationDoor[] = [
  'go_deeper',
  'lock_it_in',
  'switch_lanes',
];

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/training-engine')
export class TrainingEngineController {
  constructor(private readonly trainingEngineService: TrainingEngineService) {}

  /**
   * GET /api/v1/training-engine/enrollments
   *
   * The caller's goal enrollments (the gym's "my goals" list). Empty array if
   * the user has none yet.
   */
  @Get('enrollments')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async listMyEnrollments(
    @CurrentUser() user: AuthUser,
  ): Promise<GoalEnrollment[]> {
    return this.trainingEngineService.listMyEnrollments(user.id);
  }

  /**
   * POST /api/v1/training-engine/goals/:slug/enroll
   *
   * Enroll the caller in a goal (freezes a snapshot, creates the enrollment +
   * climb_state). Idempotent — returns the existing enrollment if already
   * enrolled.
   */
  @Post('goals/:slug/enroll')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async enrollInGoal(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
    @Body() body?: { startTempoBpm?: number },
  ): Promise<GoalEnrollment> {
    // Optional placement (Phase 5b): the gym's "what tempo can you play this
    // cleanly?" step. Absent → falls back to the goal target.
    const placement =
      typeof body?.startTempoBpm === 'number'
        ? { startTempoBpm: body.startTempoBpm }
        : undefined;
    return this.trainingEngineService.enrollInGoal(user.id, slug, placement);
  }

  /**
   * POST /api/v1/training-engine/rep-results
   *
   * The RepResultSink's server side — appends a rep to the engine's own
   * append-only history (a SIBLING write to the drill executor's block
   * completion). Validates that the enrollment belongs to the caller.
   */
  @Post('rep-results')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async recordRepResult(
    @CurrentUser() user: AuthUser,
    @Body() body: RecordRepResultDto,
  ): Promise<RepResult> {
    return this.trainingEngineService.recordRepResult(user.id, {
      goalEnrollmentId: body.goalEnrollmentId,
      drillSessionId: body.drillSessionId,
      blockId: body.blockId,
      ladderLevel: body.ladderLevel,
      tempoBpm: body.tempoBpm,
      signal: body.signal,
      result: body.result,
      achievedTier: body.achievedTier,
    });
  }

  /**
   * GET /api/v1/training-engine/enrollments/:enrollmentId/rep-results
   *
   * The engine's own history for an enrollment (what generateRep reads). Scoped
   * to the authenticated user.
   */
  @Get('enrollments/:enrollmentId/rep-results')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRepHistory(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<RepResult[]> {
    return this.trainingEngineService.getRepHistory(user.id, enrollmentId);
  }

  /**
   * POST /api/v1/training-engine/enrollments/:enrollmentId/today-rep
   *
   * Plan today's rep: read the climb state, run the pure generateRep, mint the
   * virtual-tutorial row, and return the slug the frontend renders the rep
   * through. POST (not GET) because it mints/overwrites server state.
   */
  @Post('enrollments/:enrollmentId/today-rep')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTodayRep(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body?: { mode?: 'full' | 'floor' },
  ): Promise<{ slug: string; bricks: TutorialBlock[] }> {
    // Story 5: the gym can request the short 'floor' rep. Anything but the
    // explicit 'floor' string plans the full rep.
    const mode = body?.mode === 'floor' ? 'floor' : 'full';
    return this.trainingEngineService.getTodayRep(user.id, enrollmentId, mode);
  }

  /**
   * GET /api/v1/training-engine/enrollments/:enrollmentId/graduation
   *
   * Read-time view of where the enrollment stands against its 30-day window
   * (the landing + whether the fork is due). Never mutates.
   */
  @Get('enrollments/:enrollmentId/graduation')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getGraduation(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<GraduationSummary> {
    return this.trainingEngineService.getGraduation(user.id, enrollmentId);
  }

  /**
   * GET /api/v1/training-engine/enrollments/:enrollmentId/month-in-review
   *
   * The day-30 recap (Treadmill epic Story 6): the player's journey through the
   * cycle — level then→now, practice pattern, reps/grooves conquered, streak.
   * Read-only, "always a win".
   */
  @Get('enrollments/:enrollmentId/month-in-review')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMonthInReview(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<MonthInReview> {
    return this.trainingEngineService.getMonthInReview(user.id, enrollmentId);
  }

  /**
   * POST /api/v1/training-engine/enrollments/:enrollmentId/graduate
   *
   * Walk through one of the 3 doors at graduation (body `{ door }`):
   * go_deeper (raise target + reset clock) / lock_it_in (graduate) /
   * switch_lanes (graduate; frontend re-places).
   */
  @Post('enrollments/:enrollmentId/graduate')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async graduate(
    @CurrentUser() user: AuthUser,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { door: GraduationDoor },
  ): Promise<GoalEnrollment> {
    if (!VALID_DOORS.includes(body?.door)) {
      throw new BadRequestException(
        `door must be one of: ${VALID_DOORS.join(', ')}`,
      );
    }
    return this.trainingEngineService.walkThroughDoor(
      user.id,
      enrollmentId,
      body.door,
    );
  }
}
