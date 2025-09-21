/**
 * Adaptive Streaming Manager
 *
 * Implements adaptive quality streaming with network condition
 * detection and automatic quality adjustment
 */

import {
  AdaptiveStreamingConfig,
  NetworkCondition,
  QualityLevel,
} from '../types/index.js';

export class AdaptiveStreamingManager {
  private config: AdaptiveStreamingConfig;
  private currentNetworkCondition: NetworkCondition;
  private qualityLevels: QualityLevel[];

  constructor(config: AdaptiveStreamingConfig) {
    this.config = config;
    this.currentNetworkCondition = this.initializeNetworkCondition();
    this.qualityLevels = [];
  }

  private initializeNetworkCondition(): NetworkCondition {
    return {
      connectionType: 'wifi',
      connectionQuality: 'good',
      minBandwidth: 1024 * 1024, // 1 Mbps
      maxBandwidth: 10 * 1024 * 1024, // 10 Mbps
      maxLatency: 100,
    };
  }

  async initialize(): Promise<void> {
    await this.detectNetworkConditions();
    this.setupQualityLevels();
  }

  private async detectNetworkConditions(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      this.currentNetworkCondition.connectionType = this.mapConnectionType(
        connection.effectiveType,
      );
      this.currentNetworkCondition.maxBandwidth =
        connection.downlink * 1024 * 1024;
    }
  }

  private mapConnectionType(
    effectiveType: string,
  ): NetworkCondition['connectionType'] {
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
      case '3g':
        return 'cellular';
      case '4g':
        return 'cellular';
      default:
        return 'wifi';
    }
  }

  private setupQualityLevels(): void {
    this.qualityLevels = [
      { name: 'low', quality: 30, maxSize: 1024 * 1024, targetBitrate: 128 },
      {
        name: 'medium',
        quality: 60,
        maxSize: 5 * 1024 * 1024,
        targetBitrate: 320,
      },
      {
        name: 'high',
        quality: 90,
        maxSize: 10 * 1024 * 1024,
        targetBitrate: 640,
      },
    ];
  }

  selectOptimalQuality(): QualityLevel {
    const bandwidth = this.currentNetworkCondition.maxBandwidth || 1024 * 1024;

    if (bandwidth < 2 * 1024 * 1024) {
      return this.qualityLevels[0] || this.getDefaultQuality();
    } else if (bandwidth < 5 * 1024 * 1024) {
      return this.qualityLevels[1] || this.getDefaultQuality();
    } else {
      return this.qualityLevels[2] || this.getDefaultQuality();
    }
  }

  private getDefaultQuality(): QualityLevel {
    return {
      name: 'medium',
      quality: 60,
      maxSize: 5 * 1024 * 1024,
      targetBitrate: 320,
    };
  }

  async adaptQuality(
    currentQuality: string,
    performanceMetrics: any,
  ): Promise<string> {
    const optimalQuality = this.selectOptimalQuality();

    if (performanceMetrics.errorRate > 5) {
      const currentIndex = this.qualityLevels.findIndex(
        (q) => q.name === currentQuality,
      );
      const downgradedIndex = Math.max(0, currentIndex - 1);
      const downgradedQuality = this.qualityLevels[downgradedIndex];
      return downgradedQuality?.name || this.getDefaultQuality().name;
    }

    return optimalQuality.name;
  }

  getNetworkCondition(): NetworkCondition {
    return { ...this.currentNetworkCondition };
  }

  dispose(): void {
    // Cleanup adaptive streaming resources
    this.qualityLevels = [];
  }
}
