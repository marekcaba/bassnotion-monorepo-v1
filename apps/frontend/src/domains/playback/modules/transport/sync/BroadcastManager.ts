/**
 * Broadcast Manager
 *
 * Handles event broadcasting to widgets with throttling and batching
 * for optimal performance.
 */

import { EventEmitter } from '../shared/index.js';
import type { SyncClient, SyncConfig, SyncEventData } from './types';
import { SyncEventType } from './types';

export interface BroadcastEvent<T extends SyncEventType = SyncEventType> {
  type: T;
  data: SyncEventData[T];
  timestamp: number;
}

export class BroadcastManager extends EventEmitter {
  private eventQueue: BroadcastEvent[] = [];
  private lastBroadcastTime = 0;
  private flushTimer: NodeJS.Timeout | null = null;
  private currentClients: Map<string, SyncClient> = new Map();

  constructor(private config: SyncConfig) {
    super();
  }

  /**
   * Broadcast an event to all clients
   */
  broadcast<T extends SyncEventType>(
    type: T,
    data: SyncEventData[T],
    clients: Map<string, SyncClient>,
  ): void {
    // Store current clients for use in batch flushing
    this.currentClients = clients;

    const message: BroadcastEvent<T> = {
      type,
      data,
      timestamp: Date.now(),
    };

    // Send to all connected clients
    clients.forEach((client, id) => {
      if (client.connected) {
        this.sendToClient(id, type, data);
      }
    });

    // Emit general broadcast event
    this.emit('broadcast', message);
  }

  /**
   * Throttled broadcast for high-frequency events
   */
  throttledBroadcast<T extends SyncEventType>(
    type: T,
    data: SyncEventData[T],
    clients: Map<string, SyncClient>,
  ): void {
    // Store current clients for use in batch flushing
    this.currentClients = clients;

    const now = Date.now();

    // If within throttle window, queue the event
    if (now - this.lastBroadcastTime < this.config.throttleMs) {
      this.queueEvent({ type, data, timestamp: now } as BroadcastEvent);
      return;
    }

    // Otherwise broadcast immediately
    this.lastBroadcastTime = now;
    this.broadcast(type, data, clients);
  }

  /**
   * Send event to specific client
   */
  sendToClient<T extends SyncEventType>(
    clientId: string,
    type: T,
    data: SyncEventData[T],
  ): void {
    // Emit client-specific event
    this.emit(`client:${clientId}:${type}`, data);

    // Also emit generic event with clientId
    this.emit(type as string, { clientId, ...data });
  }

  /**
   * Queue an event for batched sending
   */
  private queueEvent(event: BroadcastEvent): void {
    this.eventQueue.push(event);

    // Schedule flush if this is the first event
    if (this.eventQueue.length === 1 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushEventQueue();
      }, this.config.throttleMs);
    }
  }

  /**
   * Flush queued events as a batch
   */
  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) {
      this.flushTimer = null;
      return;
    }

    // Extract batch
    const batch = this.eventQueue.splice(0, this.config.batchSize);

    if (batch.length > 0) {
      // Emit as batch update
      const batchData: SyncEventData[SyncEventType.BATCH_UPDATE] = batch.map(
        (event) => ({
          type: event.type,
          data: event.data,
        }),
      );

      // Send batch to each current client
      this.currentClients.forEach((client, clientId) => {
        if (client.connected) {
          this.sendToClient(clientId, SyncEventType.BATCH_UPDATE, batchData);
        }
      });

      // Emit general batch event
      this.emit(SyncEventType.BATCH_UPDATE, batchData);
    }

    // Schedule next flush if more events
    if (this.eventQueue.length > 0) {
      this.flushTimer = setTimeout(() => {
        this.flushEventQueue();
      }, this.config.throttleMs);
    } else {
      this.flushTimer = null;
    }
  }

  /**
   * Force flush all queued events
   */
  forceFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    while (this.eventQueue.length > 0) {
      this.flushEventQueue();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length;
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.eventQueue = [];
    this.removeAllListeners();
  }
}
