/**
 * Preload Strategy Interface
 *
 * Defines the contract for different sample preloading strategies
 */

import { PreloadConfig, PreloadResult } from '../types/index.js';

export interface PreloadStrategy {
  /**
   * Strategy name for identification
   */
  readonly name: string;

  /**
   * Load essential samples for basic functionality
   */
  loadEssentialSamples(config?: PreloadConfig): Promise<PreloadResult>;

  /**
   * Load all remaining samples for full quality
   */
  loadFullSamples(config?: PreloadConfig): Promise<PreloadResult>;

  /**
   * Clear cached samples for this strategy
   */
  clear(): Promise<void>;

  /**
   * Get current loading progress
   */
  getProgress(): {
    loaded: number;
    total: number;
    progress: number;
  };
}
