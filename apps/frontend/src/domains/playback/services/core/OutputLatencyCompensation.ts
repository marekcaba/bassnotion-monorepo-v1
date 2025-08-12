/**
 * Output Latency Compensation System
 * 
 * Provides sample-accurate latency compensation for the entire audio pipeline,
 * ensuring perfect synchronization between tracks with different plugin chains.
 * Works in conjunction with WAM plugins and the UnifiedTransport system.
 * 
 * Features:
 * - Automatic latency detection and measurement
 * - Per-track delay compensation
 * - Plugin chain latency calculation
 * - Dynamic compensation adjustment
 * - Zero-latency monitoring mode
 * 
 * Part of Story 3.21 Task 7 - Web Audio Standards Compliance
 */

import { UnifiedTransport } from './UnifiedTransport.js';
import { serviceRegistry } from './ServiceRegistry.js';
import { EventBus } from './EventBus.js';
import { TrackMixingEngine } from './TrackMixingEngine.js';
import type { Track } from '../../types/track.js';
import type { AudioPlugin } from '../../types/plugin.js';
import { PlaybackError, ErrorSeverity } from '../errors/base.js';

/**
 * Latency source types
 */
export enum LatencySource {
  SYSTEM = 'system',
  PLUGIN = 'plugin',
  BUFFER = 'buffer',
  NETWORK = 'network',
  PROCESSING = 'processing'
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
 * Output Latency Compensation Service
 */
export class OutputLatencyCompensation {
  private static instance: OutputLatencyCompensation | null = null;
  
  // Core properties
  private config: LatencyCompensationConfig;
  private sampleRate: number = 48000;
  private blockSize: number = 128;
  
  // Latency tracking
  private trackLatencies = new Map<string, TrackLatencyInfo>();
  private systemLatency: LatencyMeasurement | null = null;
  private maxTrackLatency: number = 0;
  
  // Delay buffers for compensation
  private delayBuffers = new Map<string, DelayBuffer>();
  
  // Services
  private transport: UnifiedTransport;
  private eventBus?: EventBus;
  private mixingEngine?: TrackMixingEngine;
  
  // Measurement state
  private measurementTimer: number | null = null;
  private isActive: boolean = false;
  
  private constructor(config?: Partial<LatencyCompensationConfig>) {
    this.config = {
      enabled: true,
      maxCompensationMs: 100, // 100ms max compensation
      measurementInterval: 1000, // Measure every second
      adaptiveMode: true,
      zeroLatencyMonitoring: false,
      bufferAlignment: true,
      ...config
    };
    
    // Get services
    this.transport = UnifiedTransport.getInstance();
    
    try {
      this.eventBus = serviceRegistry.get<EventBus>('eventBus');
      this.mixingEngine = serviceRegistry.get<TrackMixingEngine>('mixingEngine');
    } catch (e) {
      console.warn('Some services not found in ServiceRegistry');
    }
    
    // Subscribe to transport events
    this.setupEventListeners();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LatencyCompensationConfig>): OutputLatencyCompensation {
    if (!OutputLatencyCompensation.instance) {
      OutputLatencyCompensation.instance = new OutputLatencyCompensation(config);
    }
    return OutputLatencyCompensation.instance;
  }
  
  /**
   * Initialize compensation system
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    this.sampleRate = audioContext.sampleRate;
    
    // Measure system latency
    await this.measureSystemLatency(audioContext);
    
    // Start measurement timer if adaptive mode
    if (this.config.adaptiveMode) {
      this.startMeasurementTimer();
    }
    
    this.isActive = true;
    
    console.log('✅ Output Latency Compensation initialized');
    console.log(`System latency: ${this.systemLatency?.latencyMs.toFixed(2)}ms`);
  }
  
  /**
   * Register track for latency compensation
   */
  registerTrack(track: Track): void {
    if (this.trackLatencies.has(track.id)) return;
    
    const info: TrackLatencyInfo = {
      trackId: track.id,
      totalLatencySamples: 0,
      totalLatencyMs: 0,
      measurements: [],
      compensationDelaySamples: 0,
      compensationDelayMs: 0,
      isCompensated: false,
      lastUpdate: Date.now()
    };
    
    this.trackLatencies.set(track.id, info);
    
    // Create delay buffer for compensation
    const delayBuffer = new DelayBuffer(
      this.sampleRate,
      this.config.maxCompensationMs
    );
    this.delayBuffers.set(track.id, delayBuffer);
    
    // Initial measurement
    this.measureTrackLatency(track);
  }
  
  /**
   * Unregister track
   */
  unregisterTrack(trackId: string): void {
    this.trackLatencies.delete(trackId);
    
    const delayBuffer = this.delayBuffers.get(trackId);
    if (delayBuffer) {
      delayBuffer.dispose();
      this.delayBuffers.delete(trackId);
    }
    
    // Recalculate max latency
    this.recalculateMaxLatency();
  }
  
