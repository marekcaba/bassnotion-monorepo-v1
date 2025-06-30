/**
 * Story 2.4 - Subtask 4.5: Sample Analytics Engine
 * Enterprise-grade analytics with quality monitoring and performance optimization
 */

import { EventEmitter } from 'events';
import {
  SampleAnalyticsConfig,
  SampleAnalyticsData,
  AudioSampleMetadata,
  AudioSampleOperationResult,
} from '@bassnotion/contracts';

/**
 * Analytics aggregation result
 */
export interface AnalyticsAggregation {
  totalSamples: number;
  totalPlayback: number;
  averageQuality: number;
  averagePerformance: number;
  topPerformingSamples: string[];
  qualityTrends: QualityTrend[];
  performanceAlerts: PerformanceAlert[];
  recommendations: AnalyticsRecommendation[];
  generatedAt: number;
}

/**
 * Quality trend analysis
 */
export interface QualityTrend {
  sampleId: string;
  trend: 'improving' | 'stable' | 'degrading';
  confidence: number;
  timeWindow: number;
  dataPoints: number;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  alertId: string;
  sampleId: string;
  alertType: 'quality' | 'performance' | 'usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  threshold: number;
  actualValue: number;
  recommendations: string[];
}

/**
 * Analytics recommendation
 */
export interface AnalyticsRecommendation {
  recommendationId: string;
  type: 'optimization' | 'quality' | 'performance' | 'usage';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  expectedImprovement: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  autoApplicable: boolean;
  createdAt: number;
}

/**
 * Real-time monitoring data
 */
export interface RealTimeMonitoringData {
  sampleId: string;
  timestamp: number;
  metrics: {
    quality: number;
    performance: number;
    usage: number;
  };
  alerts: PerformanceAlert[];
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Analytics report
 */
export interface AnalyticsReport {
  reportId: string;
  generatedAt: number;
  sessionDuration: number;
  totalOperations: number;
  aggregatedAnalytics: AnalyticsAggregation;
  topSamples: Array<{ sampleId: string; score: number; plays: number }>;
  qualityDistribution: Record<string, number>;
  performanceDistribution: Record<string, number>;
  alertSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: AnalyticsRecommendation[];
}

/**
 * Supporting interfaces
 */
interface QualityDataPoint {
  timestamp: number;
  value: number;
}

interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  success: boolean;
}

/**
 * Enterprise-grade Sample Analytics Engine
 * Provides comprehensive analytics, quality monitoring, and performance optimization
 */
export class SampleAnalyticsEngine extends EventEmitter {
  private config: SampleAnalyticsConfig;
  private analyticsData: Map<string, SampleAnalyticsData> = new Map();
  private qualityHistory: Map<string, QualityDataPoint[]> = new Map();
  private performanceHistory: Map<string, PerformanceDataPoint[]> = new Map();
  private activeAlerts: Map<string, PerformanceAlert[]> = new Map();
  private recommendations: Map<string, AnalyticsRecommendation[]> = new Map();

  // Monitoring intervals
  private qualityMonitoringInterval?: NodeJS.Timeout;
  private performanceMonitoringInterval?: NodeJS.Timeout;
  private usageTrackingInterval?: NodeJS.Timeout;
  private reportingInterval?: NodeJS.Timeout;

  // Performance tracking
  private sessionStartTime = Date.now();
  private totalOperations = 0;
  private qualityScores: Map<string, number[]> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor(config: SampleAnalyticsConfig) {
    super();
    this.config = config;
    this.initialize();
  }

  /**
   * Initialize the analytics engine
   */
  private initialize(): void {
    if (this.config.enabled) {
      this.startMonitoring();
      console.log(
        '🔍 SampleAnalyticsEngine initialized with monitoring enabled',
      );
    } else {
      console.log(
        '🔍 SampleAnalyticsEngine initialized with monitoring disabled',
      );
    }
  }

