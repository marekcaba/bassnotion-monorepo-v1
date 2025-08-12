import { EventEmitter } from 'events';
import type { UnifiedTransport, TransportState, MusicalPosition, TimingMetrics } from './UnifiedTransport.js';
import type { EventBus } from './EventBus.js';
import type { Service, ServiceRegistry } from './ServiceRegistry.js';

/**
 * Transport Synchronization Manager - Refactored
 * 
 * Now serves as a pure broadcast layer for UnifiedTransport state.
 * No longer manages its own timing - uses UnifiedTransport as the master clock.
 * 
 * Responsibilities:
 * - Widget registration and heartbeat
 * - Broadcasting transport state changes
 * - Client connection management
 * - Event batching and throttling
 * 
 * NOT responsible for:
 * - Timing or clock management (handled by UnifiedTransport)
 * - Transport control (handled by UnifiedTransport)
 * - State management (handled by UnifiedTransport)
 */

interface SyncConfig {
  heartbeatInterval: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  batchSize: number;
  throttleMs: number;
}

interface SyncMetrics {
  totalHeartbeats: number;
  missedHeartbeats: number;
  reconnections: number;
  avgLatency: number;
  connectedClients: number;
  lastSyncTime: number;
}

interface TransportStateSnapshot {
  state: TransportState;
  position: MusicalPosition;
  tempo: number;
  loop: boolean;
  loopStart: MusicalPosition;
  loopEnd: MusicalPosition;
  metrics: TimingMetrics;
  timestamp: number;
}

interface SyncClient {
  id: string;
  lastHeartbeat: number;
  missedHeartbeats: number;
  latency: number;
  connected: boolean;
}

export class TransportSyncManager extends EventEmitter {
  private static instance: TransportSyncManager;
  
  private config: SyncConfig = {
    heartbeatInterval: 1000,      // 1 second for client health checks
    reconnectDelay: 1000,         // 1 second reconnect delay
    maxReconnectAttempts: 5,      // Max reconnection attempts
    batchSize: 10,                // Batch size for events
    throttleMs: 16                // ~60fps throttling for UI updates
  };

  private clients = new Map<string, SyncClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private eventQueue: Array<{ type: string; data: any }> = [];
  private lastBroadcastTime = 0;
  private metrics: SyncMetrics = {
    totalHeartbeats: 0,
    missedHeartbeats: 0,
    reconnections: 0,
    avgLatency: 0,
    connectedClients: 0,
    lastSyncTime: 0
  };

  private unifiedTransport: UnifiedTransport | null = null;
  private eventBus: EventBus | null = null;
  private eventUnsubscribers: Array<() => void> = [];
  private registry: ServiceRegistry | null = null;

  private constructor() {
    super();
  }

  static getInstance(): TransportSyncManager {
    if (!TransportSyncManager.instance) {
      TransportSyncManager.instance = new TransportSyncManager();
    }
    return TransportSyncManager.instance;
  }

  /**
   * Initialize with UnifiedTransport and EventBus
   * This replaces the old direct Tone.js integration
   */
  initialize(unifiedTransport: UnifiedTransport, eventBus: EventBus): void {
    this.unifiedTransport = unifiedTransport;
    this.eventBus = eventBus;
    
    // Clean up any existing listeners
    this.cleanup();
    
    // Subscribe to UnifiedTransport events via EventBus
    this.setupTransportListeners();
    
    // Start heartbeat for client health monitoring
    this.startHeartbeat();
    
    console.log('🔄 TransportSyncManager initialized with UnifiedTransport');
  }

