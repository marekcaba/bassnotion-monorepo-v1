/**
 * PredictiveComponents - Main orchestrator for predictive loading system
 *
 * Coordinates behavior analysis, prediction models, and adaptive learning
 * to provide intelligent asset prefetching and loading optimization.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  PredictiveLoadingConfig,
  AssetPrediction,
  PredictionContext,
  LearningEvent,
  ModelUpdateTrigger,
} from '@bassnotion/contracts';

// Import all components
import { BehaviorAnalyzer } from './behavior/BehaviorAnalyzer.js';
import { IntelligentPrefetcher } from './prefetch/IntelligentPrefetcher.js';
import { AdaptiveLearningManager } from './learning/AdaptiveLearningManager.js';
import { AnalyticsIntegration } from '../../services/analytics/AnalyticsIntegration.js';

// Import models
import {
  ExerciseProgressionModel,
  AssetDemandModel,
  UserIntentModel,
  SessionLengthModel,
  SkillDevelopmentModel,
} from './models/index.js';

const logger = createStructuredLogger('PredictiveComponents');

/**
 * Main orchestrator for predictive loading system
 *
 * This class coordinates all predictive loading components and provides
 * a unified interface for the rest of the application.
 */
export class PredictiveComponents {
  private config: PredictiveLoadingConfig;
  private behaviorAnalyzer: BehaviorAnalyzer | null = null;
  private intelligentPrefetcher: IntelligentPrefetcher | null = null;
  private adaptiveLearningManager: AdaptiveLearningManager | null = null;
  private analyticsIntegration: AnalyticsIntegration | null = null;

  // Prediction models
  private exerciseProgressionModel: ExerciseProgressionModel | null = null;
  private assetDemandModel: AssetDemandModel | null = null;
  private userIntentModel: UserIntentModel | null = null;
  private sessionLengthModel: SessionLengthModel | null = null;
  private skillDevelopmentModel: SkillDevelopmentModel | null = null;

  constructor(config: PredictiveLoadingConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info('🎯 Initializing Predictive Components...');

    // Initialize core components
    if (this.config.behaviorAnalysis.enabled) {
      this.behaviorAnalyzer = new BehaviorAnalyzer(
        this.config.behaviorAnalysis,
      );
      await this.behaviorAnalyzer.initialize();
    }

    if (this.config.intelligentPrefetching.enabled) {
      this.intelligentPrefetcher = new IntelligentPrefetcher(
        this.config.intelligentPrefetching,
      );
      await this.intelligentPrefetcher.initialize();
    }

    if (this.config.adaptiveLearning.enabled) {
      this.adaptiveLearningManager = new AdaptiveLearningManager(
        this.config.adaptiveLearning,
      );
      await this.adaptiveLearningManager.initialize();
    }

    if (this.config.analytics.enabled) {
      this.analyticsIntegration = new AnalyticsIntegration(
        this.config.analytics,
      );
      await this.analyticsIntegration.initialize();
    }

    // Initialize prediction models
    if (this.config.predictionModels.exerciseProgression.enabled) {
      this.exerciseProgressionModel = new ExerciseProgressionModel(
        this.config.predictionModels.exerciseProgression,
      );
      await this.exerciseProgressionModel.initialize();
    }

    if (this.config.predictionModels.assetDemand.enabled) {
      this.assetDemandModel = new AssetDemandModel(
        this.config.predictionModels.assetDemand,
      );
      await this.assetDemandModel.initialize();
    }

    if (this.config.predictionModels.userIntent.enabled) {
      this.userIntentModel = new UserIntentModel(
        this.config.predictionModels.userIntent,
      );
      await this.userIntentModel.initialize();
    }

    if (this.config.predictionModels.sessionLength.enabled) {
      this.sessionLengthModel = new SessionLengthModel(
        this.config.predictionModels.sessionLength,
      );
      await this.sessionLengthModel.initialize();
    }

    if (this.config.predictionModels.skillDevelopment.enabled) {
      this.skillDevelopmentModel = new SkillDevelopmentModel(
        this.config.predictionModels.skillDevelopment,
      );
      await this.skillDevelopmentModel.initialize();
    }

    logger.info('✅ Predictive Components initialized successfully');
  }

  /**
   * Generate predictions for a user based on context
   */
  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    const allPredictions: AssetPrediction[] = [];

    // Collect predictions from all enabled models
    const modelPromises: Promise<AssetPrediction[]>[] = [];

