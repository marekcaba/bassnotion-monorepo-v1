/**
 * Bass Sequencer
 *
 * Handles bass line sequencing and pattern playback
 */

import * as Tone from 'tone';
import { BaseInstrumentScheduler } from '../../architecture/IInstrumentScheduler.js';
import type {
  Pattern,
  ScheduledNote,
} from '../../architecture/IInstrumentScheduler.js';
import type { Note } from '../../architecture/IInstrumentCore.js';
import type { BassSynthEngine, BassNote } from './BassSynthEngine.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('BassSequencer');

export interface BassPattern extends Pattern {
  groove?: 'straight' | 'shuffle' | 'swing';
  articulation?: 'legato' | 'staccato' | 'normal';
  dynamics?: {
    accent?: number[]; // Beat indices to accent
    ghost?: number[]; // Beat indices for ghost notes
  };
}

export interface BassSequence {
  id: string;
  name: string;
  tempo?: number;
  patterns: {
    intro?: BassPattern;
    verse?: BassPattern;
    chorus?: BassPattern;
    bridge?: BassPattern;
    outro?: BassPattern;
    [key: string]: BassPattern | undefined;
  };
  structure?: string[]; // e.g., ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro']
}

export interface BasslineAnalysis {
  key?: string;
  scale?: string;
  rootNotes: string[];
  chordChanges: { beat: number; chord: string }[];
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Sequencer for bass patterns and lines
 */
export class BassSequencer extends BaseInstrumentScheduler {
  private bassEngine: BassSynthEngine;
  private currentPattern: BassPattern | null = null;
  private currentSequence: BassSequence | null = null;
  private sequenceIndex = 0;
  private patternLoop: Tone.Loop | null = null;
  private noteCallbacks: Set<(note: BassNote, time: number) => void> =
    new Set();

  // Groove templates
  private grooveTemplates = {
    straight: { swing: 0, noteLength: 0.9 },
    shuffle: { swing: 67, noteLength: 0.8 },
    swing: { swing: 20, noteLength: 0.85 },
  };

  constructor(bassEngine: BassSynthEngine) {
    super(Tone.Transport);
    this.bassEngine = bassEngine;
  }

  /**
   * Create a bass pattern from notes
   */
  createPattern(
    notes: (BassNote & { beat: number })[],
    options: {
      duration?: number;
      name?: string;
      groove?: BassPattern['groove'];
      articulation?: BassPattern['articulation'];
      dynamics?: BassPattern['dynamics'];
    } = {},
  ): BassPattern {
    const {
      duration = 4, // Default 1 bar
      name = 'Bass Pattern',
      groove = 'straight',
      articulation = 'normal',
      dynamics,
    } = options;

    // Apply groove template
    const grooveSettings = this.grooveTemplates[groove];

    // Convert to scheduled notes
    const scheduledNotes: ScheduledNote[] = notes.map((note) => ({
      ...note,
      pitch: note.pitch,
      velocity: this.applyDynamics(note, dynamics),
      duration: note.duration || grooveSettings.noteLength,
      beat: note.beat,
      swing: grooveSettings.swing,
    }));

    return {
      id: this.generatePatternId(),
      name,
      notes: scheduledNotes,
      duration,
      groove,
      articulation,
      dynamics,
    };
  }

  /**
   * Create a walking bass pattern
   */
  createWalkingBassPattern(
    rootNote: string,
    scale: string[],
    bars = 1,
    options: {
      notesPerBeat?: number;
      octaveRange?: [number, number];
    } = {},
  ): BassPattern {
    const { notesPerBeat = 1, octaveRange = [2, 3] } = options;

    const notes: (BassNote & { beat: number })[] = [];
    const beatsPerBar = 4;
    const totalBeats = bars * beatsPerBar;

    // Generate walking bass line
    for (let beat = 0; beat < totalBeats; beat++) {
      for (let sub = 0; sub < notesPerBeat; sub++) {
        const beatTime = beat + sub / notesPerBeat;

        // Choose note from scale
        const scaleIndex = Math.floor(Math.random() * scale.length);
        const octave =
          octaveRange[0] +
          Math.floor(Math.random() * (octaveRange[1] - octaveRange[0] + 1));
        const noteName = scale[scaleIndex] + octave;

        notes.push({
          pitch: noteName,
          velocity: 80 + Math.random() * 20,
          duration: 0.9 / notesPerBeat,
          beat: beatTime,
          technique: 'fingered',
        });
      }
    }

    return this.createPattern(notes, {
      duration: bars * beatsPerBar,
      name: `Walking Bass in ${rootNote}`,
      groove: 'swing',
      articulation: 'legato',
    });
  }

