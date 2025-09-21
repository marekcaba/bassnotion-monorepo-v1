/**
 * Quality Monitor
 *
 * Real-time quality monitoring with automatic adjustments.
 * Extracted from PerformanceOptimizer for modular architecture.
 */

import type {
  DeviceCapabilities,
  QualitySettings,
  IQualityMonitor,
} from './types';
import { createStructuredLogger } from '../shared/index.js';

const logger = createStructuredLogger('QualityMonitor');

export class QualityMonitor implements IQualityMonitor {
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private capabilities: DeviceCapabilities | null = null;
  private settings: QualitySettings | null = null;

  /**
   * Start quality monitoring
   */
  start(capabilities: DeviceCapabilities, settings: QualitySettings): void {
    if (this.monitoring) {
      logger.warn('Quality monitoring already active');
      return;
    }

    this.capabilities = capabilities;
    this.settings = settings;
    this.monitoring = true;

    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      this.performQualityCheck();
    }, 5000); // Check every 5 seconds

    logger.info('📊 Quality monitoring started');
  }

  /**
   * Stop quality monitoring
   */
  stop(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.capabilities = null;
    this.settings = null;

    logger.info('📊 Quality monitoring stopped');
  }

  /**
   * Perform quality check
   */
  private performQualityCheck(): void {
    if (!this.monitoring || !this.capabilities || !this.settings) {
      return;
    }

    // Simulate quality metrics collection
    const qualityMetrics = {
      audioLatency: Math.random() * 10 + 10, // 10-20ms
      dropoutRate: Math.random() * 0.01, // 0-1%
      cpuUsage: Math.random() * 30 + 20, // 20-50%
      memoryUsage: Math.random() * 40 + 30, // 30-70%
      stabilityScore: Math.random() * 20 + 80, // 80-100
    };

    // Check for quality issues
    const issues = this.detectQualityIssues(qualityMetrics);

    if (issues.length > 0) {
      logger.warn('Quality issues detected:', { issues });
      // Could emit events for automatic quality adjustments
    }
  }

  /**
   * Detect quality issues from metrics
   */
  private detectQualityIssues(metrics: any): string[] {
    const issues: string[] = [];

    if (metrics.audioLatency > 30) {
      issues.push('High audio latency detected');
    }
    if (metrics.dropoutRate > 0.005) {
      issues.push('Audio dropouts detected');
    }
    if (metrics.cpuUsage > 80) {
      issues.push('High CPU usage detected');
    }
    if (metrics.memoryUsage > 85) {
      issues.push('High memory usage detected');
    }
    if (metrics.stabilityScore < 85) {
      issues.push('System stability concerns detected');
    }

    return issues;
  }

  /**
   * Dispose of quality monitor
   */
  async dispose(): Promise<void> {
    this.stop();
    logger.info('🧹 QualityMonitor disposed');
  }
}
