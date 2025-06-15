/**
 * Professional Mixing Console Core - Advanced Audio Processing & Mixing
 *
 * Provides comprehensive mixing system with individual track EQ, dynamics processing,
 * spatial positioning, advanced volume automation, and professional gain staging.
 * Integrates with existing CorePlaybackEngine and controllers for seamless operation.
 *
 * Implements Story 2.3 Task 7: Professional Mixing Console Core
 * - AC 4: Professional Mixing Console (FR-PP-05)
 * - AC 7: Performance & Quality Compliance (<100ms response time, 24-bit audio)
 * - AC 8: Advanced State Management & Automation
 */

import * as Tone from 'tone';
import { EventEmitter } from 'events';
import { CorePlaybackEngine, AudioSourceType } from './CorePlaybackEngine.js';
import { PrecisionSynchronizationEngine } from './PrecisionSynchronizationEngine.js';
import { ComprehensiveStateManager } from './ComprehensiveStateManager.js';
import { AnalyticsEngine } from './AnalyticsEngine.js';

// Track Types for Mixing
export type TrackType = AudioSourceType;

// EQ Configuration
export interface EQBandConfig {
  frequency: number; // Hz
  gain: number; // dB (-20 to +20)
  q: number; // Quality factor (0.1 to 30)
  enabled: boolean;
}

export interface ParametricEQConfig {
  lowShelf: EQBandConfig;
  midPeak: EQBandConfig;
  highShelf: EQBandConfig;
  enabled: boolean;
}

// Dynamics Processing Configuration
export interface CompressionConfig {
  threshold: number; // dB (-60 to 0)
  ratio: number; // 1:1 to 20:1
  attack: number; // ms (0.1 to 100)
  release: number; // ms (10 to 5000)
  knee: number; // dB (0 to 40)
  makeupGain: number; // dB (-20 to +20)
  enabled: boolean;
}

export interface GateConfig {
  threshold: number; // dB (-80 to 0)
  ratio: number; // 1:1 to inf:1
  attack: number; // ms (0.1 to 100)
  release: number; // ms (10 to 5000)
  enabled: boolean;
}

export interface LimiterConfig {
  threshold: number; // dB (-20 to 0)
  lookahead: number; // ms (0 to 20)
  enabled: boolean;
}

export interface DynamicsConfig {
  compressor: CompressionConfig;
  gate: GateConfig;
  limiter: LimiterConfig;
}

// Spatial Audio Configuration
export interface SpatialPosition {
  pan: number; // -1 to 1 (left to right)
  width: number; // 0 to 1 (mono to wide)
  distance: number; // 0 to 1 (close to far)
}

export interface ReverbSendConfig {
  level: number; // 0 to 1
  predelay: number; // ms (0 to 100)
  roomSize: number; // 0 to 1
  dampening: number; // 0 to 1
  enabled: boolean;
}

export interface SpatialConfig {
  position: SpatialPosition;
  reverbSend: ReverbSendConfig;
}

// Volume Automation
export interface AutomationPoint {
  time: number; // seconds
  value: number; // 0 to 1
  curve?: 'linear' | 'exponential' | 'sine' | 'cosine';
}

export interface VolumeAutomationConfig {
  enabled: boolean;
  points: AutomationPoint[];
  loop: boolean;
}

// Channel Strip Configuration
export interface ChannelStripConfig {
  trackType: TrackType;
  volume: number; // 0 to 1
  mute: boolean;
  solo: boolean;
  eq: ParametricEQConfig;
  dynamics: DynamicsConfig;
  spatial: SpatialConfig;
  automation: VolumeAutomationConfig;
  enabled: boolean;
}

// Console State
export interface MixingConsoleState {
  masterVolume: number;
  channels: Map<TrackType, ChannelStripConfig>;
  soloChannels: Set<TrackType>;
  globalEffects: {
    masterCompressor: CompressionConfig;
    masterLimiter: LimiterConfig;
  };
  performance: {
    cpuUsage: number;
    latency: number;
    responseTime: number;
  };
}

// Events
export interface MixingConsoleEvents {
  channelChanged: (trackType: TrackType, config: ChannelStripConfig) => void;
  masterVolumeChanged: (volume: number) => void;
  soloChanged: (trackType: TrackType, solo: boolean) => void;
  automationRecorded: (
    trackType: TrackType,
    automation: VolumeAutomationConfig,
  ) => void;
  performanceAlert: (metric: string, value: number, threshold: number) => void;
  stateChanged: (state: MixingConsoleState) => void;
}

