/**
 * BassScheduler - Direct audio scheduling for bass samples
 *
 * Schedules bass notes with different articulations (normal, slap, mute, etc.) with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Duration-based playback (start/stop scheduling)
 * - Velocity-based volume control
 * - Articulation support
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from '../types/region.types.js';

const logger = getLogger('BassScheduler');

export class BassScheduler {
  private bassBuffers = new Map<string, Map<string, AudioBuffer>>();
  // Structure: bassBuffers.get('normal').get('D2') → AudioBuffer
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate: number = 48000;
  private activeBassSources = new Map<string, AudioBufferSourceNode>();
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
   * Set bass buffers and destination
   */
  setBuffers(samples: Map<string, Map<string, AudioBuffer>>, destination: AudioNode): void {
    this.bassBuffers = samples;
    this.audioDestination = destination;
    logger.info('✅ Bass buffers injected', {
      articulationCount: samples.size,
      articulations: Array.from(samples.keys()),
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Schedule bass note with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // DEFENSIVE CHECK: Detect if multiple bass tracks are trying to schedule
    const bassTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'bass'
    ).length;

    if (bassTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple bass tracks detected!', {
        trackCount: bassTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'bass')
          .map(([id]) => id),
        instanceId: this.instanceId,
      });
    }

    if (!this.audioContext || !this.audioDestination) {
      logger.warn('❌ FAANG: Cannot use direct scheduling - missing bass dependencies', {
        hasAudioContext: !!this.audioContext,
        hasDestination: !!this.audioDestination,
        instanceId: this.instanceId,
      });
      return false;
    }

    // Get note and articulation
    const bassData = event.data as any;
    const note = event.type || bassData?.note;
    const articulation = bassData?.technique || 'normal';

    if (!note) {
      logger.warn('❌ FAANG: No note in bass event');
      return false;
    }

    const buffer = this.bassBuffers.get(articulation)?.get(note);

    if (!buffer) {
      logger.debug(`❌ FAANG: No buffer for bass ${articulation}/${note}`);
      return false;
    }

    // Parse duration (will be injected from outside or use default)
    // TODO: Make this configurable via dependency injection
    const { parseDuration } = require('@/domains/playback/utils/chordParser.js');
    const duration = parseDuration(event.duration, 120); // TODO: Get BPM from transport

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gain = this.audioContext.createGain();
      gain.gain.value = (event.velocity || 0.8) * 0.7;

      source.connect(gain);
      gain.connect(this.audioDestination);

      source.start(audioTime);
      if (duration > 0) {
        source.stop(audioTime + duration);
      }

      // Track for cleanup
      const noteId = `bass-${frame}`;
      this.activeBassSources.set(noteId, source);

      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000;

      logger.info(`🎯 FAANG: Bass note scheduled - ${note}`, {
        articulation,
        duration: `${duration.toFixed(3)}s`,
        targetFrame: frame,
        targetTime: audioTime.toFixed(6),
        scheduleFrame,
        lookAhead: `${timeDelta.toFixed(2)}ms`,
      });

      // Auto-cleanup
      source.onended = () => {
        this.activeBassSources.delete(noteId);
        gain.disconnect();
      };

      return true;
    } catch (error) {
      logger.error(`Failed to schedule bass note ${note}`, error);
      return false;
    }
  }

  /**
   * Stop all active bass sources
   */
  stopAll(): void {
    this.activeBassSources.forEach((source, noteId) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already stopped
      }
    });
    this.activeBassSources.clear();
  }
}