  /**
   * Set up listeners for UnifiedTransport events
   */
  private setupTransportListeners(): void {
    if (!this.eventBus) return;
    
    // Listen to transport state changes
    const unsubStart = this.eventBus.on('transport:start', (data) => {
      this.broadcast('TRANSPORT_START', {
        position: data.position,
        tempo: data.tempo,
        timeSignature: data.timeSignature
      });
    });
    
    const unsubStop = this.eventBus.on('transport:stop', (data) => {
      this.broadcast('TRANSPORT_STOP', {
        position: data.position
      });
    });
    
    const unsubPause = this.eventBus.on('transport:pause', (data) => {
      this.broadcast('TRANSPORT_PAUSE', {
        position: data.position
      });
    });
    
    const unsubResume = this.eventBus.on('transport:resume', (data) => {
      this.broadcast('TRANSPORT_RESUME', {
        position: data.position
      });
    });
    
    const unsubSeek = this.eventBus.on('transport:seek', (data) => {
      this.broadcast('TRANSPORT_SEEK', {
        position: data.position
      });
    });
    
    const unsubTempo = this.eventBus.on('transport:tempo-change', (data) => {
      this.broadcast('TEMPO_CHANGE', {
        tempo: data.tempo
      });
    });
    
    const unsubTimeSig = this.eventBus.on('transport:time-signature-change', (data) => {
      this.broadcast('TIME_SIGNATURE_CHANGE', {
        timeSignature: data.timeSignature
      });
    });
    
    const unsubLoop = this.eventBus.on('transport:loop-change', (data) => {
      this.broadcast('LOOP_CHANGE', {
        enabled: data.enabled,
        start: data.start,
        end: data.end
      });
    });
    
    // Listen to high-frequency timing updates
    const unsubTiming = this.eventBus.on('transport:timing-update', (data) => {
      // Throttle position updates to prevent overwhelming clients
      this.throttledBroadcast('POSITION_UPDATE', {
        time: data.time,
        position: data.position,
        metrics: data.metrics
      });
    });
    
    // Store unsubscribers for cleanup
    this.eventUnsubscribers = [
      unsubStart, unsubStop, unsubPause, unsubResume,
      unsubSeek, unsubTempo, unsubTimeSig, unsubLoop, unsubTiming
    ];
  }

  /**
   * Get current transport state snapshot from UnifiedTransport
   */
  private getTransportSnapshot(): TransportStateSnapshot | null {
    if (!this.unifiedTransport) return null;
    
    const config = this.unifiedTransport.getConfig();
    
    return {
      state: this.unifiedTransport.getState(),
      position: this.unifiedTransport.getPosition(),
      tempo: this.unifiedTransport.getTempo(),
      loop: false, // TODO: Get from UnifiedTransport when implemented
      loopStart: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
      loopEnd: { bars: 4, beats: 0, sixteenths: 0, ticks: 0 },
      metrics: this.unifiedTransport.getMetrics(),
      timestamp: Date.now()
    };
  }

  /**
   * Register a client for sync updates
   */
  registerClient(clientId: string): void {
    const client: SyncClient = {
      id: clientId,
      lastHeartbeat: Date.now(),
      missedHeartbeats: 0,
      latency: 0,
      connected: true
    };

    this.clients.set(clientId, client);
    this.metrics.connectedClients = this.clients.size;

    // Send initial state
    const snapshot = this.getTransportSnapshot();
    if (snapshot) {
      this.sendToClient(clientId, 'SYNC_INIT', {
        ...snapshot,
        config: this.config
      });
    }

    this.emit('client:connected', { clientId });
    console.log(`📡 Widget registered: ${clientId} (Total: ${this.clients.size})`);
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.metrics.connectedClients = this.clients.size;
    this.emit('client:disconnected', { clientId });
    console.log(`📡 Widget unregistered: ${clientId} (Total: ${this.clients.size})`);
  }

  /**
   * Handle client heartbeat response
   */
  handleClientHeartbeat(clientId: string, clientTimestamp: number): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Calculate round-trip latency
    const now = Date.now();
    client.latency = now - clientTimestamp;
    client.lastHeartbeat = now;
    client.missedHeartbeats = 0;
    
