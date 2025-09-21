/**
 * Drum Pattern Scheduler
 *
 * Handles drum pattern sequencing and scheduling
 */

import * as Tone from 'tone';
import { BaseInstrumentScheduler } from '../../architecture/IInstrumentScheduler.js';
import type {
  Pattern,
  ScheduledNote,
} from '../../architecture/IInstrumentScheduler.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import type { DrumSampleEngine, DrumNote } from './DrumSampleEngine.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('DrumPatternScheduler');

export interface DrumStep {
  drum: string; // Drum ID
  velocity: number;
  probability?: number; // 0-1 for generative patterns
  flam?: boolean; // Add flam
  ghost?: boolean; // Ghost note
  accent?: boolean; // Accented hit
}

export interface DrumPattern extends Pattern {
  steps: DrumStep[][];
  resolution: number; // Steps per beat
  swing?: number;
  humanize?: {
    timing?: number; // Timing variation in %
    velocity?: number; // Velocity variation in %
  };
}

export interface DrumSequence {
  id: string;
  name: string;
  patterns: {
    [partName: string]: DrumPattern;
  };
  arrangement?: {
    part: string;
    bars: number;
  }[];
}

/**
 * Scheduler for drum patterns and sequences
 */
export class DrumPatternScheduler extends BaseInstrumentScheduler {
  private drumEngine: DrumSampleEngine;
  private currentPattern: DrumPattern | null = null;
  private currentSequence: DrumSequence | null = null;
  private sequencePosition = 0;
  private patternLoop: Tone.Loop | null = null;
  private stepCallbacks: Set<(step: number, hits: DrumStep[]) => void> =
    new Set();

  constructor(drumEngine: DrumSampleEngine) {
    super(Tone.Transport);
    this.drumEngine = drumEngine;
  }

  /**
   * Create a drum pattern
   */
  createPattern(
    steps: DrumStep[][],
    options: {
      resolution?: number;
      name?: string;
      swing?: number;
      humanize?: { timing?: number; velocity?: number };
    } = {},
  ): DrumPattern {
    const {
      resolution = 16, // 16th notes by default
      name = 'Drum Pattern',
      swing = 0,
      humanize = {},
    } = options;

    // Convert steps to notes
    const notes: ScheduledNote[] = [];
    const stepDuration = (1 / resolution) * 4; // Convert to quarter notes

    for (let step = 0; step < steps.length; step++) {
      const hits = steps[step];
      for (const hit of hits) {
        const note: ScheduledNote & { drum: string } = {
          pitch: hit.drum,
          velocity: hit.velocity,
          beat: step * stepDuration,
          duration: stepDuration,
          drum: hit.drum,
          probability: hit.probability,
          swing: swing,
        };
        notes.push(note);
      }
    }

    return {
      id: this.generatePatternId(),
      name,
      notes,
      duration: steps.length * stepDuration,
      steps,
      resolution,
      swing,
      humanize,
    };
  }

  /**
   * Schedule a single note
   */
  scheduleNote(note: Note, time: number | string): string {
    const eventId = this.generateEventId();
    const scheduledTime =
      typeof time === 'string' ? Tone.Time(time).toSeconds() : time;

    this.transport.schedule((t) => {
      // Apply humanization
      const humanizedNote = this.humanizeNote(note as DrumNote);
      const humanizedTime = this.humanizeTime(t);

      this.drumEngine.trigger({ ...humanizedNote, time: humanizedTime });
      this.markEventPlayed(eventId);
    }, scheduledTime);

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
    const drumPattern = pattern as DrumPattern;
    const eventIds: string[] = [];
    const baseTime = startTime
      ? typeof startTime === 'string'
        ? Tone.Time(startTime).toSeconds()
        : startTime
      : this.transport.now();

    // Schedule each step
    const stepDuration = (1 / drumPattern.resolution) * 4;

    for (let step = 0; step < drumPattern.steps.length; step++) {
      const hits = drumPattern.steps[step];
      const stepTime = baseTime + step * stepDuration;

      // Apply swing
      const swingTime = this.applySwing(
        stepTime,
        step / drumPattern.resolution,
      );

      // Schedule step callback
      if (this.stepCallbacks.size > 0) {
        this.transport.schedule(() => {
          this.triggerStepCallbacks(step, hits);
        }, swingTime);
      }

      // Schedule hits
      for (const hit of hits) {
        // Check probability
        if (hit.probability !== undefined && Math.random() > hit.probability) {
          continue;
        }

        // Create drum note
        const drumNote: DrumNote = {
          drum: hit.drum,
          pitch: hit.drum,
          velocity: hit.velocity,
          duration: stepDuration,
        };

        // Apply modifiers
        if (hit.ghost) {
          drumNote.velocity *= 0.5; // Ghost notes at 50% velocity
        }
        if (hit.accent) {
          drumNote.velocity = Math.min(127, drumNote.velocity * 1.3);
        }

        // Schedule main hit
        const eventId = this.scheduleNote(drumNote, swingTime);
        eventIds.push(eventId);

        // Schedule flam if needed
        if (hit.flam) {
          const flamNote = { ...drumNote, velocity: drumNote.velocity * 0.7 };
          const flamTime = swingTime - 0.02; // 20ms before main hit
          const flamEventId = this.scheduleNote(flamNote, flamTime);
          eventIds.push(flamEventId);
        }
      }
    }

    return eventIds;
  }

