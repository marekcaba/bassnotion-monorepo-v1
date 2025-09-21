/**
 * Metronome Scheduler
 *
 * Handles beat scheduling and pattern management for metronome
 */

import * as Tone from 'tone';
import { BaseInstrumentScheduler } from '../../architecture/IInstrumentScheduler.js';
import type {
  Pattern,
  ScheduledNote,
  TimeSignature,
} from '../../architecture/IInstrumentScheduler.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import type { MetronomeCore, MetronomeNote } from './MetronomeCore.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('MetronomeScheduler');

export interface MetronomePattern extends Pattern {
  timeSignature: TimeSignature;
  accentPattern: number[]; // Beat positions to accent (1-based)
  subdivisions: number; // Subdivisions per beat
  includeSubdivisions: boolean;
}

export interface MetronomeSchedulerOptions {
  preClick?: number; // Number of pre-count beats
  visualOffset?: number; // Visual sync offset in ms
  adaptiveTiming?: boolean; // Adjust for system latency
}

/**
 * Scheduler specifically for metronome patterns
 */
export class MetronomeScheduler extends BaseInstrumentScheduler {
  private metronomeCore: MetronomeCore;
  private currentPattern: MetronomePattern | null = null;
  private preClickCount = 0;
  private visualOffset = 0;
  private adaptiveTiming = false;
  private mainLoop: Tone.Loop | null = null;
  private visualCallbacks: Set<(beat: number, subdivision: number) => void> =
    new Set();

  constructor(
    metronomeCore: MetronomeCore,
    options: MetronomeSchedulerOptions = {},
  ) {
    super(Tone.Transport);
    this.metronomeCore = metronomeCore;
    this.preClickCount = options.preClick || 0;
    this.visualOffset = options.visualOffset || 0;
    this.adaptiveTiming = options.adaptiveTiming || false;
  }

  /**
   * Create a metronome pattern
   */
  createPattern(
    timeSignature: TimeSignature,
    options: {
      accentPattern?: number[];
      subdivisions?: number;
      includeSubdivisions?: boolean;
    } = {},
  ): MetronomePattern {
    const {
      accentPattern = [1], // Default: accent first beat
      subdivisions = 1,
      includeSubdivisions = false,
    } = options;

    const notes: ScheduledNote[] = [];
    const beatsPerMeasure = timeSignature.numerator;
    const beatDuration = 1 / (timeSignature.denominator / 4); // Convert to quarter notes

    // Generate notes for one measure
    for (let beat = 1; beat <= beatsPerMeasure; beat++) {
      const isAccent = accentPattern.includes(beat);

      // Main beat
      notes.push({
        pitch: isAccent ? 'C3' : 'C4',
        velocity: isAccent ? 127 : 100,
        beat: (beat - 1) * beatDuration,
        duration: beatDuration,
        clickType: isAccent ? 'accent' : 'regular',
      } as ScheduledNote & { clickType: string });

      // Subdivisions
      if (includeSubdivisions && subdivisions > 1) {
        const subdivisionDuration = beatDuration / subdivisions;

        for (let sub = 1; sub < subdivisions; sub++) {
          notes.push({
            pitch: 'C5',
            velocity: 70,
            beat: (beat - 1) * beatDuration + sub * subdivisionDuration,
            duration: subdivisionDuration,
            clickType: 'subdivision',
          } as ScheduledNote & { clickType: string });
        }
      }
    }

    return {
      id: this.generatePatternId(),
      name: `${timeSignature.numerator}/${timeSignature.denominator} Pattern`,
      notes,
      duration: beatsPerMeasure * beatDuration,
      timeSignature,
      accentPattern,
      subdivisions,
      includeSubdivisions,
    };
  }

  /**
   * Start metronome with pattern
   */
  startWithPattern(
    pattern: MetronomePattern,
    options: { bpm?: number } = {},
  ): void {
    this.stop();

    if (options.bpm) {
      this.transport.bpm.value = options.bpm;
    }

    this.currentPattern = pattern;
    const measureDuration = pattern.duration;

    // Pre-click if enabled
    if (this.preClickCount > 0) {
      this.schedulePreClick();
    }

    // Create main loop
    this.mainLoop = new Tone.Loop((time) => {
      this.scheduleMeasure(pattern, time);
    }, measureDuration);

    this.mainLoop.start(this.preClickCount > 0 ? `+${measureDuration}` : 0);
    this.start();
  }

