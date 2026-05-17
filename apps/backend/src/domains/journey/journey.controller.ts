import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

import { AuthGuard } from '../user/auth/guards/auth.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { JourneyService } from './journey.service.js';
import type {
  GetUserJourneyResponse,
  GetAvailableJourneysResponse,
  UpdateJourneyProgressRequest,
  UpdateJourneyProgressResponse,
} from '@bassnotion/contracts';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

@Controller('api/v1/journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  /**
   * GET /api/v1/journey/available
   * Get all available learning journeys
   */
  @Get('available')
  @HttpCode(HttpStatus.OK)
  async getAvailableJourneys(): Promise<GetAvailableJourneysResponse> {
    const journeys = await this.journeyService.getAvailableJourneys();
    return { journeys };
  }

  /**
   * GET /api/v1/journey/my
   * Get current user's journey and progress
   */
  @Get('my')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserJourney(
    @CurrentUser() user: AuthUser,
  ): Promise<GetUserJourneyResponse> {
    const { journey, progress } = await this.journeyService.getUserJourney(
      user.id,
    );
    return { journey, progress };
  }

  /**
   * PATCH /api/v1/journey/progress
   * Update journey progress (complete milestone, change status)
   */
  @Patch('progress')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateJourneyProgressRequest,
  ): Promise<UpdateJourneyProgressResponse> {
    // Check user has a journey
    const { journey } = await this.journeyService.getUserJourney(user.id);
    if (!journey) {
      throw new NotFoundException(
        'No journey assigned. Complete the assessment first.',
      );
    }

    const progress = await this.journeyService.updateProgress(user.id, {
      currentMilestoneIndex: body.milestoneIndex,
      completedMilestoneIndex: body.completedMilestoneIndex,
      status: body.status,
    });

    return {
      success: true,
      progress,
      message: 'Journey progress updated successfully.',
    };
  }
}
