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
