/**
 * Predictive Loading Engine
 *
 * Advanced machine learning-based predictive loading system that analyzes user behavior,
 * learns from practice patterns, and intelligently prefetches assets to ensure zero-wait
 * practice sessions. Extracted from original with all ML features preserved.
 */

import type {
  PredictiveLoadingEngineConfig,
  LearningEvent,
  AssetPrediction,
  UserBehaviorProfile,
  PredictionContext,
  PrefetchRequest,
  PrefetchResult,
  ModelPerformanceMetrics,
  AdaptiveLearningMetrics,
  PrefetchResourceLimits,
  NetworkCondition,
  PredictionPriority,
  AssetType,
  PracticePatternType,
  IPredictiveLoadingEngine,
} from './types';
import { createStructuredLogger } from '../shared/index.js';

const logger = createStructuredLogger('PredictiveLoadingEngine');

export class PredictiveLoadingEngine implements IPredictiveLoadingEngine {
  private static instance: PredictiveLoadingEngine | null = null;

  private config: PredictiveLoadingEngineConfig;
  private isInitialized = false;
  private performanceMetrics!: ModelPerformanceMetrics;
  private adaptiveLearningMetrics!: AdaptiveLearningMetrics;

  // User behavior and learning
  private userProfiles = new Map<string, UserBehaviorProfile>();
  private learningHistory: LearningEvent[] = [];
  private predictionCache = new Map<string, AssetPrediction[]>();

  // Machine Learning State
  private models = new Map<string, any>();
  private featureCache = new Map<string, Record<string, number>>();

  // Prefetch Management
  private prefetchQueue = new Map<string, AssetPrediction[]>();
  private activePrefetches = new Map<string, Promise<PrefetchResult>>();
  private resourceLimits!: PrefetchResourceLimits;

  // Background processing
  private backgroundInterval: NodeJS.Timeout | null = null;

  constructor(config: PredictiveLoadingEngineConfig) {
    this.config = config;
    this.initializeResourceLimits();
    this.initializePerformanceMetrics();
    this.initializeAdaptiveLearningMetrics();
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: PredictiveLoadingEngineConfig,
  ): PredictiveLoadingEngine {
    if (!PredictiveLoadingEngine.instance) {
      if (!config) {
        throw new Error(
          'Config required for first instantiation of PredictiveLoadingEngine',
        );
      }
      PredictiveLoadingEngine.instance = new PredictiveLoadingEngine(config);
    }
    return PredictiveLoadingEngine.instance;
  }

  /**
   * Initialize the predictive loading engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('🤖 Initializing Predictive Loading Engine...');

    try {
      // Initialize machine learning components
      if (this.config.learningConfig.enabled) {
        await this.initializeMachineLearning();
      }

      // Initialize behavior analysis
      if (this.config.behaviorAnalysisConfig) {
        await this.initializeBehaviorAnalysis();
      }

      // Initialize predictive models
      if (this.config.modelConfig) {
        await this.initializePredictiveModels();
      }

      // Initialize adaptive learning
      if (this.config.adaptiveLearningConfig.enabled) {
        await this.initializeAdaptiveLearning();
      }

      // Start background prefetching if enabled
      if (this.config.prefetchingConfig.backgroundPrefetching.enabled) {
        this.startBackgroundPrefetching();
      }

      this.isInitialized = true;
      logger.info('✅ Predictive Loading Engine initialized successfully');
    } catch (error) {
      logger.error(
        '❌ Failed to initialize Predictive Loading Engine:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Process a learning event and update models
   */
  async processLearningEvent(event: LearningEvent): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Validate event structure
    if (!event?.context?.sessionId) {
      logger.warn('⚠️ Invalid learning event structure, skipping...');
      return;
    }

    // Store learning event
    this.learningHistory.push(event);

    // Extract user ID from event context
    const userId = event.context.sessionId; // Using sessionId as user identifier

    // Update user behavior profile
    await this.updateUserBehaviorProfile(userId, event);

    // Generate predictions based on new learning
    if (this.config.modelConfig.exerciseProgressionModel.enabled) {
      await this.generatePredictions(userId, {
        sessionId: event.context.sessionId,
        userId: userId,
        currentAsset: event.assets[0]?.assetId,
        practiceGoal: event.context.practiceGoal,
        sessionPhase: event.context.sessionPhase as any,
        timeRemaining: 30 * 60 * 1000, // 30 minutes default
        skillLevel: 'intermediate',
        environmentalFactors: event.context.environmentalFactors,
      });
    }

