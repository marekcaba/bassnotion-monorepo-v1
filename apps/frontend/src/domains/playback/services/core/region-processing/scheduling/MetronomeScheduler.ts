/**
 * MetronomeScheduler - Direct audio scheduling for metronome clicks
 *
 * Schedules accent and click samples with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Velocity-based volume control
 * - Preserves attack envelope (no sample trimming)
 * - Automatic cleanup after playback
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from '../types/region.types.js';

const logger = getLogger('MetronomeScheduler');

export class MetronomeScheduler {
  private metronomeBuffers: { accent: AudioBuffer | null; click: AudioBuffer | null } = {
    accent: null,
    click: null,
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
   * Set metronome buffers and destination
   */
  setBuffers(accent: AudioBuffer, click: AudioBuffer, destination: AudioNode): void {
    this.metronomeBuffers = { accent, click };
    this.audioDestination = destination;
    logger.info('✅ Metronome buffers injected', {
      hasAccent: !!accent,
      hasClick: !!click,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Schedule metronome click with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // DEFENSIVE CHECK: Detect if multiple metronome tracks are trying to schedule
    // This should never happen with our safeguards, but log a critical error if it does
    const metronomeTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'metronome'
    ).length;

    if (metronomeTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple metronome tracks detected!', {
        trackCount: metronomeTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'metronome')
          .map(([id]) => id),
        instanceId: this.instanceId,
      });
      // Continue anyway, but this indicates a bug in track registration
    }

    // Check if we have the necessary buffers and destination
    if (
      !this.audioContext ||
      !this.audioDestination ||
      !this.metronomeBuffers.accent ||
      !this.metronomeBuffers.click
    ) {
      logger.warn('❌ FAANG: Cannot use direct scheduling - missing metronome dependencies', {
        hasAudioContext: !!this.audioContext,
        hasDestination: !!this.audioDestination,
        hasAccentBuffer: !!this.metronomeBuffers.accent,
        hasClickBuffer: !!this.metronomeBuffers.click,
        instanceId: this.instanceId,
      });
      return false; // Fall back to event bus
    }

    // Select buffer based on event type
    const buffer =
      event.type === 'accent' ? this.metronomeBuffers.accent : this.metronomeBuffers.click;
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
        // Metronome clicks have intentional attack envelope (gradual fade-in)
        // Use higher threshold to only skip TRUE digital silence, not quiet audio
        const threshold = 0.01; // Higher threshold for metronome to preserve attack envelope
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
      const baseVolume = 0.8;
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // METRONOME FIX: DO NOT skip samples - metronome has intentional attack envelope
      // The quiet samples at start are part of the sound design, not silence to be trimmed
      const offsetSeconds = 0; // Always 0 for metronome to preserve attack envelope
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - metronome is a one-shot sample
      this.scheduledSources.set(source, { type: 'one-shot', hasStopScheduled: false });

      // Log scheduling with timing details for debugging
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms
      logger.info(`🎯 FAANG: Direct audio scheduled - metronome ${event.type}`, {
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
      logger.error('Failed to schedule metronome audio directly', error);
      return false; // Fall back to event bus
    }
  }

  /**
   * Stop all scheduled metronome sources
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
