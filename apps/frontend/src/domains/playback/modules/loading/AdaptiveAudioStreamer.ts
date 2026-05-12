/**
 * Adaptive Audio Streamer
 *
 * Enterprise-grade adaptive streaming orchestrator with progressive loading,
 * real-time quality adaptation, and intelligent format optimization.
 * Extracted from original with all streaming features preserved.
 */

import type {
  AdaptiveAudioStreamingConfig,
  AudioSampleMetadata,
  StreamingSession,
  NetworkConditions,
  StreamingChunk,
  StreamingResult,
  StreamingPerformanceMetrics,
  AudioSampleQualityProfile,
  AudioSampleFormat,
  IAdaptiveAudioStreamer,
} from './types';
import { createStructuredLogger } from '../shared/index.js';

const logger = createStructuredLogger('AdaptiveAudioStreamer');

export class AdaptiveAudioStreamer implements IAdaptiveAudioStreamer {
  private static instance: AdaptiveAudioStreamer | null = null;

  private config: AdaptiveAudioStreamingConfig;
  private isInitialized = false;

  // Session management
  private activeSessions = new Map<string, StreamingSession>();
  private sessionCounter = 0;

  // Network monitoring
  private networkConditions!: NetworkConditions;
  private networkMonitorInterval?: NodeJS.Timeout;

  // Performance tracking
  private performanceMetrics = new Map<string, StreamingPerformanceMetrics>();

  // Optimization state
  private qualityPreferences = new Map<string, AudioSampleQualityProfile>();
  private formatCache = new Map<
    string,
    { format: AudioSampleFormat; optimized: ArrayBuffer }
  >();

  constructor(config: AdaptiveAudioStreamingConfig) {
    this.config = config;
    this.initializeNetworkConditions();
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: AdaptiveAudioStreamingConfig,
  ): AdaptiveAudioStreamer {
    if (!AdaptiveAudioStreamer.instance) {
      if (!config) {
        throw new Error(
          'Config required for first instantiation of AdaptiveAudioStreamer',
        );
      }
      AdaptiveAudioStreamer.instance = new AdaptiveAudioStreamer(config);
    }
    return AdaptiveAudioStreamer.instance;
  }

  /**
   * Initialize the adaptive audio streamer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.config.enabled) {
      logger.info('AdaptiveAudioStreamer disabled in config');
      return;
    }

    logger.info('🌊 Initializing Adaptive Audio Streamer...');

    try {
      // Start network monitoring if enabled
      if (this.config.enableNetworkMonitoring) {
        await this.startNetworkMonitoring();
      }

      // Initialize format optimization
      if (this.config.enableFormatOptimization) {
        await this.initializeFormatOptimization();
      }

      this.isInitialized = true;
      logger.info('✅ Adaptive Audio Streamer initialized successfully');
    } catch (error) {
      logger.error(
        '❌ Failed to initialize Adaptive Audio Streamer:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Stream an audio sample with adaptive quality and progressive loading
   */
  async streamSample(
    sampleId: string,
    metadata: AudioSampleMetadata,
    options: {
      preferredQuality?: AudioSampleQualityProfile;
      startPlaybackEarly?: boolean;
      enableOptimization?: boolean;
    } = {},
  ): Promise<StreamingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sessionId = this.generateSessionId();
    const startTime = Date.now();