  /**
   * Schedule a single bass note
   */
  scheduleNote(note: Note, time: number | string): string {
    const eventId = this.generateEventId();
    const scheduledTime =
      typeof time === 'string' ? Tone.Time(time).toSeconds() : time;
    const bassNote = note as BassNote;

    this.transport.schedule((t) => {
      // Apply articulation
      const articulatedNote = this.applyArticulation(bassNote);

      // Trigger note
      this.bassEngine.trigger({ ...articulatedNote, time: t });

      // Notify callbacks
      this.notifyCallbacks(articulatedNote, t);

      // Mark as played
      this.markEventPlayed(eventId);

      // Schedule release
      if (articulatedNote.duration) {
        this.transport.schedule((releaseTime) => {
          this.bassEngine.release({ ...articulatedNote, time: releaseTime });
        }, t + articulatedNote.duration);
      }
    }, scheduledTime);

    this.scheduledEvents.set(eventId, {
      id: eventId,
      note: bassNote,
      time: scheduledTime,
      scheduled: true,
      played: false,
    });

    return eventId;
  }

  /**
   * Schedule a bass pattern
   */
  schedulePattern(pattern: Pattern, startTime?: number | string): string[] {
    const bassPattern = pattern as BassPattern;
    const eventIds: string[] = [];
    const baseTime = startTime
      ? typeof startTime === 'string'
        ? Tone.Time(startTime).toSeconds()
        : startTime
      : this.transport.now();

    // Schedule each note
    for (const note of bassPattern.notes) {
      const noteTime = baseTime + this.beatsToSeconds(note.beat);
      const bassNote: BassNote = {
        ...note,
        technique: this.getDefaultTechnique(bassPattern),
      };

      const eventId = this.scheduleNote(bassNote, noteTime);
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * Play a bass pattern in loop
   */
  playPattern(pattern: BassPattern, options: { bpm?: number } = {}): void {
    this.stop();

    if (options.bpm) {
      this.transport.bpm.value = options.bpm;
    }

    this.currentPattern = pattern;
    const duration = pattern.duration;

    // Create loop
    this.patternLoop = new Tone.Loop((time) => {
      this.schedulePattern(pattern, time);
    }, duration + 's');

    this.patternLoop.start(0);
    this.start();

    logger.info('Playing bass pattern', {
      name: pattern.name,
      duration: pattern.duration,
      notes: pattern.notes.length,
    });
  }

  /**
   * Play a bass sequence
   */
  playSequence(sequence: BassSequence, options: { bpm?: number } = {}): void {
    this.stop();

    if (options.bpm || sequence.tempo) {
      this.transport.bpm.value = options.bpm || sequence.tempo || 120;
    }

    this.currentSequence = sequence;
    this.sequenceIndex = 0;

    const structure = sequence.structure || Object.keys(sequence.patterns);

    // Schedule the entire sequence
    let currentTime = 0;
    for (const section of structure) {
      const pattern = sequence.patterns[section];
      if (!pattern) continue;

      this.schedulePattern(pattern, currentTime);
      currentTime += pattern.duration;
    }

    this.start();

    logger.info('Playing bass sequence', {
      name: sequence.name,
      sections: structure.length,
    });
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
   * Analyze a bass pattern
   */
  analyzePattern(pattern: BassPattern): BasslineAnalysis {
    const notes = pattern.notes;
    const pitches = notes
      .map((n) => n.pitch)
      .filter((p) => typeof p === 'string') as string[];

    // Extract root notes (simplified)
    const rootNotes = [...new Set(pitches.map((p) => p.replace(/[0-9]/g, '')))];

    // Analyze complexity
    let complexity: BasslineAnalysis['complexity'] = 'simple';
    if (notes.length / pattern.duration > 4) {
      complexity = 'complex';
    } else if (notes.length / pattern.duration > 2) {
      complexity = 'moderate';
    }

    // Detect chord changes (simplified)
    const chordChanges: { beat: number; chord: string }[] = [];
    let lastRoot = '';
    for (const note of notes) {
      if (typeof note.pitch === 'string') {
        const root = note.pitch.replace(/[0-9]/g, '');
        if (root !== lastRoot) {
          chordChanges.push({ beat: note.beat, chord: root });
          lastRoot = root;
        }
      }
    }

    return {
      rootNotes,
      chordChanges,
      complexity,
    };
  }

  /**
   * Apply dynamics to a note
   */
  private applyDynamics(
    note: BassNote & { beat: number },
    dynamics?: BassPattern['dynamics'],
  ): number {
    let velocity = note.velocity;

    if (!dynamics) return velocity;

    // Apply accent
    if (dynamics.accent && dynamics.accent.includes(Math.floor(note.beat))) {
      velocity = Math.min(127, velocity * 1.3);
    }

    // Apply ghost note
    if (dynamics.ghost && dynamics.ghost.includes(Math.floor(note.beat))) {
      velocity = velocity * 0.6;
    }

    return Math.round(velocity);
  }

  /**
   * Apply articulation to a note
   */
  private applyArticulation(note: BassNote): BassNote {
    if (!this.currentPattern) return note;

    const articulation = this.currentPattern.articulation || 'normal';
    const modified = { ...note };

    switch (articulation) {
      case 'legato':
        modified.duration = (modified.duration || 1) * 1.1;
        break;
      case 'staccato':
        modified.duration = (modified.duration || 1) * 0.5;
        break;
    }

    return modified;
  }

  /**
   * Get default technique for pattern
   */
  private getDefaultTechnique(pattern: BassPattern): BassNote['technique'] {
    // Determine technique based on groove and articulation
    if (pattern.articulation === 'staccato') {
      return 'picked';
    }
    if (pattern.groove === 'swing') {
      return 'fingered';
    }
    return 'fingered';
  }

  /**
   * Convert beats to seconds
   */
  private beatsToSeconds(beats: number): number {
    const bpm = this.transport.bpm.value;
    return (beats * 60) / bpm;
  }

  /**
   * Notify callbacks
   */
  private notifyCallbacks(note: BassNote, time: number): void {
    for (const callback of this.noteCallbacks) {
      try {
        callback(note, time);
      } catch (error) {
        logger.error('Note callback error', error);
      }
    }
  }

  /**
   * Add note callback
   */
  addNoteCallback(callback: (note: BassNote, time: number) => void): void {
    this.noteCallbacks.add(callback);
  }

  /**
   * Remove note callback
   */
  removeNoteCallback(callback: (note: BassNote, time: number) => void): void {
    this.noteCallbacks.delete(callback);
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
   * Get current pattern
   */
  getCurrentPattern(): BassPattern | null {
    return this.currentPattern;
  }

  /**
   * Get current sequence
   */
  getCurrentSequence(): BassSequence | null {
    return this.currentSequence;
  }
}

/**
 * Common bass patterns
 */
export const CommonBassPatterns = {
  // Simple root note pattern
  rootNote: (root: string, duration = 4): BassPattern => ({
    id: 'root-note',
    name: 'Root Note',
    notes: [
      { pitch: root + '2', velocity: 100, duration: 0.9, beat: 0 },
      { pitch: root + '2', velocity: 90, duration: 0.9, beat: 1 },
      { pitch: root + '2', velocity: 90, duration: 0.9, beat: 2 },
      { pitch: root + '2', velocity: 90, duration: 0.9, beat: 3 },
    ],
    duration,
  }),

  // Octave pattern
  octaves: (root: string, duration = 4): BassPattern => ({
    id: 'octaves',
    name: 'Octaves',
    notes: [
      { pitch: root + '2', velocity: 100, duration: 0.45, beat: 0 },
      { pitch: root + '3', velocity: 90, duration: 0.45, beat: 0.5 },
      { pitch: root + '2', velocity: 90, duration: 0.45, beat: 1 },
      { pitch: root + '3', velocity: 85, duration: 0.45, beat: 1.5 },
      { pitch: root + '2', velocity: 90, duration: 0.45, beat: 2 },
      { pitch: root + '3', velocity: 90, duration: 0.45, beat: 2.5 },
      { pitch: root + '2', velocity: 90, duration: 0.45, beat: 3 },
      { pitch: root + '3', velocity: 85, duration: 0.45, beat: 3.5 },
    ],
    duration,
    articulation: 'staccato',
  }),

  // Funk pattern
  funk: (root: string, duration = 2): BassPattern => ({
    id: 'funk',
    name: 'Funk',
    notes: [
      { pitch: root + '2', velocity: 110, duration: 0.2, beat: 0 },
      { pitch: root + '2', velocity: 60, duration: 0.2, beat: 0.25 },
      { pitch: root + '3', velocity: 100, duration: 0.2, beat: 0.75 },
      { pitch: root + '2', velocity: 90, duration: 0.4, beat: 1 },
      { pitch: root + '2', velocity: 70, duration: 0.2, beat: 1.5 },
      { pitch: root + '3', velocity: 95, duration: 0.2, beat: 1.75 },
    ],
    duration,
    groove: 'straight',
    articulation: 'staccato',
    dynamics: {
      accent: [0, 1],
      ghost: [0.25, 1.5],
    },
  }),
};