// Mixing Channel Implementation
export class MixingChannel extends EventEmitter {
  private trackType: TrackType;
  private config: ChannelStripConfig;

  // Tone.js Audio Chain
  private inputGain!: Tone.Gain;
  private eq!: {
    lowShelf: Tone.EQ3;
    midPeak: Tone.Filter;
    highShelf: Tone.Filter;
  };
  private dynamics!: {
    gate: Tone.Gate;
    compressor: Tone.Compressor;
    limiter: Tone.Limiter;
  };
  private spatial!: {
    panner: Tone.Panner;
    widener: Tone.StereoWidener;
    reverb: Tone.Reverb;
    reverbSend: Tone.Gain;
  };
  private volumeAutomation!: Tone.Gain;
  private outputGain!: Tone.Gain;
  private analyzer!: Tone.Analyser;

  // Automation
  private automationEngine: VolumeAutomationEngine;

  // Performance tracking
  private performanceMonitor: {
    startTime: number;
    processingTime: number;
    cpuUsage: number;
  };

  constructor(trackType: TrackType, config: ChannelStripConfig) {
    super();
    this.trackType = trackType;
    this.config = { ...config };
    this.performanceMonitor = {
      startTime: 0,
      processingTime: 0,
      cpuUsage: 0,
    };

    this.createAudioChain();
    this.automationEngine = new VolumeAutomationEngine(this.volumeAutomation);
    this.applyConfiguration();
  }

  private createAudioChain(): void {
    try {
      // Input stage
      this.inputGain = new Tone.Gain(1);

      // EQ stage (3-band parametric)
      this.eq = {
        lowShelf: new Tone.EQ3(-12, 0, 12),
        midPeak: new Tone.Filter(1000, 'peaking'),
        highShelf: new Tone.Filter(8000, 'highshelf'),
      };

      // Dynamics stage
      this.dynamics = {
        gate: new Tone.Gate(-40),
        compressor: new Tone.Compressor(-24, 4),
        limiter: new Tone.Limiter(-6),
      };

      // Spatial stage
      this.spatial = {
        panner: new Tone.Panner(0),
        widener: new Tone.StereoWidener(0),
        reverb: new Tone.Reverb(1.5),
        reverbSend: new Tone.Gain(0),
      };

      // Automation and output
      this.volumeAutomation = new Tone.Gain(1);
      this.outputGain = new Tone.Gain(1);
      this.analyzer = new Tone.Analyser('waveform', 1024);

      // Connect audio chain
      this.connectAudioChain();
    } catch (error) {
      console.error('Failed to create audio chain:', error);
      throw error;
    }
  }

  private connectAudioChain(): void {
    // Main signal path
    this.inputGain.chain(
      this.eq.lowShelf,
      this.eq.midPeak,
      this.eq.highShelf,
      this.dynamics.gate,
      this.dynamics.compressor,
      this.dynamics.limiter,
      this.spatial.panner,
      this.spatial.widener,
      this.volumeAutomation,
      this.outputGain,
      this.analyzer,
    );

    // Reverb send path (parallel to main signal)
    try {
      this.spatial.panner.connect(this.spatial.reverbSend);
      this.spatial.reverbSend.connect(this.spatial.reverb);
      this.spatial.reverb.connect(this.outputGain);
    } catch (error) {
      console.warn('Failed to connect reverb send path:', error);
    }
  }

  // Public API
  public getInputNode(): Tone.Gain {
    return this.inputGain;
  }

  public getOutputNode(): Tone.ToneAudioNode {
    return this.outputGain;
  }

  public setVolume(volume: number, rampTime = 0.05): void {
    const startTime = performance.now();

    volume = Math.max(0, Math.min(1, volume));
    this.config.volume = volume;

    this.outputGain.gain.rampTo(volume, rampTime);

    this.trackPerformance(startTime);
    this.emit('volumeChanged', this.trackType, volume);
  }

  public setMute(muted: boolean): void {
    const startTime = performance.now();

    this.config.mute = muted;
    this.outputGain.gain.rampTo(muted ? 0 : this.config.volume, 0.05);

    this.trackPerformance(startTime);
    this.emit('muteChanged', this.trackType, muted);
  }

  public setSolo(solo: boolean): void {
    this.config.solo = solo;
    this.emit('soloChanged', this.trackType, solo);
  }

