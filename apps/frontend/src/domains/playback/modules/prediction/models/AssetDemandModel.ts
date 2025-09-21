/**
 * AssetDemandModel
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  AssetDemandModelConfig,
  AssetPrediction,
  PredictionContext,
  AssetType,
  PredictionPriority,
} from '@bassnotion/contracts';
import { BasePredictiveModel } from './BasePredictiveModel.js';

const logger = createStructuredLogger('AssetDemandModel');

export class AssetDemandModel extends BasePredictiveModel {
  constructor(config: AssetDemandModelConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    logger.info('📊 Initializing Asset Demand Model...');
  }

  async generatePredictions(
    _userId: string,
    _context: PredictionContext,
  ): Promise<AssetPrediction[]> {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return [];

    const predictions: AssetPrediction[] = [];
    const timeBasedAssets = this.getTimeBasedAssets(new Date().getHours());

    for (const asset of timeBasedAssets) {
      predictions.push({
        predictionId: `pred-${Date.now()}-${asset.assetId}`,
        assetId: asset.assetId,
        assetPath: asset.assetId,
        bucket: 'assets',
        confidence: asset.confidence,
        timeToNeed: 10 * 60 * 1000, // 10 minutes
        priority: asset.priority,
        context: {
          sessionId: 'session-' + Date.now(),
          userId: _userId,
          sessionPhase: 'main',
          timeRemaining: 30 * 60 * 1000,
          skillLevel: 'intermediate',
          environmentalFactors: {},
        },
        triggers: [
          {
            triggerType: 'time_based',
            confidence: asset.confidence,
            evidence: [`High demand at ${new Date().getHours()}:00`],
            triggerTime: Date.now(),
          },
        ],
        metadata: {
          modelVersion: '1.0.0',
          predictionTime: Date.now(),
          features: {
            hourOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            userIdLength: _userId.length,
          },
          explanations: [`Popular asset at this time of day`],
        },
        validUntil: Date.now() + 60 * 60 * 1000,
      });
    }

    return predictions;
  }

  async dispose(): Promise<void> {
    logger.info('📊 Disposing Asset Demand Model...');
  }

  private getTimeBasedAssets(hour: number): Array<{
    assetId: string;
    assetType: AssetType;
    confidence: number;
    priority: PredictionPriority;
    estimatedSize: number;
    estimatedLoadTime: number;
  }> {
    if (hour >= 17 && hour <= 21) {
      return [
        {
          assetId: 'evening-warmup.mid',
          assetType: 'midi_file',
          confidence: 0.75,
          priority: 'medium',
          estimatedSize: 30 * 1024,
          estimatedLoadTime: 150,
        },
        {
          assetId: 'relaxing-backing-track.mp3',
          assetType: 'backing_track',
          confidence: 0.6,
          priority: 'low',
          estimatedSize: 4 * 1024 * 1024,
          estimatedLoadTime: 2000,
        },
      ];
    }

    return [];
  }
}