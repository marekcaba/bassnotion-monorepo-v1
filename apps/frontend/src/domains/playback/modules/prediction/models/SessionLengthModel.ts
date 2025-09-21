/**
 * SessionLengthModel
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SessionLengthModelConfig,
  AssetPrediction,
  PredictionContext,
  AssetType,
  PredictionPriority,
} from '@bassnotion/contracts';
import { BasePredictiveModel } from './BasePredictiveModel.js';

const logger = createStructuredLogger('SessionLengthModel');

export class SessionLengthModel extends BasePredictiveModel {
  constructor(config: SessionLengthModelConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('⏱️ Initializing Session Length Model...');
  }

  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return [];

    const predictions: AssetPrediction[] = [];
    const predictedSessionLength = this.predictSessionLength(context);
    const sessionAssets = this.getAssetsForSessionLength(
      predictedSessionLength,
    );

    for (const asset of sessionAssets) {
      predictions.push({
        predictionId: `pred-${Date.now()}-${asset.assetId}`,
        assetId: asset.assetId,
        assetPath: asset.assetId,
        bucket: 'session-assets',
        confidence: asset.confidence,
        timeToNeed: predictedSessionLength / 4, // Quarter of session length
        priority: asset.priority,
        context: context,
        triggers: [
          {
            triggerType: 'time_based',
            confidence: asset.confidence,
            evidence: [`Predicted session length: ${predictedSessionLength}ms`],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: '1.0.0',
          predictionTime: Date.now(),
          features: {
            timeRemaining: context.timeRemaining,
            sessionPhase: this.mapSessionPhaseToNumber(context.sessionPhase),
            predictedLength: predictedSessionLength,
          },
          explanations: [
            `Assets for ${Math.round(predictedSessionLength / 60000)} minute session`,
          ],
        },
        validUntil: Date.now() + predictedSessionLength,
      });
    }

    return predictions;
  }

  async dispose(): Promise<void> {
    logger.info('⏱️ Disposing Session Length Model...');
  }

  private predictSessionLength(context: PredictionContext): number {
    const baseSessionLength = 30 * 60 * 1000;
    const remainingTime = context.timeRemaining || baseSessionLength;

    if (context.sessionPhase === 'warmup') {
      return Math.max(remainingTime, 25 * 60 * 1000);
    } else if (context.sessionPhase === 'cooldown') {
      return Math.min(remainingTime, 10 * 60 * 1000);
    }

    return remainingTime;
  }

  private getAssetsForSessionLength(sessionLength: number): Array<{
    assetId: string;
    assetType: AssetType;
    confidence: number;
    priority: PredictionPriority;
    estimatedSize: number;
    estimatedLoadTime: number;
  }> {
    const sessionMinutes = Math.round(sessionLength / 60000);

    if (sessionMinutes < 15) {
      return [
        {
          assetId: 'quick-exercise.mid',
          assetType: 'exercise_asset',
          confidence: 0.7,
          priority: 'medium',
          estimatedSize: 20 * 1024,
          estimatedLoadTime: 100,
        },
      ];
    } else if (sessionMinutes > 45) {
      return [
        {
          assetId: 'extended-practice-set.mid',
          assetType: 'exercise_asset',
          confidence: 0.8,
          priority: 'high',
          estimatedSize: 100 * 1024,
          estimatedLoadTime: 400,
        },
        {
          assetId: 'ambient-long-track.mp3',
          assetType: 'ambient_track',
          confidence: 0.6,
          priority: 'low',
          estimatedSize: 8 * 1024 * 1024,
          estimatedLoadTime: 3000,
        },
      ];
    }

    return [
      {
        assetId: 'standard-practice-routine.mid',
        assetType: 'exercise_asset',
        confidence: 0.75,
        priority: 'medium',
        estimatedSize: 60 * 1024,
        estimatedLoadTime: 250,
      },
    ];
  }
}