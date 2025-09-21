/**
 * Supabase Client Manager
 * 
 * Manages Supabase client connections with pooling, failover,
 * and geographic optimization capabilities.
 * 
 * Extracted from SupabaseAssetClient to provide reusable
 * connection management for all domains.
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@/shared/utils/errorHandling';
import type {
  ClientManagerConfig,
  ConnectionConfig,
  ConnectionHealth,
  ClientMetrics,
  ConnectionPool as ConnectionPoolConfig,
} from '../types/client.types.js';

const logger = createStructuredLogger('SupabaseClientManager');

/**
 * Connection wrapper for pooling
 */
class Connection {
  private client: SupabaseClient;
  private config: ConnectionConfig;
  private createdAt: number;
  private lastUsedAt: number;
  private useCount: number;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.client = createClient(config.url, config.apiKey);
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.useCount = 0;
  }

  getClient(): SupabaseClient {
    this.lastUsedAt = Date.now();
    this.useCount++;
    return this.client;
  }

  getAge(): number {
    return Date.now() - this.createdAt;
  }

  getIdleTime(): number {
    return Date.now() - this.lastUsedAt;
  }

  getUseCount(): number {
    return this.useCount;
  }

  isExpired(maxLifetime: number): boolean {
    return this.getAge() > maxLifetime;
  }

  isIdle(idleTimeout: number): boolean {
    return this.getIdleTime() > idleTimeout;
  }
}

/**
 * Connection pool implementation
 */
class ConnectionPool {
  private connections: Connection[] = [];
  private available: Connection[] = [];
  private config: ConnectionPoolConfig;
  private connectionConfig: ConnectionConfig;

  constructor(config: ConnectionPoolConfig, connectionConfig: ConnectionConfig) {
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.initialize();
  }

  private initialize(): void {
    // Create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = new Connection(this.connectionConfig);
      this.connections.push(connection);
      this.available.push(connection);
    }
  }

  async acquire(): Promise<Connection> {
    // Clean up expired connections
    this.cleanup();

    // Try to get an available connection
    const connection = this.available.pop();
    if (connection) {
      return connection;
    }

    // Create new connection if under max limit
    if (this.connections.length < this.config.maxConnections) {
      const newConnection = new Connection(this.connectionConfig);
      this.connections.push(newConnection);
      return newConnection;
    }

    // Wait for a connection to become available
    return this.waitForConnection();
  }

  release(connection: Connection): void {
    if (!connection.isExpired(this.config.idleTimeout * 10)) {
      this.available.push(connection);
    } else {
      // Remove expired connection
      const index = this.connections.indexOf(connection);
      if (index > -1) {
        this.connections.splice(index, 1);
      }
    }
  }

  private async waitForConnection(): Promise<Connection> {
    const timeout = this.config.acquireTimeout || 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.available.length > 0) {
        return this.available.pop()!;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Connection pool timeout - no available connections');
  }

  private cleanup(): void {
    // Remove expired connections
    this.connections = this.connections.filter(conn => {
      if (conn.isExpired(this.config.idleTimeout * 10)) {
        const availableIndex = this.available.indexOf(conn);
        if (availableIndex > -1) {
          this.available.splice(availableIndex, 1);
        }
        return false;
      }
      return true;
    });

    // Remove idle connections over minimum
    while (this.available.length > this.config.minConnections) {
      const idleConnections = this.available.filter(conn =>
        conn.isIdle(this.config.idleTimeout)
      );
      if (idleConnections.length > 0) {
        const toRemove = idleConnections[0];
        this.available = this.available.filter(c => c !== toRemove);
        this.connections = this.connections.filter(c => c !== toRemove);
      } else {
        break;
      }
    }
  }

  getStatus() {
    return {
      total: this.connections.length,
      available: this.available.length,
      inUse: this.connections.length - this.available.length,
      utilization: this.connections.length / this.config.maxConnections,
    };
  }

  async dispose(): Promise<void> {
    this.connections = [];
    this.available = [];
  }
}

/**
 * Main Supabase Client Manager
 */
