/**
 * SkillDevelopmentModel
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SkillDevelopmentModelConfig,
  AssetPrediction,
  PredictionContext,
  AssetType,
  PredictionPriority,
} from '@bassnotion/contracts';
import { BasePredictiveModel } from './BasePredictiveModel.js';

const logger = createStructuredLogger('SkillDevelopmentModel');

export class SkillDevelopmentModel extends BasePredictiveModel {
  constructor(config: SkillDevelopmentModelConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('🎓 Initializing Skill Development Model...');
  }

  async generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return [];

    const predictions: AssetPrediction[] = [];
    const skillGaps = this.identifySkillGaps(context);
    const developmentAssets = this.getAssetsForSkillDevelopment(skillGaps);

    for (const asset of developmentAssets) {
      predictions.push({
        predictionId: `skill-dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        assetId: asset.assetId,
        assetPath: `exercise_assets/${asset.assetId}`,
        bucket: 'exercise_assets',
        confidence: asset.confidence,
        timeToNeed: 5 * 60 * 1000, // 5 minutes
        priority: asset.priority,
        context,
        triggers: [
          {
            triggerType: 'pattern_match',
            confidence: asset.confidence,
            evidence: [`Skill gap identified: ${skillGaps.join(', ')}`],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: '1.0.0',
          predictionTime: Date.now(),
          features: {
            skillLevel: this.mapSkillToNumber(context.skillLevel || 'beginner'),
            skillGaps: skillGaps.length,
            practiceGoal: context.practiceGoal?.length || 0,
          },
          explanations: [
            `Assets targeting skill gaps: ${skillGaps.join(', ')}`,
          ],
        },
        validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
    }

    return predictions;
  }

  async dispose(): Promise<void> {
    logger.info('🎓 Disposing Skill Development Model...');
  }

  private identifySkillGaps(context: PredictionContext): string[] {
    const gaps: string[] = [];

    if (
      context.practiceGoal?.includes('tempo') &&
      context.skillLevel === 'beginner'
    ) {
      gaps.push('tempo_control');
    }

    if (
      context.practiceGoal?.includes('chord') &&
      context.skillLevel === 'beginner'
    ) {
      gaps.push('chord_transitions');
    }

    // TODO: Review non-null assertion - consider null safety
    if (!context.practiceGoal) {
      gaps.push('goal_setting');
    }

    return gaps;
  }

  private getAssetsForSkillDevelopment(skillGaps: string[]): Array<{
    assetId: string;
    assetType: AssetType;
    confidence: number;
    priority: PredictionPriority;
    estimatedSize: number;
    estimatedLoadTime: number;
  }> {
    const assets: Array<{
      assetId: string;
      assetType: AssetType;
      confidence: number;
      priority: PredictionPriority;
      estimatedSize: number;
      estimatedLoadTime: number;
    }> = [];

    for (const gap of skillGaps) {
      switch (gap) {
        case 'tempo_control':
          assets.push({
            assetId: 'tempo-control-exercises.mid',
            assetType: 'exercise_asset',
            confidence: 0.85,
            priority: 'high',
            estimatedSize: 80 * 1024,
            estimatedLoadTime: 350,
          });
          break;
        case 'chord_transitions':
          assets.push({
            assetId: 'chord-transition-practice.mid',
            assetType: 'exercise_asset',
            confidence: 0.8,
            priority: 'high',
            estimatedSize: 60 * 1024,
            estimatedLoadTime: 280,
          });
          break;
        case 'goal_setting':
          assets.push({
            assetId: 'structured-practice-guide.mid',
            assetType: 'exercise_asset',
            confidence: 0.7,
            priority: 'medium',
            estimatedSize: 40 * 1024,
            estimatedLoadTime: 200,
          });
          break;
      }
    }

    return assets;
  }
}
