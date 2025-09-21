/**
 * UserIntentModel
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  UserIntentModelConfig,
  AssetPrediction,
  PredictionContext,
  AssetType,
  PredictionPriority,
} from '@bassnotion/contracts';
import { BasePredictiveModel } from './BasePredictiveModel.js';

const logger = createStructuredLogger('UserIntentModel');

export class UserIntentModel extends BasePredictiveModel {
  constructor(config: UserIntentModelConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('🎯 Initializing User Intent Model...');
  }

  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return [];

    const predictions: AssetPrediction[] = [];
    const intent = this.classifyIntent(context);
    const intentAssets = this.getAssetsForIntent(intent);

    for (const asset of intentAssets) {
      predictions.push({
        predictionId: `pred-${Date.now()}-${asset.assetId}`,
        assetId: asset.assetId,
        assetPath: asset.assetId,
        bucket: 'intent-assets',
        confidence: asset.confidence,
        timeToNeed: 2 * 60 * 1000, // 2 minutes
        priority: asset.priority,
        context: context,
        triggers: [
          {
            triggerType: 'contextual',
            confidence: asset.confidence,
            evidence: [`Detected intent: ${intent}`],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: '1.0.0',
          predictionTime: Date.now(),
          features: {
            sessionPhase: this.mapSessionPhaseToNumber(context.sessionPhase),
            practiceGoal: context.practiceGoal?.length || 0,
            timeRemaining: context.timeRemaining,
          },
          explanations: [`Assets matching ${intent} intent`],
        },
        validUntil: Date.now() + 15 * 60 * 1000,
      });
    }

    return predictions;
  }

  async dispose(): Promise<void> {
    logger.info('🎯 Disposing User Intent Model...');
  }

  private classifyIntent(context: PredictionContext): string {
    if (context.sessionPhase === 'warmup') return 'practice_preparation';
    if (context.sessionPhase === 'main') return 'skill_development';
    if (context.sessionPhase === 'cooldown') return 'review_and_reflection';
    if (context.practiceGoal?.includes('tempo')) return 'tempo_training';
    if (context.practiceGoal?.includes('chord')) return 'chord_practice';
    return 'general_practice';
  }

  private getAssetsForIntent(intent: string): Array<{
    assetId: string;
    assetType: AssetType;
    confidence: number;
    priority: PredictionPriority;
    estimatedSize: number;
    estimatedLoadTime: number;
  }> {
    const intentAssets: Record<
      string,
      Array<{
        assetId: string;
        assetType: AssetType;
        confidence: number;
        priority: PredictionPriority;
        estimatedSize: number;
        estimatedLoadTime: number;
      }>
    > = {
      practice_preparation: [
        {
          assetId: 'warmup-scales.mid',
          assetType: 'midi_file',
          confidence: 0.85,
          priority: 'high',
          estimatedSize: 25 * 1024,
          estimatedLoadTime: 100,
        },
      ],
      skill_development: [
        {
          assetId: 'technique-exercise.mid',
          assetType: 'exercise_asset',
          confidence: 0.8,
          priority: 'high',
          estimatedSize: 40 * 1024,
          estimatedLoadTime: 180,
        },
      ],
      tempo_training: [
        {
          assetId: 'metronome-120bpm.wav',
          assetType: 'audio_sample',
          confidence: 0.9,
          priority: 'critical',
          estimatedSize: 500 * 1024,
          estimatedLoadTime: 300,
        },
      ],
    };

    return intentAssets[intent] || [];
  }
}