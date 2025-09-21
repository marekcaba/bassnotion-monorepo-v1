/**
 * Edge Location Manager
 * 
 * Manages CDN edge locations and optimal routing
 * Extracted from playback domain for shared infrastructure
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  EdgeLocation,
  NetworkCondition,
} from '@bassnotion/contracts';
import type { GeolocationCoordinates } from './ICDNService.js';

const logger = createStructuredLogger('EdgeLocationManager');

export class EdgeLocationManager {
  private edgeLocations: EdgeLocation[] = [];
  private userLocation?: GeolocationCoordinates;
  private networkConditions: NetworkCondition = {
    type: 'unknown',
    bandwidth: 0,
    latency: 0,
    jitter: 0,
    packetLoss: 0,
  };

  constructor(edgeLocations: EdgeLocation[] = []) {
    this.edgeLocations = edgeLocations;
    this.detectNetworkConditions();
  }

  /**
   * Initialize edge locations from configuration
   */
  async initialize(locations?: EdgeLocation[]): Promise<void> {
    if (locations) {
      this.edgeLocations = locations;
    }

    // Try to detect user location
    try {
      this.userLocation = await this.detectUserLocation();
      logger.info('User location detected', this.userLocation);
    } catch (error) {
      logger.warn('Failed to detect user location', error);
    }

    logger.info('Edge location manager initialized', {
      locations: this.edgeLocations.length,
      hasUserLocation: !!this.userLocation,
    });
  }

  /**
   * Get optimal edge location for user
   */
  getOptimalLocation(userLocation?: GeolocationCoordinates): EdgeLocation | null {
    const location = userLocation || this.userLocation;
    
    if (!location || this.edgeLocations.length === 0) {
      return this.edgeLocations[0] || null;
    }

    // Calculate distances and scores
    const scoredLocations = this.edgeLocations.map((edge) => {
      const distance = this.calculateDistance(
        location,
        { latitude: edge.latitude, longitude: edge.longitude },
      );

      // Score based on distance, performance, and health
      const distanceScore = Math.max(0, 1 - distance / 20000); // Normalize to 0-1
      const performanceScore = edge.performanceScore || 0.5;
      const healthScore = edge.isHealthy ? 1 : 0;

      const totalScore = 
        distanceScore * 0.5 + 
        performanceScore * 0.3 + 
        healthScore * 0.2;

      return { edge, distance, score: totalScore };
    });

    // Sort by score and return best
    scoredLocations.sort((a, b) => b.score - a.score);
    
    logger.debug('Optimal edge location selected', {
      location: scoredLocations[0].edge.id,
      distance: scoredLocations[0].distance,
      score: scoredLocations[0].score,
    });

    return scoredLocations[0].edge;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(loc1: GeolocationCoordinates, loc2: GeolocationCoordinates): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(loc2.latitude - loc1.latitude);
    const dLon = this.toRad(loc2.longitude - loc1.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(loc1.latitude)) * Math.cos(this.toRad(loc2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Detect user location using Geolocation API
   */
  private async detectUserLocation(): Promise<GeolocationCoordinates | undefined> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return undefined;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(undefined);
        },
        { timeout: 5000 },
      );
    });
  }

  /**
   * Detect network conditions
   */
  private detectNetworkConditions(): void {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return;
    }

    const connection = (navigator as any).connection;
    if (connection) {
      this.networkConditions = {
        type: connection.effectiveType || 'unknown',
        bandwidth: connection.downlink || 0,
        latency: connection.rtt || 0,
        jitter: 0, // Not available in Network Information API
        packetLoss: 0, // Not available in Network Information API
      };

      // Listen for changes
      connection.addEventListener('change', () => {
        this.networkConditions = {
          type: connection.effectiveType || 'unknown',
          bandwidth: connection.downlink || 0,
          latency: connection.rtt || 0,
          jitter: 0,
          packetLoss: 0,
        };

        logger.debug('Network conditions changed', this.networkConditions);
      });
    }
  }

  /**
   * Get all edge locations
   */
  getEdgeLocations(): EdgeLocation[] {
    return [...this.edgeLocations];
  }

  /**
   * Get current network conditions
   */
  getNetworkConditions(): NetworkCondition {
    return { ...this.networkConditions };
  }

  /**
   * Update edge location health
   */
  updateEdgeHealth(edgeId: string, isHealthy: boolean): void {
    const edge = this.edgeLocations.find((e) => e.id === edgeId);
    if (edge) {
      edge.isHealthy = isHealthy;
      logger.info('Edge location health updated', { edgeId, isHealthy });
    }
  }

  /**
   * Update edge location performance score
   */
  updateEdgePerformance(edgeId: string, performanceScore: number): void {
    const edge = this.edgeLocations.find((e) => e.id === edgeId);
    if (edge) {
      edge.performanceScore = Math.max(0, Math.min(1, performanceScore));
      logger.debug('Edge location performance updated', { 
        edgeId, 
        performanceScore: edge.performanceScore 
      });
    }
  }
}