/**
 * SustainPedalManager - Manages CC64 sustain pedal timeline and analysis
 *
 * Phase 2.1: Merged CC64TimelineBuilder + SustainPedalAnalyzer
 *
 * Responsibilities:
 * - Build sustain pedal timeline from MIDI CC64 events
 * - Query pedal state at specific times
 * - Find pedal events relative to note times
 * - Calculate sustain durations for harmony scheduling
 *
 * Uses sample-accurate frame rounding to ensure timeline keys
 * exactly match note scheduling times.
 */

import * as Tone from 'tone';
import type { Region } from '../types/region.types.js';

export class SustainPedalManager {
  // Timeline builder state
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 48000;
  private transportStartTime: number = 0;
  private countdownOffsetBeats: number = 0;
  private countdownEnabled: boolean = true;
  private timeConverter: any; // TimePositionConverter - will be injected

  // Analyzer state
  private exerciseEndTime: number = 0;
  private lastBeatThreshold: number = 0;

  constructor() {
    // Empty constructor
  }

  // ============================================================================
  // CONFIGURATION METHODS (from CC64TimelineBuilder)
  // ============================================================================

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set transport start time anchor
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
  }

  /**
   * Set countdown configuration
   */
  setCountdownConfig(offsetBeats: number, enabled: boolean): void {
    this.countdownOffsetBeats = offsetBeats;
    this.countdownEnabled = enabled;
  }

  /**
   * Set musical time converter (for parsePosition)
   */
  setTimeConverter(converter: any): void {
    this.timeConverter = converter;
  }

  /**
   * Set exercise timing boundaries (from SustainPedalAnalyzer)
   */
  setExerciseTiming(endTime: number, lastBeatThreshold: number): void {
    this.exerciseEndTime = endTime;
    this.lastBeatThreshold = lastBeatThreshold;
  }

  // ============================================================================
  // TIMELINE BUILDING (from CC64TimelineBuilder)
  // ============================================================================

  /**
   * Build CC64 timeline from harmony events
   * Maps audioTime → pedal down/up state
   *
   * @param events - Array of pattern events
   * @param region - Region containing the events
   * @returns Map of audioTime to pedal state (true = down, false = up)
   */
  buildTimeline(events: any[], region: Region): Map<number, boolean> {
    const cc64Timeline = new Map<number, boolean>();

    let eventIndex = 0;
    events.forEach((event) => {
      if (event.type === 'harmony-control-change' && event.data?.cc === 64) {
        // 🚨 BUG FIX: Use absolute ticks for CC64 timing (not relative position.tick)
        // CC64 events have event.data.ticks (absolute) which must be used for accurate timing

        const absoluteTicks = (event.data as any).ticks;

        // DIAGNOSTIC: Show tick calculation for first 3 events
        if (eventIndex < 3) {
          const currentBpm = Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / currentBpm;
          const ticksPerBeat = 480; // PPQ standard
          const beatsFromTicks = absoluteTicks / ticksPerBeat;
          const secondsFromTicks = beatsFromTicks * secondsPerBeat;

          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(`[CC64 TICK DIAGNOSTIC #${eventIndex}]`, {
            absoluteTicks,
            'position.tick (relative)': (event.position as any).tick,
            'position.beat': (event.position as any).beat,
            'position.measure': (event.position as any).measure,
            calculation: {
              ticksPerBeat,
              beatsFromTicks: beatsFromTicks.toFixed(4),
              currentBpm,
              secondsFromTicks: secondsFromTicks.toFixed(6),
            },
          });
        }

        // Calculate event time from ABSOLUTE ticks (not relative position)
        // 🚨 CRITICAL FIX: Use original MIDI file BPM, not current transport BPM
        const originalBpm = (event.data as any)?.originalBpm || Tone.Transport.bpm.value;
        const secondsPerBeat = 60 / originalBpm;
        const ticksPerBeat = 480; // PPQ standard
        const eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;

        // Apply countdown offset
        const offsetTime =
          this.countdownEnabled && !region.skipCountdownOffset
            ? this.timeConverter?.parsePosition(`0:${this.countdownOffsetBeats}:0`) || 0
            : 0;

        let absoluteTime = region.startTime + eventTime + offsetTime;

        // 🚨 CRITICAL FIX: Add transportStartTime to match note scheduling
        // Notes use: audioTime = transportStartTime + absoluteTime
        // CC64 timeline MUST use the same calculation for lookup to work
        const audioTime = this.transportStartTime + absoluteTime;

        // PRECISION FIX: Round to sample-accurate frames (matches note scheduling)
        // This ensures timeline keys EXACTLY match note audioTime values
        // Without this, floating-point precision differences cause lookup failures
        let timelineKey = audioTime;
        if (this.audioContext) {
          const frame = Math.round(audioTime * this.sampleRate);
          timelineKey = frame / this.sampleRate;
        }

        const pedalDown = event.data.value >= 64;
        cc64Timeline.set(timelineKey, pedalDown);

        // Enhanced diagnostic: show position data for first 5 CC64 events
        if (eventIndex < 5) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `[CC64 TIMELINE #${eventIndex}] timelineKey=${timelineKey.toFixed(6)}s (with transportStartTime + sample precision), pedal=${pedalDown ? 'DOWN' : 'UP'}, value=${event.data.value}, absoluteTime=${absoluteTime.toFixed(6)}s, audioTime=${audioTime.toFixed(6)}s`
          );
        }
        eventIndex++;
      }
    });

    return cc64Timeline;
  }

  // ============================================================================
  // PEDAL STATE ANALYSIS (from SustainPedalAnalyzer)
  // ============================================================================

  /**
   * Check if sustain pedal is down at a specific time
   * Returns the most recent pedal state before or at the given time
   *
   * @param time - Audio time to check
   * @param cc64Timeline - Timeline map from buildTimeline()
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
