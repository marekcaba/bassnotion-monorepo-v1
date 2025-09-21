/**
 * MIDI Pipeline Builder
 *
 * Fluent API for building MIDI processing pipelines
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import { MidiProcessingPipeline } from './MidiProcessingPipeline.js';
import type {
  PipelineStep,
  PipelineOptions,
} from './MidiProcessingPipeline.js';
import type { ParsedMidiFile } from '../parser/index.js';
import {
  MidiValidationEngine,
  MidiQuantizer,
  MidiTransposer,
  MidiVelocityProcessor,
  MidiTimeStretchProcessor,
} from '../index.js';
import type {
  ValidationOptions,
  QuantizeOptions,
  TransposeOptions,
  VelocityOptions,
  TimeStretchOptions,
} from '../index.js';

const logger = createStructuredLogger('MidiPipelineBuilder');

export interface BuilderOptions extends PipelineOptions {
  name?: string;
  description?: string;
}

/**
 * Fluent builder for MIDI processing pipelines
 */
export class MidiPipelineBuilder {
  private pipeline: MidiProcessingPipeline;
  private options: BuilderOptions;
  private stepCounter = 0;

  constructor(options: BuilderOptions = {}) {
    this.options = options;
    this.pipeline = new MidiProcessingPipeline(options);
  }

