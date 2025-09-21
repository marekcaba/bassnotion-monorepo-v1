/**
 * Geographic Distribution Manager
 *
 * Manages geographic content distribution with intelligent edge selection
 * and load balancing across CDN edge locations.
 */

import { logger } from '../../../utils/logger.js';
import { EdgeLocation, CDNOptimizationConfig } from './types.js';

/**
 * Geographic Distribution Manager
 * Implements geographic content distribution with intelligent edge selection and load balancing
 */
export class GeographicDistributionManager {
  private config: CDNOptimizationConfig;
  private edgeLocations: EdgeLocation[] = [];
  private loadBalancer: LoadBalancer;
  private isInitialized = false;

  constructor(config: CDNOptimizationConfig) {
    this.config = config;
    this.loadBalancer = new LoadBalancer();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('GeographicDistributionManager already initialized');
      return;
    }

    try {
      await this.loadEdgeLocations();
      this.setupLoadBalancing();
      this.isInitialized = true;
      logger.info('🌍 GeographicDistributionManager initialized successfully');
    } catch (error) {
      logger.error(
        'Failed to initialize GeographicDistributionManager:',
        error,
      );
      throw error;
    }
  }

  private async loadEdgeLocations(): Promise<void> {
    this.edgeLocations = this.config.edgeConfiguration?.edgeLocations || [];
    logger.info(
      `📍 Loaded ${this.edgeLocations.length} edge locations for geographic distribution`,
    );
  }

  private setupLoadBalancing(): void {
    this.loadBalancer = new LoadBalancer(this.edgeLocations);
  }

  /**
   * Select the optimal edge location based on user location
   */
  selectOptimalEdge(userLocation?: GeographicLocation): EdgeLocation {
    if (!this.isInitialized) {
      logger.warn(
        'GeographicDistributionManager not initialized, using default edge',
      );
      return this.createDefaultEdge();
    }

    if (!userLocation) {
      logger.info('No user location provided, using load-based selection');
      return this.loadBalancer.selectByLoad();
    }

    return this.selectNearestEdge(userLocation);
  }

  /**
   * Select the nearest edge location to the user
   */
  private selectNearestEdge(userLocation: GeographicLocation): EdgeLocation {
    if (this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    const edgeWithDistance = this.edgeLocations.map((edge) => ({
      edge,
      distance: this.calculateDistance(userLocation, edge.coordinates),
    }));

    // Sort by distance and filter out offline edges
    const availableEdges = edgeWithDistance
      .filter((item) => item.edge.status !== 'offline')
      .sort((a, b) => a.distance - b.distance);

    if (availableEdges.length === 0) {
      logger.warn('No available edges, using default');
      return this.createDefaultEdge();
    }

    // Select nearest edge that's not overloaded
    for (const { edge } of availableEdges) {
      if (edge.currentLoad < 0.9) {
        logger.info(
          `🎯 Selected edge: ${edge.name} (${edge.city}, ${edge.country})`,
        );
        return edge;
      }
    }

    // If all edges are overloaded, use the nearest one anyway
    logger.warn('All edges overloaded, using nearest');
    return availableEdges[0].edge;
  }

  /**
   * Calculate distance between two geographic points using Haversine formula
   */
  private calculateDistance(
    loc1: GeographicLocation,
    loc2: GeographicLocation,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    const lat1 = this.toRad(loc1.latitude);
    const lat2 = this.toRad(loc2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private createDefaultEdge(): EdgeLocation {
    return {
      locationId: 'default-geo',
      name: 'Default Geographic Edge',
      region: 'global',
      country: 'US',
      city: 'Default',
      coordinates: { latitude: 0, longitude: 0 },
      endpoint: 'https://default-geo-edge.example.com',
      capacity: 1000,
      currentLoad: 0.5,
      availability: 0.99,
      latency: 50,
      features: ['compression', 'caching'],
      status: 'operational',
    };
  }

  /**
   * Get all edge locations
   */
  getEdgeLocations(): EdgeLocation[] {
    return [...this.edgeLocations];
  }

  /**
   * Get edge locations by region
   */
  getEdgeLocationsByRegion(region: string): EdgeLocation[] {
    return this.edgeLocations.filter(
      (edge) => edge.region.toLowerCase() === region.toLowerCase(),
    );
  }

  /**
   * Get edge health summary
   */
  getEdgeHealthSummary(): EdgeHealthSummary {
    const total = this.edgeLocations.length;
    const operational = this.edgeLocations.filter(
      (e) => e.status === 'operational',
    ).length;
    const degraded = this.edgeLocations.filter(
      (e) => e.status === 'degraded',
    ).length;
    const offline = this.edgeLocations.filter(
      (e) => e.status === 'offline',
    ).length;

    const averageLoad =
      this.edgeLocations.reduce((sum, e) => sum + e.currentLoad, 0) / total ||
      0;
    const averageLatency =
      this.edgeLocations.reduce((sum, e) => sum + e.latency, 0) / total || 0;

    return {
      total,
      operational,
      degraded,
      offline,
      averageLoad,
      averageLatency,
      healthScore: (operational / total) * 100,
    };
  }

  /**
   * Update edge status
   */
  updateEdgeStatus(locationId: string, status: Partial<EdgeLocation>): void {
    const edge = this.edgeLocations.find((e) => e.locationId === locationId);
    if (edge) {
      Object.assign(edge, status);
      logger.info(`📊 Updated edge ${locationId} status`);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.isInitialized = false;
    this.edgeLocations = [];
    logger.info('🛑 GeographicDistributionManager disposed');
  }
}

/**
 * Load Balancer for edge selection
 */
class LoadBalancer {
  private edgeLocations: EdgeLocation[];

  constructor(edgeLocations: EdgeLocation[] = []) {
    this.edgeLocations = edgeLocations;
  }

  /**
   * Select edge based on current load
   */
  selectByLoad(): EdgeLocation {
    if (this.edgeLocations.length === 0) {
      return this.createDefaultEdge();
    }

    // Filter out offline edges
    const availableEdges = this.edgeLocations.filter(
      (e) => e.status !== 'offline',
    );

    if (availableEdges.length === 0) {
      return this.createDefaultEdge();
    }

    // Select edge with lowest load
    return availableEdges.reduce((best, current) =>
      current.currentLoad < best.currentLoad ? current : best,
    );
  }

  /**
   * Select edge using round-robin
   */
  private currentIndex = 0;
  selectRoundRobin(): EdgeLocation {
    const availableEdges = this.edgeLocations.filter(
      (e) => e.status !== 'offline',
    );

    if (availableEdges.length === 0) {
      return this.createDefaultEdge();
    }

    const edge = availableEdges[this.currentIndex % availableEdges.length];
    this.currentIndex++;

    return edge;
  }

  /**
   * Select edge randomly
   */
  selectRandom(): EdgeLocation {
    const availableEdges = this.edgeLocations.filter(
      (e) => e.status !== 'offline',
    );

    if (availableEdges.length === 0) {
      return this.createDefaultEdge();
    }

    const randomIndex = Math.floor(Math.random() * availableEdges.length);
    return availableEdges[randomIndex];
  }

  private createDefaultEdge(): EdgeLocation {
    return {
      locationId: 'default-lb',
      name: 'Default Load Balanced Edge',
      region: 'global',
      country: 'US',
      city: 'Default',
      coordinates: { latitude: 0, longitude: 0 },
      endpoint: 'https://default-lb-edge.example.com',
      capacity: 1000,
      currentLoad: 0.5,
      availability: 0.99,
      latency: 50,
      features: ['compression', 'caching'],
      status: 'operational',
    };
  }
}

// Types
interface GeographicLocation {
  latitude: number;
  longitude: number;
}

interface EdgeHealthSummary {
  total: number;
  operational: number;
  degraded: number;
  offline: number;
  averageLoad: number;
  averageLatency: number;
  healthScore: number;
}
