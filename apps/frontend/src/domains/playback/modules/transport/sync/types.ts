/**
 * Widget Synchronization Types
 * 
 * Extracted from TransportSyncManager to provide widget synchronization
 * capabilities within the modular transport system.
 */

import type { TransportState, MusicalPosition, TimingMetrics } from '../types';

/**
 * Configuration for sync manager
 */
export interface SyncConfig {
  heartbeatInterval: number;      // Client health check interval (ms)
  reconnectDelay: number;         // Delay before reconnection attempt (ms)
  maxReconnectAttempts: number;   // Maximum reconnection attempts
  batchSize: number;              // Event batch size
  throttleMs: number;             // Throttle interval for high-frequency events (ms)
}

/**
 * Metrics for sync performance
 */
export interface SyncMetrics {
  totalHeartbeats: number;
  missedHeartbeats: number;
  reconnections: number;
  avgLatency: number;
  connectedClients: number;
  lastSyncTime: number;
}

/**
 * Snapshot of transport state for synchronization
 */
export interface TransportStateSnapshot {
  state: TransportState;
  position: MusicalPosition;
  tempo: number;
  loop: boolean;
  loopStart: MusicalPosition;
  loopEnd: MusicalPosition;
  metrics: TimingMetrics;
  timestamp: number;
}

/**
 * Connected sync client information
 */
export interface SyncClient {
  id: string;
  lastHeartbeat: number;
  missedHeartbeats: number;
  latency: number;
  connected: boolean;
}

/**
 * Sync event types
 */
export enum SyncEventType {
  // Transport events
  TRANSPORT_START = 'TRANSPORT_START',
  TRANSPORT_STOP = 'TRANSPORT_STOP',
  TRANSPORT_PAUSE = 'TRANSPORT_PAUSE',
  TRANSPORT_RESUME = 'TRANSPORT_RESUME',
  TRANSPORT_SEEK = 'TRANSPORT_SEEK',
  
  // State events
  POSITION_UPDATE = 'POSITION_UPDATE',
  TEMPO_CHANGE = 'TEMPO_CHANGE',
  TIME_SIGNATURE_CHANGE = 'TIME_SIGNATURE_CHANGE',
  LOOP_CHANGE = 'LOOP_CHANGE',
  
  // Client events
  HEARTBEAT = 'HEARTBEAT',
  BATCH_UPDATE = 'BATCH_UPDATE',
  SYNC_INIT = 'SYNC_INIT',
  RECONNECT = 'RECONNECT',
  FORCE_SYNC = 'FORCE_SYNC',
}

/**
 * Event data structures
 */
export interface SyncEventData {
  [SyncEventType.TRANSPORT_START]: {
    position: MusicalPosition;
    tempo: number;
    timeSignature: { numerator: number; denominator: number };
  };
  
  [SyncEventType.TRANSPORT_STOP]: {
    position: MusicalPosition;
  };
  
  [SyncEventType.TRANSPORT_PAUSE]: {
    position: MusicalPosition;
  };
  
  [SyncEventType.TRANSPORT_RESUME]: {
    position: MusicalPosition;
  };
  
  [SyncEventType.TRANSPORT_SEEK]: {
    position: MusicalPosition;
  };
  
  [SyncEventType.POSITION_UPDATE]: {
    time: number;
    position: MusicalPosition;
    metrics: TimingMetrics;
  };
  
  [SyncEventType.TEMPO_CHANGE]: {
    tempo: number;
  };
  
  [SyncEventType.TIME_SIGNATURE_CHANGE]: {
    timeSignature: { numerator: number; denominator: number };
  };
  
  [SyncEventType.LOOP_CHANGE]: {
    enabled: boolean;
    start: MusicalPosition;
    end: MusicalPosition;
  };
  
  [SyncEventType.HEARTBEAT]: {
    timestamp: number;
    transportSnapshot: TransportStateSnapshot;
    serverTime: number;
  };
  
  [SyncEventType.BATCH_UPDATE]: Array<{
    type: string;
    data: any;
  }>;
  
  [SyncEventType.SYNC_INIT]: TransportStateSnapshot & {
    config: SyncConfig;
  };
  
  [SyncEventType.RECONNECT]: {
    attempt: number;
    maxAttempts: number;
  };
  
  [SyncEventType.FORCE_SYNC]: TransportStateSnapshot;
}

/**
 * Widget sync manager interface
 */
export interface IWidgetSyncManager {
  // Client management
  registerClient(clientId: string): void;
  unregisterClient(clientId: string): void;
  handleClientHeartbeat(clientId: string, clientTimestamp: number): void;
  
  // Configuration
  updateConfig(config: Partial<SyncConfig>): void;
  
  // Metrics
  getMetrics(): SyncMetrics;
  getConnectedClients(): Array<{
    id: string;
    latency: number;
    connected: boolean;
  }>;
  
  // Control
  forceSync(): void;
  dispose(): void;
}