    try {
      // Create streaming session
      const session = await this.createStreamingSession(
        sessionId,
        sampleId,
        metadata,
        options,
      );

      // Determine optimal streaming strategy
      const streamingStrategy = this.determineStreamingStrategy(session);

      let result: StreamingResult;

      if (
        this.config.enableProgressiveLoading &&
        this.shouldUseProgressiveLoading(metadata)
      ) {
        result = await this.streamWithProgressiveLoading(
          session,
          streamingStrategy,
        );
      } else {
        result = await this.streamStandard(session, streamingStrategy);
      }

      // Update performance metrics
      const performance = this.calculatePerformanceMetrics(session);
      result.performance = performance;
      this.performanceMetrics.set(sessionId, performance);

      // Cleanup session
      this.activeSessions.delete(sessionId);

      logger.info(`🎵 Stream completed for ${sampleId}`, {
        quality: result.finalQuality,
        loadTime: result.totalLoadTime,
        bytes: result.bytesTransferred,
      });

      return result;
    } catch (error) {
      this.activeSessions.delete(sessionId);

      logger.error(
        '❌ Streaming failed:',
        error instanceof Error ? error : new Error(String(error)),
        { sampleId, sessionId },
      );

      return {
        success: false,
        sessionId,
        totalLoadTime: Date.now() - startTime,
        bytesTransferred: 0,
        compressionSavings: 0,
        qualityAdaptations: 0,
        error:
          error instanceof Error ? error : new Error('Unknown streaming error'),
        performance: {
          averageChunkLoadTime: 0,
          totalBufferTime: 0,
          networkUtilization: 0,
          qualityStability: 0,
          bufferUnderruns: 0,
          formatOptimizationSavings: 0,
        },
      };
    }
  }

  /**
   * Get current network conditions
   */
  getNetworkConditions(): NetworkConditions {
    return { ...this.networkConditions };
  }

  /**
   * Get active streaming sessions
   */
  getActiveSessions(): StreamingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get performance metrics for a session
   */
  getPerformanceMetrics(sessionId: string): StreamingPerformanceMetrics | null {
    return this.performanceMetrics.get(sessionId) || null;
  }

  /**
   * Cancel an active streaming session
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isStreaming = false;
    this.activeSessions.delete(sessionId);
    logger.info(`❌ Session cancelled: ${sessionId}`);
    return true;
  }

  /**
   * Cleanup and shutdown the streamer
   */
  async cleanup(): Promise<void> {
    // Cancel all active sessions
    const sessionIds = Array.from(this.activeSessions.keys());
    for (const sessionId of sessionIds) {
      await this.cancelSession(sessionId);
    }

    // Stop network monitoring
    if (this.networkMonitorInterval) {
      clearInterval(this.networkMonitorInterval);
      this.networkMonitorInterval = undefined;
    }

    // Clear caches
    this.formatCache.clear();
    this.performanceMetrics.clear();
    this.qualityPreferences.clear();

    // Clear singleton
    AdaptiveAudioStreamer.instance = null;

    logger.info('🧹 AdaptiveAudioStreamer cleaned up');
  }

  // Private initialization methods
  private initializeNetworkConditions(): void {
    this.networkConditions = {
      bandwidth: 1000, // Default 1 Mbps
      latency: 100, // Default 100ms
      connectionType: 'unknown',
      stability: 1.0,
      lastMeasured: Date.now(),
    };
  }

  private async startNetworkMonitoring(): Promise<void> {
    logger.info('📡 Starting network monitoring...');

    // Initial network detection
    await this.detectNetworkConditions();

    // Set up periodic monitoring
    this.networkMonitorInterval = setInterval(async () => {
      await this.detectNetworkConditions();
    }, 5000); // Check every 5 seconds
  }

  private async initializeFormatOptimization(): Promise<void> {
    logger.info('🔧 Initializing format optimization...');

    // Initialize format optimization cache and preferences
    this.formatCache.clear();

    // Set up preferred formats based on network conditions
    const { bandwidth } = this.networkConditions;
    const thresholds = this.config.bandwidthThresholds;

    if (bandwidth > thresholds.excellent) {
      this.config.preferredFormats = ['wav', 'flac', 'mp3'];
    } else if (bandwidth > thresholds.good) {
      this.config.preferredFormats = ['mp3', 'ogg'];
    } else {
      this.config.preferredFormats = ['ogg', 'mp3'];
    }
  }

  // Session management
  private async createStreamingSession(
    sessionId: string,
    sampleId: string,
    metadata: AudioSampleMetadata,
    options: any,
  ): Promise<StreamingSession> {
    // Determine optimal quality based on network conditions and preferences
    const optimalQuality = this.determineOptimalQuality(
      metadata,
      options.preferredQuality,
    );

    const session: StreamingSession = {
      sessionId,
      sampleId,
      metadata,
      currentQuality: optimalQuality,
      targetQuality: optimalQuality,
      isStreaming: true,
      startTime: Date.now(),
      totalChunks: this.calculateTotalChunks(metadata),
      loadedChunks: 0,
      bufferHealth: 0,
      networkConditions: { ...this.networkConditions },
      qualityTransitions: [],
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private determineOptimalQuality(
    metadata: AudioSampleMetadata,
    preferredQuality?: AudioSampleQualityProfile,
  ): AudioSampleQualityProfile {
    if (preferredQuality) {
      return preferredQuality;
    }

    // Use intelligent quality selection based on network conditions
    const { bandwidth, latency } = this.networkConditions;
    const thresholds = this.config.bandwidthThresholds;
    const latencyThresholds = this.config.latencyThresholds;

    // High quality conditions
    if (
      bandwidth > thresholds.excellent &&
      latency < latencyThresholds.excellent
    ) {
      return metadata.size > 10 * 1024 * 1024 ? 'performance' : 'studio';
    }

    // Good quality conditions
    if (bandwidth > thresholds.good && latency < latencyThresholds.good) {
      return 'performance';
    }

    // Fair quality conditions
    if (bandwidth > thresholds.fair && latency < latencyThresholds.fair) {
      return 'practice';
    }

    // Poor quality conditions - optimize for mobile/streaming
    return metadata.category === 'bass_notes' ? 'streaming' : 'mobile';
  }

  private calculateTotalChunks(metadata: AudioSampleMetadata): number {
    return Math.ceil(metadata.size / this.config.chunkSize);
  }

  private generateSessionId(): string {
    return `stream_${Date.now()}_${++this.sessionCounter}`;
  }

  // Streaming strategy determination
  private determineStreamingStrategy(
    session: StreamingSession,
  ): 'progressive' | 'standard' | 'optimized' {
    const { metadata } = session;

    // Large files benefit from progressive loading
    if (
      metadata.size > 5 * 1024 * 1024 &&
      this.config.enableProgressiveLoading
    ) {
      return 'progressive';
    }

    // Files that need format optimization
    if (
      this.config.enableFormatOptimization &&
      this.shouldOptimizeFormat(metadata)
    ) {
      return 'optimized';
    }

    // Standard streaming for smaller files
    return 'standard';
  }

  private shouldUseProgressiveLoading(metadata: AudioSampleMetadata): boolean {
    return (
      this.config.enableProgressiveLoading &&
      metadata.size > this.config.chunkSize * 2 && // At least 2 chunks
      metadata.duration > 30 // At least 30 seconds
    );
  }

  private shouldOptimizeFormat(metadata: AudioSampleMetadata): boolean {
    if (!this.config.enableFormatOptimization) {
      return false;
    }

    // Optimize if current format is not preferred for network conditions
    const optimalFormat = this.getOptimalFormat();
    return metadata.format !== optimalFormat;
  }

  private getOptimalFormat(): AudioSampleFormat {
    const { bandwidth } = this.networkConditions;
    const thresholds = this.config.bandwidthThresholds;

    // High bandwidth - prefer quality
    if (bandwidth > thresholds.excellent) {
      return this.config.preferredFormats[0] || 'wav';
    }

    // Medium bandwidth - balanced
    if (bandwidth > thresholds.good) {
      return 'mp3';
    }

    // Low bandwidth - optimize for size
    return 'ogg';
  }

  // Progressive loading implementation
  private async streamWithProgressiveLoading(
    session: StreamingSession,
    _strategy: string,
  ): Promise<StreamingResult> {
    const chunks: StreamingChunk[] = [];
    const startTime = Date.now();
    let totalBytesTransferred = 0;
    let compressionSavings = 0;
    let qualityAdaptations = 0;

    try {
      // Start with initial chunks for immediate playback
      const initialChunks = Math.min(
        this.config.preloadChunks,
        session.totalChunks,
      );

      for (let i = 0; i < initialChunks; i++) {
        const chunk = await this.loadChunk(session, i);
        chunks.push(chunk);
        totalBytesTransferred += chunk.size;

        if (chunk.compressionRatio) {
          compressionSavings += chunk.size * (1 - chunk.compressionRatio);
        }

        session.loadedChunks++;
        session.bufferHealth = session.loadedChunks / session.totalChunks;

        // Check if quality adaptation is needed
        if (await this.shouldAdaptQuality(session)) {
          qualityAdaptations++;
          await this.adaptQuality(session);
        }
      }

      // Continue loading remaining chunks in background
      const remainingChunks = session.totalChunks - initialChunks;
      if (remainingChunks > 0) {
        await this.loadRemainingChunks(session, chunks, initialChunks);
      }

      // Combine chunks into final audio data
      const combinedData = await this.combineChunks(chunks);

      return {
        success: true,
        sessionId: session.sessionId,
        data: combinedData,
        metadata: session.metadata,
        chunks,
        finalQuality: session.currentQuality,
        finalFormat: chunks[0]?.format || session.metadata.format,
        totalLoadTime: Date.now() - startTime,
        bytesTransferred: totalBytesTransferred,
        compressionSavings,
        qualityAdaptations,
        performance: this.calculatePerformanceMetrics(session),
      };
    } catch (error) {
      logger.error(
        'Progressive loading failed:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async streamStandard(
    session: StreamingSession,
    strategy: string,
  ): Promise<StreamingResult> {
    const startTime = Date.now();

    try {
      // Mock standard streaming implementation
      // In real implementation, would use actual storage client
      const mockData = new ArrayBuffer(session.metadata.size);
      let compressionSavings = 0;
      let finalFormat = session.metadata.format;
      let finalData = mockData;

      // Apply format optimization if enabled
      if (strategy === 'optimized' && this.config.enableFormatOptimization) {
        const optimizedResult = await this.optimizeFormat(mockData, session);
        finalData = optimizedResult.data;
        finalFormat = optimizedResult.format;
        compressionSavings = optimizedResult.compressionSavings;
      }

      return {
        success: true,
        sessionId: session.sessionId,
        data: finalData,
        metadata: session.metadata,
        finalQuality: session.currentQuality,
        finalFormat,
        totalLoadTime: Date.now() - startTime,
        bytesTransferred: finalData.byteLength,
        compressionSavings,
        qualityAdaptations: 0,
        performance: this.calculatePerformanceMetrics(session),
      };
    } catch (error) {
      logger.error(
        'Standard streaming failed:',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // Chunk management
  private async loadChunk(
    session: StreamingSession,
    chunkIndex: number,
  ): Promise<StreamingChunk> {
    const chunkId = `${session.sessionId}_chunk_${chunkIndex}`;
    const startTime = Date.now();

    try {
      // Calculate chunk byte range
      const chunkStart = chunkIndex * this.config.chunkSize;
      const chunkEnd = Math.min(
        chunkStart + this.config.chunkSize,
        session.metadata.size,
      );

      // Mock chunk loading (in real implementation would use HTTP range requests)
      const chunkSize = chunkEnd - chunkStart;
      const chunkData = new ArrayBuffer(chunkSize);

      return {
        chunkId,
        sessionId: session.sessionId,
        index: chunkIndex,
        data: chunkData,
        size: chunkData.byteLength,
        quality: session.currentQuality,
        format: session.metadata.format,
        isOptimized: false,
        loadTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(
        `Failed to load chunk ${chunkIndex}:`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  private async loadRemainingChunks(
    session: StreamingSession,
    chunks: StreamingChunk[],
    startIndex: number,
  ): Promise<void> {
    const maxConcurrent = this.config.maxConcurrentStreams;
    const remainingIndices = Array.from(
      { length: session.totalChunks - startIndex },
      (_, i) => i + startIndex,
    );

    // Load chunks in batches to respect concurrency limits
    for (let i = 0; i < remainingIndices.length; i += maxConcurrent) {
      const batch = remainingIndices.slice(i, i + maxConcurrent);
      const batchPromises = batch.map((index) =>
        this.loadChunk(session, index),
      );

      const batchChunks = await Promise.all(batchPromises);
      chunks.push(...batchChunks);

      session.loadedChunks += batchChunks.length;
      session.bufferHealth = session.loadedChunks / session.totalChunks;
    }
  }

  private async combineChunks(chunks: StreamingChunk[]): Promise<ArrayBuffer> {
    // Sort chunks by index to ensure correct order
    chunks.sort((a, b) => a.index - b.index);

    // Calculate total size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    // Combine chunks into single ArrayBuffer
    const combined = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      const chunkArray = new Uint8Array(chunk.data);
      combined.set(chunkArray, offset);
      offset += chunk.size;
    }

    return combined.buffer;
  }

  // Quality adaptation
  private async shouldAdaptQuality(
    session: StreamingSession,
  ): Promise<boolean> {
    if (!this.config.enableQualityAdaptation) {
      return false;
    }

    // Check if network conditions have changed significantly
    const currentConditions = this.networkConditions;
    const sessionConditions = session.networkConditions;

    const bandwidthChange =
      Math.abs(currentConditions.bandwidth - sessionConditions.bandwidth) /
      sessionConditions.bandwidth;

    const latencyChange =
      Math.abs(currentConditions.latency - sessionConditions.latency) /
      sessionConditions.latency;

    // Adapt if bandwidth or latency changed by more than 25%
    return bandwidthChange > 0.25 || latencyChange > 0.25;
  }

  private async adaptQuality(session: StreamingSession): Promise<void> {
    const oldQuality = session.currentQuality;
    const newQuality = this.determineOptimalQuality(session.metadata);

    if (oldQuality !== newQuality) {
      session.targetQuality = newQuality;

      // For progressive loading, quality change affects future chunks
      if (this.config.enableProgressiveLoading) {
        session.currentQuality = newQuality;
      }

      // Record quality transition
      session.qualityTransitions.push({
        timestamp: Date.now(),
        fromQuality: oldQuality,
        toQuality: newQuality,
        reason: 'bandwidth',
        transitionTime: 0, // Will be updated when transition completes
      });

      // Update session network conditions
      session.networkConditions = { ...this.networkConditions };

      logger.info(`🔄 Quality adapted: ${oldQuality} → ${newQuality}`);
    }
  }

  // Format optimization
  private async optimizeFormat(
    data: ArrayBuffer,
    session: StreamingSession,
  ): Promise<{
    data: ArrayBuffer;
    format: AudioSampleFormat;
    compressionSavings: number;
  }> {
    const originalSize = data.byteLength;
    const optimalFormat = this.getOptimalFormat();

    if (session.metadata.format === optimalFormat) {
      // No optimization needed
      return {
        data,
        format: session.metadata.format,
        compressionSavings: 0,
      };
    }

    try {
      // Mock format optimization (in real implementation would use actual compression)
      const compressionRatio = this.getCompressionRatio(optimalFormat);
      const optimizedSize = Math.floor(originalSize * compressionRatio);
      const optimizedData = new ArrayBuffer(optimizedSize);

      const compressionSavings = Math.max(0, originalSize - optimizedSize);

      logger.info(
        `🗜️ Format optimized: ${session.metadata.format} → ${optimalFormat}`,
        {
          originalSize,
          optimizedSize,
          savings: compressionSavings,
        },
      );

      return {
        data: optimizedData,
        format: optimalFormat,
        compressionSavings,
      };
    } catch (error) {
      logger.warn('Format optimization failed, using original:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        data,
        format: session.metadata.format,
        compressionSavings: 0,
      };
    }
  }

  private getCompressionRatio(format: AudioSampleFormat): number {
    switch (format) {
      case 'wav':
        return 1.0; // No compression
      case 'flac':
        return 0.6; // Lossless compression
      case 'mp3':
        return 0.1; // High compression
      case 'ogg':
        return 0.08; // Very high compression
      default:
        return 0.8;
    }
  }

  // Network monitoring
  private async detectNetworkConditions(): Promise<void> {
    try {
      // Use Navigator Connection API if available (typed in window.d.ts)
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

      if (connection) {
        this.networkConditions.bandwidth = connection.downlink * 1000 || 1000; // Convert to kbps
        this.networkConditions.connectionType =
          connection.effectiveType || 'unknown';
        this.networkConditions.lastMeasured = Date.now();
      }

      // Measure latency with a simple request
      if (this.config.enableNetworkMonitoring) {
        const latency = await this.measureLatency();
        this.networkConditions.latency = latency;
      }

      // Calculate connection stability
      this.updateConnectionStability();
    } catch (error) {
      logger.warn('Network condition detection failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async measureLatency(): Promise<number> {
    try {
      const start = Date.now();

      // Make a small request to measure latency
      const response = await fetch('data:,', { method: 'HEAD' });

      if (response.ok) {
        return Date.now() - start;
      }

      return this.networkConditions.latency; // Fallback to previous value
    } catch {
      return this.networkConditions.latency; // Fallback to previous value
    }
  }

  private updateConnectionStability(): void {
    // Simplified stability calculation
    const { bandwidth, latency } = this.networkConditions;
    const thresholds = this.config.bandwidthThresholds;

    if (bandwidth > thresholds.good && latency < 100) {
      this.networkConditions.stability = Math.min(
        1.0,
        this.networkConditions.stability + 0.1,
      );
    } else if (bandwidth < thresholds.poor || latency > 500) {
      this.networkConditions.stability = Math.max(
        0.1,
        this.networkConditions.stability - 0.2,
      );
    }
  }

  // Performance calculation
  private calculatePerformanceMetrics(
    session: StreamingSession,
  ): StreamingPerformanceMetrics {
    const sessionDuration = Date.now() - session.startTime;

    return {
      averageChunkLoadTime: sessionDuration / Math.max(session.loadedChunks, 1),
      totalBufferTime: sessionDuration,
      networkUtilization: session.bufferHealth,
      qualityStability: this.calculateQualityStability(session),
      bufferUnderruns: 0, // Would be tracked during actual playback
      formatOptimizationSavings: 0, // Would be calculated based on actual optimization
    };
  }

  private calculateQualityStability(session: StreamingSession): number {
    if (session.qualityTransitions.length === 0) {
      return 1.0; // Perfect stability
    }

    // Calculate stability based on number of transitions
    const maxTransitions = 5; // Arbitrary threshold
    const stabilityScore = Math.max(
      0,
      1 - session.qualityTransitions.length / maxTransitions,
    );

    return stabilityScore;
  }

  // Utility methods
  // Utility methods removed as they are unused
}