export class SupabaseClientManager {
  private config: ClientManagerConfig;
  private primaryClient: SupabaseClient;
  private fallbackClients: SupabaseClient[] = [];
  private pool?: ConnectionPool;
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private metrics: ClientMetrics;
  private currentClient?: SupabaseClient;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: ClientManagerConfig) {
    this.config = config;
    this.metrics = this.createDefaultMetrics();
    this.primaryClient = createClient(config.primary.url, config.primary.apiKey);
    this.initialize();
  }

  private initialize(): void {
    // Create fallback clients
    if (this.config.fallbacks) {
      this.fallbackClients = this.config.fallbacks.map(fallback =>
        createClient(fallback.url, fallback.apiKey)
      );
    }

    // Setup connection pooling if enabled
    if (this.config.pooling) {
      this.pool = new ConnectionPool(this.config.pooling, this.config.primary);
    }

    // Start health monitoring
    if (this.config.failover?.enabled) {
      this.startHealthMonitoring();
    }

    // Set initial client
    this.currentClient = this.primaryClient;
  }

  /**
   * Get a client for operations
   */
  async getClient(): Promise<SupabaseClient> {
    this.metrics.totalRequests++;

    // If pooling is enabled, get from pool
    if (this.pool) {
      try {
        const connection = await this.pool.acquire();
        return connection.getClient();
      } catch (error) {
        logger.error('Failed to acquire connection from pool', { error });
        this.metrics.failedRequests++;
        throw error;
      }
    }

    // Check if we need failover
    if (this.config.failover?.enabled && !this.isHealthy(this.config.primary.url)) {
      const fallback = this.selectHealthyFallback();
      if (fallback) {
        return fallback;
      }
    }

    return this.currentClient || this.primaryClient;
  }

  /**
   * Release a client back to pool
   */
  releaseClient(client: SupabaseClient): void {
    // In future, when we have connection tracking, release back to pool
    logger.debug('Client released');
  }

  /**
   * Check health of a specific endpoint
   */
  private isHealthy(url: string): boolean {
    const health = this.healthStatus.get(url);
    if (!health) return true; // Assume healthy if no data
    return health.isHealthy && health.consecutiveFailures < (this.config.failover?.failureThreshold || 3);
  }

  /**
   * Select a healthy fallback client
   */
  private selectHealthyFallback(): SupabaseClient | null {
    for (let i = 0; i < this.fallbackClients.length; i++) {
      const fallbackUrl = this.config.fallbacks?.[i].url;
      if (fallbackUrl && this.isHealthy(fallbackUrl)) {
        return this.fallbackClients[i];
      }
    }
    return null;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = this.config.failover?.healthCheckInterval || 30000;
    
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth(this.config.primary.url, this.primaryClient);
      
      for (let i = 0; i < this.fallbackClients.length; i++) {
        const fallbackUrl = this.config.fallbacks?.[i].url;
        if (fallbackUrl) {
          await this.checkHealth(fallbackUrl, this.fallbackClients[i]);
        }
      }
    }, interval);

    // Do immediate health check
    this.checkHealth(this.config.primary.url, this.primaryClient);
  }

  /**
   * Check health of a specific client
   */
  private async checkHealth(url: string, client: SupabaseClient): Promise<void> {
    const startTime = Date.now();
    let health = this.healthStatus.get(url) || this.createDefaultHealth();

    try {
      // Simple health check - try to access storage
      await client.storage.listBuckets();
      
      const latency = Date.now() - startTime;
      health.isHealthy = true;
      health.latency = latency;
      health.lastCheckTime = Date.now();
      health.consecutiveFailures = 0;
      health.successRate = (health.successRate * 0.95) + (1 * 0.05); // Exponential moving average
      
      this.metrics.successfulRequests++;
    } catch (error) {
      health.isHealthy = false;
      health.lastCheckTime = Date.now();
      health.consecutiveFailures++;
      health.errorRate = (health.errorRate * 0.95) + (1 * 0.05);
      
      this.metrics.failedRequests++;
      logger.warn(`Health check failed for ${url}`, { error });
    }

    this.healthStatus.set(url, health);
  }

  /**
   * Create default health status
   */
  private createDefaultHealth(): ConnectionHealth {
    return {
      isHealthy: true,
      lastCheckTime: Date.now(),
      latency: 0,
      errorRate: 0,
      successRate: 1,
      consecutiveFailures: 0,
    };
  }

  /**
   * Create default metrics
   */
  private createDefaultMetrics(): ClientMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      activeConnections: 0,
      poolUtilization: 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): ClientMetrics {
    if (this.pool) {
      const poolStatus = this.pool.getStatus();
      this.metrics.activeConnections = poolStatus.inUse;
      this.metrics.poolUtilization = poolStatus.utilization;
    }
    return { ...this.metrics };
  }

  /**
   * Get health status for all endpoints
   */
  getHealthStatus(): Map<string, ConnectionHealth> {
    return new Map(this.healthStatus);
  }

  /**
   * Cleanup and dispose
   */
  async dispose(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.pool) {
      await this.pool.dispose();
    }
  }
}