import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';

import { AdminGuard } from '../user/auth/guards/admin.guard.js';
import { CurrentUser } from '../user/auth/decorators/current-user.decorator.js';
import { AssessmentService } from './assessment.service.js';
import type { AssessmentQuestion, AssessmentConfig } from '@bassnotion/contracts';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

interface UpdateConfigDto {
  videoId?: string;
  videoHash?: string; // Privacy hash for unlisted Vimeo videos
  videoPlatform?: string;
  name?: string;
  description?: string;
  skillThresholds?: {
    advanced: number;
    intermediate: number;
  };
}

interface AddQuestionDto {
  question: AssessmentQuestion;
}

interface UpdateQuestionDto {
  question: AssessmentQuestion;
}

interface ReorderQuestionsDto {
  questionIds: string[];
}

@Controller('api/v1/admin/assessment')
@UseGuards(AdminGuard)
export class AdminAssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  /**
   * GET /api/v1/admin/assessment/config
   * Get the current assessment configuration
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  async getConfig(): Promise<{ config: AssessmentConfig | null }> {
    const config = await this.assessmentService.getActiveConfig();
    return { config };
  }

  /**
   * PUT /api/v1/admin/assessment/config
   * Update assessment configuration (video, thresholds, etc.)
   */
  @Put('config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateConfigDto,
  ): Promise<{ success: boolean; config: AssessmentConfig }> {
    const config = await this.assessmentService.updateConfig(user.id, body);
    return { success: true, config };
  }

  /**
   * GET /api/v1/admin/assessment/questions
   * Get all questions in the assessment
   */
  @Get('questions')
  @HttpCode(HttpStatus.OK)
  async getQuestions(): Promise<{ questions: AssessmentQuestion[] }> {
    const questions = await this.assessmentService.getQuestions();
    return { questions };
  }

  /**
   * POST /api/v1/admin/assessment/questions
   * Add a new question to the assessment
   */
  @Post('questions')
  @HttpCode(HttpStatus.CREATED)
  async addQuestion(
    @CurrentUser() user: AuthUser,
    @Body() body: AddQuestionDto,
  ): Promise<{ success: boolean; question: AssessmentQuestion }> {
    if (!body.question) {
      throw new BadRequestException('Question data is required');
    }

    if (!body.question.id || !body.question.type || !body.question.question) {
      throw new BadRequestException(
        'Question must have id, type, and question text',
      );
    }

    const question = await this.assessmentService.addQuestion(
      user.id,
      body.question,
    );
    return { success: true, question };
  }

  /**
   * PUT /api/v1/admin/assessment/questions/:questionId
   * Update an existing question
   */
  @Put('questions/:questionId')
  @HttpCode(HttpStatus.OK)
  async updateQuestion(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
    @Body() body: UpdateQuestionDto,
  ): Promise<{ success: boolean; question: AssessmentQuestion }> {
    if (!body.question) {
      throw new BadRequestException('Question data is required');
    }

    const question = await this.assessmentService.updateQuestion(
      user.id,
      questionId,
      body.question,
    );
    return { success: true, question };
  }

  /**
   * DELETE /api/v1/admin/assessment/questions/:questionId
   * Delete a question from the assessment
   */
  @Delete('questions/:questionId')
  @HttpCode(HttpStatus.OK)
  async deleteQuestion(
    @CurrentUser() user: AuthUser,
    @Param('questionId') questionId: string,
  ): Promise<{ success: boolean }> {
    await this.assessmentService.deleteQuestion(user.id, questionId);
    return { success: true };
  }

  /**
   * PUT /api/v1/admin/assessment/questions/reorder
   * Reorder questions (by timestamp order)
   */
  @Put('questions/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderQuestions(
    @CurrentUser() user: AuthUser,
    @Body() body: ReorderQuestionsDto,
  ): Promise<{ success: boolean; questions: AssessmentQuestion[] }> {
    if (!body.questionIds || !Array.isArray(body.questionIds)) {
      throw new BadRequestException('questionIds array is required');
    }

    const questions = await this.assessmentService.reorderQuestions(
      user.id,
      body.questionIds,
    );
    return { success: true, questions };
  }
}
