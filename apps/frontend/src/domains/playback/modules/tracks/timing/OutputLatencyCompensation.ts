/**
 * Output Latency Compensation System
 *
 * Provides sample-accurate latency compensation for the entire audio pipeline,
 * ensuring perfect synchronization between tracks with different plugin chains.
 * Works in conjunction with WAM plugins and the Transport system.
 *
 * Features:
 * - Automatic latency detection and measurement
 * - Per-track delay compensation
 * - Plugin chain latency calculation
 * - Dynamic compensation adjustment
 * - Zero-latency monitoring mode
 *
 * Extracted from services/core with all critical functionality preserved.
 */

import type { Transport } from '../../transport/core/Transport.js';
import type { EventBus } from '../../shared/index.js';
import type { Track } from '../core/Track.js';
import { createStructuredLogger } from '../../shared/index.js';

/**
 * Latency source types
 */
export enum LatencySource {
  SYSTEM = 'system',
  PLUGIN = 'plugin',
  BUFFER = 'buffer',
  NETWORK = 'network',
  PROCESSING = 'processing',
}

/**
 * Latency measurement
 */
export interface LatencyMeasurement {
  source: LatencySource;
  sourceId: string;
  latencySamples: number;
  latencyMs: number;
  timestamp: number;
  confidence: number; // 0-1, how confident we are in this measurement
}

/**
 * Track latency info
 */
export interface TrackLatencyInfo {
  trackId: string;
  totalLatencySamples: number;
  totalLatencyMs: number;
  measurements: LatencyMeasurement[];
  compensationDelaySamples: number;
  compensationDelayMs: number;
  isCompensated: boolean;
  lastUpdate: number;
}

/**
 * Latency compensation configuration
 */
export interface LatencyCompensationConfig {
  enabled: boolean;
  maxCompensationMs: number;
  measurementInterval: number; // ms
  adaptiveMode: boolean;
  zeroLatencyMonitoring: boolean;
  bufferAlignment: boolean;
}

/**
 * Simple delay buffer implementation
 */
class DelayBuffer {
  private buffer: Float32Array;
  private writeIndex = 0;
  private readIndex = 0;
  private delaySamples = 0;

  constructor(
    private maxDelaySamples: number,
    private channels = 2,
  ) {
    this.buffer = new Float32Array(maxDelaySamples * channels);
  }

  setDelay(samples: number): void {
    this.delaySamples = Math.min(samples, this.maxDelaySamples);
    this.readIndex =
      (this.writeIndex - this.delaySamples + this.buffer.length) %
      this.buffer.length;
  }

  process(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);

    for (let i = 0; i < input.length; i++) {
      // Write to buffer
      this.buffer[this.writeIndex] = input[i];
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length;

      // Read from buffer with delay
      output[i] = this.buffer[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.buffer.length;
    }

    return output;
  }

  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.readIndex = 0;
  }
}

const logger = createStructuredLogger('OutputLatencyCompensation');

/**
 * Output Latency Compensation Service
 */
export class OutputLatencyCompensation {
  private static instance: OutputLatencyCompensation | null = null;

  // Core properties
  private config: LatencyCompensationConfig;
  private sampleRate = 48000;
  private blockSize = 128;

  // Latency tracking
  private trackLatencies = new Map<string, TrackLatencyInfo>();
  private systemLatency: LatencyMeasurement | null = null;
  private maxTrackLatency = 0;

  // Delay buffers for compensation
  private delayBuffers = new Map<string, DelayBuffer>();

  // Services
  private transport?: Transport;
  private eventBus?: EventBus;

  // Monitoring
  private measurementInterval: NodeJS.Timeout | null = null;
  private compensationCallbacks = new Map<
    string,
    (info: TrackLatencyInfo) => void
  >();

