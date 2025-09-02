/**
 * Widget Sync Manager
 * 
 * Core synchronization system for widgets, extracted from TransportSyncManager.
 * Provides widget registration, heartbeat monitoring, and state broadcasting
 * while maintaining backward compatibility.
 */

import { EventEmitter } from 'events';
import type { Transport } from '../core/Transport';
import type { EventBus } from '../../../../services/core/EventBus';
import { HeartbeatMonitor } from './HeartbeatMonitor';
import { BroadcastManager } from './BroadcastManager';
import type {
  IWidgetSyncManager,
  SyncConfig,
  SyncMetrics,
  SyncClient,
  TransportStateSnapshot,
  SyncEventType,
  SyncEventData,
} from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('WidgetSyncManager');

export class WidgetSyncManager extends EventEmitter implements IWidgetSyncManager {
  private static instance: WidgetSyncManager | null = null;
  
  private config: SyncConfig = {
    heartbeatInterval: 1000,      // 1 second for client health checks
    reconnectDelay: 1000,         // 1 second reconnect delay
    maxReconnectAttempts: 5,      // Max reconnection attempts
    batchSize: 10,                // Batch size for events
    throttleMs: 16,               // ~60fps throttling for UI updates
  };
  
  private heartbeatMonitor: HeartbeatMonitor;
  private broadcastManager: BroadcastManager;
  private transport: Transport | null = null;
  private eventBus: EventBus | null = null;
  private eventUnsubscribers: Array<() => void> = [];
  
  private metrics: SyncMetrics = {
    totalHeartbeats: 0,
    missedHeartbeats: 0,
    reconnections: 0,
    avgLatency: 0,
    connectedClients: 0,
    lastSyncTime: 0,
  };
  
  private constructor() {
    super();
    
    // Initialize heartbeat monitor
    this.heartbeatMonitor = new HeartbeatMonitor(
      this.config,
      this.onHeartbeat.bind(this),
      this.onDeadClient.bind(this),
      this.onReconnectAttempt.bind(this)
    );
    
    // Initialize broadcast manager
    this.broadcastManager = new BroadcastManager(this.config);
    
    // Forward broadcast manager events
    this.broadcastManager.on('broadcast', (message) => {
      this.emit('broadcast', message);
      this.metrics.lastSyncTime = Date.now();
    });
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): WidgetSyncManager {
    if (!WidgetSyncManager.instance) {
      WidgetSyncManager.instance = new WidgetSyncManager();
    }
    return WidgetSyncManager.instance;
  }
  
  /**
   * Initialize with Transport and EventBus
   */
  initialize(transport: Transport, eventBus: EventBus): void {
    this.transport = transport;
    this.eventBus = eventBus;
    
    // Clean up any existing listeners
    this.cleanup();
    
    // Subscribe to transport events via EventBus
    this.setupTransportListeners();
    
    // Start heartbeat monitoring
    this.heartbeatMonitor.start();
    
    logger.info('🔄 WidgetSyncManager initialized with Transport');
  }
  
