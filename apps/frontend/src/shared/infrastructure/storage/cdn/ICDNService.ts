/**
 * CDN Service Interface
 * 
 * Generic CDN functionality that can be used by all domains
 */

import type {
  CDNOptimizationConfig,
  EdgeLocation,
  CDNPerformanceMetrics,
  CDNHealthStatus,
  NetworkCondition,
} from '@bassnotion/contracts';

export interface ICDNService {
  /**
   * Initialize CDN service
   */
  initialize(): Promise<void>;

  /**
   * Get optimal CDN endpoint for a resource
   */
  getOptimalEndpoint(resourcePath: string, userLocation?: GeolocationCoordinates): Promise<string>;

  /**
   * Get list of available edge locations
   */
  getEdgeLocations(): EdgeLocation[];

  /**
   * Get current network conditions
   */
  getNetworkConditions(): NetworkCondition;

  /**
   * Get CDN performance metrics
   */
  getMetrics(): CDNPerformanceMetrics;

  /**
   * Get CDN health status
   */
  getHealthStatus(): CDNHealthStatus;

  /**
   * Warm up CDN cache for resources
   */
  warmCache(resources: string[]): Promise<void>;

  /**
   * Invalidate CDN cache
   */
  invalidateCache(patterns: string[]): Promise<void>;

  /**
   * Clean up resources
   */
  dispose(): Promise<void>;
}

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
}