    // Update average latency
    const latencies = Array.from(this.clients.values()).map(c => c.latency);
    this.metrics.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /**
   * Start heartbeat mechanism for client health monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat to all clients
   */
  private sendHeartbeat(): void {
    const snapshot = this.getTransportSnapshot();
    if (!snapshot) return;
    
    const heartbeat = {
      timestamp: Date.now(),
      transportSnapshot: snapshot,
      serverTime: Date.now()
    };

    this.metrics.totalHeartbeats++;

    // Check for dead clients
    const deadClients: string[] = [];
    this.clients.forEach((client, id) => {
      const timeSinceLastHeartbeat = Date.now() - client.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 3) {
        client.missedHeartbeats++;
        this.metrics.missedHeartbeats++;
        
        if (client.missedHeartbeats > this.config.maxReconnectAttempts) {
          deadClients.push(id);
        } else {
          this.attemptReconnect(id);
        }
      }
    });

    // Remove dead clients
    deadClients.forEach(id => {
      console.warn(`💀 Removing unresponsive widget: ${id}`);
      this.unregisterClient(id);
    });

    // Broadcast heartbeat
    this.broadcast('HEARTBEAT', heartbeat);
  }

  /**
   * Throttled broadcast to prevent overwhelming clients
   */
  private throttledBroadcast(type: string, data: any): void {
    const now = Date.now();
    if (now - this.lastBroadcastTime < this.config.throttleMs) {
      // Queue the event
      this.eventQueue.push({ type, data });
      
      // Ensure queued events are eventually sent
      if (this.eventQueue.length === 1) {
        setTimeout(() => {
          this.flushEventQueue();
        }, this.config.throttleMs);
      }
      return;
    }

    this.lastBroadcastTime = now;
    this.broadcast(type, data);
  }

  /**
   * Flush queued events
   */
  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) return;
    
    const batch = this.eventQueue.splice(0, this.config.batchSize);
    if (batch.length > 0) {
      this.broadcast('BATCH_UPDATE', batch);
    }
    
    // Schedule next flush if more events
    if (this.eventQueue.length > 0) {
      setTimeout(() => {
        this.flushEventQueue();
      }, this.config.throttleMs);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  private broadcast(type: string, data: any): void {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };

    this.clients.forEach((client, id) => {
      if (client.connected) {
        this.sendToClient(id, type, data);
      }
    });

    this.emit('broadcast', message);
    this.metrics.lastSyncTime = Date.now();
  }

  /**
   * Send to specific client
   */
  private sendToClient(clientId: string, type: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.connected) return;

    // Emit event for the client
    this.emit(`client:${clientId}:${type}`, data);
    
    // Also emit generic event
    this.emit(type, { clientId, ...data });
  }

  /**
   * Attempt to reconnect a client
   */
  private attemptReconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.metrics.reconnections++;
    
    setTimeout(() => {
      if (this.clients.has(clientId)) {
        console.log(`🔄 Attempting to reconnect widget: ${clientId}`);
        this.sendToClient(clientId, 'RECONNECT', {
          attempt: client.missedHeartbeats,
          maxAttempts: this.config.maxReconnectAttempts
        });
      }
    }, this.config.reconnectDelay);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart heartbeat if interval changed
    if (config.heartbeatInterval !== undefined) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connected clients
   */
  getConnectedClients(): Array<{ id: string; latency: number; connected: boolean }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      latency: client.latency,
      connected: client.connected
    }));
  }

  /**
   * Force sync all clients with current state
   */
  forceSync(): void {
    const snapshot = this.getTransportSnapshot();
    if (!snapshot) return;
    
    this.broadcast('FORCE_SYNC', snapshot);
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Unsubscribe from all events
    this.eventUnsubscribers.forEach(unsub => unsub());
    this.eventUnsubscribers = [];
    
    // Clear clients
    this.clients.clear();
    this.metrics.connectedClients = 0;
    
    // Clear event queue
    this.eventQueue = [];
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.cleanup();
    this.removeAllListeners();
    TransportSyncManager.instance = null as any;
  }
}