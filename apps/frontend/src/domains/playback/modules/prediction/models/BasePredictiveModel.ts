/**
 * Base class for predictive models
 */

import type { AssetPrediction, PredictionContext } from '@bassnotion/contracts';

export abstract class BasePredictiveModel {
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]>;
  abstract dispose(): Promise<void>;

  protected mapSkillToNumber(skill: string): number {
    const skillMap: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 4,
    };
    return skillMap[skill] || 1;
  }

  protected mapSessionPhaseToNumber(phase: string): number {
    const phaseMap: Record<string, number> = {
      warmup: 1,
      main: 2,
      cooldown: 3,
    };
    return phaseMap[phase] || 2;
  }
}