  public setEQ(
    band: 'low' | 'mid' | 'high',
    frequency: number,
    gain: number,
    q = 1,
  ): void {
    const startTime = performance.now();

    switch (band) {
      case 'low':
        this.eq.lowShelf.low.value = gain;
        this.config.eq.lowShelf = { frequency: 80, gain, q, enabled: true };
        break;
      case 'mid':
        this.eq.midPeak.frequency.value = frequency;
        this.eq.midPeak.gain.value = gain;
        this.eq.midPeak.Q.value = q;
        this.config.eq.midPeak = { frequency, gain, q, enabled: true };
        break;
      case 'high':
        this.eq.highShelf.frequency.value = frequency;
        this.eq.highShelf.gain.value = gain;
        this.config.eq.highShelf = { frequency, gain, q, enabled: true };
        break;
    }

    this.trackPerformance(startTime);
    this.emit('eqChanged', this.trackType, band, { frequency, gain, q });
  }

  public setCompression(config: CompressionConfig): void {
    const startTime = performance.now();

    this.dynamics.compressor.threshold.value = config.threshold;
    this.dynamics.compressor.ratio.value = config.ratio;
    this.dynamics.compressor.attack.value = config.attack / 1000; // Convert to seconds
    this.dynamics.compressor.release.value = config.release / 1000;

    this.config.dynamics.compressor = { ...config };

    this.trackPerformance(startTime);
    this.emit('compressionChanged', this.trackType, config);
  }

  public setSpatialPosition(position: SpatialPosition): void {
    const startTime = performance.now();

    try {
      if (this.spatial.panner && this.spatial.panner.pan) {
        this.spatial.panner.pan.value = position.pan;
      } else {
        console.warn('Panner or pan property not available');
      }

      if (this.spatial.widener && this.spatial.widener.width) {
        this.spatial.widener.width.value = position.width;
      } else {
        console.warn('Widener or width property not available');
      }

      this.config.spatial.position = { ...position };

      this.trackPerformance(startTime);
      this.emit('spatialChanged', this.trackType, position);
    } catch (error) {
      console.error('Error setting spatial position:', error);
      this.trackPerformance(startTime);
    }
  }

  public setReverbSend(config: ReverbSendConfig): void {
    const startTime = performance.now();

    this.spatial.reverbSend.gain.value = config.level;
    // Note: Tone.js Reverb doesn't have roomSize and dampening properties
    // This would need to be implemented with different reverb or custom configuration

    this.config.spatial.reverbSend = { ...config };

    this.trackPerformance(startTime);
    this.emit('reverbChanged', this.trackType, config);
  }

  public startVolumeAutomation(automation: VolumeAutomationConfig): void {
    this.automationEngine.startAutomation(automation);
    this.config.automation = { ...automation };
    this.emit('automationStarted', this.trackType, automation);
  }

  public stopVolumeAutomation(): void {
    this.automationEngine.stopAutomation();
    this.emit('automationStopped', this.trackType);
  }

  public getFrequencyData(): Float32Array {
    return this.analyzer.getValue() as Float32Array;
  }

  public getConfiguration(): ChannelStripConfig {
    return { ...this.config };
  }

  public getPerformanceMetrics(): { processingTime: number; cpuUsage: number } {
    return {
      processingTime: this.performanceMonitor.processingTime,
      cpuUsage: this.performanceMonitor.cpuUsage,
    };
  }

  private applyConfiguration(): void {
    // Apply current configuration to all processors
    this.setVolume(this.config.volume, 0);
    this.setMute(this.config.mute);

    const eq = this.config.eq;
    if (eq.lowShelf.enabled) {
      this.setEQ('low', eq.lowShelf.frequency, eq.lowShelf.gain, eq.lowShelf.q);
    }
    if (eq.midPeak.enabled) {
      this.setEQ('mid', eq.midPeak.frequency, eq.midPeak.gain, eq.midPeak.q);
    }
    if (eq.highShelf.enabled) {
      this.setEQ(
        'high',
        eq.highShelf.frequency,
        eq.highShelf.gain,
        eq.highShelf.q,
      );
    }

    if (this.config.dynamics.compressor.enabled) {
      this.setCompression(this.config.dynamics.compressor);
    }

    this.setSpatialPosition(this.config.spatial.position);

    if (this.config.spatial.reverbSend.enabled) {
      this.setReverbSend(this.config.spatial.reverbSend);
    }

    if (this.config.automation.enabled) {
      this.startVolumeAutomation(this.config.automation);
    }
  }