  /**
   * Add validation step
   */
  validate(options?: ValidationOptions): this {
    const stepId = `validate-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Validation',
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const result = MidiValidationEngine.validate(file, options);

          return {
            success: result.valid,
            file,
            statistics: result.summary,
            errors: result.valid ? [] : ['Validation failed'],
            warnings: result.recommendations,
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Validation step failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add quantization step
   */
  quantize(options: QuantizeOptions): this {
    const stepId = `quantize-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Quantization',
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const result = MidiQuantizer.quantize(file, options);

          return {
            success: true,
            file: result.quantizedFile,
            statistics: result.statistics,
            errors: [],
            warnings: [],
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Quantization step failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add transposition step
   */
  transpose(options: TransposeOptions): this {
    const stepId = `transpose-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Transposition',
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const result = MidiTransposer.transpose(file, options);
          const warnings: string[] = [];

          if (result.statistics.outOfRangeNotes > 0) {
            warnings.push(
              `${result.statistics.outOfRangeNotes} notes were clamped to valid MIDI range`,
            );
          }

          return {
            success: true,
            file: result.transposedFile,
            statistics: result.statistics,
            errors: [],
            warnings,
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Transposition step failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add velocity processing step
   */
  processVelocity(options: VelocityOptions): this {
    const stepId = `velocity-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Velocity Processing',
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const result = MidiVelocityProcessor.processVelocity(file, options);

          return {
            success: true,
            file: result.processedFile,
            statistics: result.statistics,
            errors: [],
            warnings: [],
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Velocity processing step failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add time stretch step
   */
  timeStretch(options: TimeStretchOptions): this {
    const stepId = `timestretch-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Time Stretch',
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const result = MidiTimeStretchProcessor.stretch(file, options);

          return {
            success: true,
            file: result.stretchedFile,
            statistics: result.statistics,
            errors: [],
            warnings: [],
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Time stretch step failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add custom processing step
   */
  addCustomStep(
    name: string,
    processor: (file: ParsedMidiFile, options?: any) => Promise<ParsedMidiFile>,
    options?: any,
  ): this {
    const stepId = `custom-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name,
      enabled: true,
      options,
      process: async (file) => {
        const startTime = performance.now();

        try {
          const processedFile = await processor(file, options);

          return {
            success: true,
            file: processedFile,
            statistics: {},
            errors: [],
            warnings: [],
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error(`Custom step '${name}' failed`, error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Add conditional step
   */
  conditional(
    condition: (file: ParsedMidiFile) => boolean,
    ifTrue: (builder: MidiPipelineBuilder) => void,
    ifFalse?: (builder: MidiPipelineBuilder) => void,
  ): this {
    const stepId = `conditional-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Conditional',
      enabled: true,
      process: async (file, context) => {
        const conditionResult = condition(file);

        logger.info('Conditional step', {
          condition: conditionResult,
          step: stepId,
        });

        if (conditionResult) {
          const subBuilder = new MidiPipelineBuilder();
          ifTrue(subBuilder);
          const subPipeline = subBuilder.build();
          const result = await subPipeline.process(file);

          return {
            success: result.success,
            file: result.file,
            statistics: { branch: 'true' },
            errors: result.errors,
            warnings: result.warnings,
            duration: result.totalDuration,
          };
        } else if (ifFalse) {
          const subBuilder = new MidiPipelineBuilder();
          ifFalse(subBuilder);
          const subPipeline = subBuilder.build();
          const result = await subPipeline.process(file);

          return {
            success: result.success,
            file: result.file,
            statistics: { branch: 'false' },
            errors: result.errors,
            warnings: result.warnings,
            duration: result.totalDuration,
          };
        }

        // No else branch, pass through
        return {
          success: true,
          file,
          statistics: { branch: 'none' },
          errors: [],
          warnings: [],
          duration: 0,
        };
      },
    });

    return this;
  }

  /**
   * Add parallel processing branches
   */
  parallel(
    branches: Array<(builder: MidiPipelineBuilder) => void>,
    merger?: (results: ParsedMidiFile[]) => ParsedMidiFile,
  ): this {
    const stepId = `parallel-${++this.stepCounter}`;

    this.pipeline.addStep({
      id: stepId,
      name: 'Parallel Processing',
      enabled: true,
      process: async (file) => {
        const startTime = performance.now();

        try {
          // Create sub-pipelines for each branch
          const branchPromises = branches.map(
            async (configureBranch, index) => {
              const branchBuilder = new MidiPipelineBuilder();
              configureBranch(branchBuilder);
              const branchPipeline = branchBuilder.build();

              logger.info(`Processing parallel branch ${index + 1}`);
              return branchPipeline.process(file);
            },
          );

          // Execute branches in parallel
          const results = await Promise.all(branchPromises);

          // Check for failures
          const failedBranches = results.filter((r) => !r.success);
          if (failedBranches.length > 0) {
            return {
              success: false,
              file,
              statistics: { failedBranches: failedBranches.length },
              errors: failedBranches.flatMap((r) => r.errors),
              warnings: results.flatMap((r) => r.warnings),
              duration: performance.now() - startTime,
            };
          }

          // Merge results
          const processedFiles = results.map((r) => r.file);
          const mergedFile = merger
            ? merger(processedFiles)
            : processedFiles[0];

          return {
            success: true,
            file: mergedFile,
            statistics: { branches: branches.length },
            errors: [],
            warnings: results.flatMap((r) => r.warnings),
            duration: performance.now() - startTime,
          };
        } catch (error) {
          logger.error('Parallel processing failed', error);
          throw error;
        }
      },
    });

    return this;
  }

  /**
   * Configure pipeline options
   */
  withOptions(options: Partial<PipelineOptions>): this {
    this.options = { ...this.options, ...options };
    this.pipeline = new MidiProcessingPipeline(this.options);
    return this;
  }

  /**
   * Build the pipeline
   */
  build(): MidiProcessingPipeline {
    logger.info('Building pipeline', {
      name: this.options.name,
      steps: this.pipeline.getConfiguration().steps.length,
    });

    return this.pipeline;
  }

  /**
   * Create common preset pipelines
   */
  static presets = {
    // Clean up MIDI file
    cleanup: () =>
      new MidiPipelineBuilder({ name: 'MIDI Cleanup' })
        .validate()
        .quantize({ resolution: 16, strength: 50, humanize: 10 })
        .processVelocity(MidiVelocityProcessor.presets.consistent()),

    // Prepare for performance
    performance: () =>
      new MidiPipelineBuilder({ name: 'Performance Preparation' })
        .validate({ validateTiming: true })
        .quantize({ resolution: 32, strength: 80 })
        .processVelocity(MidiVelocityProcessor.presets.punchy())
        .timeStretch({ factor: 1.0, adjustTempo: true }),

    // Humanize robotic MIDI
    humanize: () =>
      new MidiPipelineBuilder({ name: 'Humanization' })
        .quantize({ resolution: 16, strength: 60, swing: 15, humanize: 20 })
        .processVelocity(MidiVelocityProcessor.presets.humanize()),

    // Transpose and normalize
    transposeAndNormalize: (semitones: number) =>
      new MidiPipelineBuilder({ name: 'Transpose and Normalize' })
        .transpose({ semitones })
        .processVelocity({ scale: 1.0, min: 40, max: 100 }),
  };
}
