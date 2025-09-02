/**
 * TransportSyncManager Delegation
 * 
 * This file provides backward compatibility by delegating to the new
 * WidgetSyncManager in the transport module while maintaining the
 * original API surface.
 */

import { EventEmitter } from 'events';
import { WidgetSyncManager } from '../../modules/transport/sync';
import type {
  UnifiedTransport,
  TransportState,
  MusicalPosition,
  TimingMetrics,
} from './UnifiedTransport';
import type { EventBus } from './EventBus';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TransportSyncManager.delegation');

/**
 * TransportSyncManager - Delegating to new WidgetSyncManager
 * 
 * This class maintains backward compatibility by delegating all
 * operations to the new modular WidgetSyncManager.
 */
export class TransportSyncManager extends EventEmitter {
  private static instance: TransportSyncManager;
  private widgetSyncManager: WidgetSyncManager;
  
  private constructor() {
    super();
    this.widgetSyncManager = WidgetSyncManager.getInstance();
    
    // Forward all events from WidgetSyncManager
    this.setupEventForwarding();
    
    logger.info('🔄 TransportSyncManager initialized with delegation to WidgetSyncManager');
  }
  
  static getInstance(): TransportSyncManager {
    if (!TransportSyncManager.instance) {
      TransportSyncManager.instance = new TransportSyncManager();
    }
    return TransportSyncManager.instance;
  }
  
  /**
   * Initialize with UnifiedTransport and EventBus
   */
  initialize(unifiedTransport: UnifiedTransport, eventBus: EventBus): void {
    // The new WidgetSyncManager needs Transport, not UnifiedTransport
    // For now, we'll use UnifiedTransport's delegation if available
    const transport = (unifiedTransport as any).newTransport || unifiedTransport;
    this.widgetSyncManager.initialize(transport, eventBus);
  }
  
  /**
   * Register a client for sync updates
   */
  registerClient(clientId: string): void {
    this.widgetSyncManager.registerClient(clientId);
  }
  
  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.widgetSyncManager.unregisterClient(clientId);
  }
  
  /**
   * Handle client heartbeat response
   */
  handleClientHeartbeat(clientId: string, clientTimestamp: number): void {
    this.widgetSyncManager.handleClientHeartbeat(clientId, clientTimestamp);
  }
  
  /**
   * Acknowledge heartbeat (alias for handleClientHeartbeat)
   */
  acknowledgeHeartbeat(clientId: string, timestamp: number): void {
    this.widgetSyncManager.acknowledgeHeartbeat(clientId, timestamp);
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: any): void {
    this.widgetSyncManager.updateConfig(config);
  }
  
  /**
   * Get current metrics
   */
  getMetrics(): any {
    return this.widgetSyncManager.getMetrics();
  }
  
  /**
   * Get connected clients
   */
  getConnectedClients(): Array<{ id: string; latency: number; connected: boolean }> {
    return this.widgetSyncManager.getConnectedClients();
  }
  
  /**
   * Force sync all clients with current state
   */
  forceSync(): void {
    this.widgetSyncManager.forceSync();
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    // The new WidgetSyncManager doesn't expose cleanup, but dispose does similar
    this.removeAllListeners();
  }
  
  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.widgetSyncManager.dispose();
    this.removeAllListeners();
    TransportSyncManager.instance = null as any;
  }
  
  /**
   * Set up event forwarding from WidgetSyncManager
   */
  private setupEventForwarding(): void {
    // List of events to forward
    const events = [
      'broadcast',
      'client:connected',
      'client:disconnected',
    ];
    
    // Forward standard events
    events.forEach(event => {
      this.widgetSyncManager.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
    
    // Special handling for client-specific events
    // We need to listen for any client:* events and forward them
    const originalEmit = this.widgetSyncManager.emit.bind(this.widgetSyncManager);
    (this.widgetSyncManager as any).emit = (event: string, ...args: any[]) => {
      const result = originalEmit(event, ...args);
      
      // Forward client-specific events
      if (typeof event === 'string' && event.startsWith('client:')) {
        this.emit(event, ...args);
      }
      
      return result;
    };
  }
}