/**
 * Instrument Scheduler Interface
 *
 * Handles timing and scheduling of musical events
 */

import type * as Tone from 'tone';
import type { Note } from './IInstrumentCore.js';

export interface Pattern {
  id: string;
  name: string;
  notes: ScheduledNote[];
  duration: number; // in beats
  timeSignature?: TimeSignature;
}

export interface ScheduledNote extends Note {
  beat: number; // position in beats
  duration: number; // duration in beats
  probability?: number; // 0-1 for generative patterns
  swing?: number; // swing amount for this note
}

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface SchedulerOptions {
  lookahead?: number; // in seconds
  scheduleAheadTime?: number; // in seconds
  tempo?: number; // BPM
  swing?: number; // 0-100%
  quantize?: number; // quantization grid (0 = off)
}

export interface ScheduledEvent {
  id: string;
  note: Note;
  time: number; // absolute time in seconds
  scheduled: boolean;
  played: boolean;
}

/**
 * Scheduler for instrument events
 */
export interface IInstrumentScheduler {
  // Scheduling
  scheduleNote(note: Note, time: number | string): string; // returns event ID
  schedulePattern(pattern: Pattern, startTime?: number | string): string[]; // returns event IDs
  scheduleLoop(pattern: Pattern, options: LoopOptions): string; // returns loop ID

  // Control
  start(time?: number | string): void;
  stop(time?: number | string): void;
  pause(): void;
  resume(): void;

  // Management
  cancel(eventId: string): void;
  cancelAll(): void;
  cancelLoop(loopId: string): void;

  // State
  getScheduledEvents(): ScheduledEvent[];
  isPlaying(): boolean;
  getCurrentBeat(): number;

  // Configuration
  setOptions(options: SchedulerOptions): void;
  getOptions(): SchedulerOptions;
}

export interface LoopOptions {
  interval?: number; // in beats
  iterations?: number; // number of times to loop (undefined = infinite)
  humanize?: number; // timing variation in %
  probability?: number; // 0-1
}

/**
 * Advanced scheduler with sequencing capabilities
 */
export interface ISequencer extends IInstrumentScheduler {
  // Sequencing
  addTrack(trackId: string, pattern: Pattern): void;
  removeTrack(trackId: string): void;
  muteTrack(trackId: string, mute: boolean): void;
  soloTrack(trackId: string, solo: boolean): void;

  // Pattern management
  setPattern(trackId: string, pattern: Pattern): void;
  getPattern(trackId: string): Pattern | undefined;
  clearPattern(trackId: string): void;

  // Transport
  setPosition(position: number): void; // in beats
  getPosition(): number;
  setLoop(start: number, end: number): void;
  clearLoop(): void;
}

/**
 * Base scheduler implementation
 */
export abstract class BaseInstrumentScheduler implements IInstrumentScheduler {
  protected options: SchedulerOptions = {
    lookahead: 0.1,
    scheduleAheadTime: 0.1,
    tempo: 120,
    swing: 0,
    quantize: 0,
  };

  protected scheduledEvents: Map<string, ScheduledEvent> = new Map();
  protected loops: Map<string, Tone.Loop> = new Map();
  protected isRunning = false;
  protected transport: typeof Tone.Transport;

  constructor(transport: typeof Tone.Transport) {
    this.transport = transport;
  }

  abstract scheduleNote(note: Note, time: number | string): string;
  abstract schedulePattern(
    pattern: Pattern,
    startTime?: number | string,
  ): string[];

  scheduleLoop(pattern: Pattern, options: LoopOptions): string {
    const loopId = this.generateLoopId();
    const {
      interval = pattern.duration,
      iterations,
      humanize = 0,
      probability = 1,
    } = options;

    let iteration = 0;
    const loop = new Tone.Loop((time) => {
      if (iterations !== undefined && iteration >= iterations) {
        this.cancelLoop(loopId);
        return;
      }

      if (Math.random() <= probability) {
        const humanizedTime = time + (Math.random() - 0.5) * humanize * 0.01;
        this.schedulePattern(pattern, humanizedTime);
      }

      iteration++;
    }, interval);

    this.loops.set(loopId, loop);
    return loopId;
  }

  start(time?: number | string): void {
    this.isRunning = true;
    if (time !== undefined) {
      this.transport.start(time);
    } else {
      this.transport.start();
    }
  }

  stop(time?: number | string): void {
    this.isRunning = false;
    if (time !== undefined) {
      this.transport.stop(time);
    } else {
      this.transport.stop();
    }
    this.cancelAll();
  }

  pause(): void {
    this.transport.pause();
  }

  resume(): void {
    this.transport.start();
  }

  cancel(eventId: string): void {
    const event = this.scheduledEvents.get(eventId);
    if (event && !event.played) {
      this.transport.clear(eventId);
      this.scheduledEvents.delete(eventId);
    }
  }

  cancelAll(): void {
    for (const eventId of this.scheduledEvents.keys()) {
      this.cancel(eventId);
    }
    for (const loopId of this.loops.keys()) {
      this.cancelLoop(loopId);
    }
  }

  cancelLoop(loopId: string): void {
    const loop = this.loops.get(loopId);
    if (loop) {
      loop.stop();
      loop.dispose();
      this.loops.delete(loopId);
    }
  }

  getScheduledEvents(): ScheduledEvent[] {
    return Array.from(this.scheduledEvents.values());
  }

  isPlaying(): boolean {
    return this.isRunning;
  }

  getCurrentBeat(): number {
    return this.transport.position as number;
  }

  setOptions(options: SchedulerOptions): void {
    this.options = { ...this.options, ...options };
    if (options.tempo !== undefined) {
      this.transport.bpm.value = options.tempo;
    }
  }

  getOptions(): SchedulerOptions {
    return { ...this.options };
  }

  protected generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateLoopId(): string {
    return `loop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  protected applySwing(time: number, beat: number): number {
    if (this.options.swing === 0) return time;

    // Apply swing to off-beats (8th notes)
    const isOffBeat = (beat * 2) % 1 !== 0;
    if (isOffBeat) {
      const swingAmount = (this.options.swing! / 100) * 0.1; // Max 10% swing
      return time + swingAmount;
    }

    return time;
  }

  protected quantizeTime(time: number): number {
    if (this.options.quantize === 0) return time;

    const grid = 1 / this.options.quantize!;
    return Math.round(time / grid) * grid;
  }
}
