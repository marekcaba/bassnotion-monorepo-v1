/**
 * Sample Preloader
 *
 * Core module for preloading and managing audio samples
 * Provides phased loading strategy: essential samples first,
 * then full quality samples as needed
 */

import { PreloadStrategy } from '../strategies/PreloadStrategy.js';
import {
  PreloadConfig,
  PreloadProgress,
  PreloadResult,
} from '../types/index.js';
import { logger } from '../../../utils/logger.js';

export class SamplePreloader {
  private static instance: SamplePreloader;
  private strategies: Map<string, PreloadStrategy> = new Map();
  private progress: Map<string, PreloadProgress> = new Map();
  private isPreloading = false;
  private preloadComplete = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): SamplePreloader {
    if (!SamplePreloader.instance) {
      SamplePreloader.instance = new SamplePreloader();
    }
    return SamplePreloader.instance;
  }

  /**
   * Register a preload strategy
   */
  registerStrategy(name: string, strategy: PreloadStrategy): void {
    this.strategies.set(name, strategy);
    this.progress.set(name, {
      total: 0,
      loaded: 0,
      progress: 0,
      phase: 'idle',
    });
  }

  /**
   * Check if a strategy is registered
   */
  hasStrategy(name: string): boolean {
    return this.strategies.has(name);
  }

  /**
   * Check if preloading is complete
   */
  isComplete(): boolean {
    return this.preloadComplete;
  }

  /**
   * Get progress for a specific strategy
   */
  getProgress(
    strategyName?: string,
  ): PreloadProgress | Map<string, PreloadProgress> {
    if (strategyName) {
      return (
        this.progress.get(strategyName) || {
          total: 0,
          loaded: 0,
          progress: 0,
          phase: 'idle',
        }
      );
    }
    return new Map(this.progress);
  }

  /**
   * Load essential samples for basic functionality
   * Called on first user interaction (like scroll)
   */
  async loadEssentialSamples(config?: PreloadConfig): Promise<PreloadResult> {
    if (this.isPreloading) {
      logger.info('Essential sample loading already in progress');
      return {
        success: false,
        error: 'Already preloading',
        loaded: 0,
        total: 0,
      };
    }

    logger.info('Starting essential sample loading...');
    this.isPreloading = true;

    const results: PreloadResult[] = [];

    try {
      // Execute essential loading for each strategy
      for (const [name, strategy] of this.strategies) {
        this.updateProgress(name, { phase: 'essential' });

        const result = await strategy.loadEssentialSamples(config);
        results.push(result);

        this.updateProgress(name, {
          loaded: result.loaded,
          total: result.total,
          progress: result.total > 0 ? result.loaded / result.total : 0,
        });
      }

      // Aggregate results
      const totalLoaded = results.reduce((sum, r) => sum + r.loaded, 0);
      const totalSamples = results.reduce((sum, r) => sum + r.total, 0);

      logger.info(`Essential samples loaded: ${totalLoaded}/${totalSamples}`);

      // Dispatch event to notify that essential samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('essentialSamplesReady'));
      }

      return {
        success: true,
        loaded: totalLoaded,
        total: totalSamples,
      };
    } catch (error) {
      logger.error('Failed to load essential samples:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        loaded: 0,
        total: 0,
      };
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load all remaining samples for full quality
   * Called when full quality is needed
   */
  async loadFullSamples(config?: PreloadConfig): Promise<PreloadResult> {
    if (this.isPreloading) {
      logger.info('Full sample loading already in progress');
      return {
        success: false,
        error: 'Already preloading',
        loaded: 0,
        total: 0,
      };
    }

    logger.info('Starting full sample loading...');
    this.isPreloading = true;

    const results: PreloadResult[] = [];

    try {
      // Execute full loading for each strategy
      for (const [name, strategy] of this.strategies) {
        this.updateProgress(name, { phase: 'full' });

        const result = await strategy.loadFullSamples(config);
        results.push(result);

        this.updateProgress(name, {
          loaded: result.loaded,
          total: result.total,
          progress: result.total > 0 ? result.loaded / result.total : 0,
          phase: 'complete',
        });
      }

      // Aggregate results
      const totalLoaded = results.reduce((sum, r) => sum + r.loaded, 0);
      const totalSamples = results.reduce((sum, r) => sum + r.total, 0);

      this.preloadComplete = true;
      logger.info(`Full samples loaded: ${totalLoaded}/${totalSamples}`);

      // Dispatch event to notify that all samples are ready
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('allSamplesReady'));
      }

      return {
        success: true,
        loaded: totalLoaded,
        total: totalSamples,
      };
    } catch (error) {
      logger.error('Failed to load full samples:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        loaded: 0,
        total: 0,
      };
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Clear all cached samples and reset state
   */
  async clear(): Promise<void> {
    for (const strategy of this.strategies.values()) {
      await strategy.clear();
    }

    this.progress.clear();
    this.preloadComplete = false;
  }

  /**
   * Update progress for a strategy
   */
  private updateProgress(
    strategyName: string,
    update: Partial<PreloadProgress>,
  ): void {
    const current = this.progress.get(strategyName) || {
      total: 0,
      loaded: 0,
      progress: 0,
      phase: 'idle',
    };

    this.progress.set(strategyName, {
      ...current,
      ...update,
    });
  }
}
