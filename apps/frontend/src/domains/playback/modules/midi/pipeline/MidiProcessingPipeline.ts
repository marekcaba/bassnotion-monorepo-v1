/**
 * MIDI Processing Pipeline
 *
 * Orchestrates MIDI processing steps in a configurable pipeline
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { ParsedMidiFile } from '../parser/index.js';
import type { ComprehensiveValidationResult } from '../validators/index.js';
import { MidiValidationEngine } from '../validators/index.js';
import type { QuantizeResult } from '../transformers/index.js';
import type { TransposeResult } from '../transformers/index.js';
import type { VelocityResult } from '../transformers/index.js';
import type { TimeStretchResult } from '../transformers/index.js';

const logger = createStructuredLogger('MidiProcessingPipeline');

export interface PipelineStep {
  id: string;
  name: string;
  enabled: boolean;
  process: (
    file: ParsedMidiFile,
    context: PipelineContext,
  ) => Promise<ProcessStepResult>;
  options?: any;
}

export interface PipelineContext {
  originalFile: ParsedMidiFile;
  currentFile: ParsedMidiFile;
  stepResults: Map<string, ProcessStepResult>;
  metadata: Map<string, any>;
  options: PipelineOptions;
}

export interface ProcessStepResult {
  success: boolean;
  file: ParsedMidiFile;
  statistics?: any;
  errors?: string[];
  warnings?: string[];
  duration: number;
}

export interface PipelineOptions {
  // Stop on first error
  stopOnError?: boolean;

  // Validate between steps
  validateBetweenSteps?: boolean;

  // Save intermediate results
  saveIntermediateResults?: boolean;

  // Parallel processing for independent steps
  parallel?: boolean;

  // Custom error handler
  errorHandler?: (
    error: Error,
    step: PipelineStep,
    context: PipelineContext,
  ) => void;

  // Progress callback
  onProgress?: (progress: PipelineProgress) => void;
}

export interface PipelineProgress {
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  percentage: number;
}

export interface PipelineResult {
  success: boolean;
  file: ParsedMidiFile;
  steps: Map<string, ProcessStepResult>;
  totalDuration: number;
  errors: string[];
  warnings: string[];
}

/**
 * MIDI processing pipeline implementation
 */
