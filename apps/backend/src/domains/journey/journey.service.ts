import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  LearningJourney,
  UserJourneyWithDetails,
  JourneyProgress,
  JourneyStatus,
} from '@bassnotion/contracts';
import { JourneyRepository } from './repositories/journey.repository.js';
import { RequestContextService } from '../../shared/services/request-context.service.js';

@Injectable()
export class JourneyService {
  private readonly staticLogger = createStructuredLogger(JourneyService.name);

  constructor(
    private readonly journeyRepository: JourneyRepository,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Get all available learning journeys
   */
  async getAvailableJourneys(): Promise<LearningJourney[]> {
    return this.journeyRepository.getActiveJourneys();
  }

  /**
   * Get user's current journey with progress
   */
  async getUserJourney(
    userId: string,
  ): Promise<{ journey: UserJourneyWithDetails | null; progress: JourneyProgress | null }> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.debug('Getting user journey', { userId, correlationId });

    const userJourney = await this.journeyRepository.getUserJourney(userId);

    if (!userJourney) {
      return { journey: null, progress: null };
    }

    const progress = this.journeyRepository.calculateProgress(userJourney);

    return { journey: userJourney, progress };
  }

  /**
   * Update journey progress
   */
  async updateProgress(
    userId: string,
    updates: {
      currentMilestoneIndex?: number;
      completedMilestoneIndex?: number;
      status?: JourneyStatus;
    },
  ): Promise<JourneyProgress> {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Updating journey progress', { userId, updates, correlationId });

    await this.journeyRepository.updateProgress(userId, updates);

    // Get updated journey and progress
    const { journey, progress } = await this.getUserJourney(userId);

    if (!journey || !progress) {
      throw new Error('Failed to get updated journey progress');
    }

    return progress;
  }
}
