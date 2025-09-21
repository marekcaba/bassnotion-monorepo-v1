/**
 * MIDI Pipeline Module
 *
 * Complete MIDI processing pipeline system
 */

// Core pipeline
export { MidiProcessingPipeline } from './MidiProcessingPipeline.js';
export type {
  PipelineStep,
  PipelineContext,
  ProcessStepResult,
  PipelineOptions,
  PipelineProgress,
  PipelineResult,
} from './MidiProcessingPipeline.js';

// Pipeline builder
export { MidiPipelineBuilder } from './MidiPipelineBuilder.js';
export type { BuilderOptions } from './MidiPipelineBuilder.js';

// Middleware system
export {
  MidiPipelineMiddleware,
  MiddlewareRunner,
} from './MidiPipelineMiddleware.js';
export type {
  Middleware,
  MiddlewareFunction,
  MiddlewareContext,
} from './MidiPipelineMiddleware.js';

// Preset pipelines
export { MidiPipelinePresets } from './MidiPipelinePresets.js';
export type { PresetOptions } from './MidiPipelinePresets.js';
