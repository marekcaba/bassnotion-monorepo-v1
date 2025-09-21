/**
 * Client Management Types
 * 
 * Types for managing storage client connections, pooling,
 * failover, and geographic optimization.
 */

export interface ConnectionConfig {
  url: string;
  apiKey: string;
  region?: string;
  priority?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface ConnectionPool {
  maxConnections: number;
  minConnections: number;
  connectionTimeout: number;
  idleTimeout: number;
  acquireTimeout: number;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  lastCheckTime: number;
  latency: number;
  errorRate: number;
  successRate: number;
  consecutiveFailures: number;
}

export interface FailoverConfig {
  enabled: boolean;
  healthCheckInterval: number;
  failureThreshold: number;
  recoveryTimeout: number;
  primaryCheckInterval: number;
}

export interface GeographicConfig {
  enabled: boolean;
  preferredRegions: string[];
  latencyThreshold: number;
  autoRouting: boolean;
}

export interface ClientManagerConfig {
  primary: ConnectionConfig;
  fallbacks?: ConnectionConfig[];
  pooling?: ConnectionPool;
  failover?: FailoverConfig;
  geographic?: GeographicConfig;
  monitoring?: {
    enabled: boolean;
    metricsInterval: number;
  };
}

export interface ClientMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  activeConnections: number;
  poolUtilization: number;
}