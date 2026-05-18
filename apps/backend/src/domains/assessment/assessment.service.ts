import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  AssessmentResult,
  AssessmentStatus,
  SkillLevel,
  LearningJourney,
  JourneyMatchResult,
  JourneyMatchScore,
  AssessmentQuestion,
  AssessmentConfig,
} from '@bassnotion/contracts';
import {
  AssessmentRepository,
  AssessmentData,
} from './repositories/assessment.repository.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service.js';

@Injectable()
export class AssessmentService {
  private readonly staticLogger = createStructuredLogger(
    AssessmentService.name,
  );

  constructor(
    private readonly assessmentRepository: AssessmentRepository,
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get assessment status for a user
   */
  async getStatus(userId: string): Promise<AssessmentStatus> {
    return this.assessmentRepository.getStatus(userId);
  }

  /**
   * Complete assessment and save results
   * Also matches and assigns the best journey
   */
  async completeAssessment(
    userId: string,
    result: AssessmentResult,
  ): Promise<{ skillLevel: SkillLevel; assignedJourneyId: string | null }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Completing assessment', {
      userId,
      skillLevel: result.skillLevel,
      primaryGoal: result.primaryGoal,
      correlationId,
    });

    // Save assessment results
    const assessmentData: AssessmentData = {
      skillLevel: result.skillLevel,
      assessmentScore: Math.round(result.percentageScore),
      primaryGoal: result.primaryGoal,
      preferredTechniques: result.preferredTechniques,
      preferredGenres: result.preferredGenres,
    };

    await this.assessmentRepository.saveResults(userId, assessmentData);

    // Find and assign best matching journey
    const matchResult = await this.findBestJourney(assessmentData);
    let assignedJourneyId: string | null = null;

    if (matchResult.bestMatch) {
      assignedJourneyId = await this.assignJourney(
        userId,
        matchResult.bestMatch.journeyId,
      );
      logger.info('Assigned journey to user', {
        userId,
        journeyId: assignedJourneyId,
        journeyName: matchResult.bestMatch.journey.name,
        matchScore: matchResult.bestMatch.score,
        correlationId,
      });
    }

    return {
      skillLevel: result.skillLevel,
      assignedJourneyId,
    };
  }

  /**
   * Find the best matching journey based on assessment results
   */
  async findBestJourney(data: AssessmentData): Promise<JourneyMatchResult> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Finding best journey match', {
      skillLevel: data.skillLevel,
      primaryGoal: data.primaryGoal,
      correlationId,
    });

    // Get all active journeys
    const { data: journeys, error } = await this.supabaseService
      .getClient()
      .from('learning_journeys')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to fetch journeys', error, { correlationId });
      throw error;
    }

    if (!journeys || journeys.length === 0) {
      logger.warn('No active journeys found', { correlationId });
      return { bestMatch: null, alternatives: [] };
    }

    // Score each journey
    const scoredJourneys: JourneyMatchScore[] = journeys.map((journey) => {
      const score = this.calculateJourneyScore(data, journey);
      return {
        journeyId: journey.id,
        journey: this.mapDbJourneyToType(journey),
        score: score.score,
        matchReasons: score.reasons,
      };
    });

    // Sort by score descending
    scoredJourneys.sort((a, b) => b.score - a.score);

    const bestMatch = scoredJourneys[0].score > 0 ? scoredJourneys[0] : null;
    const alternatives = scoredJourneys.slice(1, 4); // Top 3 alternatives

    logger.debug('Journey match results', {
      bestMatch: bestMatch?.journey.name,
      bestScore: bestMatch?.score,
      alternativesCount: alternatives.length,
      correlationId,
    });

    return { bestMatch, alternatives };
  }

  /**
   * Calculate match score between assessment data and a journey
   */
  private calculateJourneyScore(
    data: AssessmentData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    journey: any,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Skill level match (40 points max)
    if (journey.target_skill_level === data.skillLevel) {
      score += 40;
      reasons.push(`Matches your ${data.skillLevel} skill level`);
    } else if (
      (journey.target_skill_level === 'beginner' &&
        data.skillLevel === 'intermediate') ||
      (journey.target_skill_level === 'intermediate' &&
        data.skillLevel === 'advanced')
    ) {
      // Adjacent skill levels get partial credit
      score += 20;
      reasons.push('Close skill level match');
    }

    // Goal match (30 points max)
    const targetGoals = journey.target_goals || [];
    if (targetGoals.includes(data.primaryGoal)) {
      score += 30;
      reasons.push('Aligns with your goals');
    }

    // Technique match (15 points max)
    const targetTechniques = journey.target_techniques || [];
    const matchingTechniques = data.preferredTechniques.filter((t) =>
      targetTechniques.includes(t),
    );
    if (matchingTechniques.length > 0) {
      score += Math.min(15, matchingTechniques.length * 5);
      reasons.push(`Covers ${matchingTechniques.join(', ')} techniques`);
    }

    // Genre match (15 points max)
    const targetGenres = journey.target_genres || [];
    const matchingGenres = data.preferredGenres.filter((g) =>
      targetGenres.includes(g),
    );
    if (matchingGenres.length > 0) {
      score += Math.min(15, matchingGenres.length * 5);
      reasons.push(`Features ${matchingGenres.join(', ')} music`);
    }

    return { score, reasons };
  }

  /**
   * Map database journey row to TypeScript type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbJourneyToType(row: any): LearningJourney {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      targetSkillLevel: row.target_skill_level,
      targetGoals: row.target_goals || [],
      targetTechniques: row.target_techniques || [],
      targetGenres: row.target_genres || [],
      milestones: row.milestones || [],
      estimatedWeeks: row.estimated_weeks,
      iconUrl: row.icon_url,
      color: row.color,
      isActive: row.is_active,
      isFeatured: row.is_featured,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Assign a journey to a user
   */
  private async assignJourney(
    userId: string,
    journeyId: string,
  ): Promise<string> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    // Check if user already has a journey
    const { data: existing } = await this.supabaseService
      .getClient()
      .from('user_journeys')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update existing journey
      const { error } = await this.supabaseService
        .getClient()
        .from('user_journeys')
        .update({
          journey_id: journeyId,
          started_at: new Date().toISOString(),
          current_milestone_index: 0,
          completed_milestones: [],
          progress: 0,
          status: 'active',
          completed_at: null,
        })
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to update user journey', error, {
          userId,
          journeyId,
          correlationId,
        });
        throw error;
      }

      return existing.id;
    }

    // Create new journey assignment
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_journeys')
      .insert({
        user_id: userId,
        journey_id: journeyId,
        started_at: new Date().toISOString(),
        current_milestone_index: 0,
        completed_milestones: [],
        progress: 0,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create user journey', error, {
        userId,
        journeyId,
        correlationId,
      });
      throw error;
    }

    return data.id;
  }

  // ==========================================================================
  // Admin Methods for Assessment Config Management
  // ==========================================================================

  /**
   * Get the active assessment configuration
   */
  async getActiveConfig(): Promise<AssessmentConfig | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Getting active assessment config', { correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      logger.error('Failed to get assessment config', error, { correlationId });
      throw error;
    }

    return this.mapDbConfigToType(data);
  }

  /**
   * Update assessment configuration
   */
  async updateConfig(
    userId: string,
    updates: {
      videoId?: string;
      videoPlatform?: string;
      videoLibraryId?: string;
      name?: string;
      description?: string;
      skillThresholds?: { advanced: number; intermediate: number };
    },
  ): Promise<AssessmentConfig> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Updating assessment config', {
      userId,
      updates,
      correlationId,
    });

    // Get current config
    const current = await this.getActiveConfig();
    if (!current) {
      throw new NotFoundException('No active assessment config found');
    }

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    if (updates.videoId !== undefined) updateData.video_id = updates.videoId;
    if (updates.videoPlatform !== undefined)
      updateData.video_platform = updates.videoPlatform;
    if (updates.videoLibraryId !== undefined)
      updateData.video_library_id = updates.videoLibraryId;
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.skillThresholds !== undefined)
      updateData.skill_thresholds = updates.skillThresholds;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .update(updateData)
      .eq('is_active', true)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update assessment config', error, {
        correlationId,
      });
      throw error;
    }

    logger.info('Assessment config updated', { correlationId });
    return this.mapDbConfigToType(data);
  }

  /**
   * Get all questions from the active assessment
   */
  async getQuestions(): Promise<AssessmentQuestion[]> {
    const config = await this.getActiveConfig();
    return config?.questions || [];
  }

  /**
   * Add a question to the assessment
   */
  async addQuestion(
    userId: string,
    question: AssessmentQuestion,
  ): Promise<AssessmentQuestion> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Adding question to assessment', {
      userId,
      questionId: question.id,
      correlationId,
    });

    const config = await this.getActiveConfig();
    if (!config) {
      throw new NotFoundException('No active assessment config found');
    }

    // Add question and sort by timestamp
    const questions = [...config.questions, question].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .update({
        questions: JSON.stringify(questions),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to add question', error, { correlationId });
      throw error;
    }

    logger.info('Question added', { questionId: question.id, correlationId });
    return question;
  }

  /**
   * Update an existing question
   */
  async updateQuestion(
    userId: string,
    questionId: string,
    question: AssessmentQuestion,
  ): Promise<AssessmentQuestion> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Updating question', { userId, questionId, correlationId });

    const config = await this.getActiveConfig();
    if (!config) {
      throw new NotFoundException('No active assessment config found');
    }

    const questionIndex = config.questions.findIndex(
      (q) => q.id === questionId,
    );
    if (questionIndex === -1) {
      throw new NotFoundException(`Question with id ${questionId} not found`);
    }

    // Update and sort by timestamp
    const questions = [...config.questions];
    questions[questionIndex] = { ...question, id: questionId };
    questions.sort((a, b) => a.timestamp - b.timestamp);

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .update({
        questions: JSON.stringify(questions),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to update question', error, { correlationId });
      throw error;
    }

    logger.info('Question updated', { questionId, correlationId });
    return questions[questionIndex];
  }

  /**
   * Delete a question from the assessment
   */
  async deleteQuestion(userId: string, questionId: string): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Deleting question', { userId, questionId, correlationId });

    const config = await this.getActiveConfig();
    if (!config) {
      throw new NotFoundException('No active assessment config found');
    }

    const questions = config.questions.filter((q) => q.id !== questionId);

    if (questions.length === config.questions.length) {
      throw new NotFoundException(`Question with id ${questionId} not found`);
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .update({
        questions: JSON.stringify(questions),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to delete question', error, { correlationId });
      throw error;
    }

    logger.info('Question deleted', { questionId, correlationId });
  }

  /**
   * Reorder questions by providing new order of IDs
   */
  async reorderQuestions(
    userId: string,
    questionIds: string[],
  ): Promise<AssessmentQuestion[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Reordering questions', { userId, correlationId });

    const config = await this.getActiveConfig();
    if (!config) {
      throw new NotFoundException('No active assessment config found');
    }

    // Create a map for quick lookup
    const questionMap = new Map(config.questions.map((q) => [q.id, q]));

    // Reorder based on provided IDs
    const reorderedQuestions: AssessmentQuestion[] = [];
    for (const id of questionIds) {
      const question = questionMap.get(id);
      if (question) {
        reorderedQuestions.push(question);
        questionMap.delete(id);
      }
    }

    // Add any remaining questions not in the reorder list
    for (const question of questionMap.values()) {
      reorderedQuestions.push(question);
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('assessment_config')
      .update({
        questions: JSON.stringify(reorderedQuestions),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('is_active', true);

    if (error) {
      logger.error('Failed to reorder questions', error, { correlationId });
      throw error;
    }

    logger.info('Questions reordered', { correlationId });
    return reorderedQuestions;
  }

  /**
   * Map database config row to TypeScript type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbConfigToType(row: any): AssessmentConfig {
    // Parse questions - may come as string from DB
    let questions = row.questions || [];
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch {
        questions = [];
      }
    }
    // Ensure questions is an array
    if (!Array.isArray(questions)) {
      questions = [];
    }

    // Parse skillThresholds - may come as string from DB
    let skillThresholds = row.skill_thresholds;
    if (typeof skillThresholds === 'string') {
      try {
        skillThresholds = JSON.parse(skillThresholds);
      } catch {
        skillThresholds = null;
      }
    }
    // Ensure skillThresholds has required shape
    if (!skillThresholds || typeof skillThresholds !== 'object') {
      skillThresholds = { advanced: 80, intermediate: 50 };
    }

    return {
      videoPlatform: 'bunny',
      videoLibraryId: row.video_library_id || '',
      videoId: row.video_id,
      questions,
      skillThresholds,
    };
  }
}
