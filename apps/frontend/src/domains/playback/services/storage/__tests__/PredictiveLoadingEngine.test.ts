/**
 * Story 2.4 Task 3: Predictive Asset Loading Engine Tests
 *
 * Test suite for the machine learning-based predictive loading system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PredictiveLoadingEngine } from '../PredictiveLoadingEngine.js';
import type {
  PredictiveLoadingEngineConfig,
  LearningEvent,
  PredictionContext,
} from '@bassnotion/contracts';

describe('PredictiveLoadingEngine', () => {
  let engine: PredictiveLoadingEngine;
  let mockConfig: PredictiveLoadingEngineConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      learningConfig: {
        enabled: true,
        modelType: 'neural_network',
        trainingConfig: {
          batchSize: 32,
          maxEpochs: 100,
          learningRate: 0.001,
          regularization: {
            l1Penalty: 0.01,
            l2Penalty: 0.01,
            dropoutRate: 0.1,
            batchNormalization: true,
            weightDecay: 0.0001,
          },
          earlyStopping: {
            enabled: true,
            patience: 10,
            minImprovement: 0.001,
            monitorMetric: 'val_accuracy',
            restoreBestWeights: true,
          },
          optimizerType: 'adam',
          lossFunction: 'binary_crossentropy',
          trainingSchedule: {
            frequency: 'daily',
            batchTraining: true,
            incrementalLearning: true,
            retrainingTriggers: [],
            maintenanceWindow: {
              windowId: 'test-window-1',
              name: 'Test Maintenance Window',
              description: 'Test maintenance window for training',
              startTime: 1680000000000,
              endTime: 1680003600000,
              recurring: false,
              affectedComponents: ['training'],
              suppressAlerts: false,
              notifyBeforeStart: true,
            },
          },
        },
        featureEngineering: {
          enabled: true,
          temporalFeatures: {
            timeOfDay: true,
            dayOfWeek: true,
            seasonality: true,
            timeSinceLastPractice: true,
            practiceSessionLength: true,
            sequencePosition: true,
            historicalTrends: true,
            cyclicalPatterns: true,
          },
          behavioralFeatures: {
            practiceConsistency: true,
            skillProgressionRate: true,
            errorPatterns: true,
            preferenceShifts: true,
            engagementLevel: true,
            difficultyProgression: true,
            exerciseTypePreference: true,
            controlUsagePatterns: true,
          },
          contextualFeatures: {
            deviceType: true,
            networkCondition: true,
            sessionContext: true,
            environmentalFactors: true,
            userState: true,
            applicationState: true,
            externalFactors: true,
            socialContext: true,
          },
          assetFeatures: {
            assetType: true,
            assetComplexity: true,
            assetPopularity: true,
            assetRelationships: true,
            assetMetadata: true,
            historicalPerformance: true,
            technicalProperties: true,
            contentCharacteristics: true,
          },
          sequentialFeatures: {
            sequenceLength: 10,
            lookbackWindow: 3600000,
            sequenceEncoding: 'lstm',
            sequenceWeighting: 'attention_based',
            paddingStrategy: 'zero',
          },
          featureNormalization: {
            method: 'z_score',
            perFeature: true,
            onlineNormalization: true,
            adaptiveNormalization: true,
          },
        },
        modelPersistence: {
          enabled: true,
          storageLocation: 'local',
          encryptionEnabled: true,
          compressionEnabled: true,
          versioning: true,
          backupStrategy: 'incremental',
          retentionPolicy: {
            maxVersions: 10,
            retentionPeriod: 30 * 24 * 3600 * 1000,
            autoCleanup: true,
            archiveOldVersions: true,
          },
          syncInterval: 3600000,
        },
        predictionThresholds: {
          minimumConfidence: 0.6,
          optimalConfidence: 0.8,
          highConfidenceThreshold: 0.9,
          uncertaintyThreshold: 0.3,
          actionThresholds: [],
          contextualThresholds: [],
        },
        crossValidation: {
          enabled: true,
          folds: 5,
          stratified: true,
          timeSeriesSplit: false,
          validationStrategy: 'k_fold',
          testSize: 0.2,
          randomState: 42,
          shuffle: true,
        },
      },
      behaviorAnalysisConfig: {
        enabled: true,
        patternRecognition: {
          algorithmType: 'ensemble',
          minPatternSupport: 0.1,
          confidenceThreshold: 0.7,
          patternTypes: ['temporal', 'sequential'],
          temporalPatterns: true,
          hierarchicalPatterns: true,
          crossDomainPatterns: true,
        },
        sessionAnalysis: {
          sessionSegmentation: true,
          transitionAnalysis: true,
          intentRecognition: true,
          goalInference: true,
          anomalyDetection: true,
          sessionSimilarity: true,
          outcomePredicition: true,
        },
        practiceRoutineAnalysis: {
          routineIdentification: true,
          routineEvolution: true,
          routineEffectiveness: true,
          routinePersonalization: true,
          routineRecommendation: true,
          routineOptimization: true,
        },
        userSegmentation: {
          segmentationMethod: 'behavioral',
          numberOfSegments: 5,
          segmentStability: true,
          dynamicSegmentation: true,
          personalization: true,
          segmentTransitions: true,
        },
        temporalPatterns: {
          circadianPatterns: true,
          weeklyPatterns: true,
          seasonalPatterns: true,
          learningCurvePatterns: true,
          motivationPatterns: true,
          performancePatterns: true,
        },
        correlationAnalysis: {
          featureCorrelations: true,
          assetCorrelations: true,
          behaviorCorrelations: true,
          outcomeCorrelations: true,
          crossModalCorrelations: true,
          temporalCorrelations: true,
        },
      },
      prefetchingConfig: {
        enabled: true,
        strategy: {
          primaryStrategy: 'adaptive',
          lookAheadWindow: 300000,
          confidenceThreshold: 0.7,
          resourceAwareness: true,
          networkAwareness: true,
          userAwareness: true,
          contextAwareness: true,
        },
        prioritization: {
          primaryCriteria: 'confidence',
          weightingFactors: {
            confidenceWeight: 0.4,
            urgencyWeight: 0.3,
            sizeWeight: 0.2,
            popularityWeight: 0.1,
            userValueWeight: 0.0,
            resourceCostWeight: 0.0,
          },
          dynamicPriorities: true,
          userPreferences: true,
          contextualFactors: true,
          systemConstraints: true,
        },
        resourceManagement: {
          maxConcurrentPrefetches: 3,
          maxPrefetchBandwidth: 10 * 1024 * 1024,
          maxPrefetchMemory: 100 * 1024 * 1024,
          maxPrefetchStorage: 500 * 1024 * 1024,
          resourceAllocation: {
            strategy: 'adaptive',
            priorityBased: true,
            fairnessConstraints: true,
            dynamicAdjustment: true,
            resourceReservation: true,
          },
          quotaManagement: {
            enabled: true,
            bandwidthQuota: 100 * 1024 * 1024,
            storageQuota: 1024 * 1024 * 1024,
            requestQuota: 1000,
            quotaPeriod: 3600000,
            quotaExceededAction: 'throttle',
          },
          throttling: {
            enabled: true,
            maxRequestsPerSecond: 10,
            maxConcurrentRequests: 5,
            backoffStrategy: 'exponential',
            priorityBased: true,
            gracefulDegradation: true,
          },
        },
        networkAware: {
          enabled: true,
          networkQualityThresholds: {
            excellent: {
              minBandwidth: 10 * 1024 * 1024,
              maxLatency: 50,
              minReliability: 0.95,
              connectionTypes: ['wifi'],
            },
            good: {
              minBandwidth: 5 * 1024 * 1024,
              maxLatency: 100,
              minReliability: 0.9,
              connectionTypes: ['wifi', 'ethernet'],
            },
            fair: {
              minBandwidth: 1 * 1024 * 1024,
              maxLatency: 200,
              minReliability: 0.8,
              connectionTypes: ['cellular'],
            },
            poor: {
              minBandwidth: 256 * 1024,
              maxLatency: 500,
              minReliability: 0.7,
              connectionTypes: ['cellular'],
            },
          },
          adaptiveQuality: true,
          connectionTypeOptimization: true,
          latencyOptimization: true,
          bandwidthOptimization: true,
          costAwareness: true,
        },
        backgroundPrefetching: {
          enabled: true,
          idleTimeDetection: true,
          lowPriorityPrefetching: true,
          opportunisticPrefetching: true,
          backgroundLimits: {
            maxBackgroundTasks: 2,
            maxBackgroundBandwidth: 1024 * 1024,
            maxBackgroundMemory: 50 * 1024 * 1024,
            maxBackgroundTime: 300000,
            batteryThreshold: 20,
          },
          interruptibility: true,
          powerAwareness: true,
        },
        prefetchValidation: {
          enabled: true,
          validationRules: [],
          checksumValidation: true,
          integrityChecks: true,
          expiredAssetHandling: {
            strategy: 'refresh',
            gracePerioD: 60000,
            backgroundRefresh: true,
            userNotification: false,
          },
          corruptionDetection: true,
          rollbackCapability: true,
        },
      },
      modelConfig: {
        exerciseProgressionModel: {
          enabled: true,
          modelType: 'sequence_prediction',
          features: {
            currentSkillLevel: true,
            practiceHistory: true,
            difficultyHistory: true,
            errorPatterns: true,
            timeSpent: true,
            userPreferences: true,
          },
          predictionHorizon: 5,
          difficultyModeling: true,
          skillTransferModeling: true,
          personalizedProgression: true,
        },
        assetDemandModel: {
          enabled: true,
          modelType: 'collaborative_filtering',
          features: {
            historical: true,
            seasonal: true,
            contextual: true,
            collaborative: true,
            content: true,
            popularity: true,
          },
          temporalModeling: true,
          popularityModeling: true,
          contextualModeling: true,
          coldStartHandling: true,
        },
        userIntentModel: {
          enabled: true,
          modelType: 'classification',
          features: {
            currentActivity: true,
            sessionContext: true,
            historicalBehavior: true,
            timePatterns: true,
            deviceContext: true,
            environmentalContext: true,
          },
          intentCategories: [],
          realTimeInference: true,
          contextWindow: 300000,
          uncertaintyHandling: true,
        },
        sessionLengthModel: {
          enabled: true,
          modelType: 'regression',
          features: {
            historical: true,
            timeOfDay: true,
            dayOfWeek: true,
            userState: true,
            sessionGoals: true,
            environmentalFactors: true,
          },
          predictionInterval: 30,
          dynamicUpdates: true,
          attentionModeling: true,
          fatigueModeling: true,
        },
        skillDevelopmentModel: {
          enabled: true,
          modelType: 'neural_network',
          features: {
            practiceTime: true,
            errorRates: true,
            progressionRate: true,
            retentionRate: true,
            transferEffects: true,
            motivationLevel: true,
          },
          skillHierarchy: true,
          prerequisites: true,
          forgettingCurve: true,
          masteryThresholds: [],
        },
        modelEnsembleConfig: {
          enabled: true,
          ensembleMethod: 'voting',
          modelWeights: {},
          dynamicWeighting: true,
          diversityMaintenance: true,
          adaptiveEnsemble: true,
        },
      },
      adaptiveLearningConfig: {
        enabled: true,
        feedbackLoop: {
          enabled: true,
          feedbackSources: ['user_explicit', 'system_performance'],
          feedbackAggregation: {
            strategy: 'weighted_average',
            weights: {
              user_explicit: 0.7,
              user_implicit: 0.5,
              system_performance: 0.8,
              accuracy_metrics: 0.9,
              usage_analytics: 0.6,
              error_analysis: 0.8,
            },
            confidenceThreshold: 0.7,
            minimumSamples: 10,
          },
          feedbackWeighting: {
            timeDecay: true,
            sourceReliability: true,
            contextualRelevance: true,
            userExpertise: true,
            feedbackFrequency: true,
          },
          rewardSignals: {
            signals: [],
            weighting: {},
            normalization: true,
            temporalAggregation: true,
          },
          penaltySignals: {
            signals: [],
            weighting: {},
            threshold: 0.5,
            gracePeriod: 60000,
          },
          feedbackValidation: {
            enabled: true,
            outlierDetection: true,
            consistencyChecks: true,
            sourceVerification: true,
            fraudDetection: true,
          },
        },
        modelUpdateStrategy: {
          updateTriggers: ['performance_degradation'],
          updateFrequency: {
            interval: 3600000,
            condition: 'performance_based',
            minInterval: 1800000,
            maxInterval: 86400000,
          },
          incrementalUpdates: true,
          batchUpdates: true,
          gradualRollout: true,
          rollbackStrategy: {
            enabled: true,
            criteria: [],
            automaticRollback: true,
            rollbackDelay: 300000,
            maxRollbacks: 3,
          },
          versionControl: {
            enabled: true,
            versioningStrategy: 'semantic',
            maxVersions: 10,
            branchingSupport: true,
            mergingSupport: true,
          },
        },
        performanceThresholds: {
          accuracyThresholds: {
            warning: 0.7,
            critical: 0.6,
            optimal: 0.9,
            target: 0.8,
          },
          latencyThresholds: {
            warning: 100,
            critical: 200,
            optimal: 50,
            target: 75,
          },
          resourceThresholds: {
            memory: { warning: 80, critical: 90, optimal: 60, target: 70 },
            cpu: { warning: 70, critical: 85, optimal: 50, target: 60 },
            network: { warning: 80, critical: 90, optimal: 60, target: 70 },
            storage: { warning: 85, critical: 95, optimal: 70, target: 80 },
          },
          userSatisfactionThresholds: {
            warning: 0.7,
            critical: 0.6,
            optimal: 0.9,
            target: 0.8,
          },
          adaptationTriggers: [],
          degradationThresholds: [],
        },
        onlineLearning: {
          enabled: true,
          learningRate: 0.001,
          adaptationSpeed: 'medium',
          forgettingFactor: 0.9,
          conceptDriftDetection: true,
          distributionShiftHandling: true,
          catastrophicForgettingPrevention: true,
        },
        transferLearning: {
          enabled: true,
          sourceModels: [],
          transferStrategy: 'fine_tuning',
          similarityThreshold: 0.8,
          knowledgeDistillation: true,
          multitaskLearning: true,
        },
        continuousImprovement: {
          enabled: true,
          improvementMetrics: [],
          experimentationFramework: {
            enabled: true,
            experimentTypes: [],
            statisticalSignificance: 0.95,
            minimumSampleSize: 100,
            maxExperimentDuration: 7 * 24 * 3600 * 1000,
          },
          abTesting: {
            enabled: true,
            trafficSplit: { control: 50, treatment: 50 },
            minimumSampleSize: 100,
            confidenceLevel: 0.95,
            maxTestDuration: 7 * 24 * 3600 * 1000,
          },
          performanceBaseline: {
            enabled: true,
            baselineMetrics: ['accuracy', 'latency'],
            updateFrequency: 86400000,
            historicalWindow: 7 * 24 * 3600 * 1000,
            alertOnRegression: true,
          },
          innovationRate: 0.1,
          conservativeness: 0.8,
        },
      },
      performanceOptimization: {
        accuracyMetrics: {
          enabled: true,
          primaryMetrics: [],
          secondaryMetrics: [],
          realTimeTracking: true,
          historicalComparison: true,
          benchmarkComparison: true,
          reportingInterval: 300000,
          alertThresholds: [],
        },
        latencyRequirements: {
          maxPredictionLatency: 100,
          maxPrefetchLatency: 5000,
          realTimeRequirements: true,
          latencyBudget: 200,
        },
        resourceLimits: {
          maxMemoryUsage: 200 * 1024 * 1024,
          maxCpuUsage: 80,
          maxNetworkUsage: 10 * 1024 * 1024,
          maxStorageUsage: 1024 * 1024 * 1024,
        },
        optimizationTargets: {
          primaryTarget: 'accuracy',
          secondaryTargets: ['latency'],
          tradeoffWeights: { accuracy: 0.6, latency: 0.4 },
          constraints: [],
        },
        monitoringConfig: {
          enabled: true,
          metricsCollection: true,
          performanceTracking: true,
          errorTracking: true,
          alerting: true,
          dashboards: true,
        },
      },
      analyticsIntegration: {
        story23AnalyticsEngine: true,
        behaviorPatternIntegration: {
          enabled: true,
          patternTypes: ['practice', 'usage'],
          syncInterval: 300000,
          dataTransformation: true,
          realTimeSync: true,
        },
        practiceSessionIntegration: {
          enabled: true,
          sessionTracking: true,
          metricsExtraction: true,
          contextualData: true,
          realTimeUpdates: true,
        },
        progressAnalysisIntegration: {
          enabled: true,
          skillTracking: true,
          achievementTracking: true,
          trendAnalysis: true,
          predictiveInsights: true,
        },
        dataExchangeProtocol: {
          protocol: 'rest',
          encryption: true,
          compression: true,
          batchSize: 100,
          syncStrategy: 'bidirectional',
        },
      },
    };

    engine = new PredictiveLoadingEngine(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    it('should be marked as initialized after setup', async () => {
      await engine.initialize();
      expect(engine.getPerformanceMetrics()).toBeDefined();
      expect(engine.getAdaptiveLearningMetrics()).toBeDefined();
    });
  });

  describe('learning event processing', () => {
    it('should process learning events successfully', async () => {
      const learningEvent: LearningEvent = {
        eventId: 'test_event_1',
        timestamp: Date.now(),
        eventType: 'practice_session',
        context: {
          sessionId: 'session_123',
          sessionPhase: 'main',
          timeInSession: 300000,
          practiceGoal: 'tempo_improvement',
          difficulty: 70,
          userState: 'focused',
          environmentalFactors: { noiseLevel: 'low' },
        },
        assets: [
          {
            assetId: 'exercise_tempo_120',
            role: 'primary',
            interactionType: 'practice',
            duration: 120000,
            effectiveness: 0.8,
          },
        ],
        outcome: {
          outcomeType: 'success',
          metrics: { accuracy: 0.85, tempo_consistency: 0.9 },
          userFeedback: 0.8,
          objectively_measured: true,
        },
        features: {
          temporal: { hour_of_day: 19, day_of_week: 3 },
          behavioral: { practice_consistency: 0.8 },
          contextual: { device_type: 1 },
          asset: { complexity: 0.7 },
          sequential: [0.1, 0.2, 0.3],
        },
        labels: {
          nextAssetNeeded: 'exercise_tempo_140',
          timeToNextAsset: 300000,
          sessionContinuation: true,
          skillImprovement: 0.1,
          satisfactionLevel: 0.8,
        },
      };

      await expect(
        engine.processLearningEvent(learningEvent),
      ).resolves.not.toThrow();
    });
  });

  describe('prediction generation', () => {
    it('should generate predictions based on context', async () => {
      await engine.initialize();

      const context: PredictionContext = {
        sessionId: 'session_123',
        userId: 'user_456',
        currentAsset: 'exercise_tempo_120',
        practiceGoal: 'tempo_improvement',
        sessionPhase: 'main',
        timeRemaining: 1800000,
        skillLevel: 'intermediate',
        environmentalFactors: { noiseLevel: 'low' },
      };

      const predictions = await engine.generatePredictions('user_456', context);

      expect(predictions).toBeInstanceOf(Array);
      expect(predictions.length).toBeGreaterThan(0);

      predictions.forEach((prediction) => {
        expect(prediction).toHaveProperty('predictionId');
        expect(prediction).toHaveProperty('assetId');
        expect(prediction).toHaveProperty('confidence');
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        expect(prediction).toHaveProperty('timeToNeed');
        expect(prediction).toHaveProperty('priority');
        expect(['critical', 'high', 'medium', 'low', 'background']).toContain(
          prediction.priority,
        );
      });
    });

    it('should prioritize predictions correctly', async () => {
      await engine.initialize();

      const context: PredictionContext = {
        sessionId: 'session_123',
        userId: 'user_456',
        sessionPhase: 'main',
        timeRemaining: 1800000,
        skillLevel: 'intermediate',
        environmentalFactors: {},
      };

      const predictions = await engine.generatePredictions('user_456', context);

      // Verify predictions are sorted by priority and confidence
      for (let i = 0; i < predictions.length - 1; i++) {
        const current = predictions[i];
        const next = predictions[i + 1];

        if (!current || !next) continue;

        const priorityOrder = {
          critical: 5,
          high: 4,
          medium: 3,
          low: 2,
          background: 1,
        };
        const currentPriorityValue = priorityOrder[current.priority];
        const nextPriorityValue = priorityOrder[next.priority];

        if (currentPriorityValue === nextPriorityValue) {
          expect(current.confidence).toBeGreaterThanOrEqual(next.confidence);
        } else {
          expect(currentPriorityValue).toBeGreaterThanOrEqual(
            nextPriorityValue,
          );
        }
      }
    });
  });

  describe('user behavior profiling', () => {
    it('should create user behavior profile from learning events', async () => {
      await engine.initialize();

      const learningEvent: LearningEvent = {
        eventId: 'test_event_1',
        timestamp: Date.now(),
        eventType: 'practice_session',
        context: {
          sessionId: 'session_123',
          sessionPhase: 'main',
          timeInSession: 300000,
          practiceGoal: 'tempo_improvement',
          difficulty: 70,
          userState: 'focused',
          environmentalFactors: {},
        },
        assets: [
          {
            assetId: 'exercise_tempo_120',
            role: 'primary',
            interactionType: 'practice',
            duration: 120000,
            effectiveness: 0.8,
          },
        ],
        outcome: {
          outcomeType: 'success',
          metrics: { accuracy: 0.85 },
          userFeedback: 0.8,
        },
        features: {
          temporal: {},
          behavioral: {},
          contextual: {},
          asset: {},
          sequential: [],
        },
        labels: {},
      };

      await engine.processLearningEvent(learningEvent);

      const profile = engine.getUserBehaviorProfile('session_123');
      expect(profile).toBeDefined();
      expect(profile?.userId).toBe('session_123');
      expect(profile?.practicePatterns).toBeInstanceOf(Array);
      expect(profile?.assetUsagePatterns).toBeInstanceOf(Array);
      expect(profile?.learningCharacteristics).toBeDefined();
      expect(profile?.preferences).toBeDefined();
      expect(profile?.skillProgression).toBeDefined();
      expect(profile?.sessionCharacteristics).toBeDefined();
      expect(profile?.predictiveMetrics).toBeDefined();
    });
  });

  describe('performance metrics', () => {
    it('should track and update performance metrics', async () => {
      await engine.initialize();

      const initialMetrics = engine.getPerformanceMetrics();
      expect(initialMetrics.accuracy).toBeGreaterThan(0);
      expect(initialMetrics.precision).toBeGreaterThan(0);
      expect(initialMetrics.recall).toBeGreaterThan(0);
      expect(initialMetrics.f1Score).toBeGreaterThan(0);

      // Process a learning event to trigger metric updates
      const learningEvent: LearningEvent = {
        eventId: 'test_event_1',
        timestamp: Date.now(),
        eventType: 'practice_session',
        context: {
          sessionId: 'session_123',
          sessionPhase: 'main',
          timeInSession: 300000,
          practiceGoal: 'tempo_improvement',
          difficulty: 70,
          userState: 'focused',
          environmentalFactors: {},
        },
        assets: [],
        outcome: { outcomeType: 'success', metrics: {} },
        features: {
          temporal: {},
          behavioral: {},
          contextual: {},
          asset: {},
          sequential: [],
        },
        labels: {},
      };

      await engine.processLearningEvent(learningEvent);

      const updatedMetrics = engine.getPerformanceMetrics();
      expect(updatedMetrics.lastEvaluated).toBeGreaterThan(
        initialMetrics.lastEvaluated,
      );
    });
  });

  describe('adaptive learning metrics', () => {
    it('should provide adaptive learning metrics', async () => {
      await engine.initialize();

      const adaptiveMetrics = engine.getAdaptiveLearningMetrics();
      expect(adaptiveMetrics.adaptationRate).toBeGreaterThan(0);
      expect(['improving', 'stable', 'degrading']).toContain(
        adaptiveMetrics.improvementTrend,
      );
      expect(adaptiveMetrics.feedbackIncorporation).toBeGreaterThan(0);
      expect(adaptiveMetrics.modelStability).toBeGreaterThan(0);
      expect(adaptiveMetrics.knowledgeRetention).toBeGreaterThan(0);
      expect(adaptiveMetrics.transferEffectiveness).toBeGreaterThan(0);
      expect(adaptiveMetrics.continuousAccuracy).toBeGreaterThan(0);
      expect(adaptiveMetrics.adaptationHistory).toBeInstanceOf(Array);
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple users simultaneously', async () => {
      await engine.initialize();

      const users = ['user_1', 'user_2', 'user_3'];

      for (const userId of users) {
        const context: PredictionContext = {
          sessionId: `session_${userId}`,
          userId,
          sessionPhase: 'main',
          timeRemaining: 1800000,
          skillLevel: 'intermediate',
          environmentalFactors: {},
        };

        const predictions = await engine.generatePredictions(userId, context);
        expect(predictions).toBeInstanceOf(Array);
        expect(predictions.length).toBeGreaterThan(0);
      }

      // Verify each user has their own profile
      for (const userId of users) {
        const profile = engine.getUserBehaviorProfile(`session_${userId}`);
        expect(profile?.userId).toBe(`session_${userId}`);
      }
    });

    it('should maintain performance under load', async () => {
      await engine.initialize();

      const startTime = Date.now();
      const numRequests = 10;

      const promises = Array.from({ length: numRequests }, async (_, i) => {
        const context: PredictionContext = {
          sessionId: `session_${i}`,
          userId: `user_${i}`,
          sessionPhase: 'main',
          timeRemaining: 1800000,
          skillLevel: 'intermediate',
          environmentalFactors: {},
        };

        return engine.generatePredictions(`user_${i}`, context);
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(numRequests);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds

      results.forEach((predictions) => {
        expect(predictions).toBeInstanceOf(Array);
      });
    });
  });

  describe('error handling', () => {
    it('should handle invalid learning events gracefully', async () => {
      await engine.initialize();

      // Create an invalid learning event (missing required fields)
      const invalidEvent = {
        eventId: 'invalid_event',
        // Missing other required fields
      } as any;

      // Should not throw an error, but handle gracefully
      await expect(
        engine.processLearningEvent(invalidEvent),
      ).resolves.not.toThrow();
    });

    it('should handle disabled features gracefully', async () => {
      const disabledConfig = {
        ...mockConfig,
        learningConfig: {
          ...mockConfig.learningConfig,
          enabled: false,
        },
        modelConfig: {
          ...mockConfig.modelConfig,
          exerciseProgressionModel: {
            ...mockConfig.modelConfig.exerciseProgressionModel,
            enabled: false,
          },
        },
      };

      const disabledEngine = new PredictiveLoadingEngine(disabledConfig);
      await expect(disabledEngine.initialize()).resolves.not.toThrow();

      const context: PredictionContext = {
        sessionId: 'session_123',
        userId: 'user_456',
        sessionPhase: 'main',
        timeRemaining: 1800000,
        skillLevel: 'intermediate',
        environmentalFactors: {},
      };

      const predictions = await disabledEngine.generatePredictions(
        'user_456',
        context,
      );
      expect(predictions).toBeInstanceOf(Array);
    });
  });

  describe('contract compliance', () => {
    it('should return properly typed prediction results', async () => {
      await engine.initialize();

      const context: PredictionContext = {
        sessionId: 'session_123',
        userId: 'user_456',
        sessionPhase: 'main',
        timeRemaining: 1800000,
        skillLevel: 'intermediate',
        environmentalFactors: {},
      };

      const predictions = await engine.generatePredictions('user_456', context);

      predictions.forEach((prediction) => {
        // Verify all required properties exist and have correct types
        expect(typeof prediction.predictionId).toBe('string');
        expect(typeof prediction.assetId).toBe('string');
        expect(typeof prediction.assetPath).toBe('string');
        expect(typeof prediction.bucket).toBe('string');
        expect(typeof prediction.confidence).toBe('number');
        expect(typeof prediction.timeToNeed).toBe('number');
        expect(typeof prediction.priority).toBe('string');
        expect(prediction.context).toBeDefined();
        expect(Array.isArray(prediction.triggers)).toBe(true);
        expect(prediction.metadata).toBeDefined();
        expect(typeof prediction.validUntil).toBe('number');
      });
    });

    it('should return properly typed performance metrics', async () => {
      await engine.initialize();

      const metrics = engine.getPerformanceMetrics();

      expect(typeof metrics.modelId).toBe('string');
      expect(typeof metrics.accuracy).toBe('number');
      expect(typeof metrics.precision).toBe('number');
      expect(typeof metrics.recall).toBe('number');
      expect(typeof metrics.f1Score).toBe('number');
      expect(typeof metrics.auc).toBe('number');
      expect(metrics.confusionMatrix).toBeDefined();
      expect(typeof metrics.crossValidationScore).toBe('number');
      expect(typeof metrics.generalizationError).toBe('number');
      expect(Array.isArray(metrics.trainingHistory)).toBe(true);
      expect(typeof metrics.predictionLatency).toBe('number');
      expect(typeof metrics.lastEvaluated).toBe('number');
    });

    it('should return properly typed adaptive learning metrics', async () => {
      await engine.initialize();

      const metrics = engine.getAdaptiveLearningMetrics();

      expect(typeof metrics.adaptationRate).toBe('number');
      expect(typeof metrics.improvementTrend).toBe('string');
      expect(typeof metrics.feedbackIncorporation).toBe('number');
      expect(typeof metrics.modelStability).toBe('number');
      expect(typeof metrics.knowledgeRetention).toBe('number');
      expect(typeof metrics.transferEffectiveness).toBe('number');
      expect(typeof metrics.continuousAccuracy).toBe('number');
      expect(Array.isArray(metrics.adaptationHistory)).toBe(true);
    });
  });
});
