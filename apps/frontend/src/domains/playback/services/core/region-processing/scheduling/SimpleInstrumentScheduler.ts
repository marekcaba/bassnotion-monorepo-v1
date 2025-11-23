/**
 * SimpleInstrumentScheduler - Base class for simple one-shot sample schedulers
 *
 * Phase 3: Extracted from MetronomeScheduler, DrumScheduler, VoiceCueScheduler, BassScheduler
 *
 * Provides direct audio scheduling for instruments with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Configurable buffer mapping
 * - Velocity-based volume control
 * - Optional silent sample detection and compensation
 * - Automatic cleanup after playback
 *
 * Eliminates 90% code duplication between 4 scheduler classes by using configuration.
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from '../types/region.types.js';

/**
 * Configuration for SimpleInstrumentScheduler
 */
export interface SchedulerConfig {
  /** Logger name (e.g., 'MetronomeScheduler', 'DrumScheduler') */
  loggerName: string;

  /** Instrument type for track validation (e.g., 'metronome', 'drums') */
  instrumentType: string;

  /** Map of event types to buffer keys (e.g., { 'accent': 'accent', 'click': 'click' }) */
  eventTypeToBufferKey: Record<string, string>;

  /** Whether to preserve attack envelope (don't trim silent samples) */
  preserveAttackEnvelope?: boolean;

  /** Base volume multiplier (0-1) */
  baseVolume?: number;

  /** Silence detection threshold for trimming */
  silenceThreshold?: number;
}

export class SimpleInstrumentScheduler {
  private buffers: Map<string, AudioBuffer> = new Map();
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate: number = 48000;
  private scheduledSources = new Map<
    AudioBufferSourceNode,
    { type: 'one-shot'; hasStopScheduled: boolean }
  >();
  private instanceId: string;
  private tracks: Map<string, any>; // Reference to track registry for validation
  private config: SchedulerConfig;
  private logger: ReturnType<typeof getLogger>;

  constructor(
    instanceId: string,
    tracks: Map<string, any>,
    config: SchedulerConfig,
  ) {
    this.instanceId = instanceId;
    this.tracks = tracks;
    this.config = {
      preserveAttackEnvelope: false,
      baseVolume: 0.8,
      silenceThreshold: 0.001,
      ...config,
    };
    this.logger = getLogger(this.config.loggerName);
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set buffers from a map (generic interface)
   * Stores buffers internally by their keys for flexible access
   */
  setBuffers(buffers: Record<string, AudioBuffer>, destination: AudioNode): void {
    this.buffers.clear();
    Object.entries(buffers).forEach(([key, buffer]) => {
      this.buffers.set(key, buffer);
    });
    this.audioDestination = destination;

    this.logger.info(`✅ ${this.config.loggerName} buffers injected`, {
      bufferKeys: Object.keys(buffers),
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Get buffer for a specific event type using configuration mapping
   */
  private getBufferForEvent(event: PatternEvent): AudioBuffer | null {
    // Try direct mapping from event type
    const bufferKey = this.config.eventTypeToBufferKey[event.type];
    if (bufferKey && this.buffers.has(bufferKey)) {
      return this.buffers.get(bufferKey)!;
    }

    // Fallback: check event.data for instrument-specific fields
    if (event.data) {
      // For drums: event.data.drum ('kick', 'snare', 'hihat')
      if (event.data.drum && this.buffers.has(event.data.drum)) {
        return this.buffers.get(event.data.drum)!;
      }
      // For voice cues: event.data.cue ('one', 'two', 'three', etc.)
      if (event.data.cue && this.buffers.has(event.data.cue)) {
        return this.buffers.get(event.data.cue)!;
      }
    }

    return null;
  }

  /**
   * Schedule sample with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // DEFENSIVE CHECK: Detect if multiple tracks of same type are trying to schedule
    const trackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === this.config.instrumentType,
    ).length;

    if (trackCount > 1) {
      this.logger.error(
        `🚨 CRITICAL: Multiple ${this.config.instrumentType} tracks detected!`,
        {
          trackCount,
          trackIds: Array.from(this.tracks.entries())
            .filter(([, t]) => t.instrumentType === this.config.instrumentType)
            .map(([id]) => id),
          instanceId: this.instanceId,
        },
      );
    }

    // Check if we have the necessary context and destination
    if (!this.audioContext || !this.audioDestination) {
      this.logger.warn(
        `❌ FAANG: Cannot use direct scheduling - missing ${this.config.instrumentType} dependencies`,
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this.instanceId,
        },
      );
      return false; // Fall back to event bus
    }

    // Get buffer for this event
    const buffer = this.getBufferForEvent(event);
    if (!buffer) {
      this.logger.warn(
        `❌ No buffer found for ${this.config.instrumentType} event type: ${event.type}`,
        { event, instanceId: this.instanceId },
      );
      return false;
    }

    const velocity = event.velocity || 0.8;

    try {
      // Capture scheduling time for accuracy measurement
      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);

      // DIAGNOSTIC: Analyze buffer for silence at start
      let silentSamplesAtStart = 0;
      let firstAudibleSampleTime = 0;
      if (buffer.getChannelData(0)) {
        const channelData = buffer.getChannelData(0);
        const threshold = this.config.preserveAttackEnvelope
          ? 0.01 // Higher threshold to preserve attack envelope
          : this.config.silenceThreshold!;

        for (let i = 0; i < Math.min(1000, channelData.length); i++) {
          if (Math.abs(channelData[i]) > threshold) {
            break;
          }
          silentSamplesAtStart++;
        }
        firstAudibleSampleTime = (silentSamplesAtStart / buffer.sampleRate) * 1000; // ms
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      velocityGain.gain.value = velocity * this.config.baseVolume!;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // Optionally skip silent samples for tighter timing
      const offsetSeconds = this.config.preserveAttackEnvelope
        ? 0 // Preserve attack envelope
        : silentSamplesAtStart / buffer.sampleRate; // Skip silence

      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - this is a one-shot sample
      this.scheduledSources.set(source, { type: 'one-shot', hasStopScheduled: false });

      // Log scheduling with timing details for debugging
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms
      this.logger.info(
        `🎯 FAANG: Direct audio scheduled - ${this.config.instrumentType} ${event.type}`,
        {
          targetFrame: frame,
          targetTime: audioTime.toFixed(6),
          scheduleFrame,
          scheduleTime: scheduleTime.toFixed(6),
          lookAhead: `${timeDelta.toFixed(2)}ms (${frameDelta} frames)`,
          sourceStartCallDuration: `${(sourceStartCallEnd - sourceStartCallTime).toFixed(3)}ms`,
          jsExecutionTime: performance.now(),
          bufferAnalysis: {
            silentSamplesAtStart,
            firstAudibleSampleTime: `${firstAudibleSampleTime.toFixed(2)}ms`,
            bufferDuration: `${(buffer.duration * 1000).toFixed(2)}ms`,
            offsetApplied: `${(offsetSeconds * 1000).toFixed(2)}ms`,
          },
        },
      );

      // Auto-cleanup after playback
      source.onended = () => {
        this.scheduledSources.delete(source);
        velocityGain.disconnect();
      };

      return true; // Successfully scheduled directly
    } catch (error) {
      this.logger.error(
        `Failed to schedule ${this.config.instrumentType} audio directly`,
        error,
      );
      return false; // Fall back to event bus
    }
  }

  /**
   * Stop all scheduled sources
   */
  stopAll(): void {
    this.scheduledSources.forEach((metadata, source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already stopped/disconnected
      }
    });
    this.scheduledSources.clear();
  }
}
