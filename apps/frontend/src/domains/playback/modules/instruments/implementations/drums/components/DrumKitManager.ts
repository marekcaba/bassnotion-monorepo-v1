/**
 * DrumKitManager - Simple drum kit switching with 5 velocity layers
 *
 * Simplified from complex HybridSampleManager for bass practice platform.
 * Each drum kit has 5 velocity samples per drum piece.
 */

import { createStructuredLogger } from '../../../../shared/index.js';
import { DrumPiece } from './DrumMidiMapper.js';

const logger = createStructuredLogger('DrumKitManager');

export interface DrumKitSample {
  url: string;
  velocity: number; // 1-5 velocity layer
  loaded: boolean;
  buffer?: AudioBuffer;
}

export interface DrumKitConfig {
  id: string;
  name: string;
  description: string;
  samples: Record<DrumPiece, DrumKitSample[]>; // 5 velocity layers per piece
}

/**
 * Simple drum kit manager for 5-velocity drum samples
 */
export class DrumKitManager {
  private currentKit: DrumKitConfig | null = null;
  private availableKits = new Map<string, DrumKitConfig>();
  private loadingPromises = new Map<string, Promise<void>>();

  /**
   * Load a drum kit with 5 velocity layers
   */
  async loadDrumKit(kitId: string): Promise<DrumKitConfig> {
    // Check if already loading
    if (this.loadingPromises.has(kitId)) {
      await this.loadingPromises.get(kitId);
      const kit = this.availableKits.get(kitId);
      if (!kit) throw new Error(`Kit ${kitId} failed to load`);
      return kit;
    }

    // Check if already loaded
    const existingKit = this.availableKits.get(kitId);
    if (existingKit) {
      this.currentKit = existingKit;
      return existingKit;
    }

    // Load new kit
    const loadPromise = this.loadKitFromSupabase(kitId);
    this.loadingPromises.set(kitId, loadPromise);

    try {
      await loadPromise;
      const kit = this.availableKits.get(kitId);
      if (!kit) throw new Error(`Kit ${kitId} not found after loading`);
      this.currentKit = kit;

      logger.info(`Drum kit loaded: ${kitId}`, {
        name: kit.name,
        sampleCount: this.countSamples(kit),
      });

      return kit;
    } finally {
      this.loadingPromises.delete(kitId);
    }
  }

  /**
   * Switch to a different drum kit
   */
  async switchDrumKit(kitId: string): Promise<DrumKitConfig> {
    logger.info(`Switching to drum kit: ${kitId}`);
    return await this.loadDrumKit(kitId);
  }

  /**
   * Get current drum kit
   */
  getCurrentKit(): DrumKitConfig | null {
    return this.currentKit;
  }

  /**
   * Get sample for specific drum piece and velocity (1-5)
   */
  getSample(drumPiece: DrumPiece, velocity: number): DrumKitSample | null {
    if (!this.currentKit) return null;

    const samples = this.currentKit.samples[drumPiece];
    if (!samples || samples.length === 0) return null;

    // Map velocity (0-127) to velocity layer (1-5)
    const velocityLayer = Math.min(
      5,
      Math.max(1, Math.ceil((velocity / 127) * 5)),
    );

    return (
      samples.find((sample) => sample.velocity === velocityLayer) ||
      samples[0] ||
      null
    );
  }

  /**
   * Load kit configuration from Supabase
   */
  private async loadKitFromSupabase(kitId: string): Promise<void> {
    try {
      // This would load from Supabase storage
      // For now, create a mock kit structure
      const kit: DrumKitConfig = {
        id: kitId,
        name: `Drum Kit ${kitId}`,
        description: `Professional drum kit with 5 velocity layers`,
        samples: this.createMockKitSamples(kitId),
      };

      this.availableKits.set(kitId, kit);
      logger.info(`Kit configuration loaded: ${kitId}`);
    } catch (error) {
      logger.error(
        `Failed to load kit from Supabase: ${kitId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Create mock kit samples structure (replace with Supabase loading)
   */
  private createMockKitSamples(
    kitId: string,
  ): Record<DrumPiece, DrumKitSample[]> {
    const samples: Record<DrumPiece, DrumKitSample[]> = {} as any;

    Object.values(DrumPiece).forEach((piece) => {
      samples[piece] = Array.from({ length: 5 }, (_, index) => ({
        url: `supabase://drums/${kitId}/${piece}/velocity-${index + 1}.wav`,
        velocity: index + 1,
        loaded: false,
      }));
    });

    return samples;
  }

  /**
   * Count total samples in kit
   */
  private countSamples(kit: DrumKitConfig): number {
    return Object.values(kit.samples).reduce(
      (total, samples) => total + samples.length,
      0,
    );
  }

  /**
   * Preload all samples for current kit
   */
  async preloadCurrentKit(): Promise<void> {
    if (!this.currentKit) return;

    const loadPromises: Promise<void>[] = [];

    Object.values(this.currentKit.samples).forEach((samples) => {
      samples.forEach((sample) => {
        if (!sample.loaded && sample.url) {
          loadPromises.push(this.loadSampleBuffer(sample));
        }
      });
    });

    await Promise.all(loadPromises);
    logger.info(`All samples preloaded for kit: ${this.currentKit.id}`);
  }

  /**
   * Load individual sample buffer
   */
  private async loadSampleBuffer(sample: DrumKitSample): Promise<void> {
    try {
      // This would load from Supabase and decode audio
      // For now, mark as loaded
      sample.loaded = true;
      logger.debug(`Sample loaded: ${sample.url}`);
    } catch (error) {
      logger.error(
        `Failed to load sample: ${sample.url}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

// Export singleton instance
export const drumKitManager = new DrumKitManager();