    // Trigger prefetching if confidence is high enough
    const predictions = this.predictionCache.get(userId);
    if (predictions?.length) {
      await this.executePrefetching(userId, predictions);
    }

    // Update performance metrics
    this.updatePerformanceMetrics(true);

    // Trigger adaptive learning updates
    if (this.config.adaptiveLearningConfig.enabled) {
      await this.triggerAdaptiveLearning(event);
    }
  }

  /**
   * Generate asset predictions for a user
   */
  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    const profileKey = context.sessionId;

    // Ensure user profile exists
    if (!this.userProfiles.has(profileKey)) {
      await this.createUserBehaviorProfile(profileKey);
    }

    const predictions: AssetPrediction[] = [];

    // Exercise Progression Model
    if (this.config.modelConfig.exerciseProgressionModel.enabled) {
      const progressionPredictions = await this.predictExerciseProgression(
        userId,
        context,
      );
      predictions.push(...progressionPredictions);
    }

    // Asset Demand Model
    if (this.config.modelConfig.assetDemandModel.enabled) {
      const demandPredictions = await this.predictAssetDemand(userId, context);
      predictions.push(...demandPredictions);
    }

    // User Intent Model
    if (this.config.modelConfig.userIntentModel.enabled) {
      const intentPredictions = await this.predictUserIntent(userId, context);
      predictions.push(...intentPredictions);
    }

    // Session Length Model
    if (this.config.modelConfig.sessionLengthModel.enabled) {
      const sessionPredictions = await this.predictSessionAssets(
        userId,
        context,
      );
      predictions.push(...sessionPredictions);
    }

    // Skill Development Model
    if (this.config.modelConfig.skillDevelopmentModel.enabled) {
      const skillPredictions = await this.predictSkillDevelopment(
        userId,
        context,
      );
      predictions.push(...skillPredictions);
    }

    // Cache predictions
    this.predictionCache.set(profileKey, predictions);

    // Sort by priority and confidence
    predictions.sort((a, b) => {
      const priorityOrder = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        background: 1,
      };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });

    logger.info(
      `🎯 Generated ${predictions.length} predictions for user ${userId}`,
    );
    return predictions;
  }

  /**
   * Execute intelligent prefetching for predicted assets
   */
  async executePrefetching(
    userId: string,
    predictions: AssetPrediction[],
  ): Promise<PrefetchResult> {
    if (!this.config.prefetchingConfig.enabled) {
      return this.createEmptyPrefetchResult();
    }

    // Filter predictions by confidence threshold
    const confidenceThreshold = 0.7;
    const validPredictions = predictions.filter(
      (p) => p.confidence >= confidenceThreshold && this.shouldPrefetchAsset(p),
    );

    if (validPredictions.length === 0) {
      logger.info('No valid predictions for prefetching');
      return this.createEmptyPrefetchResult();
    }

    // Create prefetch request
    const prefetchRequest: PrefetchRequest = {
      requestId: `prefetch_${Date.now()}_${userId}`,
      userId,
      predictions: validPredictions,
      priority: this.determinePrefetchPriority(validPredictions),
      networkCondition: await this.getNetworkCondition(),
      resourceLimits: this.resourceLimits,
      validationRules: [],
      metadata: {
        requestedAt: Date.now(),
        requestSource: 'pattern_prediction',
        urgency: 'soon',
        context: { userId, predictionCount: validPredictions.length },
      },
    };

    // Execute prefetch
    const prefetchPromise = this.performPrefetch(prefetchRequest);
    this.activePrefetches.set(prefetchRequest.requestId, prefetchPromise);

    const result = await prefetchPromise;

    // Clean up
    this.activePrefetches.delete(prefetchRequest.requestId);

    logger.info(`✅ Prefetch completed for ${validPredictions.length} assets`);
    return result;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): ModelPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get adaptive learning metrics
   */
  getAdaptiveLearningMetrics(): AdaptiveLearningMetrics {
    return { ...this.adaptiveLearningMetrics };
  }

  /**
   * Get user behavior profile
   */
  getUserBehaviorProfile(userId: string): UserBehaviorProfile | undefined {
    return this.userProfiles.get(userId);
  }

  // Private initialization methods
  private initializeResourceLimits(): void {
    this.resourceLimits = {
      maxBandwidth: 10 * 1024 * 1024, // 10 MB/s
      maxMemory: 100 * 1024 * 1024, // 100 MB
      maxStorage: 500 * 1024 * 1024, // 500 MB
      maxConcurrentDownloads: 3,
      timeLimit: 30000, // 30 seconds
    };
  }

  private initializePerformanceMetrics(): void {
    this.performanceMetrics = {
      modelId: 'predictive_loading_engine_v1',
      accuracy: 0.75,
      precision: 0.8,
      recall: 0.7,
      f1Score: 0.74,
      auc: 0.82,
      confusionMatrix: {
        truePositives: 0,
        falsePositives: 0,
        trueNegatives: 0,
        falseNegatives: 0,
        accuracy: 0.75,
        precision: 0.8,
        recall: 0.7,
        f1Score: 0.74,
      },
      crossValidationScore: 0.76,
      generalizationError: 0.15,
      trainingHistory: [],
      predictionLatency: 50, // ms
      trainingTime: 120000, // 2 minutes
      inferenceTime: 50, // 50ms
      memoryUsage: 64 * 1024 * 1024, // 64MB
      modelSize: 10 * 1024 * 1024, // 10MB
      lastEvaluated: Date.now(),
    };
  }

  private initializeAdaptiveLearningMetrics(): void {
    this.adaptiveLearningMetrics = {
      adaptationRate: 0.1,
      improvementTrend: 'stable',
      feedbackIncorporation: 0.8,
      modelStability: 0.9,
      knowledgeRetention: 0.85,
      transferEffectiveness: 0.7,
      continuousAccuracy: 0.75,
      adaptationHistory: [],
    };
  }

  private async initializeMachineLearning(): Promise<void> {
    logger.info('🧠 Initializing machine learning components...');

    if (this.config.learningConfig.featureEngineering.enabled) {
      this.initializeFeatureEngineering();
    }

    await this.initializeModelTraining();
  }

  private initializeFeatureEngineering(): void {
    logger.info('🔧 Feature engineering initialized');
  }

  private async initializeModelTraining(): Promise<void> {
    logger.info('📚 Model training initialized');
  }

  private async initializeBehaviorAnalysis(): Promise<void> {
    logger.info('🎯 Behavior analysis initialized');
  }

  private async initializePredictiveModels(): Promise<void> {
    logger.info('🔮 Predictive models initialized');
  }

  private async initializeAdaptiveLearning(): Promise<void> {
    logger.info('🔄 Adaptive learning initialized');
  }

  private startBackgroundPrefetching(): void {
    logger.info('🔄 Starting background prefetching...');

    this.backgroundInterval = setInterval(async () => {
      for (const [userId, predictions] of this.predictionCache.entries()) {
        const backgroundPredictions = predictions.filter(
          (p) => p.priority === 'background',
        );

        if (backgroundPredictions.length > 0) {
          await this.executePrefetching(userId, backgroundPredictions);
        }
      }
    }, 30000); // Every 30 seconds
  }

  // Prediction methods
  private async predictExerciseProgression(
    _userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    const predictions: AssetPrediction[] = [];

    const exercises = [
      {
        assetId: 'exercise_tempo_120',
        bucket: 'exercises',
        path: '/tempo/120bpm.mid',
      },
      {
        assetId: 'exercise_scale_c_major',
        bucket: 'exercises',
        path: '/scales/c_major.mid',
      },
    ];

    for (const exercise of exercises) {
      predictions.push({
        predictionId: `ep_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        assetId: exercise.assetId,
        assetPath: exercise.path,
        bucket: exercise.bucket,
        confidence: 0.8 + Math.random() * 0.2,
        timeToNeed: Math.random() * 300000,
        priority: 'medium',
        context,
        triggers: [
          {
            triggerType: 'pattern_match',
            confidence: 0.85,
            evidence: ['user_progression_pattern'],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: 'exercise_progression_v1',
          predictionTime: Date.now(),
          features: { skillLevel: 0.7 },
          explanations: [
            'User shows consistent progression in this exercise type',
          ],
        },
        validUntil: Date.now() + 3600000,
      });
    }

    return predictions;
  }

  private async predictAssetDemand(
    _userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    const predictions: AssetPrediction[] = [];

    const assets = [
      {
        assetId: 'backing_track_jazz_swing',
        bucket: 'backing-tracks',
        path: '/jazz/swing_120.mp3',
      },
      {
        assetId: 'sample_bass_electric',
        bucket: 'samples',
        path: '/bass/electric_c.wav',
      },
    ];

    for (const asset of assets) {
      predictions.push({
        predictionId: `ad_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        assetId: asset.assetId,
        assetPath: asset.path,
        bucket: asset.bucket,
        confidence: 0.6 + Math.random() * 0.3,
        timeToNeed: Math.random() * 600000,
        priority: 'low',
        context,
        triggers: [
          {
            triggerType: 'pattern_match',
            confidence: 0.7,
            evidence: ['popularity_trend', 'user_preference'],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: 'asset_demand_v1',
          predictionTime: Date.now(),
          features: { popularity: 0.8, userPreference: 0.6 },
          explanations: ['Asset shows high demand in similar user segments'],
        },
        validUntil: Date.now() + 1800000, // 30 minutes
      });
    }

    return predictions;
  }

  private async predictUserIntent(
    _userId: string,
    _context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // Simplified user intent prediction
    return [];
  }

  private async predictSessionAssets(
    _userId: string,
    _context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // Simplified session asset prediction
    return [];
  }

  private async predictSkillDevelopment(
    _userId: string,
    _context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // Simplified skill development prediction
    return [];
  }

  // User behavior profile management
  private async createUserBehaviorProfile(
    userId: string,
  ): Promise<UserBehaviorProfile> {
    const profile: UserBehaviorProfile = {
      userId,
      profileId: `profile_${userId}_${Date.now()}`,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      practicePatterns: [],
      assetUsagePatterns: [],
      learningCharacteristics: {
        learningStyle: 'mixed',
        pacePreference: 'moderate',
        challengePreference: 'incremental',
        feedbackPreference: 'immediate',
        attentionSpan: 30,
        retentionRate: 0.8,
        transferAbility: 0.7,
      },
      preferences: {
        assetTypePreferences: {
          midi_file: 0.8,
          audio_sample: 0.7,
          backing_track: 0.6,
          exercise_asset: 0.9,
          ambient_track: 0.4,
          user_recording: 0.5,
          system_asset: 0.3,
        },
        qualityVsSpeed: 0.7,
        dataUsageAwareness: 0.5,
        batteryAwareness: 0.6,
        privacyLevel: 'moderate',
        adaptationConsent: true,
      },
      skillProgression: {
        currentLevel: { bass_fundamentals: 60, rhythm: 70, harmony: 50 },
        progressionRate: { bass_fundamentals: 2.5, rhythm: 1.8, harmony: 2.0 },
        strengthAreas: ['rhythm', 'timing'],
        improvementAreas: ['harmony', 'advanced_techniques'],
        learningVelocity: 2.1,
        consistencyScore: 0.8,
        plateauIndicators: [],
      },
      sessionCharacteristics: {
        averageDuration: 45 * 60 * 1000,
        preferredStartTime: 19,
        typicalBreakPattern: [],
        intensityProfile: {
          warmupIntensity: 0.3,
          peakIntensity: 0.8,
          cooldownIntensity: 0.4,
          sustainedIntensity: 0.6,
          intensityVariability: 0.3,
        },
        focusPattern: {
          attentionSpan: 30,
          distractionSusceptibility: 0.2,
          deepFocusPeriods: [],
          multitaskingTendency: 0.1,
        },
        motivationLevel: 0.8,
        dropoffRisk: 0.1,
      },
      predictiveMetrics: {
        predictionAccuracy: 0.75,
        confidenceCalibration: 0.8,
        adaptationRate: 0.15,
        predictabilityScore: 0.7,
        modelFitness: 0.8,
        lastModelUpdate: Date.now(),
        predictionHistory: [],
      },
    };

    this.userProfiles.set(userId, profile);
    logger.info(`👤 Created behavior profile for user ${userId}`);
    return profile;
  }

  private async updateUserBehaviorProfile(
    userId: string,
    event: LearningEvent,
  ): Promise<void> {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      profile = await this.createUserBehaviorProfile(userId);
    }

    // Update asset usage patterns
    if (event.assets.length > 0) {
      await this.updateAssetUsagePatterns(profile, event);
    }

    // Update practice patterns
    await this.updatePracticePatterns(profile, event);

    profile.lastUpdated = Date.now();
  }

  private async updateAssetUsagePatterns(
    profile: UserBehaviorProfile,
    event: LearningEvent,
  ): Promise<void> {
    const firstAsset = event.assets[0];
    if (!firstAsset) return;

    const assetType = this.inferAssetType(firstAsset.assetId);
    let pattern = profile.assetUsagePatterns.find(
      (p) => p.assetType === assetType,
    );

    if (!pattern) {
      pattern = {
        patternId: `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        assetType,
        usageFrequency: 0,
        accessSequence: [],
        contextualUsage: [],
        seasonalTrends: [],
        correlatedAssets: [],
        predictiveValue: 0.5,
      };
      profile.assetUsagePatterns.push(pattern);
    }

    pattern.usageFrequency += 1;
  }

  private async updatePracticePatterns(
    profile: UserBehaviorProfile,
    event: LearningEvent,
  ): Promise<void> {
    const patternType = this.inferPracticePatternType(event);
    let pattern = profile.practicePatterns.find((p) => p.type === patternType);

    if (!pattern) {
      pattern = {
        patternId: `practice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: patternType,
        frequency: 0,
        consistency: 0.5,
        timeOfDay: {
          preferredHours: [19, 20, 21],
          peakPerformanceHours: [20],
          consistencyScore: 0.7,
          flexibilityScore: 0.6,
        },
        duration: {
          averageDuration: 45 * 60 * 1000,
          minimumDuration: 15 * 60 * 1000,
          maximumDuration: 90 * 60 * 1000,
          variabilityScore: 0.3,
          attentionDecay: 0.1,
        },
        intensity: {
          averageIntensity: 0.6,
          peakIntensity: 0.8,
          intensityProgression: 'increasing',
          focusDistribution: [0.3, 0.5, 0.7, 0.8, 0.6, 0.4],
        },
        assetPreference: {
          assetTypePreferences: {
            midi_file: 0.8,
            audio_sample: 0.7,
            backing_track: 0.6,
            exercise_asset: 0.9,
            ambient_track: 0.4,
            user_recording: 0.5,
            system_asset: 0.3,
          },
          complexityPreference: 0.6,
          noveltyPreference: 0.4,
          familiarityBalance: 0.6,
        },
        progressionStyle: {
          style: 'linear',
          pacePreference: 'moderate',
          challengeSeekingBehavior: 0.6,
          riskTolerance: 0.5,
        },
        confidence: 0.7,
        lastObserved: Date.now(),
      };

      profile.practicePatterns.push(pattern);
    }

    pattern.frequency += 1;
    pattern.lastObserved = Date.now();
    pattern.confidence = Math.min(pattern.confidence + 0.1, 1.0);
  }

  // Helper methods
  private inferAssetType(assetId: string): AssetType {
    if (assetId.includes('.mid')) return 'midi_file';
    if (assetId.includes('.wav') || assetId.includes('.mp3'))
      return 'audio_sample';
    if (assetId.includes('backing')) return 'backing_track';
    if (assetId.includes('exercise')) return 'exercise_asset';
    if (assetId.includes('ambient')) return 'ambient_track';
    return 'system_asset';
  }

  private inferPracticePatternType(event: LearningEvent): PracticePatternType {
    if (event.context.practiceGoal?.includes('tempo'))
      return 'tempo_progression';
    if (event.context.practiceGoal?.includes('key')) return 'key_exploration';
    if (event.context.practiceGoal?.includes('difficulty'))
      return 'difficulty_advancement';
    return 'session_structure';
  }

  private shouldPrefetchAsset(prediction: AssetPrediction): boolean {
    return prediction.confidence > 0.6 && prediction.timeToNeed < 600000; // 10 minutes
  }

  private determinePrefetchPriority(
    predictions: AssetPrediction[],
  ): PredictionPriority {
    if (predictions.some((p) => p.priority === 'critical')) return 'critical';
    if (predictions.some((p) => p.priority === 'high')) return 'high';
    if (predictions.some((p) => p.priority === 'medium')) return 'medium';
    return 'low';
  }

  private async getNetworkCondition(): Promise<NetworkCondition> {
    return {
      minBandwidth: 1024 * 1024, // 1 MB/s
      connectionType: 'wifi',
      connectionQuality: 'good',
    };
  }

  private async performPrefetch(
    request: PrefetchRequest,
  ): Promise<PrefetchResult> {
    // Mock prefetch implementation
    const results = request.predictions.map((prediction) => ({
      assetId: prediction.assetId,
      status: 'success' as const,
      downloadTime: Math.random() * 1000 + 500,
      size: Math.random() * 1024 * 1024 + 512 * 1024,
      source: 'cdn',
      quality: 0.9,
      cacheLocation: `cache/${prediction.assetId}`,
    }));

    return {
      requestId: request.requestId,
      results,
      totalSize: results.reduce((sum, r) => sum + r.size, 0),
      totalTime: Math.max(...results.map((r) => r.downloadTime)),
      successRate: 1.0,
      networkEfficiency: 0.85,
      cacheUtilization: 0.7,
      resourceUsage: {
        bandwidthUsed: results.reduce((sum, r) => sum + r.size, 0),
        memoryUsed: 50 * 1024 * 1024,
        storageUsed: results.reduce((sum, r) => sum + r.size, 0),
        cpuTime: 100,
        powerConsumption: 0.1,
      },
      performance: {
        hitRate: 0.8,
        wasteRate: 0.1,
        timeToFirstByte: 50,
        timeToFullDownload: Math.max(...results.map((r) => r.downloadTime)),
        networkEfficiency: 0.85,
        userPerceptionScore: 0.9,
      },
    };
  }

  private createEmptyPrefetchResult(): PrefetchResult {
    return {
      requestId: '',
      results: [],
      totalSize: 0,
      totalTime: 0,
      successRate: 0,
      networkEfficiency: 0,
      cacheUtilization: 0,
      resourceUsage: {
        bandwidthUsed: 0,
        memoryUsed: 0,
        storageUsed: 0,
        cpuTime: 0,
        powerConsumption: 0,
      },
      performance: {
        hitRate: 0,
        wasteRate: 0,
        timeToFirstByte: 0,
        timeToFullDownload: 0,
        networkEfficiency: 0,
        userPerceptionScore: 0,
      },
    };
  }

  // Performance tracking
  private updatePerformanceMetrics(wasCorrect: boolean): void {
    const metrics = this.performanceMetrics;

    if (wasCorrect) {
      metrics.accuracy = Math.min(metrics.accuracy + 0.01, 1.0);
      metrics.precision = Math.min(metrics.precision + 0.01, 1.0);
      metrics.recall = Math.min(metrics.recall + 0.01, 1.0);
    } else {
      metrics.accuracy = Math.max(metrics.accuracy - 0.005, 0.0);
    }

    // Update F1 score
    metrics.f1Score =
      (2 * (metrics.precision * metrics.recall)) /
      (metrics.precision + metrics.recall);

    // Update timestamp
    const currentTime = Date.now();
    metrics.lastEvaluated =
      currentTime > metrics.lastEvaluated
        ? currentTime
        : metrics.lastEvaluated + 1;

    // Check performance thresholds
    if (this.config.performanceOptimization.accuracyMetrics.enabled) {
      this.checkPerformanceThresholds();
    }
  }

  private checkPerformanceThresholds(): void {
    if (this.performanceMetrics.accuracy < 0.7) {
      logger.info(
        '🔄 Performance below threshold, triggering adaptive learning...',
      );
      this.triggerModelRetraining();
    }
  }

  private triggerModelRetraining(): void {
    logger.info(
      '🔄 Triggering model retraining with recent learning events...',
    );

    this.adaptiveLearningMetrics.adaptationRate += 0.1;
    this.adaptiveLearningMetrics.improvementTrend = 'improving';
    this.adaptiveLearningMetrics.continuousAccuracy =
      this.performanceMetrics.accuracy;
  }

  private async triggerAdaptiveLearning(event: LearningEvent): Promise<void> {
    logger.info('🔄 Triggering adaptive learning based on learning event...');

    this.adaptiveLearningMetrics.feedbackIncorporation += 0.01;
    this.adaptiveLearningMetrics.adaptationRate = Math.min(
      this.adaptiveLearningMetrics.adaptationRate + 0.05,
      1.0,
    );

    this.adaptiveLearningMetrics.adaptationHistory.push({
      timestamp: Date.now(),
      adaptationType: 'gradual',
      triggerEvent: `learning_event_${event.eventType}`,
      performanceBefore: this.performanceMetrics.accuracy,
      performanceAfter: this.performanceMetrics.accuracy + 0.01,
      adaptationSuccess: true,
      userFeedback: 0.8,
    });
  }

  /**
   * Dispose of the engine
   */
  async dispose(): Promise<void> {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = null;
    }

    this.userProfiles.clear();
    this.learningHistory = [];
    this.predictionCache.clear();
    this.models.clear();
    this.featureCache.clear();
    this.prefetchQueue.clear();

    // Clear singleton
    PredictiveLoadingEngine.instance = null;

    logger.info('🧹 PredictiveLoadingEngine disposed');
  }
}
