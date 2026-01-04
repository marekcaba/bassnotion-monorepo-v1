/**
 * Core Services Index
 * Story 3.18.2: Core Services Foundation
 *
 * Central export point for all core services.
 * Import this to access the new FAANG-style architecture.
 */

// Main integration
export {
  CoreServices,
  createCoreServices,
  createCoreServicesWithPreInit,
  GlobalAudioSystem,
} from './CoreServices.js';
export type { CoreServicesConfig } from './CoreServices.js';

// Individual services
export { ServiceRegistry } from './ServiceRegistry.js';
export { EventBus } from './EventBus.js';
// export { AudioEngine } from './AudioEngine.js'; // Moved to modules/audio-engine
export { AudioEngine } from '../../modules/audio-engine/core/AudioEngine.js';
export type { AudioEngineEvent } from '../../modules/audio-engine/core/AudioEngine.js';
// export { UnifiedTransport } from './UnifiedTransport.js'; // Replaced by TransportAdapter
export { TransportAdapter } from './TransportAdapter.js';
export { TransportAdapter as UnifiedTransport } from './TransportAdapter.js'; // Alias for backward compatibility
export { TransportSyncManager } from './TransportSyncManager.js';
export { PluginManager, registerExistingPlugins } from './PluginManager.js';

// BeatEmitter - Audio-synchronized visual beat events via Tone.Draw
export { BeatEmitter, getBeatEmitter } from './BeatEmitter.js';
export type { BeatEvent, BeatEmitterConfig } from './BeatEmitter.js';

// Story 3.21 services
// Note: TrackManager is implemented as EnhancedTrackManagerProcessor in plugins directory
export { Track } from './Track.js';
export { TrackStateContainer } from './TrackStateContainer.js';
export { TrackMixingEngine } from './TrackMixingEngine.js';
export { OutputLatencyCompensation } from './OutputLatencyCompensation.js';
export { MultiTrackTimingSynchronizer } from './MultiTrackTimingSynchronizer.js';
export { TimingIsolationManager } from './TimingIsolationManager.js';

// Story 3.22 services - Pattern generation removed (using MIDI files directly)

// Service types
export type { Service } from './ServiceRegistry.js';
export type { EventData, EventHandler } from './EventBus.js';
export type {
  AudioEngineConfig,
  AudioSampler,
  SamplerConfig,
} from '../../modules/audio-engine/types/index.js';
// Export transport types from the modular system
export type {
  TransportConfig,
  MusicalPosition,
  TransportState,
  TimingEvent,
  TimingMetrics,
} from '../../modules/transport/types/index.js';
export type { PluginRegistration } from './PluginManager.js';

// Track types from Story 3.21
export type { LatencyMeasurement } from './OutputLatencyCompensation.js';
export type {
  IsolatedTrackInfo,
  IsolationReport,
} from './TimingIsolationManager.js';

// Error types
export { ServiceError } from './ServiceRegistry.js';
export { EventBusError } from './EventBus.js';
// export { AudioError as AudioEngineError } from './AudioEngine.js'; // AudioError doesn't exist in AudioEngine
// export { TransportError } from './UnifiedTransport.js'; // Use errors from the modular system
export { PluginError } from './PluginManager.js';
export { CoreServicesError } from './CoreServices.js';