  /**
   * Schedule a single note
   */
  scheduleNote(note: Note, time: number | string): string {
    const eventId = this.generateEventId();
    const scheduledTime =
      typeof time === 'string' ? Tone.Time(time).toSeconds() : time;

    // Apply adaptive timing if enabled
    const adjustedTime = this.adaptiveTiming
      ? scheduledTime + this.getLatencyCompensation()
      : scheduledTime;

    // Schedule audio
    this.transport.schedule((t) => {
      this.metronomeCore.trigger({ ...note, time: t });
      this.markEventPlayed(eventId);
    }, adjustedTime);

    // Schedule visual callback
    if (
      this.visualCallbacks.size > 0 &&
      note instanceof Object &&
      'beat' in note
    ) {
      const visualTime = adjustedTime - this.visualOffset / 1000;
      this.transport.schedule(() => {
        this.triggerVisualCallbacks(
          (note as any).beat || 0,
          (note as any).subdivision || 0,
        );
      }, visualTime);
    }

    // Track event
    this.scheduledEvents.set(eventId, {
      id: eventId,
      note,
      time: scheduledTime,
      scheduled: true,
      played: false,
    });

    return eventId;
  }

  /**
   * Schedule a pattern
   */
  schedulePattern(pattern: Pattern, startTime?: number | string): string[] {
    const eventIds: string[] = [];
    const baseTime = startTime
      ? typeof startTime === 'string'
        ? Tone.Time(startTime).toSeconds()
        : startTime
      : this.transport.now();

    for (const note of pattern.notes) {
      const noteTime = baseTime + note.beat;
      const metronomeNote: MetronomeNote = {
        ...note,
        clickType: (note as any).clickType || 'regular',
        beat: Math.floor(note.beat) + 1,
        subdivision: Math.round(
          (note.beat % 1) * ((pattern as MetronomePattern).subdivisions || 1),
        ),
      };

      const eventId = this.scheduleNote(metronomeNote, noteTime);
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * Schedule pre-click beats
   */
  private schedulePreClick(): void {
    const beatDuration = 1; // One quarter note

    for (let i = 0; i < this.preClickCount; i++) {
      const time = i * beatDuration;
      this.scheduleNote(
        {
          pitch: 'C5',
          velocity: 90,
          clickType: 'regular',
          beat: -(this.preClickCount - i),
        } as MetronomeNote,
        time,
      );
    }
  }

  /**
   * Schedule a measure
   */
  private scheduleMeasure(pattern: MetronomePattern, time: number): void {
    this.schedulePattern(pattern, time);
  }

  /**
   * Stop metronome
   */
  stop(time?: number | string): void {
    if (this.mainLoop) {
      this.mainLoop.stop();
      this.mainLoop.dispose();
      this.mainLoop = null;
    }

    super.stop(time);
    this.currentPattern = null;
  }

  /**
   * Add visual callback
   */
  addVisualCallback(
    callback: (beat: number, subdivision: number) => void,
  ): void {
    this.visualCallbacks.add(callback);
  }

  /**
   * Remove visual callback
   */
  removeVisualCallback(
    callback: (beat: number, subdivision: number) => void,
  ): void {
    this.visualCallbacks.delete(callback);
  }

  /**
   * Trigger visual callbacks
   */
  private triggerVisualCallbacks(beat: number, subdivision: number): void {
    for (const callback of this.visualCallbacks) {
      try {
        callback(beat, subdivision);
      } catch (error) {
        logger.error('Visual callback error', error);
      }
    }
  }

  /**
   * Mark event as played
   */
  private markEventPlayed(eventId: string): void {
    const event = this.scheduledEvents.get(eventId);
    if (event) {
      event.played = true;
    }
  }

  /**
   * Get latency compensation
   */
  private getLatencyCompensation(): number {
    // Simple adaptive timing - could be enhanced
    return Tone.context.baseLatency;
  }

  /**
   * Generate pattern ID
   */
  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current pattern
   */
  getCurrentPattern(): MetronomePattern | null {
    return this.currentPattern;
  }

  /**
   * Update options
   */
  updateOptions(options: MetronomeSchedulerOptions): void {
    if (options.preClick !== undefined) {
      this.preClickCount = options.preClick;
    }
    if (options.visualOffset !== undefined) {
      this.visualOffset = options.visualOffset;
    }
    if (options.adaptiveTiming !== undefined) {
      this.adaptiveTiming = options.adaptiveTiming;
    }
  }
}
