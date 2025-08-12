/**
 * Core Services Index
 * Story 3.18.2: Core Services Foundation
 * 
 * Central export point for all core services.
 * Import this to access the new FAANG-style architecture.
 */

// Main integration
export { CoreServices, createCoreServices, createCoreServicesWithPreInit, GlobalAudioSystem } from './CoreServices.js';
export type { CoreServicesConfig } from './CoreServices.js';

// Individual services
export { ServiceRegistry } from './ServiceRegistry.js';
export { EventBus } from './EventBus.js';
export { AudioEngine } from './AudioEngine.js';
export { UnifiedTransport } from './UnifiedTransport.js';
export { TransportSyncManager } from './TransportSyncManager.js';
export { PluginManager, registerExistingPlugins } from './PluginManager.js';

// Story 3.21 services
// Note: TrackManager is implemented as EnhancedTrackManagerProcessor in plugins directory
export { Track } from './Track.js';
export { TrackStateContainer } from './TrackStateContainer.js';
export { TrackMixingEngine } from './TrackMixingEngine.js';
export { OutputLatencyCompensation } from './OutputLatencyCompensation.js';
export { MultiTrackTimingSynchronizer } from './MultiTrackTimingSynchronizer.js';
export { TimingIsolationManager } from './TimingIsolationManager.js';

// Story 3.22 services - Professional DAW Sequencer
export { PatternScheduler } from './PatternScheduler.js';
export { PatternConverter } from './PatternConverter.js';
export type { SchedulableEvent } from './PatternConverter.js';

// Service types
export type { Service } from './ServiceRegistry.js';
export type { EventData, EventHandler, StoredEvent } from './EventBus.js';
export type { AudioEngineConfig, AudioSampler, SamplerConfig } from './AudioEngine.js';
export type { 
  TransportConfig, 
  MusicalPosition,
  TransportState,
  TimingEvent,
  TimingMetrics
} from './UnifiedTransport.js';
export type { PluginRegistration } from './PluginManager.js';

// Track types from Story 3.21
export type { TrackTimingMetrics, TrackHealthMetrics } from './MultiTrackTimingSynchronizer.js';
export type { LatencyReport, LatencyMeasurement } from './OutputLatencyCompensation.js';
export type { IsolatedTrack, IsolationReport } from './TimingIsolationManager.js';

// Error types
export { ServiceError } from './ServiceRegistry.js';
export { EventBusError } from './EventBus.js';
// export { AudioError as AudioEngineError } from './AudioEngine.js'; // AudioError doesn't exist in AudioEngine
export { TransportError } from './UnifiedTransport.js';
export { PluginError } from './PluginManager.js';
export { CoreServicesError } from './CoreServices.js';