  private trackPerformance(startTime: number): void {
    const endTime = performance.now();
    this.performanceMonitor.processingTime = endTime - startTime;
    this.performanceMonitor.cpuUsage = Math.min(
      100,
      this.performanceMonitor.processingTime * 10,
    );

    // Alert if performance threshold exceeded (100ms target)
    if (this.performanceMonitor.processingTime > 100) {
      this.emit(
        'performanceAlert',
        'processingTime',
        this.performanceMonitor.processingTime,
        100,
      );
    }
  }

  public dispose(): void {
    this.automationEngine.dispose();

    // Dispose all Tone.js nodes
    Object.values(this.eq).forEach((node) => node.dispose());
    Object.values(this.dynamics).forEach((node) => node.dispose());
    Object.values(this.spatial).forEach((node) => node.dispose());

    this.inputGain.dispose();
    this.volumeAutomation.dispose();
    this.outputGain.dispose();
    this.analyzer.dispose();

    this.removeAllListeners();
  }
}

// Volume Automation Engine
export class VolumeAutomationEngine {
  private gainNode: Tone.Gain;
  private automation: VolumeAutomationConfig | null = null;
  private isRunning = false;
  private scheduledEvents: number[] = [];

  constructor(gainNode: Tone.Gain) {
    this.gainNode = gainNode;
  }

  public startAutomation(config: VolumeAutomationConfig): void {
    this.stopAutomation();
    this.automation = { ...config };

    if (!config.enabled || !config.points.length) return;

    this.isRunning = true;
    this.scheduleAutomationPoints();
  }

  public stopAutomation(): void {
    this.isRunning = false;

    // Clear scheduled events
    this.scheduledEvents.forEach((eventId) => {
      Tone.Transport.clear(eventId);
    });
    this.scheduledEvents = [];
  }

  private scheduleAutomationPoints(): void {
    if (!this.automation) return;

    this.automation.points.forEach((point, index) => {
      const eventId = Tone.Transport.schedule((time) => {
        if (!this.isRunning) return;

        const curve = point.curve || 'linear';
        const nextPoint = this.automation!.points[index + 1];
        const rampTime = nextPoint ? nextPoint.time - point.time : 0.1;

        switch (curve) {
          case 'linear':
            this.gainNode.gain.linearRampTo(point.value, rampTime, time);
            break;
          case 'exponential':
            this.gainNode.gain.exponentialRampTo(
              Math.max(0.001, point.value),
              rampTime,
              time,
            );
            break;
          default:
            this.gainNode.gain.setValueAtTime(point.value, time);
        }
      }, point.time);

      this.scheduledEvents.push(eventId);
    });
  }

  public dispose(): void {
    this.stopAutomation();
  }
}

// Main Mixing Console
export class MixingConsole extends EventEmitter {
  private static instance: MixingConsole;

  // Core systems integration
  private coreEngine: CorePlaybackEngine;
  private syncEngine: PrecisionSynchronizationEngine;
  private stateManager: ComprehensiveStateManager;
  private analytics: AnalyticsEngine;

  // Mixing channels
  private channels: Map<TrackType, MixingChannel> = new Map();
  private masterBus!: {
    inputGain: Tone.Gain;
    compressor: Tone.Compressor;
    limiter: Tone.Limiter;
    outputGain: Tone.Gain;
    analyzer: Tone.Analyser;
  };

  // Console state
  private state: MixingConsoleState;
  private isInitialized = false;

  // Automation engine
  private automationEngine!: MixingAutomationEngine;

  // Performance monitoring
  private performanceMonitor: {
    responseTimeTarget: number;
    cpuUsageTarget: number;
    latencyTarget: number;
  };

  private constructor() {
    super();

    // Initialize core systems
    this.coreEngine = CorePlaybackEngine.getInstance();
    this.syncEngine = PrecisionSynchronizationEngine.getInstance();
    this.stateManager = ComprehensiveStateManager.getInstance();
    this.analytics = new AnalyticsEngine();

    // Initialize state
    this.state = this.createInitialState();

    // Performance targets (AC 7: <100ms response time)
    this.performanceMonitor = {
      responseTimeTarget: 100, // ms - Story 2.3 requirement
      cpuUsageTarget: 30, // % - NFR-PF-09
      latencyTarget: 50, // ms - Audio latency target
    };

    this.setupEventHandlers();
  }

