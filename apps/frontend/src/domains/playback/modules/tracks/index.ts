/**
 * Tracks Module
 *
 * Professional track-based DAW architecture with:
 * - Track management and lifecycle
 * - Regions and content organization
 * - Professional mixing and routing
 * - Bus architecture
 * - Automation support
 * - State management with undo/redo
 */

// Core track components
export { Track } from './core/Track.js';
export { TrackManager } from './core/TrackManager.js';
export { Region } from './core/Region.js';

// Mixing infrastructure
export { Mixer } from './mixing/Mixer.js';
export { Channel } from './mixing/Channel.js';
export { Bus } from './mixing/Bus.js';

// State management
export { TrackState } from './state/TrackState.js';
export { TrackStore } from './state/TrackStore.js';
export { TrackStateContainer } from './state/TrackStateContainer.js';

// Routing
export { Router } from './routing/Router.js';

// Automation
export { AutomationLane } from './automation/AutomationLane.js';
export { AutomationController } from './automation/AutomationController.js';

// Timing synchronization
export { TrackTimingSynchronizer } from './timing/index.js';
export type {
  TrackTimingState,
  TrackSyncMetrics,
  CrossTrackSyncReport,
  TimingSyncConfig,
  TrackRegistrationOptions,
  EventSchedulingOptions,
  ITrackTimingSynchronizer,
} from './timing/index.js';

// Track management
export type { InstrumentType } from './management/TrackManagerProcessor.js';
export { TrackManagerProcessor } from './management/TrackManagerProcessor.js';

// Types
export type {
  TrackConfig,
  TrackLifecycle,
  TrackMixingState,
  TrackRouting,
  TrackSyncConfig,
  TrackMetrics,
  TrackAutomation,
  TrackSend,
} from '../../types/track.js';

export type { RegionConfig } from './core/Region.js';

export type { TrackGroup, TrackTemplate } from './core/TrackManager.js';

export type {
  ChannelConfig,
  ChannelInsert,
  ChannelEQ,
  ChannelDynamics,
} from './mixing/Channel.js';

export type {
  BusType,
  BusConfig,
  BusDynamics,
  BusInsert,
} from './mixing/Bus.js';

export type {
  TrackChannel,
  MixBus,
  Send,
  MixingSnapshot,
} from './mixing/Mixer.js';

export type {
  TrackStateSnapshot,
  TrackStateConfig,
} from './state/TrackState.js';

export type {
  TrackStoreConfig,
  TrackStoreSnapshot,
  DerivedState,
} from './state/TrackStore.js';

export type {
  RouteType,
  RoutePoint,
  Route,
  RoutingMatrix,
  RouterConfig,
} from './routing/Router.js';

export type {
  AutomationMode,
  AutomationLaneConfig,
  AutomationRecordingState,
} from './automation/AutomationLane.js';

export type {
  AutomationParameter,
  AutomationSnapshot,
  AutomationControllerConfig,
} from './automation/AutomationController.js';
