/**
 * DrumScheduler - Direct audio scheduling for drum samples
 *
 * Schedules kick, snare, and hihat samples with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Automatic silent sample detection and compensation
 * - Velocity-based volume control
 * - Automatic cleanup after playback
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from '../types/region.types.js';

const logger = getLogger('DrumScheduler');

export class DrumScheduler {
  private drumBuffers: {
    kick: AudioBuffer | null;
    snare: AudioBuffer | null;
    hihat: AudioBuffer | null;
  } = {
    kick: null,
    snare: null,
    hihat: null,
  };
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate: number = 48000;
  private scheduledSources = new Map<
    AudioBufferSourceNode,
    { type: 'one-shot'; hasStopScheduled: boolean }
  >();
  private instanceId: string;
  private tracks: Map<string, any>; // Reference to track registry for validation

  constructor(instanceId: string, tracks: Map<string, any>) {
    this.instanceId = instanceId;
    this.tracks = tracks;
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set drum buffers and destination
   */
  setBuffers(
    kick: AudioBuffer,
    snare: AudioBuffer,
    hihat: AudioBuffer,
    destination: AudioNode
  ): void {
    this.drumBuffers = { kick, snare, hihat };
    this.audioDestination = destination;
    logger.info('✅ Drum buffers injected', {
      hasKick: !!kick,
      hasSnare: !!snare,
      hasHihat: !!hihat,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Schedule drum hit with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // DEFENSIVE CHECK: Detect if multiple drum tracks are trying to schedule
    const drumTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'drums'
    ).length;

    if (drumTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple drum tracks detected!', {
        trackCount: drumTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'drums')
          .map(([id]) => id),
        instanceId: this.instanceId,
      });
    }

    // Check if we have the necessary buffers and destination
    if (!this.audioContext || !this.audioDestination) {
      logger.warn('❌ FAANG: Cannot use direct scheduling - missing drum dependencies', {
        hasAudioContext: !!this.audioContext,
        hasDestination: !!this.audioDestination,
        instanceId: this.instanceId,
      });
      return false;
    }

    // Map drum type to buffer
    // Check multiple possible locations: type, drum field (DrumPatternEvent), or data.drum
    const drumType = event.type || (event as any).drum || event.data?.drum;

    logger.info(`🥁 Processing drum event`, {
      drumType,
      hasType: !!event.type,
      hasDrumField: !!(event as any).drum,
      hasDataDrum: !!event.data?.drum,
      eventKeys: Object.keys(event),
    });

    let buffer: AudioBuffer | null = null;

    switch (drumType) {
      case 'kick':
        buffer = this.drumBuffers.kick;
        break;
      case 'snare':
        buffer = this.drumBuffers.snare;
        break;
      case 'hihat':
        buffer = this.drumBuffers.hihat;
        break;
      default:
        logger.debug(`❌ FAANG: Unknown drum type: ${drumType}`);
        return false;
    }

    if (!buffer) {
      logger.warn(`❌ FAANG: No buffer for drum type: ${drumType}`, {
        drumType,
        hasKick: !!this.drumBuffers.kick,
        hasSnare: !!this.drumBuffers.snare,
        hasHihat: !!this.drumBuffers.hihat,
      });
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
        const threshold = 0.001; // Consider anything below this as silence
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
      const baseVolume = 0.7; // Slightly quieter for drums
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // FAANG FIX: Skip silent samples at the beginning for perfect sync with metronome
      const offsetSeconds = silentSamplesAtStart / buffer.sampleRate;
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - drums are one-shot samples
      this.scheduledSources.set(source, { type: 'one-shot', hasStopScheduled: false });

      // Log scheduling with timing details
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms
      logger.info(`🎯 FAANG: Direct audio scheduled - drum ${drumType}`, {
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
      });

      // Auto-cleanup after playback
      source.onended = () => {
        this.scheduledSources.delete(source);
        velocityGain.disconnect();
      };

      return true; // Successfully scheduled directly
    } catch (error) {
      logger.error(`Failed to schedule drum audio directly (${drumType})`, error);
      return false; // Fall back to event bus
    }
  }

  /**
   * Stop all scheduled drum sources
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