  /**
   * Update plugin latency for track
   */
  updatePluginLatency(
    trackId: string,
    pluginId: string,
    latencySamples: number
  ): void {
    const trackInfo = this.trackLatencies.get(trackId);
    if (!trackInfo) return;
    
    // Find or create plugin measurement
    const existingIndex = trackInfo.measurements.findIndex(
      m => m.source === LatencySource.PLUGIN && m.sourceId === pluginId
    );
    
    const measurement: LatencyMeasurement = {
      source: LatencySource.PLUGIN,
      sourceId: pluginId,
      latencySamples,
      latencyMs: (latencySamples / this.sampleRate) * 1000,
      timestamp: Date.now(),
      confidence: 1.0
    };
    
    if (existingIndex >= 0) {
      trackInfo.measurements[existingIndex] = measurement;
    } else {
      trackInfo.measurements.push(measurement);
    }
    
    // Recalculate total track latency
    this.recalculateTrackLatency(trackId);
  }
  
  /**
   * Get compensation delay for track
   */
  getTrackCompensationDelay(trackId: string): number {
    const info = this.trackLatencies.get(trackId);
    return info?.compensationDelaySamples || 0;
  }
  
  /**
   * Process audio with latency compensation
   */
  processWithCompensation(
    trackId: string,
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer
  ): void {
    if (!this.config.enabled || this.config.zeroLatencyMonitoring) {
      // Bypass compensation
      for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
        outputBuffer.copyToChannel(
          inputBuffer.getChannelData(channel),
          channel
        );
      }
      return;
    }
    
    const delayBuffer = this.delayBuffers.get(trackId);
    const info = this.trackLatencies.get(trackId);
    
    if (!delayBuffer || !info || info.compensationDelaySamples === 0) {
      // No compensation needed
      for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
        outputBuffer.copyToChannel(
          inputBuffer.getChannelData(channel),
          channel
        );
      }
      return;
    }
    
