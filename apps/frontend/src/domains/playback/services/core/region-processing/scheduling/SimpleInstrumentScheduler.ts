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
 * - Live tempo-aware duration calculation for bass notes
 *
 * Eliminates 90% code duplication between 4 scheduler classes by using configuration.
 */

import { getLogger } from '@/utils/logger.js';
import { verboseLog } from '@/config/debug';
import type { PatternEvent } from '../types/region.types.js';
import { InstrumentTimingDiagnostic } from '../../diagnostics/InstrumentTimingDiagnostic.js';
import { parsePositionToObject } from '../../timeUtils.js';

/**
 * Helper to get Tone from window (must be initialized before scheduling)
 * Returns null if Tone.js is not loaded (graceful fallback)
 */
function getTone(): typeof window.Tone | null {
  if (typeof window !== 'undefined') {
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  return null;
}

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
  private sampleRate = 48000;
  private scheduledSources = new Map<
    AudioBufferSourceNode,
    {
      type: 'one-shot';
      hasStopScheduled: boolean;
      gain: GainNode;
      /** AudioContext time the source is scheduled to start. Lets stopAll
       *  distinguish already-playing sources (need a fade) from future
       *  scheduled-but-silent ones (stop immediately — fading a not-yet-
       *  started click sample lets its attack transient fire mid-fade,
       *  which is the stop spike). */
      startAudioTime: number;
    }
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
   * MERGES new buffers with existing ones instead of replacing
   * This allows multiple calls to add different samples (e.g., bass samples
   * from different exercises or preload batches)
   */
  setBuffers(
    buffers: Record<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    // MERGE buffers instead of clearing - this fixes the issue where
    // multiple setBassBuffers calls would overwrite previous samples
    const existingCount = this.buffers.size;
    Object.entries(buffers).forEach(([key, buffer]) => {
      this.buffers.set(key, buffer);
    });
    this.audioDestination = destination;

    this.logger.info(`✅ ${this.config.loggerName} buffers injected`, {
      bufferKeys: Object.keys(buffers),
      newBuffersAdded: Object.keys(buffers).length,
      previousBufferCount: existingCount,
      totalBufferCount: this.buffers.size,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Clear all buffers (call when switching exercises or resetting)
   */
  clearBuffers(): void {
    const count = this.buffers.size;
    // DEBUG: Log stack trace to find who is clearing buffers
    const stack =
      new Error().stack?.split('\n').slice(1, 6).join('\n') || 'no stack';
    this.buffers.clear();
    this.logger.info(`🗑️ ${this.config.loggerName} buffers cleared`, {
      previousCount: count,
      instanceId: this.instanceId,
      calledFrom: stack,
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
      // For bass: event.data.midiNote (MIDI note number as buffer key)
      if (event.data.midiNote !== undefined) {
        const midiKey = String(event.data.midiNote);
        if (this.buffers.has(midiKey)) {
          return this.buffers.get(midiKey)!;
        }
        // DEBUG: Log buffer lookup failure for bass
        if (this.config.instrumentType === 'bass') {
          console.warn(
            `🔍 [BASS-BUFFER-LOOKUP] MISS for midiNote=${event.data.midiNote} (key="${midiKey}")`,
            {
              bufferCount: this.buffers.size,
              availableKeys: Array.from(this.buffers.keys()).slice(0, 10),
              eventType: event.type,
              eventData: event.data,
            },
          );
        }
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

    // DEBUG: Log bass event details BEFORE buffer lookup
    if (this.config.instrumentType === 'bass') {
      verboseLog(
        `🔍 [BASS-SCHEDULER-DEBUG] About to look up buffer for event:`,
        {
          eventType: event.type,
          hasMidiNote: event.data?.midiNote !== undefined,
          midiNote: event.data?.midiNote,
          eventData: event.data,
          bufferCount: this.buffers.size,
          bufferKeys: Array.from(this.buffers.keys()),
        },
      );
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

    // Normalize velocity: MIDI velocity is 0-127, we need 0-1
    // If velocity > 1, assume it's MIDI velocity and normalize
    const rawVelocity = event.velocity || 0.8;
    const velocity = rawVelocity > 1 ? rawVelocity / 127 : rawVelocity;

    // 🔊 AUDIO DIAGNOSTIC: Log timing and gain calculation for bass
    if (this.config.instrumentType === 'bass') {
      // Parse position string to extract measure and beat
      // event.position is in "bar:beat:sixteenth" format (e.g., "0:0:0", "1:2:0")
      // parsePositionToObject returns { bars, beats, sixteenths } (0-indexed)
      // We add 1 to display as human-readable 1-indexed values
      const parsedPos = parsePositionToObject(event.position);
      const eventMeasure = parsedPos.bars + 1; // 1-indexed for display
      const eventBeat = parsedPos.beats + 1; // 1-indexed for display

      verboseLog(`🎸 [BASS-AUDIO-TIMING] === BASS NOTE SCHEDULING ===`);
      verboseLog(
        `🎸 [BASS-AUDIO-TIMING] audioTime=${audioTime.toFixed(4)}s = ${(audioTime * 1000).toFixed(0)}ms`,
      );
      verboseLog(
        `🎸 [BASS-AUDIO-TIMING] Note position: measure=${eventMeasure}, beat=${eventBeat} (raw: ${event.position})`,
      );
      verboseLog(
        `🎸 [BASS-AUDIO-TIMING] midiNote=${event.data?.midiNote}, velocity=${velocity.toFixed(3)}`,
      );
      verboseLog(
        `🎸 [BASS-AUDIO-TIMING] audioContext.currentTime=${this.audioContext?.currentTime?.toFixed(4)}s`,
      );
      verboseLog(
        `🎸 [BASS-AUDIO-TIMING] scheduling ${(audioTime - (this.audioContext?.currentTime || 0)).toFixed(4)}s in advance`,
      );
    }

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
        firstAudibleSampleTime =
          (silentSamplesAtStart / buffer.sampleRate) * 1000; // ms
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      const targetGain = velocity * this.config.baseVolume!;

      // For instruments with preserveAttackEnvelope (like bass), start at full volume immediately
      // to preserve the attack transient. For other instruments, use a 10ms fade-in to prevent clicks.
      if (this.config.preserveAttackEnvelope) {
        // BASS/ATTACK-SENSITIVE: Start at full volume immediately - no fade-in
        velocityGain.gain.setValueAtTime(targetGain, audioTime);
      } else {
        // OTHER INSTRUMENTS: Use 10ms exponential fade-in to prevent audio spike on playback start
        const FADE_IN_DURATION = 0.01; // 10ms - imperceptible but eliminates clicks
        velocityGain.gain.setValueAtTime(0.001, audioTime); // Start near-zero (not 0 for exponential ramp)
        velocityGain.gain.exponentialRampToValueAtTime(
          targetGain,
          audioTime + FADE_IN_DURATION,
        );
      }

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // 🔊 AUDIO DIAGNOSTIC: Confirm gain node state for bass
      if (this.config.instrumentType === 'bass') {
        verboseLog(`🎸 [BASS AUDIO] Gain applied`, {
          gainValue: velocityGain.gain.value,
          targetGain,
          fadeIn: this.config.preserveAttackEnvelope
            ? 'NONE (attack preserved)'
            : '10ms exponential',
          destinationType:
            this.audioDestination?.constructor?.name || 'unknown',
          audioTime: audioTime.toFixed(4),
        });
      }

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // Optionally skip silent samples for tighter timing
      const offsetSeconds = this.config.preserveAttackEnvelope
        ? 0 // Preserve attack envelope
        : silentSamplesAtStart / buffer.sampleRate; // Skip silence

      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // For bass notes with duration, schedule a stop with fadeout to prevent clicks
      // event.duration can be a string like "0.5s" or a number in seconds
      // TEMPO FIX: For bass, recalculate duration using LIVE tempo from Tone.Transport
      // This ensures bass notes play at the correct duration when user adjusts tempo
      let noteDuration: number | null = null;
      if (event.duration) {
        if (typeof event.duration === 'string') {
          // Parse duration string like "0.5s" or "1.2s"
          const match = event.duration.match(/^([\d.]+)s?$/);
          if (match) {
            noteDuration = parseFloat(match[1]);
          }
        } else if (typeof event.duration === 'number') {
          noteDuration = event.duration;
        }

        // TEMPO FIX: Recalculate bass duration using live tempo
        // The event.data may contain durationInBeats and originalBpm from ExerciseLoader
        // If available, use these to calculate the correct duration at the current tempo
        if (
          this.config.instrumentType === 'bass' &&
          event.data &&
          noteDuration
        ) {
          const durationInBeats = event.data.durationInBeats;
          const originalBpm = event.data.originalBpm;

          if (durationInBeats !== undefined && originalBpm !== undefined) {
            // Get live BPM from Tone.Transport (source of truth for tempo).
            // Use getTransport() (not the deprecated Tone.Transport const)
            // so we re-resolve against the current Context — safe across
            // setContext swaps.
            const Tone = getTone();
            const liveBpm = Tone?.getTransport
              ? Tone.getTransport().bpm.value
              : Tone?.Transport?.bpm?.value;

            if (liveBpm && liveBpm !== originalBpm) {
              // Recalculate: duration = beats * (60 / liveBpm)
              const adjustedDuration = durationInBeats * (60 / liveBpm);

              // Log tempo adjustment for debugging
              this.logger.debug('Bass duration adjusted for tempo change', {
                originalBpm,
                liveBpm,
                durationInBeats,
                originalDuration: `${noteDuration.toFixed(4)}s`,
                adjustedDuration: `${adjustedDuration.toFixed(4)}s`,
                midiNote: event.data.midiNote,
              });

              noteDuration = adjustedDuration;
            }
          }
        }
      }

      // Schedule stop for bass notes (instruments that need duration control)
      const needsDurationControl =
        this.config.instrumentType === 'bass' &&
        noteDuration &&
        noteDuration > 0;
      if (needsDurationControl && noteDuration) {
        // Apply a quick 15ms fadeout before stop to prevent click (user requested 15ms)
        const FADEOUT_DURATION = 0.015;
        const stopTime = audioTime + noteDuration;
        const fadeStartTime = stopTime - FADEOUT_DURATION;

        // Only fade if we have enough time (note is longer than fadeout)
        if (noteDuration > FADEOUT_DURATION) {
          velocityGain.gain.setValueAtTime(targetGain, fadeStartTime);
          velocityGain.gain.linearRampToValueAtTime(0.001, stopTime);
        }

        // Schedule the stop
        source.stop(stopTime + 0.001); // Tiny buffer after fadeout completes
      }

      // Store for cleanup - track if stop is scheduled
      this.scheduledSources.set(source, {
        type: 'one-shot',
        hasStopScheduled: needsDurationControl,
        gain: velocityGain,
        startAudioTime: audioTime,
      });

      // Log scheduling with timing details for debugging
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms

      // 🎯 TIMING DIAGNOSTIC: Record for cross-instrument comparison
      if (InstrumentTimingDiagnostic.isEnabled()) {
        // Parse position string to extract beat/measure accurately
        // event.position is the canonical source ("bar:beat:sixteenth" format)
        const diagPos = parsePositionToObject(event.position);
        const beat = diagPos.beats + 1; // 1-indexed for display
        const measure = diagPos.bars + 1; // 1-indexed for display

        InstrumentTimingDiagnostic.record({
          instrument: this.config.instrumentType as
            | 'drums'
            | 'metronome'
            | 'bass'
            | 'voice-cue',
          eventType: event.data?.drum || event.data?.cue || event.type,
          scheduledAudioTime: audioTime,
          jsExecutionTime: sourceStartCallEnd,
          scheduleFrame,
          targetFrame: frame,
          lookaheadMs: timeDelta,
          beat,
          measure,
        });
      }

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
          noteDuration: noteDuration
            ? `${(noteDuration * 1000).toFixed(0)}ms`
            : 'full sample',
          hasStopScheduled: needsDurationControl,
          bufferAnalysis: {
            silentSamplesAtStart,
            firstAudibleSampleTime: `${firstAudibleSampleTime.toFixed(2)}ms`,
            bufferDuration: `${(buffer.duration * 1000).toFixed(2)}ms`,
            offsetApplied: `${(offsetSeconds * 1000).toFixed(2)}ms`,
          },
        },
      );

      // CRITICAL: DO NOT auto-cleanup on onended during normal playback!
      // We need to keep ALL sources tracked so stopAll() can cancel future scheduled sounds.
      // The gain will be disconnected in stopAll() when we manually stop.
      source.onended = () => {
        // Only disconnect the gain node, but keep the source in scheduledSources Map
        // so that stopAll() can find and cancel all future scheduled sounds
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
   *
   * @param graceful - If true (exercise natural end), let one-shot samples finish naturally
   *                   If false (manual stop), apply quick 50ms fadeout to avoid clicks
   *
   * Stop Modes:
   * - Manual Stop (graceful=false): 50ms quick fade - fast cutoff without clicks
   * - Exercise End (graceful=true): Let samples ring out - no intervention, just clear tracking
   */
  stopAll(graceful = false): void {
    verboseLog(`[${this.config.loggerName} STOP] Stopping sources`, {
      scheduledCount: this.scheduledSources.size,
      graceful,
    });

    // GRACEFUL STOP: Let one-shot samples finish naturally
    // One-shot drum/metronome samples are short (< 1 second) and should ring out
    if (graceful) {
      verboseLog(
        `[${this.config.loggerName} STOP] Graceful stop - letting ${this.scheduledSources.size} samples ring out naturally`,
      );
      // Just clear the tracking map - samples will finish on their own
      // The onended callbacks will handle cleanup
      this.scheduledSources.clear();
      return;
    }

    // MANUAL STOP: Quick 30ms fadeout to avoid clicks
    const FADEOUT_TIME = 0.03; // 30ms matches master fade-out
    const currentTime = this.audioContext?.currentTime ?? 0;
    const stopTime = currentTime + FADEOUT_TIME;

    let fadedCount = 0;
    let stoppedCount = 0;
    let errorCount = 0;

    // Collect sources to disconnect after fadeout
    const sourcesToDisconnect: Array<{
      source: AudioBufferSourceNode;
      gain: GainNode;
    }> = [];

    let killedFutureCount = 0;
    this.scheduledSources.forEach((metadata, source) => {
      try {
        // KEY FIX (stop-spike): a one-shot scheduler (metronome especially)
        // keeps FUTURE sources queued — clicks scheduled seconds ahead via
        // source.start(futureTime). Those haven't made any sound yet. The
        // old code ramped their gain to 0 over 30ms AND called
        // source.stop(now + 30ms) — which let the queued click's start fire
        // inside that 30ms window, so its sharp attack transient played and
        // got cut mid-fade. That attack IS the stop spike (measured: peak
        // 0.188 @ ~16ms, right in the fade window).
        //
        // So: if the source hasn't started yet, kill it HARD at `now`. A
        // not-yet-started source produces no click when stopped before its
        // start time — there's no audio in flight to fade. Only sources
        // already sounding get the 30ms gain fade.
        const notYetStarted = metadata.startAudioTime > currentTime;

        if (notYetStarted) {
          // Stop before it can make a sound. stop(currentTime) on a source
          // whose start is in the future cancels it silently.
          if (this.audioContext) {
            source.stop(currentTime);
          } else {
            source.stop(0);
          }
          // Pin its gain to 0 too, belt-and-braces, in case the start
          // somehow lands on the same block.
          if (metadata.gain) {
            try {
              metadata.gain.gain.cancelScheduledValues(currentTime);
              metadata.gain.gain.setValueAtTime(0, currentTime);
            } catch {
              /* ignore */
            }
            sourcesToDisconnect.push({ source, gain: metadata.gain });
          }
          killedFutureCount++;
          stoppedCount++;
          return;
        }

        // ALREADY PLAYING: apply the quick 30ms fadeout via gain node.
        if (this.audioContext && metadata.gain) {
          const gain = metadata.gain;
          gain.gain.cancelScheduledValues(currentTime);
          gain.gain.setValueAtTime(gain.gain.value, currentTime);
          gain.gain.linearRampToValueAtTime(0, stopTime);
          fadedCount++;
          sourcesToDisconnect.push({ source, gain });
        }

        // Schedule stop after fadeout completes
        if (this.audioContext) {
          source.stop(stopTime + 0.001);
        } else {
          source.stop(0);
        }
        // DON'T disconnect immediately - this causes the spike!
        // The fadeout needs the audio chain intact to work
        stoppedCount++;
      } catch (e) {
        // Source may have already stopped/disconnected or never started
        errorCount++;
      }
    });

    this.scheduledSources.clear();

    // Disconnect sources AFTER fadeout completes (async cleanup)
    if (sourcesToDisconnect.length > 0) {
      setTimeout(
        () => {
          sourcesToDisconnect.forEach(({ source, gain }) => {
            try {
              source.disconnect();
              gain.disconnect();
            } catch {
              // Already disconnected
            }
          });
        },
        FADEOUT_TIME * 1000 + 10,
      ); // 10ms buffer after fadeout
    }

    verboseLog(
      `[${this.config.loggerName} STOP] Sources stopped with fadeout`,
      {
        fadedCount,
        killedFutureCount,
        stoppedCount,
        errorCount,
        fadeoutMs: FADEOUT_TIME * 1000,
      },
    );
  }

  /**
   * Protected accessors for subclass overrides (e.g., BassScheduler graceful fadeout)
   */
  protected getScheduledSources(): Map<
    AudioBufferSourceNode,
    {
      type: 'one-shot';
      hasStopScheduled: boolean;
      gain: GainNode;
      /** AudioContext time the source is scheduled to start. Lets stopAll
       *  distinguish already-playing sources (need a fade) from future
       *  scheduled-but-silent ones (stop immediately — fading a not-yet-
       *  started click sample lets its attack transient fire mid-fade,
       *  which is the stop spike). */
      startAudioTime: number;
    }
  > {
    return this.scheduledSources;
  }

  protected getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  protected clearScheduledSources(): void {
    this.scheduledSources.clear();
  }
}
