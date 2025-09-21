/**
 * ExerciseProgressionModel
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  ExerciseProgressionModelConfig,
  AssetPrediction,
  PredictionContext,
  AssetType,
  PredictionPriority,
} from '@bassnotion/contracts';
import { BasePredictiveModel } from './BasePredictiveModel.js';

const logger = createStructuredLogger('ExerciseProgressionModel');

export class ExerciseProgressionModel extends BasePredictiveModel {
  constructor(config: ExerciseProgressionModelConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('📈 Initializing Exercise Progression Model...');
  }

  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return [];

    const predictions: AssetPrediction[] = [];
    const currentSkill = context.skillLevel || 'beginner';
    const nextExercises = this.getNextExercises(currentSkill);

    for (const exercise of nextExercises) {
      predictions.push({
        predictionId: `pred-${Date.now()}-${exercise.assetId}`,
        assetId: exercise.assetId,
        assetPath: exercise.assetId,
        bucket: 'exercises',
        confidence: exercise.confidence,
        timeToNeed: 5 * 60 * 1000, // 5 minutes
        priority: exercise.priority,
        context: {
          sessionId: context.sessionId,
          userId: context.userId,
          sessionPhase: context.sessionPhase,
          timeRemaining: context.timeRemaining,
          skillLevel: currentSkill,
          environmentalFactors: {},
        },
        triggers: [
          {
            triggerType: 'pattern_match',
            confidence: exercise.confidence,
            evidence: [
              `Skill level: ${currentSkill}`,
              `Session phase: ${context.sessionPhase}`,
            ],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: '1.0.0',
          predictionTime: Date.now(),
          features: {
            skillLevel: this.mapSkillToNumber(currentSkill),
            sessionPhase: this.mapSessionPhaseToNumber(context.sessionPhase),
            timeRemaining: context.timeRemaining,
          },
          explanations: [`Next exercise in ${currentSkill} progression`],
        },
        validUntil: Date.now() + 30 * 60 * 1000,
      });
    }

    return predictions;
  }

  async dispose(): Promise<void> {
    logger.info('📈 Disposing Exercise Progression Model...');
  }

  private getNextExercises(skillLevel: string): Array<{
    assetId: string;
    assetType: AssetType;
    confidence: number;
    priority: PredictionPriority;
    estimatedSize: number;
    estimatedLoadTime: number;
  }> {
    return [
      {
        assetId: `exercise-${skillLevel}-1.mid`,
        assetType: 'midi_file' as AssetType,
        confidence: 0.8,
        priority: 'high' as PredictionPriority,
        estimatedSize: 50 * 1024,
        estimatedLoadTime: 200,
      },
      {
        assetId: `backing-track-${skillLevel}.mp3`,
        assetType: 'backing_track' as AssetType,
        confidence: 0.7,
        priority: 'medium' as PredictionPriority,
        estimatedSize: 3 * 1024 * 1024,
        estimatedLoadTime: 1500,
      },
    ];
  }
}