export class MidiProcessingPipeline {
  private steps: PipelineStep[] = [];
  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = {
      stopOnError: true,
      validateBetweenSteps: false,
      saveIntermediateResults: false,
      parallel: false,
      ...options,
    };
  }

  /**
   * Add a processing step
   */
  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Remove a step by ID
   */
  removeStep(stepId: string): this {
    this.steps = this.steps.filter((s) => s.id !== stepId);
    return this;
  }

  /**
   * Enable/disable a step
   */
  setStepEnabled(stepId: string, enabled: boolean): this {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) {
      step.enabled = enabled;
    }
    return this;
  }

  /**
   * Clear all steps
   */
  clear(): this {
    this.steps = [];
    return this;
  }

  /**
   * Process a MIDI file through the pipeline
   */
  async process(file: ParsedMidiFile): Promise<PipelineResult> {
    const startTime = performance.now();
    const enabledSteps = this.steps.filter((s) => s.enabled);

    logger.info('Starting pipeline processing', {
      steps: enabledSteps.map((s) => s.name),
      options: this.options,
    });

    // Initialize context
    const context: PipelineContext = {
      originalFile: this.cloneFile(file),
      currentFile: this.cloneFile(file),
      stepResults: new Map(),
      metadata: new Map(),
      options: this.options,
    };

    // Result tracking
    const errors: string[] = [];
    const warnings: string[] = [];
    let success = true;

    // Process steps
    if (this.options.parallel) {
      // Process independent steps in parallel
      await this.processParallel(enabledSteps, context, errors, warnings);
    } else {
      // Process steps sequentially
      for (let i = 0; i < enabledSteps.length; i++) {
        const step = enabledSteps[i];

        // Progress callback
        if (this.options.onProgress) {
          this.options.onProgress({
            currentStep: step.name,
            completedSteps: i,
            totalSteps: enabledSteps.length,
            percentage: (i / enabledSteps.length) * 100,
          });
        }

        try {
          const stepStart = performance.now();
          const result = await step.process(context.currentFile, context);
          result.duration = performance.now() - stepStart;

          context.stepResults.set(step.id, result);

          if (result.success) {
            context.currentFile = result.file;
            if (result.warnings) warnings.push(...result.warnings);
          } else {
            success = false;
            if (result.errors) errors.push(...result.errors);
            if (this.options.stopOnError) {
              logger.error('Pipeline stopped due to error', {
                step: step.name,
              });
              break;
            }
          }

          // Validate between steps if requested
          if (
            this.options.validateBetweenSteps &&
            i < enabledSteps.length - 1
          ) {
            await this.validateIntermediateResult(context, step.name);
          }
        } catch (error) {
          logger.error('Step failed', error, { step: step.name });

          if (this.options.errorHandler) {
            this.options.errorHandler(error as Error, step, context);
          }

          success = false;
          errors.push(`Step '${step.name}' failed: ${error.message}`);

          if (this.options.stopOnError) {
            break;
          }
        }
      }
    }

    // Final progress callback
    if (this.options.onProgress) {
      this.options.onProgress({
        currentStep: 'Complete',
        completedSteps: enabledSteps.length,
        totalSteps: enabledSteps.length,
        percentage: 100,
      });
    }

    const totalDuration = performance.now() - startTime;

    logger.info('Pipeline processing complete', {
      success,
      duration: totalDuration,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      success,
      file: context.currentFile,
      steps: context.stepResults,
      totalDuration,
      errors,
      warnings,
    };
  }

  /**
   * Process independent steps in parallel
   */
  private async processParallel(
    steps: PipelineStep[],
    context: PipelineContext,
    errors: string[],
    warnings: string[],
  ): Promise<void> {
    // Group steps by dependencies
    const independentGroups = this.groupIndependentSteps(steps);

    for (const group of independentGroups) {
      const promises = group.map(async (step) => {
        try {
          const stepContext = {
            ...context,
            currentFile: this.cloneFile(context.currentFile),
          };

          const result = await step.process(
            stepContext.currentFile,
            stepContext,
          );
          return { step, result, error: null };
        } catch (error) {
          return { step, result: null, error };
        }
      });

      const results = await Promise.all(promises);

      // Process results
      for (const { step, result, error } of results) {
        if (error) {
          errors.push(`Step '${step.name}' failed: ${error.message}`);
          if (this.options.errorHandler) {
            this.options.errorHandler(error as Error, step, context);
          }
        } else if (result) {
          context.stepResults.set(step.id, result);
          if (result.warnings) warnings.push(...result.warnings);
          if (result.errors) errors.push(...result.errors);

          // For parallel processing, we need to merge results
          // This is a simplified approach - real implementation would need
          // to handle conflicts and dependencies
          if (result.success) {
            context.currentFile = result.file;
          }
        }
      }
    }
  }

  /**
   * Group steps that can be processed independently
   */
  private groupIndependentSteps(steps: PipelineStep[]): PipelineStep[][] {
    // Simplified grouping - in a real implementation, this would
    // analyze dependencies between steps
    const groups: PipelineStep[][] = [];

    for (const step of steps) {
      // For now, each step is its own group (sequential)
      groups.push([step]);
    }

    return groups;
  }

  /**
   * Validate intermediate result
   */
  private async validateIntermediateResult(
    context: PipelineContext,
    afterStep: string,
  ): Promise<void> {
    const validation = MidiValidationEngine.validate(context.currentFile, {
      validateFormat: true,
      validateEvents: true,
      validateTiming: false, // Skip timing validation for performance
    });

    if (!validation.valid) {
      logger.warn('Validation issues after step', {
        step: afterStep,
        errors: validation.summary.totalErrors,
        warnings: validation.summary.totalWarnings,
      });
    }
  }

  /**
   * Clone a MIDI file
   */
  private cloneFile(file: ParsedMidiFile): ParsedMidiFile {
    return {
      header: { ...file.header },
      tracks: file.tracks.map((track) => ({
        ...track,
        events: track.events.map((event) => ({
          ...event,
          data: event.data ? [...event.data] : undefined,
        })),
      })),
    };
  }

  /**
   * Get pipeline configuration
   */
  getConfiguration(): {
    steps: Array<{ id: string; name: string; enabled: boolean; options?: any }>;
    options: PipelineOptions;
  } {
    return {
      steps: this.steps.map((s) => ({
        id: s.id,
        name: s.name,
        enabled: s.enabled,
        options: s.options,
      })),
      options: this.options,
    };
  }

  /**
   * Load configuration
   */
  loadConfiguration(config: {
    steps: Array<{ id: string; enabled: boolean; options?: any }>;
    options?: Partial<PipelineOptions>;
  }): this {
    // Update step configuration
    for (const stepConfig of config.steps) {
      const step = this.steps.find((s) => s.id === stepConfig.id);
      if (step) {
        step.enabled = stepConfig.enabled;
        if (stepConfig.options) {
          step.options = stepConfig.options;
        }
      }
    }

    // Update pipeline options
    if (config.options) {
      this.options = { ...this.options, ...config.options };
    }

    return this;
  }
}