  /**
   * Record sample operation for analytics
   */
  public recordSampleOperation(
    sampleId: string,
    operation: 'load' | 'save' | 'delete' | 'convert' | 'analyze',
    result: AudioSampleOperationResult,
    metadata?: AudioSampleMetadata,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled) return;

    const timestamp = Date.now();
    this.totalOperations++;

    // Update or create analytics data
    let sampleAnalytics = this.analyticsData.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!sampleAnalytics) {
      sampleAnalytics = this.createInitialAnalyticsData(sampleId, timestamp);
      this.analyticsData.set(sampleId, sampleAnalytics);
    }

    // Update metrics based on operation
    this.updateMetricsForOperation(
      sampleAnalytics,
      operation,
      result,
      metadata,
    );

    // Record quality metrics if available
    if (result.qualityScore) {
      this.recordQualityMetrics(sampleId, result.qualityScore, timestamp);
    }

    // Record performance metrics
    this.recordPerformanceMetrics(sampleId, result, timestamp);

    // Check for alerts
    this.checkAlertThresholds(sampleId, sampleAnalytics);

    // Emit analytics update event
    this.emit('analyticsUpdated', {
      sampleId,
      operation,
      analytics: sampleAnalytics,
      timestamp,
    });
  }

  /**
   * Record playback event for analytics
   */
  public recordPlaybackEvent(
    sampleId: string,
    event: 'play' | 'pause' | 'stop' | 'complete' | 'skip',
    duration?: number,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled || !this.config.trackPlayback) return;

    const analytics = this.analyticsData.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!analytics) return;

    const playbackMetrics = analytics.playbackMetrics;

    switch (event) {
      case 'play':
        playbackMetrics.totalPlays++;
        playbackMetrics.lastPlayed = Date.now();
        break;
      case 'complete':
        if (duration) {
          playbackMetrics.totalDuration += duration;
          playbackMetrics.averagePlayDuration =
            playbackMetrics.totalDuration / playbackMetrics.totalPlays;

          // Update completion rate
          const completionEvents = playbackMetrics.totalPlays;
          playbackMetrics.completionRate =
            (playbackMetrics.completionRate * (completionEvents - 1) + 1) /
            completionEvents;
        }
        break;
      case 'skip': {
        const skipEvents = playbackMetrics.totalPlays;
        playbackMetrics.skipRate =
          (playbackMetrics.skipRate * (skipEvents - 1) + 1) / skipEvents;
        break;
      }
    }

    // Update analytics timestamp
    analytics.timestamp = Date.now();

    this.emit('playbackAnalyticsUpdated', {
      sampleId,
      event,
      metrics: playbackMetrics,
    });
  }

  /**
   * Record user interaction for analytics
   */
  public recordUserInteraction(
    sampleId: string,
    interaction:
      | 'like'
      | 'dislike'
      | 'share'
      | 'download'
      | 'bookmark'
      | 'comment'
      | 'rate',
    value?: number,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enabled || !this.config.trackUserInteractions) return;

    const analytics = this.analyticsData.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!analytics) return;

    const interactionMetrics = analytics.interactionMetrics;

    switch (interaction) {
      case 'like':
        interactionMetrics.likes++;
        break;
      case 'dislike':
        interactionMetrics.dislikes++;
        break;
      case 'share':
        interactionMetrics.shares++;
        break;
      case 'download':
        interactionMetrics.downloads++;
        break;
      case 'bookmark':
        interactionMetrics.bookmarks++;
        break;
      case 'comment':
        interactionMetrics.comments++;
        break;
      case 'rate':
        if (value !== undefined) {
          interactionMetrics.ratingCount++;
          interactionMetrics.averageRating =
            (interactionMetrics.averageRating *
              (interactionMetrics.ratingCount - 1) +
              value) /
            interactionMetrics.ratingCount;
        }
        break;
    }

    analytics.timestamp = Date.now();

    this.emit('interactionAnalyticsUpdated', {
      sampleId,
      interaction,
      value,
      metrics: interactionMetrics,
    });
  }

  /**
   * Get analytics data for a specific sample
   */
  public getSampleAnalytics(sampleId: string): SampleAnalyticsData | null {
    return this.analyticsData.get(sampleId) || null;
  }

  /**
   * Get aggregated analytics for all samples
   */
  public getAggregatedAnalytics(): AnalyticsAggregation {
    const samples = Array.from(this.analyticsData.values());
    const totalSamples = samples.length;

    if (totalSamples === 0) {
      return this.createEmptyAggregation();
    }

    const totalPlayback = samples.reduce(
      (sum, s) => sum + s.playbackMetrics.totalPlays,
      0,
    );
    const averageQuality =
      samples.reduce((sum, s) => sum + s.qualityMetrics.audioQualityScore, 0) /
      totalSamples;
    const averagePerformance =
      samples.reduce((sum, s) => sum + s.performanceMetrics.successRate, 0) /
      totalSamples;

    // Find top performing samples
    const topPerformingSamples = samples
      .sort(
        (a, b) =>
          b.performanceMetrics.successRate - a.performanceMetrics.successRate,
      )
      .slice(0, 10)
      .map((s) => s.sampleId);

    // Generate quality trends
    const qualityTrends = this.generateQualityTrends();

    // Get active performance alerts
    const performanceAlerts = Array.from(this.activeAlerts.values()).flat();

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      totalSamples,
      totalPlayback,
      averageQuality,
      averagePerformance,
      topPerformingSamples,
      qualityTrends,
      performanceAlerts,
      recommendations,
      generatedAt: Date.now(),
    };
  }

  /**
   * Get real-time monitoring data for a specific sample
   */
  public getRealTimeMonitoringData(
    sampleId: string,
  ): RealTimeMonitoringData | null {
    const analytics = this.analyticsData.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!analytics) return null;

    const alerts = this.activeAlerts.get(sampleId) || [];
    const status = this.determineHealthStatus(analytics, alerts);

    return {
      sampleId,
      timestamp: Date.now(),
      metrics: {
        quality: analytics.qualityMetrics.audioQualityScore,
        performance: analytics.performanceMetrics.successRate,
        usage: analytics.usageMetrics.usageFrequency,
      },
      alerts,
      status,
    };
  }

  /**
   * Start quality monitoring
   */
  public startQualityMonitoring(): void {
    if (
      // TODO: Review non-null assertion - consider null safety
      !this.config.enableQualityMonitoring ||
      this.qualityMonitoringInterval
    ) {
      return;
    }

    this.qualityMonitoringInterval = setInterval(() => {
      this.performQualityCheck();
    }, this.config.qualityCheckInterval);

    console.log('🔍 Quality monitoring started');
    this.emit('qualityMonitoringStarted');
  }

  /**
   * Stop quality monitoring
   */
  public stopQualityMonitoring(): void {
    if (this.qualityMonitoringInterval) {
      clearInterval(this.qualityMonitoringInterval);
      this.qualityMonitoringInterval = undefined;
      console.log('🔍 Quality monitoring stopped');
      this.emit('qualityMonitoringStopped');
    }
  }

  /**
   * Start performance monitoring
   */
  public startPerformanceMonitoring(): void {
    if (
      // TODO: Review non-null assertion - consider null safety
      !this.config.enablePerformanceMonitoring ||
      this.performanceMonitoringInterval
    ) {
      return;
    }

    this.performanceMonitoringInterval = setInterval(() => {
      this.performPerformanceCheck();
    }, this.config.performanceMetricsInterval);

    console.log('📊 Performance monitoring started');
    this.emit('performanceMonitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  public stopPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = undefined;
      console.log('📊 Performance monitoring stopped');
      this.emit('performanceMonitoringStopped');
    }
  }

  /**
   * Get performance recommendations for a sample
   */
  public getPerformanceRecommendations(
    sampleId: string,
  ): AnalyticsRecommendation[] {
    return this.recommendations.get(sampleId) || [];
  }

  /**
   * Get quality trends for a sample
   */
  public getQualityTrends(sampleId: string): QualityTrend | null {
    const qualityData = this.qualityHistory.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!qualityData || qualityData.length < 2) return null;

    return this.analyzeQualityTrend(sampleId, qualityData);
  }

  /**
   * Generate analytics report
   */
  public generateReport(): AnalyticsReport {
    const aggregated = this.getAggregatedAnalytics();
    const sessionDuration = Date.now() - this.sessionStartTime;

    return {
      reportId: `report_${Date.now()}`,
      generatedAt: Date.now(),
      sessionDuration,
      totalOperations: this.totalOperations,
      aggregatedAnalytics: aggregated,
      topSamples: this.getTopSamples(10),
      qualityDistribution: this.getQualityDistribution(),
      performanceDistribution: this.getPerformanceDistribution(),
      alertSummary: this.getAlertSummary(),
      recommendations: aggregated.recommendations,
    };
  }

  /**
   * Cleanup and dispose
   */
  public async dispose(): Promise<void> {
    this.stopQualityMonitoring();
    this.stopPerformanceMonitoring();

    if (this.usageTrackingInterval) {
      clearInterval(this.usageTrackingInterval);
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }

    this.removeAllListeners();
    console.log('🔍 SampleAnalyticsEngine disposed');
  }

  // Private helper methods

  private startMonitoring(): void {
    if (this.config.enableQualityMonitoring) {
      this.startQualityMonitoring();
    }

    if (this.config.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring();
    }

    if (this.config.enableUsageAnalytics) {
      this.startUsageTracking();
    }

    if (this.config.enableReporting) {
      this.startReporting();
    }
  }

  private startUsageTracking(): void {
    this.usageTrackingInterval = setInterval(() => {
      this.performUsageAnalysis();
    }, this.config.usageTrackingInterval);
  }

  private startReporting(): void {
    this.reportingInterval = setInterval(() => {
      const report = this.generateReport();
      this.emit('reportGenerated', report);
    }, this.config.reportingInterval);
  }

  private createInitialAnalyticsData(
    sampleId: string,
    timestamp: number,
  ): SampleAnalyticsData {
    return {
      sampleId,
      timestamp,
      playbackMetrics: {
        totalPlays: 0,
        totalDuration: 0,
        averagePlayDuration: 0,
        completionRate: 0,
        skipRate: 0,
        repeatRate: 0,
        lastPlayed: 0,
      },
      qualityMetrics: {
        audioQualityScore: 0.8, // Default score
        compressionEfficiency: 0,
        dynamicRange: 0,
        signalToNoiseRatio: 0,
        totalHarmonicDistortion: 0,
        frequencyResponse: [],
        qualityTrend: 'stable',
      },
      performanceMetrics: {
        loadTime: 0,
        firstByteTime: 0,
        throughput: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        cacheHitRate: 0,
        errorRate: 0,
        successRate: 1.0,
      },
      usageMetrics: {
        uniqueUsers: 0,
        sessionsWithSample: 0,
        averageSessionDuration: 0,
        peakUsageTime: 0,
        usageFrequency: 0,
        userRetention: 0,
        popularityRank: 0,
      },
      interactionMetrics: {
        likes: 0,
        dislikes: 0,
        shares: 0,
        downloads: 0,
        bookmarks: 0,
        comments: 0,
        averageRating: 0,
        ratingCount: 0,
        feedbackCount: 0,
      },
    };
  }

  private updateMetricsForOperation(
    analytics: SampleAnalyticsData,
    operation: string,
    result: AudioSampleOperationResult,
    metadata?: AudioSampleMetadata,
  ): void {
    const performanceMetrics = analytics.performanceMetrics;

    // Update performance metrics
    performanceMetrics.loadTime = result.duration;

    if (result.success) {
      performanceMetrics.successRate =
        performanceMetrics.successRate * 0.95 + 0.05; // Moving average
    } else {
      performanceMetrics.errorRate = performanceMetrics.errorRate * 0.95 + 0.05; // Moving average
      performanceMetrics.successRate = performanceMetrics.successRate * 0.95; // Decrease success rate
    }

    // Update cache hit rate
    if (result.source === 'cache') {
      performanceMetrics.cacheHitRate =
        performanceMetrics.cacheHitRate * 0.9 + 0.1; // Moving average
    }

    // Update quality metrics if metadata is available
    if (metadata) {
      this.updateQualityMetrics(analytics, metadata);
    }

    // Update usage metrics
    analytics.usageMetrics.sessionsWithSample++;
    analytics.timestamp = Date.now();
  }

  private updateQualityMetrics(
    analytics: SampleAnalyticsData,
    metadata: AudioSampleMetadata,
  ): void {
    const qualityMetrics = analytics.qualityMetrics;

    // Update quality score based on metadata
    if (metadata.peakAmplitude) {
      qualityMetrics.dynamicRange = metadata.dynamicRange;
      qualityMetrics.signalToNoiseRatio = this.calculateSNR(metadata);
    }

    // Update compression efficiency
    if (metadata.compressionRatio) {
      qualityMetrics.compressionEfficiency = metadata.compressionRatio;
    }

    // Calculate overall quality score
    qualityMetrics.audioQualityScore =
      this.calculateOverallQualityScore(qualityMetrics);
  }

  private recordQualityMetrics(
    sampleId: string,
    qualityScore: number,
    timestamp: number,
  ): void {
    let qualityData = this.qualityHistory.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!qualityData) {
      qualityData = [];
      this.qualityHistory.set(sampleId, qualityData);
    }

    qualityData.push({ timestamp, value: qualityScore });

    // Keep only recent data (last 100 points)
    if (qualityData.length > 100) {
      qualityData.shift();
    }

    // Update quality scores for aggregation
    let scores = this.qualityScores.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!scores) {
      scores = [];
      this.qualityScores.set(sampleId, scores);
    }
    scores.push(qualityScore);

    if (scores.length > 50) {
      scores.shift();
    }
  }

  private recordPerformanceMetrics(
    sampleId: string,
    result: AudioSampleOperationResult,
    timestamp: number,
  ): void {
    let performanceData = this.performanceHistory.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!performanceData) {
      performanceData = [];
      this.performanceHistory.set(sampleId, performanceData);
    }

    performanceData.push({
      timestamp,
      value: result.duration,
      success: result.success,
    });

    // Keep only recent data (last 100 points)
    if (performanceData.length > 100) {
      performanceData.shift();
    }

    // Update performance metrics for aggregation
    let metrics = this.performanceMetrics.get(sampleId);
    // TODO: Review non-null assertion - consider null safety
    if (!metrics) {
      metrics = [];
      this.performanceMetrics.set(sampleId, metrics);
    }
    metrics.push(result.duration);

    if (metrics.length > 50) {
      metrics.shift();
    }
  }

  private checkAlertThresholds(
    sampleId: string,
    analytics: SampleAnalyticsData,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.config.enableAlerts) return;

    const alerts: PerformanceAlert[] = [];
    const thresholds = this.config.alertThresholds;

    // Check quality degradation
    if (
      analytics.qualityMetrics.audioQualityScore < thresholds.qualityDegradation
    ) {
      alerts.push(
        this.createAlert(
          sampleId,
          'quality',
          'high',
          'Quality degradation detected',
          thresholds.qualityDegradation,
          analytics.qualityMetrics.audioQualityScore,
          ['Consider re-encoding sample', 'Check source audio quality'],
        ),
      );
    }

    // Check performance degradation
    if (
      analytics.performanceMetrics.successRate <
      thresholds.performanceDegradation
    ) {
      alerts.push(
        this.createAlert(
          sampleId,
          'performance',
          'medium',
          'Performance degradation detected',
          thresholds.performanceDegradation,
          analytics.performanceMetrics.successRate,
          ['Check network connectivity', 'Verify sample integrity'],
        ),
      );
    }

    // Check error rate increase
    if (analytics.performanceMetrics.errorRate > thresholds.errorRateIncrease) {
      alerts.push(
        this.createAlert(
          sampleId,
          'performance',
          'critical',
          'High error rate detected',
          thresholds.errorRateIncrease,
          analytics.performanceMetrics.errorRate,
          ['Check sample file integrity', 'Verify storage connectivity'],
        ),
      );
    }

    if (alerts.length > 0) {
      this.activeAlerts.set(sampleId, alerts);
      this.emit('alertsTriggered', { sampleId, alerts });
    }
  }

  private createAlert(
    sampleId: string,
    alertType: 'quality' | 'performance' | 'usage',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    threshold: number,
    actualValue: number,
    recommendations: string[],
  ): PerformanceAlert {
    return {
      alertId: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sampleId,
      alertType,
      severity,
      message,
      timestamp: Date.now(),
      threshold,
      actualValue,
      recommendations,
    };
  }

  private performQualityCheck(): void {
    // Use Array.from to properly iterate over Map
    Array.from(this.analyticsData.entries()).forEach(
      ([sampleId, analytics]) => {
        const qualityScore = analytics.qualityMetrics.audioQualityScore;

        if (qualityScore < this.config.qualityThresholds.minAudioQuality) {
          this.emit('qualityAlert', {
            sampleId,
            qualityScore,
            threshold: this.config.qualityThresholds.minAudioQuality,
            timestamp: Date.now(),
          });
        }
      },
    );
  }

  private performPerformanceCheck(): void {
    // Use Array.from to properly iterate over Map
    Array.from(this.analyticsData.entries()).forEach(
      ([sampleId, analytics]) => {
        const loadTime = analytics.performanceMetrics.loadTime;

        if (loadTime > this.config.performanceThresholds.maxLoadTime) {
          this.emit('performanceAlert', {
            sampleId,
            loadTime,
            threshold: this.config.performanceThresholds.maxLoadTime,
            timestamp: Date.now(),
          });
        }
      },
    );
  }

  private performUsageAnalysis(): void {
    // Analyze usage patterns and update metrics
    Array.from(this.analyticsData.entries()).forEach(
      ([sampleId, analytics]) => {
        const usageMetrics = analytics.usageMetrics;

        // Calculate usage frequency (plays per day)
        const daysSinceFirstPlay =
          (Date.now() - this.sessionStartTime) / (1000 * 60 * 60 * 24);
        if (daysSinceFirstPlay > 0) {
          usageMetrics.usageFrequency =
            analytics.playbackMetrics.totalPlays / daysSinceFirstPlay;
        }

        // Update popularity rank
        usageMetrics.popularityRank = this.calculatePopularityRank(sampleId);
      },
    );
  }

  private calculatePopularityRank(sampleId: string): number {
    const allSamples = Array.from(this.analyticsData.values());
    const currentSample = this.analyticsData.get(sampleId);

    // TODO: Review non-null assertion - consider null safety
    if (!currentSample) return 0;

    const sortedByPlays = allSamples.sort(
      (a, b) => b.playbackMetrics.totalPlays - a.playbackMetrics.totalPlays,
    );
    const rank = sortedByPlays.findIndex((s) => s.sampleId === sampleId) + 1;

    return rank;
  }

  private generateQualityTrends(): QualityTrend[] {
    const trends: QualityTrend[] = [];

    // Use Array.from to properly iterate over Map
    Array.from(this.qualityHistory.entries()).forEach(
      ([sampleId, qualityData]) => {
        if (qualityData.length >= 5) {
          const trend = this.analyzeQualityTrend(sampleId, qualityData);
          if (trend) {
            trends.push(trend);
          }
        }
      },
    );

    return trends;
  }

  private analyzeQualityTrend(
    sampleId: string,
    qualityData: QualityDataPoint[],
  ): QualityTrend | null {
    if (qualityData.length < 2) return null;

    const recentData = qualityData.slice(-10); // Last 10 data points
    const firstDataPoint = recentData[0];
    const lastDataPoint = recentData[recentData.length - 1];

    // TODO: Review non-null assertion - consider null safety
    if (!firstDataPoint || !lastDataPoint) return null;

    const firstValue = firstDataPoint.value;
    const lastValue = lastDataPoint.value;
    const change = lastValue - firstValue;
    const changePercent = Math.abs(change / firstValue);

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    let confidence = 0.5;

    if (changePercent > 0.1) {
      // 10% change threshold
      trend = change > 0 ? 'improving' : 'degrading';
      confidence = Math.min(changePercent * 2, 1.0); // Max confidence of 1.0
    }

    return {
      sampleId,
      trend,
      confidence,
      timeWindow: lastDataPoint.timestamp - firstDataPoint.timestamp,
      dataPoints: recentData.length,
    };
  }

  private generateRecommendations(): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    // Analyze all samples for optimization opportunities
    Array.from(this.analyticsData.entries()).forEach(
      ([sampleId, analytics]) => {
        const sampleRecommendations = this.generateSampleRecommendations(
          sampleId,
          analytics,
        );
        recommendations.push(...sampleRecommendations);
      },
    );

    // Sort by priority and return top recommendations
    return recommendations
      .sort(
        (a, b) =>
          this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority),
      )
      .slice(0, 20); // Top 20 recommendations
  }

  private generateSampleRecommendations(
    sampleId: string,
    analytics: SampleAnalyticsData,
  ): AnalyticsRecommendation[] {
    const recommendations: AnalyticsRecommendation[] = [];

    // Quality optimization recommendations
    if (analytics.qualityMetrics.audioQualityScore < 0.7) {
      recommendations.push({
        recommendationId: `quality_${sampleId}_${Date.now()}`,
        type: 'quality',
        priority: 'high',
        title: 'Improve Audio Quality',
        description: `Sample ${sampleId} has low quality score (${analytics.qualityMetrics.audioQualityScore.toFixed(2)})`,
        expectedImprovement: 0.3,
        implementationComplexity: 'medium',
        autoApplicable: false,
        createdAt: Date.now(),
      });
    }

    // Performance optimization recommendations
    if (analytics.performanceMetrics.loadTime > 5000) {
      recommendations.push({
        recommendationId: `performance_${sampleId}_${Date.now()}`,
        type: 'performance',
        priority: 'medium',
        title: 'Optimize Load Time',
        description: `Sample ${sampleId} has slow load time (${analytics.performanceMetrics.loadTime}ms)`,
        expectedImprovement: 0.5,
        implementationComplexity: 'low',
        autoApplicable: true,
        createdAt: Date.now(),
      });
    }

    // Usage optimization recommendations
    if (analytics.playbackMetrics.completionRate < 0.5) {
      recommendations.push({
        recommendationId: `usage_${sampleId}_${Date.now()}`,
        type: 'usage',
        priority: 'low',
        title: 'Improve User Engagement',
        description: `Sample ${sampleId} has low completion rate (${(analytics.playbackMetrics.completionRate * 100).toFixed(1)}%)`,
        expectedImprovement: 0.2,
        implementationComplexity: 'high',
        autoApplicable: false,
        createdAt: Date.now(),
      });
    }

    return recommendations;
  }

  private getPriorityScore(priority: 'low' | 'medium' | 'high'): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }

  private determineHealthStatus(
    analytics: SampleAnalyticsData,
    alerts: PerformanceAlert[],
  ): 'healthy' | 'warning' | 'critical' {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    const highAlerts = alerts.filter((a) => a.severity === 'high');

    if (criticalAlerts.length > 0) return 'critical';
    if (highAlerts.length > 0 || analytics.performanceMetrics.errorRate > 0.1) {
      return 'warning';
    }
    return 'healthy';
  }

  private createEmptyAggregation(): AnalyticsAggregation {
    return {
      totalSamples: 0,
      totalPlayback: 0,
      averageQuality: 0,
      averagePerformance: 0,
      topPerformingSamples: [],
      qualityTrends: [],
      performanceAlerts: [],
      recommendations: [],
      generatedAt: Date.now(),
    };
  }

  private calculateSNR(metadata: AudioSampleMetadata): number {
    // Calculate signal-to-noise ratio based on metadata
    const peakLevel = metadata.peakAmplitude || 0;
    const rmsLevel = metadata.rmsLevel || 0;

    if (rmsLevel > 0) {
      return 20 * Math.log10(peakLevel / rmsLevel);
    }

    return 0;
  }

  private calculateOverallQualityScore(
    qualityMetrics: SampleAnalyticsData['qualityMetrics'],
  ): number {
    // Weighted average of quality factors
    const weights = {
      snr: 0.3,
      dynamicRange: 0.2,
      compressionEfficiency: 0.2,
      thd: 0.3,
    };

    let score = 0;
    let totalWeight = 0;

    if (qualityMetrics.signalToNoiseRatio > 0) {
      score += (qualityMetrics.signalToNoiseRatio / 100) * weights.snr;
      totalWeight += weights.snr;
    }

    if (qualityMetrics.dynamicRange > 0) {
      score += (qualityMetrics.dynamicRange / 100) * weights.dynamicRange;
      totalWeight += weights.dynamicRange;
    }

    if (qualityMetrics.compressionEfficiency > 0) {
      score +=
        qualityMetrics.compressionEfficiency * weights.compressionEfficiency;
      totalWeight += weights.compressionEfficiency;
    }

    if (qualityMetrics.totalHarmonicDistortion > 0) {
      score += (1 - qualityMetrics.totalHarmonicDistortion) * weights.thd;
      totalWeight += weights.thd;
    }

    return totalWeight > 0 ? score / totalWeight : 0.8; // Default to 0.8 if no metrics available
  }

  private getTopSamples(
    count: number,
  ): Array<{ sampleId: string; score: number; plays: number }> {
    return Array.from(this.analyticsData.values())
      .map((analytics) => ({
        sampleId: analytics.sampleId,
        score: analytics.qualityMetrics.audioQualityScore,
        plays: analytics.playbackMetrics.totalPlays,
      }))
      .sort((a, b) => b.score - a.score || b.plays - a.plays)
      .slice(0, count);
  }

  private getQualityDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      excellent: 0, // > 0.9
      good: 0, // 0.7 - 0.9
      fair: 0, // 0.5 - 0.7
      poor: 0, // < 0.5
    };

    // Use Array.from to properly iterate over Map values
    Array.from(this.analyticsData.values()).forEach((analytics) => {
      const score = analytics.qualityMetrics.audioQualityScore;
      // TODO: Review non-null assertion - consider null safety
      if (score > 0.9) distribution.excellent!++;
      // TODO: Review non-null assertion - consider null safety
      else if (score > 0.7) distribution.good!++;
      // TODO: Review non-null assertion - consider null safety
      else if (score > 0.5) distribution.fair!++;
      // TODO: Review non-null assertion - consider null safety
      else distribution.poor!++;
    });

    return distribution;
  }

  private getPerformanceDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      fast: 0, // < 1000ms
      medium: 0, // 1000-3000ms
      slow: 0, // 3000-5000ms
      very_slow: 0, // > 5000ms
    };

    // Use Array.from to properly iterate over Map values
    Array.from(this.analyticsData.values()).forEach((analytics) => {
      const loadTime = analytics.performanceMetrics.loadTime;
      // TODO: Review non-null assertion - consider null safety
      if (loadTime < 1000) distribution.fast!++;
      // TODO: Review non-null assertion - consider null safety
      else if (loadTime < 3000) distribution.medium!++;
      // TODO: Review non-null assertion - consider null safety
      else if (loadTime < 5000) distribution.slow!++;
      // TODO: Review non-null assertion - consider null safety
      else distribution.very_slow!++;
    });

    return distribution;
  }

  private getAlertSummary(): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    const allAlerts = Array.from(this.activeAlerts.values()).flat();

    return {
      total: allAlerts.length,
      critical: allAlerts.filter((a) => a.severity === 'critical').length,
      high: allAlerts.filter((a) => a.severity === 'high').length,
      medium: allAlerts.filter((a) => a.severity === 'medium').length,
      low: allAlerts.filter((a) => a.severity === 'low').length,
    };
  }
}
