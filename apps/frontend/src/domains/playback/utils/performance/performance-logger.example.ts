/**
 * Examples of using PerformanceLogger with refactored components
 */

import {
  createPerformanceLogger,
  PerformanceThresholds,
} from './PerformanceLogger.js';
import type { DrumKit } from '../../modules/instruments/components/drums/DrumSampleEngine.js';
import type { MidiFile } from '../../modules/midi/types/index.js';

/**
 * Example 1: DrumSampleEngine with performance logging
 */
export class PerformanceAwareDrumEngine {
  private perfLogger = createPerformanceLogger('DrumEngine', {
    'drum.kit.load': { excellent: 150, good: 400, acceptable: 800 },
    'drum.sample.trigger': { excellent: 0.5, good: 2, acceptable: 5 },
  });

  async loadKit(kit: DrumKit, correlationId?: string): Promise<void> {
    const operation = this.perfLogger.startOperation({
      operation: 'drum.kit.load',
      component: 'DrumEngine',
      correlationId,
      metadata: {
        kitName: kit.name,
        pieceCount: Object.keys(kit.pieces).length,
      },
    });

    try {
      // Checkpoint for validation
      operation.checkpoint('validation');
      this.validateKit(kit);

      // Checkpoint for sample loading
      operation.checkpoint('loadSamples');
      await this.loadSamples(kit);

      // Checkpoint for initialization
      operation.checkpoint('initialize');
      await this.initializeEngine();

      // Success
      operation.complete({
        samplesLoaded: Object.keys(kit.pieces).length,
      });
    } catch (error) {
      operation.fail(error as Error, {
        kitName: kit.name,
      });
      throw error;
    }
  }

  private validateKit(kit: DrumKit): void {
    // Validation logic
  }

  private async loadSamples(kit: DrumKit): Promise<void> {
    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async initializeEngine(): Promise<void> {
    // Simulate initialization
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Example 2: MIDI Processing with performance tracking
 */
export class PerformanceAwareMidiProcessor {
  private perfLogger = createPerformanceLogger('MidiProcessor');

  async processMidiFile(file: File): Promise<MidiFile> {
    const operation = this.perfLogger.startOperation({
      operation: 'midi.process',
      component: 'MidiProcessor',
      metadata: {
        fileName: file.name,
        fileSize: file.size,
      },
    });

    try {
      // Parse file
      operation.checkpoint('parse');
      const parsed = await this.parse(file);

      // Validate
      operation.checkpoint('validate');
      this.validate(parsed);

      // Transform
      operation.checkpoint('transform');
      const transformed = await this.transform(parsed);

      operation.complete({
        trackCount: transformed.tracks?.length || 0,
        duration: transformed.duration || 0,
      });

      return transformed;
    } catch (error) {
      operation.fail(error as Error);
      throw error;
    }
  }

  private async parse(file: File): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {};
  }

  private validate(data: any): void {
    // Validation
  }

  private async transform(data: any): Promise<MidiFile> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { tracks: [], duration: 100 } as any;
  }
}

/**
 * Example 3: Using performance statistics
 */
export async function monitorPerformance() {
  const perfLogger = createPerformanceLogger('AudioEngine');

  // Simulate multiple operations
  for (let i = 0; i < 100; i++) {
    const operation = perfLogger.startOperation({
      operation: 'audio.buffer.decode',
      component: 'AudioEngine',
      metadata: { iteration: i },
    });

    // Simulate varying performance
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 50),
    );

    if (Math.random() > 0.9) {
      operation.fail(new Error('Decode failed'));
    } else {
      operation.complete({ bufferSize: 44100 });
    }
  }

  // Get statistics
  const stats = perfLogger.getStatistics('audio.buffer.decode');
  console.log('Performance Statistics:', {
    operations: stats.count,
    averageTime: stats.average.toFixed(2) + 'ms',
    p95: stats.p95.toFixed(2) + 'ms',
    statusDistribution: stats.statusDistribution,
  });

  // Get poor performance entries
  const poorEntries = perfLogger.getPoorPerformanceEntries();
  console.log('Poor Performance Count:', poorEntries.length);
}

/**
 * Example 4: Custom thresholds for specific operations
 */
export class InstrumentLoader {
  // Define custom thresholds for instrument operations
  private static CUSTOM_THRESHOLDS: Record<string, PerformanceThresholds> = {
    'instrument.sampler.init': {
      excellent: 200, // Samplers take longer
      good: 500,
      acceptable: 1000,
    },
    'instrument.synth.init': {
      excellent: 50, // Synths are faster
      good: 150,
      acceptable: 300,
    },
    'instrument.effect.apply': {
      excellent: 1,
      good: 5,
      acceptable: 10,
    },
  };

  private perfLogger = createPerformanceLogger(
    'InstrumentLoader',
    InstrumentLoader.CUSTOM_THRESHOLDS,
  );

  async loadInstrument(type: 'sampler' | 'synth', config: any): Promise<void> {
    const operation = this.perfLogger.startOperation({
      operation: `instrument.${type}.init`,
      component: 'InstrumentLoader',
      metadata: { type, configSize: JSON.stringify(config).length },
    });

    try {
      // Initialization steps
      operation.checkpoint('createInstance');
      const instance = await this.createInstance(type);

      operation.checkpoint('loadResources');
      await this.loadResources(instance, config);

      operation.checkpoint('applyEffects');
      await this.applyEffects(instance);

      operation.complete({
        instrumentId: instance.id,
        ready: true,
      });
    } catch (error) {
      operation.fail(error as Error, { type });
      throw error;
    }
  }

  private async createInstance(type: string): Promise<any> {
    await new Promise((resolve) =>
      setTimeout(resolve, type === 'sampler' ? 300 : 80),
    );
    return { id: Math.random().toString(36).substr(2, 9) };
  }

  private async loadResources(instance: any, config: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  private async applyEffects(instance: any): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
