/**
 * VoiceCueScheduler - Handles direct audio scheduling for voice cues
 *
 * Schedules voice countdown samples ("one", "two", "three", "four") with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Automatic silent sample detection and compensation
 * - Velocity-based volume control
 * - Automatic cleanup after playback
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from '../types/region.types.js';

const logger = getLogger('VoiceCueScheduler');

export class VoiceCueScheduler {
  private voiceCueBuffers = new Map<string, AudioBuffer>();
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate: number = 48000;
  private scheduledSources = new Map<AudioBufferSourceNode, { type: 'one-shot'; hasStopScheduled: boolean }>();
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set voice cue buffers and destination
   */
  setBuffers(samples: Map<string, AudioBuffer>, destination: AudioNode): void {
    this.voiceCueBuffers = samples;
    this.audioDestination = destination;
    logger.info('✅ Voice cue buffers injected', {
      sampleCount: samples.size,
      cues: Array.from(samples.keys()),
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Schedule voice cue playback with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // Check if we have the necessary buffers and destination
    if (!this.audioContext || !this.audioDestination) {
      logger.warn('❌ FAANG: Cannot use direct scheduling - missing voice cue dependencies', {
        hasAudioContext: !!this.audioContext,
        hasDestination: !!this.audioDestination,
        instanceId: this.instanceId,
      });
      return false;
    }

    // Get the cue name from event data (e.g., "one", "two", "three", "four")
    const cueName = (event as any).data?.cue;

    if (!cueName) {
      logger.warn('❌ FAANG: Voice cue event missing cue name', {
        eventData: (event as any).data,
        eventType: event.type,
      });
      return false;
    }

    // Get the buffer for this cue
    const buffer = this.voiceCueBuffers.get(cueName);

    if (!buffer) {
      logger.warn(`❌ FAANG: No buffer for voice cue: ${cueName}`, {
        cueName,
        availableCues: Array.from(this.voiceCueBuffers.keys()),
      });
      return false;
    }

    const velocity = event.velocity || 1.0;

    try {
      // Capture scheduling time for accuracy measurement
      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);

      // Analyze buffer for silence at start
      let silentSamplesAtStart = 0;
      let firstAudibleSampleTime = 0;
      if (buffer.getChannelData(0)) {
        const channelData = buffer.getChannelData(0);
        const threshold = 0.001;
        for (let i = 0; i < Math.min(1000, channelData.length); i++) {
          if (Math.abs(channelData[i]) > threshold) {
            break;
          }
          silentSamplesAtStart++;
        }
        firstAudibleSampleTime = (silentSamplesAtStart / buffer.sampleRate) * 1000;
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      const baseVolume = 0.45; // Voice cues at moderate volume (5dB quieter than metronome)
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // Schedule start at EXACT audio time (sample-perfect)
      // Skip silent samples at the beginning for perfect sync
      const offsetSeconds = silentSamplesAtStart / buffer.sampleRate;
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - voice cues are one-shot samples
      this.scheduledSources.set(source, { type: 'one-shot', hasStopScheduled: false });

      // Log scheduling with timing details
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000;
      logger.info(`🎯 FAANG: Direct audio scheduled - voice cue "${cueName}"`, {
        cueName,
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
    } catch (_error) {
      logger.error(`Failed to schedule voice cue audio directly (${cueName})`, _error);
      return false; // Fall back to event bus
    }
  }

  /**
   * Stop all scheduled voice cue sources
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

  /**
   * Get the voice cue buffers map (for testing/inspection)
   */
  getBuffers(): Map<string, AudioBuffer> {
    return this.voiceCueBuffers;
  }
}
