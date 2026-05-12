import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { AssessmentService } from './assessment.service.js';
import type {
  AssessmentResult,
  AssessmentConfig,
  CompleteAssessmentResponse,
  GetAssessmentStatusResponse,
} from '@bassnotion/contracts';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  /**
   * GET /api/v1/assessment/config
   * Get the assessment configuration (public endpoint for taking the assessment)
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  async getConfig(): Promise<{ config: AssessmentConfig | null }> {
    const config = await this.assessmentService.getActiveConfig();
    return { config };
  }

  /**
   * GET /api/v1/assessment/status
   * Check if user has completed the assessment
   */
  @Get('status')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getStatus(
    @CurrentUser() user: AuthUser,
  ): Promise<GetAssessmentStatusResponse> {
    const status = await this.assessmentService.getStatus(user.id);
    return { status };
  }

  /**
   * POST /api/v1/assessment/complete
   * Submit assessment results and get assigned journey
   */
  @Post('complete')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeAssessment(
    @CurrentUser() user: AuthUser,
    @Body() body: { result: AssessmentResult },
  ): Promise<CompleteAssessmentResponse> {
    // Validate required fields
    if (!body.result) {
      throw new BadRequestException('Assessment result is required');
    }

    if (!body.result.skillLevel) {
      throw new BadRequestException('Skill level is required');
    }

    if (!body.result.primaryGoal) {
      throw new BadRequestException('Primary goal is required');
    }

    const { skillLevel, assignedJourneyId } =
      await this.assessmentService.completeAssessment(user.id, body.result);

    return {
      success: true,
      skillLevel,
      assignedJourneyId,
      message: `Welcome! Your skill level is ${skillLevel}. ${
        assignedJourneyId
          ? 'A personalized learning journey has been created for you.'
          : 'Explore our tutorials to start learning.'
      }`,
    };
  }
}
