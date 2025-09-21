/**
 * Examples of using logging decorators with refactored playback components
 */

import {
  LogMethod,
  LogPerformance,
  LogErrors,
  WithCorrelation,
  LogClass,
} from '../logging.decorators.js';
import type {
  DrumKit,
  DrumNote,
} from '../../../modules/instruments/components/drums/DrumSampleEngine.js';
import type { MidiFile } from '../../../modules/midi/types/index.js';

/**
 * Example 1: Enhanced DrumSampleEngine with logging decorators
 */
export class EnhancedDrumSampleEngine {
  @LogMethod({ level: 'info', includeArgs: true })
  @LogPerformance({ threshold: 100, metricName: 'drums.kit.load' })
  async loadKit(kit: DrumKit): Promise<void> {
    // Simulate loading
    await new Promise((resolve) => setTimeout(resolve, 150));
    console.log('Kit loaded:', kit.name);
  }

  @LogMethod({ level: 'debug' })
  @LogErrors({ recoveryStrategies: ['retry', 'fallback'] })
  trigger(note: DrumNote): void {
    if (!note.drum) {
      throw new Error('Invalid drum note: missing drum ID');
    }
    // Trigger drum sound
  }

  @WithCorrelation()
  @LogPerformance({ threshold: 50 })
  async loadSample(
    url: string,
    options?: { correlationId?: string },
  ): Promise<AudioBuffer> {
    // The correlation ID will be automatically tracked
    await new Promise((resolve) => setTimeout(resolve, 75));
    return {} as AudioBuffer;
  }
}

/**
 * Example 2: Enhanced MIDI Parser with automatic logging
 */
@LogClass({ level: 'debug', includeArgs: false }) // Log all methods
export class EnhancedMidiParser {
  // All methods automatically get basic logging

  @LogPerformance({ threshold: 200, metricName: 'midi.parse.file' })
  @LogErrors({ sanitize: true })
  async parseFile(file: File): Promise<MidiFile> {
    // Parsing logic
    return {} as MidiFile;
  }

  validateFormat(data: Uint8Array): boolean {
    // Automatically logged by @LogClass
    return true;
  }
}

/**
 * Example 3: Bass Synth with performance tracking
 */
export class EnhancedBassSynthEngine {
  @LogMethod({
    level: 'debug',
    sanitizeArgs: (args) => {
      // Don't log sensitive audio data
      return args.map((arg) =>
        arg instanceof AudioBuffer ? '[AudioBuffer]' : arg,
      );
    },
  })
  processSynthesis(buffer: AudioBuffer, params: any): void {
    // Process audio
  }

  @LogPerformance({ includeInMetrics: true })
  @LogErrors({ rethrow: false, recoveryStrategies: ['useDefault'] })
  async loadPreset(presetName: string): Promise<void> {
    // If this fails, error is logged but not rethrown
    throw new Error('Preset not found');
  }
}

/**
 * Example 4: Using measureAsync for ad-hoc performance tracking
 */
import { measureAsync } from '../logging.decorators.js';

export async function processAudioBatch(files: File[]) {
  // Measure the entire batch processing
  return measureAsync(
    'audio.batch.process',
    async () => {
      const results = [];

      for (const file of files) {
        // Measure individual file processing
        const result = await measureAsync(
          'audio.file.process',
          () => processFile(file),
          {
            tags: { fileName: file.name },
            threshold: 100, // Only log if takes > 100ms
          },
        );
        results.push(result);
      }

      return results;
    },
    {
      tags: { batchSize: files.length.toString() },
      threshold: 500, // Log if batch takes > 500ms
    },
  );
}

async function processFile(file: File): Promise<any> {
  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
  return { processed: true };
}

/**
 * Example 5: Complex component with multiple decorators
 */
export class AudioProcessingPipeline {
  private stages: string[] = ['load', 'parse', 'transform', 'output'];

  @LogMethod({ level: 'info', includeResult: true })
  @LogPerformance({ threshold: 1000 })
  @WithCorrelation()
  async process(input: { data: any; correlationId?: string }): Promise<any> {
    const results = {};

    for (const stage of this.stages) {
      results[stage] = await this.runStage(stage, input);
    }

    return results;
  }

  @LogMethod({ level: 'debug' })
  @LogErrors({
    recoveryStrategies: ['retry', 'skip', 'useDefault'],
    sanitize: true,
  })
  private async runStage(stage: string, input: any): Promise<any> {
    // Simulate stage processing
    if (Math.random() > 0.9) {
      throw new Error(`Stage ${stage} failed`);
    }

    return { stage, processed: true };
  }
}

/**
 * Example 6: Integration with existing structured logger
 */
import { createStructuredLogger } from '@bassnotion/contracts';

export class ComponentWithCustomLogger {
  private logger = createStructuredLogger('playback:CustomComponent');

  @LogMethod({
    level: 'info',
    // Use custom result sanitizer
    sanitizeResult: (result) => {
      if (result && typeof result === 'object' && 'secret' in result) {
        const { secret, ...safeResult } = result;
        return safeResult;
      }
      return result;
    },
  })
  async processWithSecret(): Promise<{ data: string; secret: string }> {
    // This method returns sensitive data that will be sanitized in logs
    return {
      data: 'public information',
      secret: 'this-should-not-be-logged',
    };
  }
}
