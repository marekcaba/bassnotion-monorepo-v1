/**
 * EventRouter - Centralized event emission and audio scheduling
 *
 * Routes pattern events to appropriate scheduling systems:
 * - Direct audio scheduling (sample-perfect, Phase 4)
 * - Event bus fallback (legacy instruments)
 *
 * Responsibilities:
 * - Time conversion (transport time → AudioContext time)
 * - Sample-accurate rounding (frame-perfect scheduling)
 * - Instrument-specific routing
 * - Event bus fallback
 */

import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RegionProcessor');

// PatternEvent type definition (from RegionProcessor)
export interface PatternEvent {
  position: string;
  type: string;
  velocity?: number;
  duration?: string;
  data?: any;
}

export interface EventBus {
  emit(event: string, data: any): void;
}

export interface Scheduler {
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean;
}

export class EventRouter {
  private instanceId: string;
  private audioContext: AudioContext | null = null;
  private sampleRate = 48000;
  private transportStartTime = 0;
  private eventBus!: EventBus;

  // Instrument schedulers (Phase 4)
  private metronomeScheduler!: Scheduler;
  private drumScheduler!: Scheduler;
  private harmonyScheduler!: Scheduler;
  private bassScheduler!: Scheduler;
  private voiceCueScheduler!: Scheduler;

  // Timing accuracy callback
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private trackTimingAccuracy: (frame: number, time: number) => void = () => {};

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Initialize with required dependencies
   */
  initialize(
    audioContext: AudioContext | null,
    sampleRate: number,
    eventBus: EventBus,
    metronomeScheduler: Scheduler,
    drumScheduler: Scheduler,
    harmonyScheduler: Scheduler,
    bassScheduler: Scheduler,
    voiceCueScheduler: Scheduler,
    trackTimingAccuracy: (frame: number, time: number) => void,
  ): void {
    this.audioContext = audioContext;
    this.sampleRate = sampleRate;
    this.eventBus = eventBus;
    this.metronomeScheduler = metronomeScheduler;
    this.drumScheduler = drumScheduler;
    this.harmonyScheduler = harmonyScheduler;
    this.bassScheduler = bassScheduler;
    this.voiceCueScheduler = voiceCueScheduler;
    this.trackTimingAccuracy = trackTimingAccuracy;
  }

  /**
   * Update transport start time (called when transport starts)
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
  }

  /**
   * Emit event with timing conversion and routing
   */
  emitEvent(instrumentType: string, event: PatternEvent, time: number): void {
    // CRITICAL FIX: Convert transport time → AudioContext time
    // transportTime (beats) + transportStartTime (anchor) = audioContextTime (hardware)
    let audioTime = this.transportStartTime + time;

    // FAANG SOLUTION: Sample-accurate rounding for sub-millisecond precision
    // Round to exact audio frame to eliminate sub-sample jitter
    let frame = 0;
    if (this.audioContext) {
      frame = Math.round(audioTime * this.sampleRate);
      audioTime = frame / this.sampleRate;

      // Track timing accuracy metrics
      this.trackTimingAccuracy(frame, time);
    }

    const timestamp = Date.now();

    // Debug logging removed for performance

    // FAANG SOLUTION: Try direct audio scheduling first (sample-perfect)
    if (this.scheduleAudioDirect(instrumentType, event, audioTime, frame)) {
      // Successfully scheduled directly - skip event bus
      return;
    }

    // Fall back to event bus for instruments without direct scheduling
    this.emitToEventBus(instrumentType, event, audioTime, timestamp);
  }

  /**
   * FAANG SOLUTION: Schedule audio directly in Web Audio graph
   * Bypasses JavaScript callback timing for sample-perfect playback
   */
  private scheduleAudioDirect(
    instrumentType: string,
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // Handle metronome
    if (instrumentType === 'metronome') {
      return this.metronomeScheduler.schedule(event, audioTime, frame);
    }

    // Handle drums
    if (instrumentType === 'drums') {
      return this.drumScheduler.schedule(event, audioTime, frame);
    }

    // Handle harmony
    if (instrumentType === 'harmony') {
      return this.harmonyScheduler.schedule(event, audioTime, frame);
    }

    // Handle bass
    if (instrumentType === 'bass') {
      return this.bassScheduler.schedule(event, audioTime, frame);
    }

    // Handle voice cues
    if (instrumentType === 'voice-cue') {
      return this.voiceCueScheduler.schedule(event, audioTime, frame);
    }

    // Not supported yet - fall back to event bus
    logger.debug(
      `❌ FAANG: Direct scheduling not yet implemented for: ${instrumentType}`,
    );
    return false;
  }

  /**
   * Emit event to event bus (fallback for legacy instruments)
   */
  private emitToEventBus(
    instrumentType: string,
    event: PatternEvent,
    audioTime: number,
    timestamp: number,
  ): void {
    switch (instrumentType) {
      case 'metronome':
        this.eventBus.emit('metronome-trigger', {
          beat: event.type === 'accent' ? 1 : 2, // Simple beat numbering
          isDownbeat: event.type === 'accent',
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        logger.debug(
          `Emitted metronome-trigger: ${event.type} at ${audioTime.toFixed(3)}`,
        );
        break;

      case 'drums': {
        // Map event types to drum names
        const drumMap: Record<string, string> = {
          kick: 'kick',
          snare: 'snare',
          hihat: 'hihat',
          openhat: 'openHihat',
          crash: 'crash',
          ride: 'ride',
          accent: 'kick',
          click: 'hihat',
        };

        const drum = drumMap[event.type] || event.type;
        this.eventBus.emit('drum-trigger', {
          drum,
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        logger.debug(
          `Emitted drum-trigger: ${drum} at ${audioTime.toFixed(3)}`,
        );
        break;
      }

      case 'bass':
        this.eventBus.emit('bass-trigger', {
          note: event.type,
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        break;

      case 'harmony':
        this.eventBus.emit('chord-trigger', {
          chord: event.type,
          notes: [], // Would need to parse from event
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        break;
    }
  }
}
