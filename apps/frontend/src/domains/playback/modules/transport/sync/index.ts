/**
 * Transport Sync Module
 * 
 * Provides widget synchronization capabilities for the transport system.
 * Extracted from TransportSyncManager to maintain critical functionality.
 */

export { WidgetSyncManager } from './WidgetSyncManager';
export { HeartbeatMonitor } from './HeartbeatMonitor';
export { BroadcastManager } from './BroadcastManager';

export type {
  // Core types
  IWidgetSyncManager,
  SyncConfig,
  SyncMetrics,
  SyncClient,
  TransportStateSnapshot,
  
  // Event types
  SyncEventType,
  SyncEventData,
  
  // Broadcast types
  BroadcastEvent,
  
  // Metrics types
  HeartbeatMetrics,
} from './types';

export { SyncEventType } from './types';