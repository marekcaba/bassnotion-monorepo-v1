import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  LearningJourney,
  UserJourney,
  UserJourneyWithDetails,
  JourneyProgress,
  JourneyStatus,
} from '@bassnotion/contracts';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';
import { RequestContextService } from '../../../shared/services/request-context.service.js';

@Injectable()
export class JourneyRepository {
  private readonly staticLogger = createStructuredLogger(JourneyRepository.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get all active learning journeys
   */
  async getActiveJourneys(): Promise<LearningJourney[]> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Fetching active journeys', { correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('learning_journeys')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Failed to fetch journeys', error, { correlationId });
      throw error;
    }

    return (data || []).map(this.mapDbRowToJourney);
  }

  /**
   * Get a journey by ID
   */
  async getJourneyById(journeyId: string): Promise<LearningJourney | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Fetching journey by ID', { journeyId, correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('learning_journeys')
      .select('*')
      .eq('id', journeyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('Failed to fetch journey', error, { journeyId, correlationId });
      throw error;
    }

    return data ? this.mapDbRowToJourney(data) : null;
  }

  /**
   * Get user's current journey with full details
   */
  async getUserJourney(userId: string): Promise<UserJourneyWithDetails | null> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Fetching user journey', { userId, correlationId });

    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_journeys')
      .select(
        `
        *,
        learning_journeys (*)
      `,
      )
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No journey assigned
      }
      logger.error('Failed to fetch user journey', error, { userId, correlationId });
      throw error;
    }

    if (!data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const journeyData = (data as any).learning_journeys;
    return {
      ...this.mapDbRowToUserJourney(data),
      journey: this.mapDbRowToJourney(journeyData),
    };
  }

  /**
   * Calculate journey progress
   */
  calculateProgress(
    userJourney: UserJourneyWithDetails,
  ): JourneyProgress {
    const totalMilestones = userJourney.journey.milestones.length;
    const completedMilestones = userJourney.completedMilestones.length;
    const currentMilestoneIndex = userJourney.currentMilestoneIndex;

    const currentMilestone =
      userJourney.journey.milestones[currentMilestoneIndex] || null;
    const nextMilestone =
      userJourney.journey.milestones[currentMilestoneIndex + 1] || null;

    const percentComplete =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    const completedWeeks =
      (completedMilestones / totalMilestones) *
      userJourney.journey.estimatedWeeks;
    const estimatedRemainingWeeks = Math.ceil(
      userJourney.journey.estimatedWeeks - completedWeeks,
    );

    return {
      journeyId: userJourney.journeyId,
      totalMilestones,
      completedMilestones,
      currentMilestoneIndex,
      currentMilestone,
      nextMilestone,
      percentComplete,
      estimatedRemainingWeeks,
    };
  }

  /**
   * Update user journey progress
   */
  async updateProgress(
    userId: string,
    updates: {
      currentMilestoneIndex?: number;
      completedMilestoneIndex?: number;
      status?: JourneyStatus;
    },
  ): Promise<void> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Updating journey progress', { userId, updates, correlationId });

    // Get current journey to update correctly
    const current = await this.getUserJourney(userId);
    if (!current) {
      throw new Error('User has no assigned journey');
    }

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.currentMilestoneIndex !== undefined) {
      updateData.current_milestone_index = updates.currentMilestoneIndex;
    }

    if (updates.completedMilestoneIndex !== undefined) {
      // Add to completed milestones array if not already there
      const completed = [...current.completedMilestones];
      if (!completed.includes(updates.completedMilestoneIndex)) {
        completed.push(updates.completedMilestoneIndex);
      }
      updateData.completed_milestones = completed;

      // Calculate progress percentage
      updateData.progress = Math.round(
        (completed.length / current.journey.milestones.length) * 100,
      );
    }

    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('user_journeys')
      .update(updateData)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to update journey progress', error, {
        userId,
        correlationId,
      });
      throw error;
    }

    logger.info('Journey progress updated', { userId, correlationId });
  }

  /**
   * Map database row to LearningJourney type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbRowToJourney(row: any): LearningJourney {
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
   * Map database row to UserJourney type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbRowToUserJourney(row: any): UserJourney {
    return {
      id: row.id,
      userId: row.user_id,
      journeyId: row.journey_id,
      startedAt: row.started_at,
      currentMilestoneIndex: row.current_milestone_index,
      completedMilestones: row.completed_milestones || [],
      progress: row.progress,
      status: row.status,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
