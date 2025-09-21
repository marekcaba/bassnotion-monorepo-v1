/**
 * Heartbeat Monitor
 *
 * Manages client health monitoring through periodic heartbeats.
 * Detects dead clients and manages reconnection attempts.
 */

import type { SyncClient, SyncConfig } from './types';

export interface HeartbeatMetrics {
  totalHeartbeats: number;
  missedHeartbeats: number;
  reconnections: number;
}

export class HeartbeatMonitor {
  private clients = new Map<string, SyncClient>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private metrics: HeartbeatMetrics = {
    totalHeartbeats: 0,
    missedHeartbeats: 0,
    reconnections: 0,
  };

  constructor(
    private config: SyncConfig,
    private onHeartbeat: (clients: Map<string, SyncClient>) => void,
    private onDeadClient: (clientId: string) => void,
    private onReconnectAttempt: (clientId: string, attempt: number) => void,
  ) {}

  /**
   * Start the heartbeat monitor
   */
  start(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop the heartbeat monitor
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Register a new client
   */
  registerClient(clientId: string): void {
    const client: SyncClient = {
      id: clientId,
      lastHeartbeat: Date.now(),
      missedHeartbeats: 0,
      latency: 0,
      connected: true,
    };

    this.clients.set(clientId, client);
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Update client heartbeat
   */
  updateClientHeartbeat(clientId: string, clientTimestamp: number): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Calculate round-trip latency
    const now = Date.now();
    client.latency = now - clientTimestamp;
    client.lastHeartbeat = now;
    client.missedHeartbeats = 0;
    client.connected = true;
  }

  /**
   * Get all clients
   */
  getClients(): Map<string, SyncClient> {
    return new Map(this.clients);
  }

  /**
   * Get average latency across all clients
   */
  getAverageLatency(): number {
    if (this.clients.size === 0) return 0;

    const latencies = Array.from(this.clients.values()).map((c) => c.latency);
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /**
   * Get metrics
   */
  getMetrics(): HeartbeatMetrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    Object.assign(this.config, config);

    // Restart if interval changed
    if (config.heartbeatInterval !== undefined) {
      this.stop();
      this.start();
    }
  }

  /**
   * Check heartbeats and detect dead clients
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const deadClients: string[] = [];

    this.metrics.totalHeartbeats++;

    this.clients.forEach((client, id) => {
      const timeSinceLastHeartbeat = now - client.lastHeartbeat;

      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 3) {
        client.missedHeartbeats++;
        this.metrics.missedHeartbeats++;

        if (client.missedHeartbeats > this.config.maxReconnectAttempts) {
          deadClients.push(id);
        } else {
          this.attemptReconnect(id, client.missedHeartbeats);
        }
      }
    });

    // Remove dead clients
    deadClients.forEach((id) => {
      this.clients.delete(id);
      this.onDeadClient(id);
    });

    // Trigger heartbeat callback
    this.onHeartbeat(this.clients);
  }

  /**
   * Attempt to reconnect a client
   */
  private attemptReconnect(clientId: string, attempt: number): void {
    this.metrics.reconnections++;

    setTimeout(() => {
      if (this.clients.has(clientId)) {
        this.onReconnectAttempt(clientId, attempt);
      }
    }, this.config.reconnectDelay);
  }

  /**
   * Dispose of the monitor
   */
  dispose(): void {
    this.stop();
    this.clients.clear();
  }
}
