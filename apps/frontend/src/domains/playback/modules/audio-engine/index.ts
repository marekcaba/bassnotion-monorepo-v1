/**
 * Audio Engine Module
 *
 * Modular audio engine for web-based audio applications.
 * Provides abstraction over Web Audio API and Tone.js.
 */

// Core exports
export { AudioEngine } from './core/AudioEngine.js';
export { AudioContextManager } from './core/AudioContextManager.js';
export { ToneWrapper } from './core/ToneWrapper.js';
export { AudioNodeManager } from './core/AudioNodeManager.js';

// Processor exports
export { EffectsChain } from './processors/EffectsChain.js';
export { MixerNode } from './processors/MixerNode.js';
export { VolumeControl } from './processors/VolumeControl.js';

// Type exports
export type {
  AudioEngineConfig,
  AudioContextState,
  AudioMetrics,
  SamplerConfig,
  AudioSampler,
  AudioNodeWrapper,
  EffectsConfig,
  BrowserInfo,
  ToneModule,
} from './types/index.js';

// Re-export specific processor types
export type { ChannelStrip, AuxBus } from './processors/MixerNode.js';
export type {
  VolumeScaling,
  VolumeAutomationPoint,
} from './processors/VolumeControl.js';
export type { EffectNode } from './processors/EffectsChain.js';
