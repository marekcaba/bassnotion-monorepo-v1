// Transport Module
// Timeline, synchronization, and scheduling
// This module will be extracted from UnifiedTransport.ts

// Types (to be extracted from UnifiedTransport)
export type { 
  MusicalPosition,
  TransportPosition,
  TimeSignature,
  TransportState,
  TimingEvent,
  TimingMetrics,
  TransportConfig
} from './types/index.js';

// Core exports
export { Clock } from './core/Clock.js';
export { Timeline } from './core/Timeline.js';
export { Scheduler } from './core/Scheduler.js';
export type { SchedulerConfig } from './core/Scheduler.js';
export { Transport } from './core/Transport.js';

// Sync exports - Widget synchronization system
export { WidgetSyncManager } from './sync/index.js';
export type { 
  IWidgetSyncManager,
  SyncConfig,
  SyncMetrics,
  SyncClient,
  TransportStateSnapshot,
  SyncEventType,
  SyncEventData,
} from './sync/index.js';

// Pattern exports - Professional DAW-style pattern scheduling
export { 
  PatternScheduler,
  RegionManager,
  EventScheduler,
  PatternConverter,
} from './patterns/index.js';
export type {
  IPatternScheduler,
  PatternSchedulerConfig,
  PatternSchedulingMetrics,
  SchedulableEvent,
  ScheduledRegion,
  EventSchedulingResult,
  MusicalTimeOptions,
  LoopIteration,
  RegionActivationState,
  PatternSchedulerEvents,
} from './patterns/index.js';

// Error exports
export { TransportError } from './types/errors.js';