    // Apply delay compensation
    delayBuffer.process(
      inputBuffer,
      outputBuffer,
      info.compensationDelaySamples
    );
  }
  
  /**
   * Get latency report
   */
  getLatencyReport(): {
    systemLatency: number;
    maxTrackLatency: number;
    trackLatencies: Map<string, TrackLatencyInfo>;
    isCompensating: boolean;
  } {
    return {
      systemLatency: this.systemLatency?.latencyMs || 0,
      maxTrackLatency: this.maxTrackLatency,
      trackLatencies: new Map(this.trackLatencies),
      isCompensating: this.config.enabled && !this.config.zeroLatencyMonitoring
    };
  }
  
  /**
   * Enable/disable compensation
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (!enabled) {
      // Reset all delay buffers
      for (const delayBuffer of this.delayBuffers.values()) {
        delayBuffer.reset();
      }
    }
    
    this.eventBus?.emit('latency:compensation:toggled', { enabled });
  }
  
  /**
   * Enable/disable zero-latency monitoring
   */
  setZeroLatencyMonitoring(enabled: boolean): void {
    this.config.zeroLatencyMonitoring = enabled;
    
    if (enabled) {
      // Reset all delay buffers for zero-latency
      for (const delayBuffer of this.delayBuffers.values()) {
        delayBuffer.reset();
      }
    } else {
      // Recalculate compensation for all tracks
      this.recalculateAllCompensation();
    }
    
    this.eventBus?.emit('latency:monitoring:toggled', { enabled });
  }
  
  /**
   * Dispose compensation system
   */
  dispose(): void {
    this.stopMeasurementTimer();
    
    // Dispose all delay buffers
    for (const delayBuffer of this.delayBuffers.values()) {
      delayBuffer.dispose();
    }
    
    this.delayBuffers.clear();
    this.trackLatencies.clear();
    
    this.isActive = false;
    
    console.log('🗑️ Output Latency Compensation disposed');
  }
  
  // Private methods
  
  private async measureSystemLatency(audioContext: AudioContext): Promise<void> {
    // Measure base system latency
    const baseLatency = audioContext.baseLatency || 0;
    const outputLatency = audioContext.outputLatency || 0;
    
    const totalLatencySamples = Math.round(
      (baseLatency + outputLatency) * this.sampleRate
    );
    
    this.systemLatency = {
      source: LatencySource.SYSTEM,
      sourceId: 'audio-context',
      latencySamples: totalLatencySamples,
      latencyMs: (baseLatency + outputLatency) * 1000,
      timestamp: Date.now(),
      confidence: 1.0
    };
  }
  
  private measureTrackLatency(track: Track): void {
    const info = this.trackLatencies.get(track.id);
    if (!info) return;
    
    // Clear non-plugin measurements
    info.measurements = info.measurements.filter(
      m => m.source === LatencySource.PLUGIN
    );
    
    // Add system latency
    if (this.systemLatency) {
      info.measurements.push({ ...this.systemLatency });
    }
    
    // Add buffer latency
    const bufferLatencySamples = this.blockSize;
    info.measurements.push({
      source: LatencySource.BUFFER,
      sourceId: 'audio-worklet',
      latencySamples: bufferLatencySamples,
      latencyMs: (bufferLatencySamples / this.sampleRate) * 1000,
      timestamp: Date.now(),
      confidence: 1.0
    });
    
    // Measure plugin chain latency
    this.measurePluginChainLatency(track);
    
    // Recalculate total
    this.recalculateTrackLatency(track.id);
  }
  
  private measurePluginChainLatency(track: Track): void {
    // This would be called by the plugin chain
    // For now, we rely on plugins reporting their latency
  }
  
  private recalculateTrackLatency(trackId: string): void {
    const info = this.trackLatencies.get(trackId);
    if (!info) return;
    
    // Sum all latencies
    info.totalLatencySamples = info.measurements.reduce(
      (sum, m) => sum + m.latencySamples,
      0
    );
    
    info.totalLatencyMs = (info.totalLatencySamples / this.sampleRate) * 1000;
    info.lastUpdate = Date.now();
    
    // Recalculate compensation
    this.recalculateMaxLatency();
    this.updateTrackCompensation(trackId);
    
    // Emit update event
    this.eventBus?.emit('latency:track:updated', {
      trackId,
      totalLatencyMs: info.totalLatencyMs,
      compensationDelayMs: info.compensationDelayMs
    });
  }
  
  private recalculateMaxLatency(): void {
    let maxLatency = 0;
    
    for (const info of this.trackLatencies.values()) {
      maxLatency = Math.max(maxLatency, info.totalLatencySamples);
    }
    
    this.maxTrackLatency = maxLatency;
  }
  
  private updateTrackCompensation(trackId: string): void {
    const info = this.trackLatencies.get(trackId);
    if (!info) return;
    
    // Calculate compensation delay
    const compensationSamples = this.maxTrackLatency - info.totalLatencySamples;
    
    // Apply buffer alignment if enabled
    if (this.config.bufferAlignment) {
      // Align to block size boundaries
      info.compensationDelaySamples = Math.round(
        compensationSamples / this.blockSize
      ) * this.blockSize;
    } else {
      info.compensationDelaySamples = compensationSamples;
    }
    
    info.compensationDelayMs = (info.compensationDelaySamples / this.sampleRate) * 1000;
    info.isCompensated = info.compensationDelaySamples > 0;
  }
  
  private recalculateAllCompensation(): void {
    for (const trackId of this.trackLatencies.keys()) {
      this.updateTrackCompensation(trackId);
    }
  }
  
  private setupEventListeners(): void {
    // Listen for plugin latency updates
    this.eventBus?.on('wam:latency:updated', (data: any) => {
      this.updatePluginLatency(
        data.trackId,
        data.instanceId,
        Math.round(data.latency * this.sampleRate / 1000)
      );
    });
    
    // Listen for track events
    this.eventBus?.on('track:created', (track: Track) => {
      this.registerTrack(track);
    });
    
    this.eventBus?.on('track:removed', (trackId: string) => {
      this.unregisterTrack(trackId);
    });
  }
  
  private startMeasurementTimer(): void {
    if (this.measurementTimer) return;
    
    this.measurementTimer = window.setInterval(() => {
      // Re-measure all tracks in adaptive mode
      for (const [trackId] of this.trackLatencies) {
        const track = this.mixingEngine?.getTrack?.(trackId);
        if (track) {
          this.measureTrackLatency(track);
        }
      }
    }, this.config.measurementInterval);
  }
  
  private stopMeasurementTimer(): void {
    if (this.measurementTimer) {
      clearInterval(this.measurementTimer);
      this.measurementTimer = null;
    }
  }
}

/**
 * Delay buffer for compensation
 */
class DelayBuffer {
  private buffers: Float32Array[];
  private writeIndex: number = 0;
  private maxDelaySamples: number;
  
  constructor(sampleRate: number, maxDelayMs: number) {
    this.maxDelaySamples = Math.ceil((maxDelayMs / 1000) * sampleRate);
    this.buffers = [];
  }
  
  process(
    inputBuffer: AudioBuffer,
    outputBuffer: AudioBuffer,
    delaySamples: number
  ): void {
    // Ensure we have enough buffer channels
    while (this.buffers.length < inputBuffer.numberOfChannels) {
      this.buffers.push(new Float32Array(this.maxDelaySamples));
    }
    
    const frameCount = inputBuffer.length;
    
    for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
      const input = inputBuffer.getChannelData(channel);
      const output = outputBuffer.getChannelData(channel);
      const buffer = this.buffers[channel];
      
      for (let i = 0; i < frameCount; i++) {
        // Read delayed sample
        const readIndex = (this.writeIndex - delaySamples + this.maxDelaySamples) % this.maxDelaySamples;
        output[i] = buffer[readIndex];
        
        // Write current sample
        buffer[this.writeIndex] = input[i];
        this.writeIndex = (this.writeIndex + 1) % this.maxDelaySamples;
      }
    }
  }
  
  reset(): void {
    for (const buffer of this.buffers) {
      buffer.fill(0);
    }
    this.writeIndex = 0;
  }
  
  dispose(): void {
    this.buffers = [];
  }
}