  /**
   * Register a client for sync updates
   */
  registerClient(clientId: string): void {
    this.heartbeatMonitor.registerClient(clientId);
    this.metrics.connectedClients = this.heartbeatMonitor.getClients().size;
    
    // Send initial state
    const snapshot = this.getTransportSnapshot();
    if (snapshot) {
      this.broadcastManager.sendToClient(
        clientId,
        'SYNC_INIT' as SyncEventType,
        {
          ...snapshot,
          config: this.config,
        } as SyncEventData[SyncEventType.SYNC_INIT]
      );
    }
    
    this.emit('client:connected', { clientId });
    logger.info(`📡 Widget registered: ${clientId} (Total: ${this.metrics.connectedClients})`);
  }
  
  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.heartbeatMonitor.unregisterClient(clientId);
    this.metrics.connectedClients = this.heartbeatMonitor.getClients().size;
    this.emit('client:disconnected', { clientId });
    logger.info(`📡 Widget unregistered: ${clientId} (Total: ${this.metrics.connectedClients})`);
  }
  
  /**
   * Handle client heartbeat response
   */
  handleClientHeartbeat(clientId: string, clientTimestamp: number): void {
    this.heartbeatMonitor.updateClientHeartbeat(clientId, clientTimestamp);
    this.metrics.avgLatency = this.heartbeatMonitor.getAverageLatency();
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.heartbeatMonitor.updateConfig(config);
    this.broadcastManager.updateConfig(config);
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    const heartbeatMetrics = this.heartbeatMonitor.getMetrics();
    return {
      ...this.metrics,
      totalHeartbeats: heartbeatMetrics.totalHeartbeats,
      missedHeartbeats: heartbeatMetrics.missedHeartbeats,
      reconnections: heartbeatMetrics.reconnections,
    };
  }
  
  /**
   * Get connected clients
   */
  getConnectedClients(): Array<{ id: string; latency: number; connected: boolean }> {
    const clients = this.heartbeatMonitor.getClients();
    return Array.from(clients.values()).map(client => ({
      id: client.id,
      latency: client.latency,
      connected: client.connected,
    }));
  }
  
  /**
   * Force sync all clients with current state
   */
  forceSync(): void {
    const snapshot = this.getTransportSnapshot();
    if (!snapshot) return;
    
    const clients = this.heartbeatMonitor.getClients();
    this.broadcastManager.broadcast(
      'FORCE_SYNC' as SyncEventType,
      snapshot as SyncEventData[SyncEventType.FORCE_SYNC],
      clients
    );
  }
  
  /**
   * Set up listeners for transport events
   */
  private setupTransportListeners(): void {
    if (!this.eventBus) return;
    
    const clients = this.heartbeatMonitor.getClients();
    
    // Transport state changes
    const unsubStart = this.eventBus.on('transport:start', (data) => {
      this.broadcastManager.broadcast(
        'TRANSPORT_START' as SyncEventType,
        {
          position: data.position,
          tempo: data.tempo,
          timeSignature: data.timeSignature,
        } as SyncEventData[SyncEventType.TRANSPORT_START],
        clients
      );
    });
    
    const unsubStop = this.eventBus.on('transport:stop', (data) => {
      this.broadcastManager.broadcast(
        'TRANSPORT_STOP' as SyncEventType,
        { position: data.position } as SyncEventData[SyncEventType.TRANSPORT_STOP],
        clients
      );
    });
    
    const unsubPause = this.eventBus.on('transport:pause', (data) => {
      this.broadcastManager.broadcast(
        'TRANSPORT_PAUSE' as SyncEventType,
        { position: data.position } as SyncEventData[SyncEventType.TRANSPORT_PAUSE],
        clients
      );
    });
    
    const unsubResume = this.eventBus.on('transport:resume', (data) => {
      this.broadcastManager.broadcast(
        'TRANSPORT_RESUME' as SyncEventType,
        { position: data.position } as SyncEventData[SyncEventType.TRANSPORT_RESUME],
        clients
      );
    });
    
    const unsubSeek = this.eventBus.on('transport:seek', (data) => {
      this.broadcastManager.broadcast(
        'TRANSPORT_SEEK' as SyncEventType,
        { position: data.position } as SyncEventData[SyncEventType.TRANSPORT_SEEK],
        clients
      );
    });
    
    // Parameter changes
    const unsubTempo = this.eventBus.on('transport:tempo-change', (data) => {
      this.broadcastManager.broadcast(
        'TEMPO_CHANGE' as SyncEventType,
        { tempo: data.tempo } as SyncEventData[SyncEventType.TEMPO_CHANGE],
        clients
      );
    });
    
    const unsubTimeSig = this.eventBus.on('transport:time-signature-change', (data) => {
      this.broadcastManager.broadcast(
        'TIME_SIGNATURE_CHANGE' as SyncEventType,
        { timeSignature: data.timeSignature } as SyncEventData[SyncEventType.TIME_SIGNATURE_CHANGE],
        clients
      );
    });
    
    const unsubLoop = this.eventBus.on('transport:loop-change', (data) => {
      this.broadcastManager.broadcast(
        'LOOP_CHANGE' as SyncEventType,
        {
          enabled: data.enabled,
          start: data.start,
          end: data.end,
        } as SyncEventData[SyncEventType.LOOP_CHANGE],
        clients
      );
    });
    
    // High-frequency timing updates (throttled)
    const unsubTiming = this.eventBus.on('transport:timing-update', (data) => {
      this.broadcastManager.throttledBroadcast(
        'POSITION_UPDATE' as SyncEventType,
        {
          time: data.time,
          position: data.position,
          metrics: data.metrics,
        } as SyncEventData[SyncEventType.POSITION_UPDATE],
        clients
      );
    });
    
    // Store unsubscribers
    this.eventUnsubscribers = [
      unsubStart,
      unsubStop,
      unsubPause,
      unsubResume,
      unsubSeek,
      unsubTempo,
      unsubTimeSig,
      unsubLoop,
      unsubTiming,
    ];
  }
  
  /**
   * Get current transport state snapshot
   */
  private getTransportSnapshot(): TransportStateSnapshot | null {
    if (!this.transport) return null;
    
    return {
      state: this.transport.getState(),
      position: this.transport.getPosition(),
      tempo: this.transport.getTempo(),
      loop: this.transport.isLooping(),
      loopStart: this.transport.getLoopStart(),
      loopEnd: this.transport.getLoopEnd(),
      metrics: this.transport.getMetrics(),
      timestamp: Date.now(),
    };
  }
  
  /**
   * Handle heartbeat event
   */
  private onHeartbeat(clients: Map<string, SyncClient>): void {
    const snapshot = this.getTransportSnapshot();
    if (!snapshot) return;
    
    const heartbeatData: SyncEventData[SyncEventType.HEARTBEAT] = {
      timestamp: Date.now(),
      transportSnapshot: snapshot,
      serverTime: Date.now(),
    };
    
    this.broadcastManager.broadcast(
      'HEARTBEAT' as SyncEventType,
      heartbeatData,
      clients
    );
  }
  
  /**
   * Handle dead client detection
   */
  private onDeadClient(clientId: string): void {
    logger.warn(`💀 Removing unresponsive widget: ${clientId}`);
    this.unregisterClient(clientId);
  }
  
  /**
   * Handle reconnection attempt
   */
  private onReconnectAttempt(clientId: string, attempt: number): void {
    logger.info(`🔄 Attempting to reconnect widget: ${clientId} (attempt ${attempt})`);
    
    this.broadcastManager.sendToClient(
      clientId,
      'RECONNECT' as SyncEventType,
      {
        attempt,
        maxAttempts: this.config.maxReconnectAttempts,
      } as SyncEventData[SyncEventType.RECONNECT]
    );
  }
  
  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Unsubscribe from all events
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
    
    // Force flush any pending broadcasts
    this.broadcastManager.forceFlush();
  }
  
  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.cleanup();
    this.heartbeatMonitor.dispose();
    this.broadcastManager.dispose();
    this.removeAllListeners();
    
    // Clear singleton
    WidgetSyncManager.instance = null;
  }
  
  // Backward compatibility: acknowledge heartbeat method
  acknowledgeHeartbeat(clientId: string, timestamp: number): void {
    this.handleClientHeartbeat(clientId, timestamp);
  }
}