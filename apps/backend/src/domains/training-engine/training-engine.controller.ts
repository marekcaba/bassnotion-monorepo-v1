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
import type { RepResult, TutorialBlock } from '@bassnotion/contracts';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { TrainingEngineService } from './training-engine.service.js';
import { RecordRepResultDto } from './dto/record-rep-result.dto.js';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/training-engine')
export class TrainingEngineController {
  constructor(private readonly trainingEngineService: TrainingEngineService) {}

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
  ): Promise<{ slug: string; bricks: TutorialBlock[] }> {
    return this.trainingEngineService.getTodayRep(user.id, enrollmentId);
  }
}
