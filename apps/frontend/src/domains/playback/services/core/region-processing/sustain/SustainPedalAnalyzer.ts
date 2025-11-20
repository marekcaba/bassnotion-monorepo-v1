/**
 * SustainPedalAnalyzer - Queries sustain pedal state from CC64 timeline
 *
 * Provides methods to check pedal state at specific times and find
 * pedal events relative to note times. Used for accurate sustain
 * duration calculation in harmony scheduling.
 */

// Sustain pedal analyzer - no logger needed (uses console for diagnostics)

export class SustainPedalAnalyzer {
  private exerciseEndTime: number = 0;
  private lastBeatThreshold: number = 0;

  constructor() {
    // Empty constructor
  }

  /**
   * Set exercise timing boundaries
   */
  setExerciseTiming(endTime: number, lastBeatThreshold: number): void {
    this.exerciseEndTime = endTime;
    this.lastBeatThreshold = lastBeatThreshold;
  }

  /**
   * Check if sustain pedal is down at a specific time
   * Returns the most recent pedal state before or at the given time
   *
   * @param time - Audio time to check
   * @param cc64Timeline - Timeline map from CC64TimelineBuilder
   * @returns true if pedal is down, false if up
   */
  isPedalDownAtTime(time: number, cc64Timeline: Map<number, boolean>): boolean {
    const sortedTimes = Array.from(cc64Timeline.keys()).sort((a, b) => a - b);

    let lastPedalState = false; // Default to UP
    let lastEventTime = -1;
    let eventsFound = 0;

    for (const eventTime of sortedTimes) {
      if (eventTime > time) break;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      lastPedalState = cc64Timeline.get(eventTime)!;
      lastEventTime = eventTime;
      eventsFound++;
    }

    // Enhanced diagnostic with precision info
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `[CC64 CHECK] isPedalDownAtTime(${time.toFixed(6)}s): lastEvent=${lastEventTime.toFixed(6)}s (${eventsFound} events scanned), state=${lastPedalState ? 'DOWN' : 'UP'}, timelineSize=${cc64Timeline.size}, precision=${time === lastEventTime ? 'EXACT' : 'APPROXIMATE'}`
    );

    return lastPedalState;
  }

  /**
   * Find the next CC64 UP event after a given time
   * Returns the audioTime of the next pedal UP, or null if none found
   *
   * @param noteStartTime - Note start time
   * @param cc64Timeline - Timeline map
   * @returns Audio time of next pedal UP, or null
   */
  findNextCC64Up(noteStartTime: number, cc64Timeline: Map<number, boolean>): number | null {
    const sortedTimes = Array.from(cc64Timeline.keys()).sort((a, b) => a - b);

    for (const time of sortedTimes) {
      if (time > noteStartTime && cc64Timeline.get(time) === false) {
        return time; // Found next pedal UP
      }
    }

    return null; // No pedal UP found
  }

  /**
   * Check if MIDI note-off happens at/near exercise end (held by hand)
   * Uses 250ms threshold to account for MIDI timing imperfections
   *
   * @param midiNoteEndTime - Original MIDI note-off time (before CC64 extension)
   * @returns true if note is held until exercise end
   */
  isNoteHeldUntilExerciseEnd(midiNoteEndTime: number): boolean {
    if (this.exerciseEndTime === 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('[HELD BY HAND CHECK] Exercise end time not set, returning false');
      return false; // Exercise end time not set
    }

    const THRESHOLD_MS = 0.25; // 250 milliseconds
    const timeDifference = this.exerciseEndTime - midiNoteEndTime;
    const heldUntilEnd = timeDifference >= 0 && timeDifference <= THRESHOLD_MS;

    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `[HELD BY HAND CHECK] midiNoteEnd=${midiNoteEndTime.toFixed(3)}s, exerciseEnd=${this.exerciseEndTime.toFixed(3)}s, diff=${timeDifference.toFixed(3)}s, threshold=${THRESHOLD_MS}s, result=${heldUntilEnd}`
    );

    return heldUntilEnd;
  }

  /**
   * Check if CC64 pedal is DOWN when note starts OR goes DOWN during note's MIDI duration
   * This is critical for syncopated pedaling where pedal goes DOWN after note starts
   * Returns the time when pedal went/goes DOWN, or null if pedal stays UP
   *
   * @param noteStart - Note start time
   * @param noteEnd - Note end time (from MIDI)
   * @param timeline - CC64 timeline
   * @returns Time when pedal goes down, or null
   */
  findCC64DownDuringNote(
    noteStart: number,
    noteEnd: number,
    timeline: Map<number, boolean>
  ): number | null {
    const sortedTimes = Array.from(timeline.keys()).sort((a, b) => a - b);

    // 🚨 CRITICAL FIX: Handle complex pedaling with multiple DOWN/UP cycles
    // For overlapping chords with legato pedaling:
    // - Old chord plays with pedal DOWN
    // - Pedal goes UP briefly to separate chords
    // - New chord starts BEFORE pedal goes back DOWN
    // - Pedal goes DOWN again to sustain new chord
    //
    // Strategy: Always use the LATEST pedal DOWN that affects this note
    // This ensures we find the pedal UP that actually releases THIS chord

    let latestPedalDown: number | null = null;

    // Check if pedal is already DOWN before note starts
    const isPedalDownAtStart = this.isPedalDownAtTime(noteStart, timeline);
    if (isPedalDownAtStart) {
      latestPedalDown = noteStart; // Pedal already DOWN when note starts
    }

    // Check if pedal goes DOWN during the note's MIDI duration
    // This overrides the pedal-down-at-start if found
    for (const eventTime of sortedTimes) {
      if (eventTime > noteStart && eventTime < noteEnd) {
        if (timeline.get(eventTime) === true) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `[CC64 MID-NOTE] Pedal goes DOWN at ${eventTime.toFixed(3)}s during note playing ${noteStart.toFixed(3)}s-${noteEnd.toFixed(3)}s`
          );
          latestPedalDown = eventTime; // Use this pedal DOWN (overrides earlier one)
        }
      }
    }

    return latestPedalDown;
  }
}
