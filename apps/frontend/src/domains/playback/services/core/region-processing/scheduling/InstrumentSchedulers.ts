/**
 * Concrete instrument scheduler instances
 *
 * These are thin wrappers around SimpleInstrumentScheduler
 * configured for specific instruments.
 */

import {
  SimpleInstrumentScheduler,
  type SchedulerConfig,
} from './SimpleInstrumentScheduler.js';

/**
 * MetronomeScheduler - configured for metronome clicks
 */
export class MetronomeScheduler extends SimpleInstrumentScheduler {
  constructor(instanceId: string, tracks: Map<string, any>) {
    const config: SchedulerConfig = {
      loggerName: 'MetronomeScheduler',
      instrumentType: 'metronome',
      eventTypeToBufferKey: {
        accent: 'accent',
        click: 'click',
      },
      baseVolume: 1.0,
      preserveAttackEnvelope: true,
    };
    super(instanceId, tracks, config);
  }
}

/**
 * DrumScheduler - configured for drum patterns
 */
export class DrumScheduler extends SimpleInstrumentScheduler {
  constructor(instanceId: string, tracks: Map<string, any>) {
    const config: SchedulerConfig = {
      loggerName: 'DrumScheduler',
      instrumentType: 'drums',
      eventTypeToBufferKey: {
        kick: 'kick',
        snare: 'snare',
        hihat: 'hihat',
        openhat: 'openhat',
        crash: 'crash',
        ride: 'ride',
        tom1: 'tom1',
        tom2: 'tom2',
        tom3: 'tom3',
      },
      baseVolume: 0.8,
      preserveAttackEnvelope: true,
    };
    super(instanceId, tracks, config);
  }
}

/**
 * BassScheduler - configured for bass patterns
 *
 * Extended with graceful fade-out behavior matching HarmonySchedulerV2:
 * - Manual stop: 50ms quick fade (inherited from SimpleInstrumentScheduler)
 * - Graceful stop (exercise end): 1.5s hold + 2.5s exponential fade
 */
export class BassScheduler extends SimpleInstrumentScheduler {
  constructor(instanceId: string, tracks: Map<string, any>) {
    const config: SchedulerConfig = {
      loggerName: 'BassScheduler',
      instrumentType: 'bass',
      eventTypeToBufferKey: {}, // Will be populated from buffer keys
      baseVolume: 0.7,
      preserveAttackEnvelope: true,
    };
    super(instanceId, tracks, config);
  }

  /**
   * Override stopAll to add graceful fade-out matching HarmonySchedulerV2
   *
   * Stop Modes:
   * - Manual Stop (graceful=false): 50ms quick fade (handled by super)
   * - Exercise End (graceful=true): 1.5s hold + 2.5s exponential fade
   */
  override stopAll(graceful = false): void {
    // For non-graceful (manual) stops, use the parent implementation
    if (!graceful) {
      super.stopAll(graceful);
      return;
    }

    // GRACEFUL STOP: Apply 4-second ring-out (1.5s hold + 2.5s fade)
    // This matches HarmonySchedulerV2 behavior for consistent exercise endings
    const scheduledSources = this.getScheduledSources();
    const audioContext = this.getAudioContext();

    console.log('[BassScheduler GRACEFUL STOP] Applying ring-out fade', {
      scheduledCount: scheduledSources.size,
    });

    if (!audioContext || scheduledSources.size === 0) {
      // No context or sources - just clear tracking
      this.clearScheduledSources();
      return;
    }

    // Ring-out timing constants (matching HarmonySchedulerV2)
    const RING_OUT_HOLD = 1.5; // 1.5 second hold at current volume
    const RING_OUT_FADE = 2.5; // 2.5 second fadeout
    const currentTime = audioContext.currentTime;
    const fadeStartTime = currentTime + RING_OUT_HOLD;
    const stopTime = fadeStartTime + RING_OUT_FADE;

    let fadedCount = 0;
    let errorCount = 0;

    scheduledSources.forEach((metadata, source) => {
      try {
        if (metadata.gain) {
          const gain = metadata.gain;
          const currentGain = gain.gain.value;

          // Cancel any existing automation
          gain.gain.cancelScheduledValues(currentTime);
          // Hold current gain for 1.5 seconds
          gain.gain.setValueAtTime(currentGain, currentTime);
          gain.gain.linearRampToValueAtTime(currentGain, fadeStartTime);
          // Fade to silence over 2.5 seconds using exponential ramp for natural decay
          gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
          fadedCount++;
        }

        // Schedule stop after fade completes
        source.stop(stopTime + 0.01);
      } catch (e) {
        // Source may have already stopped or never started
        errorCount++;
      }
    });

    // Clear tracking - sources will clean up after scheduled stop
    this.clearScheduledSources();

    console.log('[BassScheduler GRACEFUL STOP] Ring-out fade applied', {
      fadedCount,
      errorCount,
      holdDuration: RING_OUT_HOLD + 's',
      fadeDuration: RING_OUT_FADE + 's',
      totalRingOut: RING_OUT_HOLD + RING_OUT_FADE + 's',
    });
  }
}

/**
 * VoiceCueScheduler - configured for voice cues
 * NOTE: No eventTypeToBufferKey mapping - relies on event.data.cue for buffer lookup
 */
export class VoiceCueScheduler extends SimpleInstrumentScheduler {
  constructor(instanceId: string, tracks: Map<string, any>) {
    const config: SchedulerConfig = {
      loggerName: 'VoiceCueScheduler',
      instrumentType: 'voice-cue',
      eventTypeToBufferKey: {}, // Empty - use event.data.cue fallback for 'one', 'two', 'three', 'four'
      baseVolume: 1.0,
      preserveAttackEnvelope: true,
    };
    super(instanceId, tracks, config);
  }
}