  /**
   * Start playing a pattern in loop
   */
  playPattern(pattern: DrumPattern, options: { bpm?: number } = {}): void {
    this.stop();

    if (options.bpm) {
      this.transport.bpm.value = options.bpm;
    }

    this.currentPattern = pattern;
    const duration = pattern.duration;

    // Create loop
    this.patternLoop = new Tone.Loop((time) => {
      this.schedulePattern(pattern, time);
    }, duration);

    this.patternLoop.start(0);
    this.start();
  }

  /**
   * Play a sequence of patterns
   */
  playSequence(sequence: DrumSequence, options: { bpm?: number } = {}): void {
    this.stop();

    if (options.bpm) {
      this.transport.bpm.value = options.bpm;
    }

    this.currentSequence = sequence;
    this.sequencePosition = 0;

    // Use arrangement or play all patterns in order
    const arrangement =
      sequence.arrangement ||
      Object.keys(sequence.patterns).map((part) => ({ part, bars: 1 }));

    // Schedule entire sequence
    let currentTime = 0;
    for (const section of arrangement) {
      const pattern = sequence.patterns[section.part];
      if (!pattern) continue;

      for (let bar = 0; bar < section.bars; bar++) {
        this.schedulePattern(pattern, currentTime);
        currentTime += pattern.duration;
      }
    }

    this.start();
  }

  /**
   * Stop playback
   */
  stop(time?: number | string): void {
    if (this.patternLoop) {
      this.patternLoop.stop();
      this.patternLoop.dispose();
      this.patternLoop = null;
    }

    super.stop(time);
    this.currentPattern = null;
    this.currentSequence = null;
  }

  /**
   * Apply humanization to note
   */
  private humanizeNote(note: DrumNote): DrumNote {
    if (!this.currentPattern?.humanize) return note;

    const humanized = { ...note };

    // Humanize velocity
    if (this.currentPattern.humanize.velocity) {
      const variation =
        ((Math.random() - 0.5) * 2 * this.currentPattern.humanize.velocity) /
        100;
      humanized.velocity = Math.round(
        Math.max(1, Math.min(127, note.velocity * (1 + variation))),
      );
    }

    return humanized;
  }

  /**
   * Apply humanization to timing
   */
  private humanizeTime(time: number): number {
    if (!this.currentPattern?.humanize?.timing) return time;

    const maxVariation = 0.01; // 10ms max variation
    const variation =
      (Math.random() - 0.5) *
      2 *
      maxVariation *
      (this.currentPattern.humanize.timing / 100);

    return time + variation;
  }

  /**
   * Add step callback
   */
  addStepCallback(callback: (step: number, hits: DrumStep[]) => void): void {
    this.stepCallbacks.add(callback);
  }

  /**
   * Remove step callback
   */
  removeStepCallback(callback: (step: number, hits: DrumStep[]) => void): void {
    this.stepCallbacks.delete(callback);
  }

  /**
   * Trigger step callbacks
   */
  private triggerStepCallbacks(step: number, hits: DrumStep[]): void {
    for (const callback of this.stepCallbacks) {
      try {
        callback(step, hits);
      } catch (error) {
        logger.error('Step callback error', error);
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
   * Generate pattern ID
   */
  private generatePatternId(): string {
    return `drum-pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current pattern
   */
  getCurrentPattern(): DrumPattern | null {
    return this.currentPattern;
  }

  /**
   * Get current sequence
   */
  getCurrentSequence(): DrumSequence | null {
    return this.currentSequence;
  }
}

/**
 * Common drum patterns
 */
export const CommonDrumPatterns = {
  // Basic 4/4 rock beat
  rock: {
    steps: [
      [
        { drum: 'kick', velocity: 100 },
        { drum: 'hihat-closed', velocity: 80 },
      ],
      [{ drum: 'hihat-closed', velocity: 60 }],
      [
        { drum: 'snare', velocity: 100 },
        { drum: 'hihat-closed', velocity: 80 },
      ],
      [{ drum: 'hihat-closed', velocity: 60 }],
      [
        { drum: 'kick', velocity: 90 },
        { drum: 'hihat-closed', velocity: 80 },
      ],
      [
        { drum: 'kick', velocity: 70 },
        { drum: 'hihat-closed', velocity: 60 },
      ],
      [
        { drum: 'snare', velocity: 100 },
        { drum: 'hihat-closed', velocity: 80 },
      ],
      [{ drum: 'hihat-closed', velocity: 60 }],
    ],
    resolution: 8,
    name: 'Rock Beat',
  },

  // Basic hip-hop beat
  hiphop: {
    steps: [
      [{ drum: 'kick', velocity: 110 }],
      [],
      [{ drum: 'hihat-closed', velocity: 70 }],
      [],
      [{ drum: 'snare', velocity: 100 }],
      [],
      [{ drum: 'hihat-closed', velocity: 70 }],
      [{ drum: 'hihat-closed', velocity: 50, ghost: true }],
      [{ drum: 'kick', velocity: 90 }],
      [],
      [{ drum: 'kick', velocity: 80 }],
      [],
      [{ drum: 'snare', velocity: 100 }],
      [],
      [{ drum: 'hihat-closed', velocity: 70 }],
      [],
    ],
    resolution: 16,
    name: 'Hip-Hop Beat',
    swing: 20,
  },
};