    if (this.exerciseProgressionModel) {
      modelPromises.push(
        this.exerciseProgressionModel.generatePredictions(userId, context),
      );
    }

    if (this.assetDemandModel) {
      modelPromises.push(
        this.assetDemandModel.generatePredictions(userId, context),
      );
    }

    if (this.userIntentModel) {
      modelPromises.push(
        this.userIntentModel.generatePredictions(userId, context),
      );
    }

    if (this.sessionLengthModel) {
      modelPromises.push(
        this.sessionLengthModel.generatePredictions(userId, context),
      );
    }

    if (this.skillDevelopmentModel) {
      modelPromises.push(
        this.skillDevelopmentModel.generatePredictions(userId, context),
      );
    }

    // Wait for all models to complete
    const modelResults = await Promise.all(modelPromises);

    // Merge all predictions
    for (const predictions of modelResults) {
      allPredictions.push(...predictions);
    }

    // Deduplicate and rank predictions
    return this.deduplicateAndRankPredictions(allPredictions);
  }

  /**
   * Process a learning event for adaptive learning
   */
  async processLearningEvent(event: LearningEvent): Promise<void> {
    if (this.adaptiveLearningManager) {
      await this.adaptiveLearningManager.processEvent(event);
    }
  }

  /**
   * Trigger model update based on specific criteria
   */
  async triggerModelUpdate(
    userId: string,
    trigger: ModelUpdateTrigger,
  ): Promise<void> {
    if (this.adaptiveLearningManager) {
      await this.adaptiveLearningManager.triggerModelUpdate(userId, trigger);
    }
  }

  /**
   * Get behavior analyzer instance
   */
  getBehaviorAnalyzer(): BehaviorAnalyzer | null {
    return this.behaviorAnalyzer;
  }

  /**
   * Get intelligent prefetcher instance
   */
  getIntelligentPrefetcher(): IntelligentPrefetcher | null {
    return this.intelligentPrefetcher;
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    logger.info('🧹 Disposing Predictive Components...');

    const disposePromises: Promise<void>[] = [];

    // Dispose core components
    if (this.behaviorAnalyzer) {
      disposePromises.push(this.behaviorAnalyzer.dispose());
    }

    if (this.intelligentPrefetcher) {
      disposePromises.push(this.intelligentPrefetcher.dispose());
    }

    if (this.adaptiveLearningManager) {
      disposePromises.push(this.adaptiveLearningManager.dispose());
    }

    if (this.analyticsIntegration) {
      disposePromises.push(this.analyticsIntegration.dispose());
    }

    // Dispose models
    if (this.exerciseProgressionModel) {
      disposePromises.push(this.exerciseProgressionModel.dispose());
    }

    if (this.assetDemandModel) {
      disposePromises.push(this.assetDemandModel.dispose());
    }

    if (this.userIntentModel) {
      disposePromises.push(this.userIntentModel.dispose());
    }

    if (this.sessionLengthModel) {
      disposePromises.push(this.sessionLengthModel.dispose());
    }

    if (this.skillDevelopmentModel) {
      disposePromises.push(this.skillDevelopmentModel.dispose());
    }

    await Promise.all(disposePromises);

    logger.info('✅ Predictive Components disposed successfully');
  }

  /**
   * Deduplicate and rank predictions by confidence and priority
   */
  private deduplicateAndRankPredictions(
    predictions: AssetPrediction[],
  ): AssetPrediction[] {
    // Group by assetId
    const grouped = new Map<string, AssetPrediction[]>();

    for (const prediction of predictions) {
      const existing = grouped.get(prediction.assetId) || [];
      existing.push(prediction);
      grouped.set(prediction.assetId, existing);
    }

    // For each asset, keep the prediction with highest confidence
    const deduplicated: AssetPrediction[] = [];

    for (const [assetId, group] of grouped) {
      const best = group.reduce((prev, curr) => {
        // Prioritize by priority level first, then confidence
        const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        const prevPriority = priorityOrder[prev.priority] || 0;
        const currPriority = priorityOrder[curr.priority] || 0;

        if (currPriority > prevPriority) return curr;
        if (currPriority < prevPriority) return prev;

        // Same priority, use confidence
        return curr.confidence > prev.confidence ? curr : prev;
      });

      deduplicated.push(best);
    }

    // Sort by priority and confidence
    return deduplicated.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return b.confidence - a.confidence;
    });
  }
}
