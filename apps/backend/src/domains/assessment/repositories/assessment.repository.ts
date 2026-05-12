import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SkillLevel,
  PrimaryGoal,
  AssessmentBassTechnique,
  MusicGenre,
  AssessmentStatus,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

export interface AssessmentData {
  skillLevel: SkillLevel;
  assessmentScore: number;
  primaryGoal: PrimaryGoal;
  preferredTechniques: AssessmentBassTechnique[];
  preferredGenres: MusicGenre[];
}

@Injectable()
export class AssessmentRepository {
  private readonly staticLogger = createStructuredLogger(
    AssessmentRepository.name,
  );

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get assessment status for a user
   */
  async getStatus(userId: string): Promise<AssessmentStatus> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Getting assessment status', { userId, correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select(
        'skill_level, assessment_completed, assessment_completed_at, assessment_score, primary_goal',
      )
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to get assessment status', error, {
        userId,
        correlationId,
      });
      throw error;
    }

    return {
      completed: data?.assessment_completed ?? false,
      skillLevel: data?.skill_level ?? null,
      primaryGoal: data?.primary_goal ?? null,
      completedAt: data?.assessment_completed_at ?? null,
      score: data?.assessment_score ?? null,
    };
  }

  /**
   * Check if user has completed assessment
   */
  async hasCompletedAssessment(userId: string): Promise<boolean> {
    const status = await this.getStatus(userId);
    return status.completed;
  }

  /**
   * Save assessment results for a user
   */
  async saveResults(userId: string, data: AssessmentData): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Saving assessment results', {
      userId,
      skillLevel: data.skillLevel,
      primaryGoal: data.primaryGoal,
      correlationId,
    });

    const { error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .update({
        skill_level: data.skillLevel,
        assessment_completed: true,
        assessment_completed_at: new Date().toISOString(),
        assessment_score: data.assessmentScore,
        primary_goal: data.primaryGoal,
        preferred_techniques: data.preferredTechniques,
        preferred_genres: data.preferredGenres,
      })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to save assessment results', error, {
        userId,
        correlationId,
      });
      throw error;
    }

    logger.info('Assessment results saved successfully', {
      userId,
      correlationId,
    });
  }

  /**
   * Get user's assessment data (for journey matching)
   */
  async getAssessmentData(userId: string): Promise<AssessmentData | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Getting assessment data', { userId, correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('profiles')
      .select(
        'skill_level, assessment_score, primary_goal, preferred_techniques, preferred_genres',
      )
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to get assessment data', error, {
        userId,
        correlationId,
      });
      throw error;
    }

    if (!data?.skill_level) {
      return null;
    }

    return {
      skillLevel: data.skill_level as SkillLevel,
      assessmentScore: data.assessment_score ?? 0,
      primaryGoal: data.primary_goal as PrimaryGoal,
      preferredTechniques: (data.preferred_techniques ?? []) as AssessmentBassTechnique[],
      preferredGenres: (data.preferred_genres ?? []) as MusicGenre[],
    };
  }
}