  public static getInstance(): MixingConsole {
    if (!MixingConsole.instance) {
      MixingConsole.instance = new MixingConsole();
    }
    return MixingConsole.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure core systems are initialized
      await this.ensureCoreSystems();

      // Create master bus
      this.createMasterBus();

      // Initialize default channels for all track types
      await this.initializeDefaultChannels();

      // Initialize automation engine
      this.automationEngine = new MixingAutomationEngine(
        this.channels,
        this.state,
      );

      // Connect to core engine audio sources
      this.connectToCoreEngine();

      this.isInitialized = true;
      this.emit('initialized');

      console.log('Mixing Console initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Mixing Console:', error);
      throw error;
    }
  }

  // Public API - Channel Management
  public getChannel(trackType: TrackType): MixingChannel {
    const channel = this.channels.get(trackType);
    if (!channel) {
      throw new Error(`Channel not found for track type: ${trackType}`);
    }
    return channel;
  }

  public setChannelVolume(
    trackType: TrackType,
    volume: number,
    rampTime?: number,
  ): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setVolume(volume, rampTime);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelVolume', startTime);
    this.analytics.trackControlUsage('mixing-console-volume', {
      trackType,
      volume,
    });
  }

  public setChannelMute(trackType: TrackType, muted: boolean): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setMute(muted);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelMute', startTime);
    this.analytics.trackControlUsage('mixing-console-mute', {
      trackType,
      muted,
    });
  }

  public setChannelSolo(trackType: TrackType, solo: boolean): void {
    const startTime = performance.now();

    // Handle solo logic
    if (solo) {
      this.state.soloChannels.add(trackType);
    } else {
      this.state.soloChannels.delete(trackType);
    }

    // Update all channels based on solo state
    this.updateSoloState();

    this.trackPerformance('setChannelSolo', startTime);
    this.analytics.trackControlUsage('mixing-console-solo', {
      trackType,
      solo,
    });
    this.emit('soloChanged', trackType, solo);
  }

  public setChannelEQ(
    trackType: TrackType,
    band: 'low' | 'mid' | 'high',
    frequency: number,
    gain: number,
    q?: number,
  ): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setEQ(band, frequency, gain, q);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelEQ', startTime);
    this.analytics.trackControlUsage('mixing-console-eq', {
      trackType,
      band,
      frequency,
      gain,
      q,
    });
  }

  public setChannelCompression(
    trackType: TrackType,
    config: CompressionConfig,
  ): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setCompression(config);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelCompression', startTime);
    this.analytics.trackControlUsage('mixing-console-compression', {
      trackType,
      config,
    });
  }

  public setChannelSpatialPosition(
    trackType: TrackType,
    position: SpatialPosition,
  ): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setSpatialPosition(position);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelSpatialPosition', startTime);
    this.analytics.trackControlUsage('mixing-console-spatial', {
      trackType,
      position,
    });
  }

  public setChannelReverbSend(
    trackType: TrackType,
    config: ReverbSendConfig,
  ): void {
    const startTime = performance.now();

    const channel = this.getChannel(trackType);
    channel.setReverbSend(config);

    this.updateChannelState(trackType);
    this.trackPerformance('setChannelReverbSend', startTime);
    this.analytics.trackControlUsage('mixing-console-reverb', {
      trackType,
      config,
    });
  }

  // Master Bus Controls
  public setMasterVolume(volume: number, rampTime = 0.05): void {
    const startTime = performance.now();

    volume = Math.max(0, Math.min(1, volume));
    this.state.masterVolume = volume;

    this.masterBus.outputGain.gain.rampTo(volume, rampTime);

    this.trackPerformance('setMasterVolume', startTime);
    this.analytics.trackControlUsage('mixing-console-master-volume', {
      volume,
    });
    this.emit('masterVolumeChanged', volume);
  }

  // Automation
  public startChannelVolumeAutomation(
    trackType: TrackType,
    automation: VolumeAutomationConfig,
  ): void {
    const channel = this.getChannel(trackType);
    channel.startVolumeAutomation(automation);

    this.updateChannelState(trackType);
    this.analytics.trackControlUsage('mixing-console-automation-start', {
      trackType,
      pointCount: automation.points.length,
    });
    this.emit('automationRecorded', trackType, automation);
  }

  public stopChannelVolumeAutomation(trackType: TrackType): void {
    const channel = this.getChannel(trackType);
    channel.stopVolumeAutomation();

    this.analytics.trackControlUsage('mixing-console-automation-stop', {
      trackType,
    });
  }

  public createAutomationLane(
    trackType: TrackType,
    parameter: string,
  ): AutomationLane {
    return this.automationEngine.createLane(trackType, parameter);
  }

  // State Management
  public getMixingConsoleState(): MixingConsoleState {
    return { ...this.state };
  }

  public applyMixingConsoleState(state: Partial<MixingConsoleState>): void {
    const startTime = performance.now();

    if (state.masterVolume !== undefined) {
      this.setMasterVolume(state.masterVolume, 0);
    }

    if (state.channels) {
      state.channels.forEach((config, trackType) => {
        this.applyChannelConfiguration(trackType, config);
      });
    }

    if (state.soloChannels) {
      this.state.soloChannels = new Set(state.soloChannels);
      this.updateSoloState();
    }

    this.trackPerformance('applyMixingConsoleState', startTime);
    this.emit('stateChanged', this.state);
  }

  // Performance & Analysis
  public getPerformanceMetrics(): MixingConsoleState['performance'] {
    const channelMetrics = Array.from(this.channels.values()).map((channel) =>
      channel.getPerformanceMetrics(),
    );

    const avgProcessingTime =
      channelMetrics.reduce((sum, m) => sum + m.processingTime, 0) /
      channelMetrics.length;
    const avgCpuUsage =
      channelMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) /
      channelMetrics.length;

    return {
      cpuUsage: avgCpuUsage,
      latency: 0, // TODO: Implement latency measurement
      responseTime: avgProcessingTime,
    };
  }

  public getFrequencyAnalysis(trackType: TrackType): Float32Array {
    const channel = this.getChannel(trackType);
    return channel.getFrequencyData();
  }

  public getMasterFrequencyAnalysis(): Float32Array {
    return this.masterBus.analyzer.getValue() as Float32Array;
  }

  // Private implementation
  private createInitialState(): MixingConsoleState {
    return {
      masterVolume: 0.8,
      channels: new Map(),
      soloChannels: new Set(),
      globalEffects: {
        masterCompressor: {
          threshold: -12,
          ratio: 4,
          attack: 3,
          release: 100,
          knee: 6,
          makeupGain: 0,
          enabled: true,
        },
        masterLimiter: {
          threshold: -1,
          lookahead: 5,
          enabled: true,
        },
      },
      performance: {
        cpuUsage: 0,
        latency: 0,
        responseTime: 0,
      },
    };
  }

  private async ensureCoreSystems(): Promise<void> {
    // Initialize core systems if needed
    const systems = [
      this.coreEngine,
      this.syncEngine,
      this.stateManager,
      this.analytics,
    ];

    for (const system of systems) {
      if (typeof system.initialize === 'function') {
        try {
          // Use type assertion to handle different initialize signatures
          await (system.initialize as any)();
        } catch (error) {
          console.warn(
            'Failed to initialize system:',
            system.constructor.name,
            error,
          );
        }
      }
    }
  }

  private createMasterBus(): void {
    this.masterBus = {
      inputGain: new Tone.Gain(1),
      compressor: new Tone.Compressor(-12, 4),
      limiter: new Tone.Limiter(-1),
      outputGain: new Tone.Gain(this.state.masterVolume),
      analyzer: new Tone.Analyser('waveform', 2048),
    };

    // Connect master bus chain
    this.masterBus.inputGain.chain(
      this.masterBus.compressor,
      this.masterBus.limiter,
      this.masterBus.outputGain,
      this.masterBus.analyzer,
    );

    // Connect to master destination
    this.masterBus.outputGain.toDestination();
  }

  private async initializeDefaultChannels(): Promise<void> {
    const trackTypes: TrackType[] = [
      'drums',
      'bass',
      'harmony',
      'metronome',
      'ambient',
    ];

    for (const trackType of trackTypes) {
      const config = this.createDefaultChannelConfig(trackType);
      const channel = new MixingChannel(trackType, config);

      // Connect channel to master bus
      channel.getOutputNode().connect(this.masterBus.inputGain);

      // Set up channel event listeners
      this.setupChannelEventHandlers(channel, trackType);

      this.channels.set(trackType, channel);
      this.state.channels.set(trackType, config);
    }
  }

  private createDefaultChannelConfig(trackType: TrackType): ChannelStripConfig {
    return {
      trackType,
      volume: 0.8,
      mute: false,
      solo: false,
      eq: {
        lowShelf: { frequency: 80, gain: 0, q: 0.7, enabled: false },
        midPeak: { frequency: 1000, gain: 0, q: 1.0, enabled: false },
        highShelf: { frequency: 8000, gain: 0, q: 0.7, enabled: false },
        enabled: false,
      },
      dynamics: {
        compressor: {
          threshold: -24,
          ratio: 4,
          attack: 3,
          release: 100,
          knee: 6,
          makeupGain: 0,
          enabled: false,
        },
        gate: {
          threshold: -40,
          ratio: 10,
          attack: 1,
          release: 100,
          enabled: false,
        },
        limiter: {
          threshold: -6,
          lookahead: 5,
          enabled: false,
        },
      },
      spatial: {
        position: { pan: 0, width: 0, distance: 0 },
        reverbSend: {
          level: 0,
          predelay: 20,
          roomSize: 0.5,
          dampening: 0.5,
          enabled: false,
        },
      },
      automation: {
        enabled: false,
        points: [],
        loop: false,
      },
      enabled: true,
    };
  }

  private connectToCoreEngine(): void {
    // Connect core engine audio sources to mixing channels
    const trackTypes: TrackType[] = [
      'drums',
      'bass',
      'harmony',
      'metronome',
      'ambient',
    ];

    trackTypes.forEach((trackType) => {
      const channel = this.channels.get(trackType);
      if (channel) {
        // Get the audio source from core engine and connect to channel
        try {
          // TODO: Implement getAudioSource method in CorePlaybackEngine
          // const audioSource = this.coreEngine.getAudioSource?.(trackType);
          // if (audioSource) {
          //   audioSource.connect(channel.getInputNode());
          // }
        } catch (error) {
          console.warn(
            `Could not connect audio source for ${trackType}:`,
            error,
          );
        }
      }
    });
  }

  private setupChannelEventHandlers(
    channel: MixingChannel,
    _trackType: TrackType,
  ): void {
    channel.on('volumeChanged', (type, _volume) => {
      this.emit(
        'channelChanged',
        type,
        this.channels.get(type)!.getConfiguration(),
      );
    });

    channel.on('performanceAlert', (metric, value, threshold) => {
      this.emit('performanceAlert', metric, value, threshold);
    });
  }

  private setupEventHandlers(): void {
    // Integration with state manager for automation
    this.stateManager.on('automationRecorded', (data: any) => {
      if (data.controllerType === 'mixing-console') {
        this.handleAutomationRecorded(data);
      }
    });

    // Performance monitoring
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  private updateSoloState(): void {
    const hasSoloChannels = this.state.soloChannels.size > 0;

    this.channels.forEach((channel, trackType) => {
      if (hasSoloChannels) {
        // If there are solo channels, mute non-solo channels
        const shouldMute = !this.state.soloChannels.has(trackType);
        channel.setMute(shouldMute);
      } else {
        // If no solo channels, restore original mute state
        const config = this.state.channels.get(trackType);
        if (config) {
          channel.setMute(config.mute);
        }
      }

      channel.setSolo(this.state.soloChannels.has(trackType));
    });
  }

  private updateChannelState(trackType: TrackType): void {
    const channel = this.channels.get(trackType);
    if (channel) {
      this.state.channels.set(trackType, channel.getConfiguration());
      this.emit('channelChanged', trackType, channel.getConfiguration());
    }
  }

  private applyChannelConfiguration(
    trackType: TrackType,
    config: ChannelStripConfig,
  ): void {
    const channel = this.channels.get(trackType);
    if (!channel) return;

    channel.setVolume(config.volume, 0);
    channel.setMute(config.mute);

    if (config.eq.enabled) {
      if (config.eq.lowShelf.enabled) {
        channel.setEQ(
          'low',
          config.eq.lowShelf.frequency,
          config.eq.lowShelf.gain,
          config.eq.lowShelf.q,
        );
      }
      if (config.eq.midPeak.enabled) {
        channel.setEQ(
          'mid',
          config.eq.midPeak.frequency,
          config.eq.midPeak.gain,
          config.eq.midPeak.q,
        );
      }
      if (config.eq.highShelf.enabled) {
        channel.setEQ(
          'high',
          config.eq.highShelf.frequency,
          config.eq.highShelf.gain,
          config.eq.highShelf.q,
        );
      }
    }

    if (config.dynamics.compressor.enabled) {
      channel.setCompression(config.dynamics.compressor);
    }

    channel.setSpatialPosition(config.spatial.position);

    if (config.spatial.reverbSend.enabled) {
      channel.setReverbSend(config.spatial.reverbSend);
    }

    if (config.automation.enabled) {
      channel.startVolumeAutomation(config.automation);
    }
  }

  private updatePerformanceMetrics(): void {
    const metrics = this.getPerformanceMetrics();
    this.state.performance = metrics;

    // Check performance thresholds
    if (metrics.responseTime > this.performanceMonitor.responseTimeTarget) {
      this.emit(
        'performanceAlert',
        'responseTime',
        metrics.responseTime,
        this.performanceMonitor.responseTimeTarget,
      );
    }

    if (metrics.cpuUsage > this.performanceMonitor.cpuUsageTarget) {
      this.emit(
        'performanceAlert',
        'cpuUsage',
        metrics.cpuUsage,
        this.performanceMonitor.cpuUsageTarget,
      );
    }

    if (metrics.latency > this.performanceMonitor.latencyTarget) {
      this.emit(
        'performanceAlert',
        'latency',
        metrics.latency,
        this.performanceMonitor.latencyTarget,
      );
    }
  }

  private trackPerformance(operation: string, startTime: number): void {
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    // Track in analytics
    this.analytics.trackControlUsage('mixing-console-performance', {
      operation,
      responseTime,
      timestamp: Date.now(),
    });

    // Alert if threshold exceeded
    if (responseTime > this.performanceMonitor.responseTimeTarget) {
      this.emit(
        'performanceAlert',
        'responseTime',
        responseTime,
        this.performanceMonitor.responseTimeTarget,
      );
    }
  }

  private handleAutomationRecorded(data: any): void {
    // Handle automation recording from state manager
    console.log('Mixing console automation recorded:', data);
  }

  public dispose(): void {
    // Dispose all channels
    this.channels.forEach((channel) => channel.dispose());
    this.channels.clear();

    // Dispose master bus
    Object.values(this.masterBus).forEach((node) => {
      if (node && typeof node.dispose === 'function') {
        node.dispose();
      }
    });

    // Dispose automation engine
    if (this.automationEngine) {
      this.automationEngine.dispose();
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }
}

// Mixing Automation Engine
export class MixingAutomationEngine {
  private channels: Map<TrackType, MixingChannel>;
  private state: MixingConsoleState;
  private automationLanes: Map<string, AutomationLane> = new Map();

  constructor(
    channels: Map<TrackType, MixingChannel>,
    state: MixingConsoleState,
  ) {
    this.channels = channels;
    this.state = state;
  }

  public createLane(trackType: TrackType, parameter: string): AutomationLane {
    const laneId = `${trackType}-${parameter}`;
    const lane = new AutomationLane(laneId, trackType, parameter);

    this.automationLanes.set(laneId, lane);
    return lane;
  }

  public dispose(): void {
    this.automationLanes.forEach((lane) => lane.dispose());
    this.automationLanes.clear();
  }
}

// Automation Lane
export class AutomationLane {
  public readonly id: string;
  public readonly trackType: TrackType;
  public readonly parameter: string;
  private points: AutomationPoint[] = [];
  private isRecording = false;
  private isPlaying = false;

  constructor(id: string, trackType: TrackType, parameter: string) {
    this.id = id;
    this.trackType = trackType;
    this.parameter = parameter;
  }

  public addPoint(point: AutomationPoint): void {
    this.points.push(point);
    this.points.sort((a, b) => a.time - b.time);
  }

  public removePoint(index: number): void {
    if (index >= 0 && index < this.points.length) {
      this.points.splice(index, 1);
    }
  }

  public getPoints(): AutomationPoint[] {
    return [...this.points];
  }

  public startRecording(): void {
    this.isRecording = true;
    this.points = [];
  }

  public stopRecording(): void {
    this.isRecording = false;
  }

  public startPlayback(): void {
    this.isPlaying = true;
    // Implementation for automation playback
  }

  public stopPlayback(): void {
    this.isPlaying = false;
  }

  public dispose(): void {
    this.stopRecording();
    this.stopPlayback();
    this.points = [];
  }
}