  constructor() {
    this.config = {
      enabled: true,
      maxCompensationMs: 100, // 100ms max compensation
      measurementInterval: 1000, // Measure every second
      adaptiveMode: true,
      zeroLatencyMonitoring: false,
      bufferAlignment: true,
    };

    // Get audio context parameters
    if (typeof window !== 'undefined' && window.AudioContext) {
      const ctx = new AudioContext();
      this.sampleRate = ctx.sampleRate;
      ctx.close();
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OutputLatencyCompensation {
    if (!OutputLatencyCompensation.instance) {
      OutputLatencyCompensation.instance = new OutputLatencyCompensation();
    }
    return OutputLatencyCompensation.instance;
  }

  /**
   * Initialize with dependencies
   */
  public initialize(transport: Transport, eventBus?: EventBus): void {
    this.transport = transport;
    this.eventBus = eventBus;

    // Measure system latency on init
    this.measureSystemLatency();

    // Start automatic measurements if enabled
    if (this.config.adaptiveMode) {
      this.startMeasurements();
    }

    // Subscribe to events
    this.subscribeToEvents();

    logger.info('⏱️ Output latency compensation initialized', {
      sampleRate: this.sampleRate,
      maxCompensationMs: this.config.maxCompensationMs,
    });
  }

  /**
   * Subscribe to relevant events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // Track events
    this.eventBus.on('track:added', (data: any) => {
      this.initializeTrackCompensation(data.trackId);
    });

    this.eventBus.on('track:removed', (data: any) => {
      this.removeTrackCompensation(data.trackId);
    });

    // Plugin events
    this.eventBus.on('plugin:latencyChanged', (data: any) => {
      this.updatePluginLatency(data.trackId, data.pluginId, data.latency);
    });

    // Timing events
    this.eventBus.on('timing:syncRequired', () => {
      this.recalculateCompensation();
    });

    logger.info('📡 Subscribed to latency compensation events');
  }

  /**
   * Configure latency compensation
   */
  public configure(config: Partial<LatencyCompensationConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.enabled !== undefined && !config.enabled) {
      this.disable();
    } else if (config.enabled) {
      this.enable();
    }

    if (config.adaptiveMode !== undefined) {
      if (config.adaptiveMode) {
        this.startMeasurements();
      } else {
        this.stopMeasurements();
      }
    }

    logger.info('⚙️ Latency compensation configured', { config });
  }

  /**
   * Enable compensation
   */
  public enable(): void {
    this.config.enabled = true;
    this.recalculateCompensation();
    logger.info('✅ Latency compensation enabled');
  }

  /**
   * Disable compensation
   */
  public disable(): void {
    this.config.enabled = false;
    this.resetAllCompensation();
    logger.info('❌ Latency compensation disabled');
  }

  /**
   * Measure system latency
   */
  private async measureSystemLatency(): Promise<void> {
    try {
      // Get audio context output latency
      const ctx = new AudioContext();
      const baseLatency = ctx.baseLatency || 0;
      const outputLatency = (ctx as any).outputLatency || 0;

      const totalLatencySeconds = baseLatency + outputLatency;
      const totalLatencySamples = Math.round(
        totalLatencySeconds * this.sampleRate,
      );

      this.systemLatency = {
        source: LatencySource.SYSTEM,
        sourceId: 'audio-context',
        latencySamples: totalLatencySamples,
        latencyMs: totalLatencySeconds * 1000,
        timestamp: Date.now(),
        confidence: 0.95,
      };

      ctx.close();

      logger.info('🎯 System latency measured', {
        latencyMs: this.systemLatency.latencyMs,
        samples: totalLatencySamples,
      });

      // Emit measurement
      this.eventBus?.emit('latency:systemMeasured', this.systemLatency);
    } catch (error) {
      logger.error('Failed to measure system latency', { error });
    }
  }

  /**
   * Initialize track compensation
   */
  private initializeTrackCompensation(trackId: string): void {
    const info: TrackLatencyInfo = {
      trackId,
      totalLatencySamples: 0,
      totalLatencyMs: 0,
      measurements: [],
      compensationDelaySamples: 0,
      compensationDelayMs: 0,
      isCompensated: false,
      lastUpdate: Date.now(),
    };

    this.trackLatencies.set(trackId, info);

    // Create delay buffer
    const maxDelaySamples = Math.round(
      (this.config.maxCompensationMs / 1000) * this.sampleRate,
    );
    this.delayBuffers.set(trackId, new DelayBuffer(maxDelaySamples));

    logger.info(`🎚️ Initialized latency compensation for track ${trackId}`);
  }

  /**
   * Remove track compensation
   */
  private removeTrackCompensation(trackId: string): void {
    this.trackLatencies.delete(trackId);
    this.delayBuffers.delete(trackId);
    this.compensationCallbacks.delete(trackId);

    logger.info(`🗑️ Removed latency compensation for track ${trackId}`);
  }

  /**
   * Update plugin latency
   */
  public updatePluginLatency(
    trackId: string,
    pluginId: string,
    latencySamples: number,
  ): void {
    const trackInfo = this.trackLatencies.get(trackId);
    if (!trackInfo) {
      this.initializeTrackCompensation(trackId);
      return this.updatePluginLatency(trackId, pluginId, latencySamples);
    }

    // Find or create measurement
    const measurementIndex = trackInfo.measurements.findIndex(
      (m) => m.source === LatencySource.PLUGIN && m.sourceId === pluginId,
    );

    const measurement: LatencyMeasurement = {
      source: LatencySource.PLUGIN,
      sourceId: pluginId,
      latencySamples,
      latencyMs: (latencySamples / this.sampleRate) * 1000,
      timestamp: Date.now(),
      confidence: 1.0,
    };

    if (measurementIndex >= 0) {
      trackInfo.measurements[measurementIndex] = measurement;
    } else {
      trackInfo.measurements.push(measurement);
    }

    // Recalculate total
    this.recalculateTrackLatency(trackId);

    logger.info(`🔌 Updated plugin latency`, {
      trackId,
      pluginId,
      latencyMs: measurement.latencyMs,
    });

    // Emit update
    this.eventBus?.emit('latency:pluginUpdated', {
      trackId,
      pluginId,
      measurement,
    });
  }

  /**
   * Add buffer latency measurement
   */
  public addBufferLatency(trackId: string, bufferSize: number): void {
    const latencySamples = bufferSize;
    this.addLatencyMeasurement(trackId, {
      source: LatencySource.BUFFER,
      sourceId: 'audio-buffer',
      latencySamples,
      latencyMs: (latencySamples / this.sampleRate) * 1000,
      timestamp: Date.now(),
      confidence: 1.0,
    });
  }

  /**
   * Add generic latency measurement
   */
  private addLatencyMeasurement(
    trackId: string,
    measurement: LatencyMeasurement,
  ): void {
    const trackInfo = this.trackLatencies.get(trackId);
    if (!trackInfo) {
      this.initializeTrackCompensation(trackId);
      return this.addLatencyMeasurement(trackId, measurement);
    }

    trackInfo.measurements.push(measurement);
    this.recalculateTrackLatency(trackId);
  }

  /**
   * Recalculate track latency
   */
  private recalculateTrackLatency(trackId: string): void {
    const trackInfo = this.trackLatencies.get(trackId);
    if (!trackInfo) return;

    // Sum all latencies
    let totalSamples = 0;
    for (const measurement of trackInfo.measurements) {
      totalSamples += measurement.latencySamples;
    }

    // Add system latency if available
    if (this.systemLatency) {
      totalSamples += this.systemLatency.latencySamples;
    }

    trackInfo.totalLatencySamples = totalSamples;
    trackInfo.totalLatencyMs = (totalSamples / this.sampleRate) * 1000;
    trackInfo.lastUpdate = Date.now();

    // Trigger compensation recalculation
    this.recalculateCompensation();
  }

  /**
   * Recalculate compensation for all tracks
   */
  private recalculateCompensation(): void {
    if (!this.config.enabled) return;

    // Find maximum latency
    this.maxTrackLatency = 0;
    for (const trackInfo of this.trackLatencies.values()) {
      if (trackInfo.totalLatencySamples > this.maxTrackLatency) {
        this.maxTrackLatency = trackInfo.totalLatencySamples;
      }
    }

    // Calculate compensation delay for each track
    for (const [trackId, trackInfo] of this.trackLatencies.entries()) {
      const compensationSamples =
        this.maxTrackLatency - trackInfo.totalLatencySamples;

      trackInfo.compensationDelaySamples = compensationSamples;
      trackInfo.compensationDelayMs =
        (compensationSamples / this.sampleRate) * 1000;
      trackInfo.isCompensated = compensationSamples > 0;

      // Update delay buffer
      const delayBuffer = this.delayBuffers.get(trackId);
      if (delayBuffer) {
        delayBuffer.setDelay(compensationSamples);
      }

      // Notify callback
      const callback = this.compensationCallbacks.get(trackId);
      if (callback) {
        callback(trackInfo);
      }
    }

    logger.info('🔄 Recalculated latency compensation', {
      maxLatencyMs: (this.maxTrackLatency / this.sampleRate) * 1000,
      tracksCompensated: this.trackLatencies.size,
    });

    // Emit update event
    this.eventBus?.emit('latency:compensationUpdated', {
      maxLatencySamples: this.maxTrackLatency,
      tracks: Array.from(this.trackLatencies.values()),
    });
  }

  /**
   * Apply compensation to audio buffer
   */
  public processBuffer(trackId: string, buffer: Float32Array): Float32Array {
    if (!this.config.enabled) {
      return buffer;
    }

    const delayBuffer = this.delayBuffers.get(trackId);
    if (!delayBuffer) {
      return buffer;
    }

    return delayBuffer.process(buffer);
  }

  /**
   * Get track latency info
   */
  public getTrackLatency(trackId: string): TrackLatencyInfo | undefined {
    return this.trackLatencies.get(trackId);
  }

  /**
   * Get all track latencies
   */
  public getAllLatencies(): Map<string, TrackLatencyInfo> {
    return new Map(this.trackLatencies);
  }

  /**
   * Get compensation report
   */
  public getCompensationReport(): {
    enabled: boolean;
    systemLatency: LatencyMeasurement | null;
    maxLatency: { samples: number; ms: number };
    tracks: TrackLatencyInfo[];
  } {
    return {
      enabled: this.config.enabled,
      systemLatency: this.systemLatency,
      maxLatency: {
        samples: this.maxTrackLatency,
        ms: (this.maxTrackLatency / this.sampleRate) * 1000,
      },
      tracks: Array.from(this.trackLatencies.values()),
    };
  }

  /**
   * Register compensation callback
   */
  public onCompensationUpdate(
    trackId: string,
    callback: (info: TrackLatencyInfo) => void,
  ): void {
    this.compensationCallbacks.set(trackId, callback);
  }

  /**
   * Remove compensation callback
   */
  public offCompensationUpdate(trackId: string): void {
    this.compensationCallbacks.delete(trackId);
  }

  /**
   * Start automatic measurements
   */
  private startMeasurements(): void {
    if (this.measurementInterval) return;

    this.measurementInterval = setInterval(() => {
      this.measureSystemLatency();
      // Could add more automatic measurements here
    }, this.config.measurementInterval);

    logger.info('🔁 Started automatic latency measurements');
  }

  /**
   * Stop automatic measurements
   */
  private stopMeasurements(): void {
    if (this.measurementInterval) {
      clearInterval(this.measurementInterval);
      this.measurementInterval = null;
      logger.info('⏹️ Stopped automatic latency measurements');
    }
  }

  /**
   * Enable zero-latency monitoring
   */
  public enableZeroLatencyMonitoring(trackId: string): void {
    const trackInfo = this.trackLatencies.get(trackId);
    if (trackInfo) {
      // Bypass compensation for monitoring
      trackInfo.isCompensated = false;
      const delayBuffer = this.delayBuffers.get(trackId);
      if (delayBuffer) {
        delayBuffer.setDelay(0);
      }
      logger.info(`🎧 Enabled zero-latency monitoring for track ${trackId}`);
    }
  }

  /**
   * Disable zero-latency monitoring
   */
  public disableZeroLatencyMonitoring(trackId: string): void {
    this.recalculateCompensation();
    logger.info(`🎧 Disabled zero-latency monitoring for track ${trackId}`);
  }

  /**
   * Reset all compensation
   */
  private resetAllCompensation(): void {
    for (const [trackId, trackInfo] of this.trackLatencies.entries()) {
      trackInfo.compensationDelaySamples = 0;
      trackInfo.compensationDelayMs = 0;
      trackInfo.isCompensated = false;

      const delayBuffer = this.delayBuffers.get(trackId);
      if (delayBuffer) {
        delayBuffer.reset();
      }
    }
    logger.info('🔄 Reset all latency compensation');
  }

  /**
   * Destroy the service
   */
  public destroy(): void {
    this.stopMeasurements();
    this.trackLatencies.clear();
    this.delayBuffers.clear();
    this.compensationCallbacks.clear();
    OutputLatencyCompensation.instance = null;
    logger.info('💀 Output latency compensation destroyed');
  }
}
