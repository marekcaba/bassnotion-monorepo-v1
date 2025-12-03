/**
 * MusicalTruthAuthority - The ONE SINGLE SOURCE OF TRUTH for all musical timing parameters
 *
 * This class owns ALL musical parameters:
 * - BPM (tempo)
 * - Time Signature (meter)
 * - Duration (in measures/bars)
 * - Countdown duration
 *
 * ALL other systems (Transport, Timeline, MusicalPositionManager, RegionProcessor, Schedulers, Widgets)
 * MUST read from this authority. NO system may store its own copy of these values.
 *
 * This ensures:
 * - IMPOSSIBLE for tempos to diverge
 * - IMPOSSIBLE for time signatures to mismatch
 * - IMPOSSIBLE for duration calculations to conflict
 * - ONE call sets everything: musicalTruth.setFromExercise(exercise)
 */

import * as Tone from 'tone';

export interface TimeSignature {
  numerator: number; // Beats per bar (e.g., 4 in 4/4)
  denominator: number; // Note value (e.g., 4 = quarter note in 4/4)
}

export interface MusicalTruth {
  bpm: number; // Tempo (e.g., 95 BPM)
  timeSignature: TimeSignature; // Meter (e.g., 4/4, 3/4, 6/8)
  durationBars: number; // Exercise duration in bars (NOT including countdown)
  countdownBars: number; // Countdown duration in bars (typically 1)
  totalBars: number; // Total duration = durationBars + countdownBars
}

export interface Exercise {
  bpm: number;
  timeSignature: TimeSignature;
  total_bars?: number;
  duration_beats?: number;
  notes?: Array<{
    position?: {
      measure?: number;
    };
  }>;
}

/**
 * Calculate actual exercise duration from note positions
 * This is the most accurate way since it reflects actual content
 */
function calculateActualBarsFromNotes(exercise: Exercise): number {
  // First try: Use notes array to find last note's measure
  if (exercise.notes && exercise.notes.length > 0) {
    const lastNote = exercise.notes[exercise.notes.length - 1];
    const lastMeasure = lastNote?.position?.measure;
    if (lastMeasure && lastMeasure > 0) {
      console.log('🎵 [MUSICAL TRUTH] Duration calculated from last note position:', lastMeasure);
      return lastMeasure;
    }
  }

  // Second try: Use explicit total_bars field
  if (exercise.total_bars && exercise.total_bars > 0) {
    console.log('🎵 [MUSICAL TRUTH] Duration from total_bars field:', exercise.total_bars);
    return exercise.total_bars;
  }

  // Third try: Calculate from duration_beats
  if (exercise.duration_beats && exercise.timeSignature?.numerator) {
    const calculatedBars = Math.ceil(exercise.duration_beats / exercise.timeSignature.numerator);
    console.log('🎵 [MUSICAL TRUTH] Duration calculated from duration_beats:', {
      duration_beats: exercise.duration_beats,
      beatsPerBar: exercise.timeSignature.numerator,
      calculatedBars,
    });
    return calculatedBars;
  }

  // Fallback: Default to 4 bars
  console.warn('🎵 [MUSICAL TRUTH] No duration information found, defaulting to 4 bars');
  return 4;
}

export class MusicalTruthAuthority {
  private truth: MusicalTruth = {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    durationBars: 4,
    countdownBars: 1,
    totalBars: 5,
  };

  private listeners = new Set<(truth: MusicalTruth) => void>();

  /**
   * THE ONE METHOD to set all musical parameters from exercise data
   * This is the ONLY way to update the musical truth
   */
  setFromExercise(exercise: Exercise): void {
    const durationBars = calculateActualBarsFromNotes(exercise);

    this.truth = {
      bpm: exercise.bpm,
      timeSignature: exercise.timeSignature,
      durationBars: durationBars,
      countdownBars: 1, // Always 1 bar of countdown
      totalBars: durationBars + 1, // Exercise + countdown
    };

    console.log('🎵 [MUSICAL TRUTH] Setting from exercise:', this.truth);

    // Synchronize Tone.Transport immediately
    // This ensures the Web Audio API timing matches our truth
    Tone.Transport.bpm.value = this.truth.bpm;
    Tone.Transport.timeSignature = this.truth.timeSignature.numerator;

    console.log('🎵 [MUSICAL TRUTH] Tone.Transport synchronized:', {
      'Tone.Transport.bpm.value': Tone.Transport.bpm.value,
      'Tone.Transport.timeSignature': Tone.Transport.timeSignature,
    });

    // Notify all listeners (systems that need to react to changes)
    this.listeners.forEach((fn) => fn(this.truth));
  }

  /**
   * Get the current BPM (tempo)
   * All timing calculations MUST use this value
   */
  getBPM(): number {
    return this.truth.bpm;
  }

  /**
   * Get the current time signature (meter)
   * All bar/beat calculations MUST use this value
   */
  getTimeSignature(): TimeSignature {
    return this.truth.timeSignature;
  }

  /**
   * Get exercise duration in bars (NOT including countdown)
   */
  getDurationBars(): number {
    return this.truth.durationBars;
  }

  /**
   * Get exercise duration in beats (NOT including countdown)
   */
  getDurationBeats(): number {
    return this.truth.durationBars * this.truth.timeSignature.numerator;
  }

  /**
   * Get countdown duration in bars (typically 1)
   */
  getCountdownBars(): number {
    return this.truth.countdownBars;
  }

  /**
   * Get countdown duration in beats
   */
  getCountdownBeats(): number {
    return this.truth.countdownBars * this.truth.timeSignature.numerator;
  }

  /**
   * Get total duration in bars (exercise + countdown)
   */
  getTotalBars(): number {
    return this.truth.totalBars;
  }

  /**
   * Get total duration in beats (exercise + countdown)
   */
  getTotalBeats(): number {
    return this.truth.totalBars * this.truth.timeSignature.numerator;
  }

  /**
   * Get the complete musical truth object (read-only)
   */
  getTruth(): Readonly<MusicalTruth> {
    return this.truth;
  }

  /**
   * Subscribe to changes in musical truth
   * Use this if your system needs to react when exercise changes
   */
  subscribe(callback: (truth: MusicalTruth) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Convert seconds to beats using the current BPM
   */
  secondsToBeats(seconds: number): number {
    const beatsPerSecond = this.truth.bpm / 60;
    return seconds * beatsPerSecond;
  }

  /**
   * Convert beats to seconds using the current BPM
   */
  beatsToSeconds(beats: number): number {
    const beatsPerSecond = this.truth.bpm / 60;
    return beats / beatsPerSecond;
  }

  /**
   * Convert bars to beats using the current time signature
   */
  barsToBeats(bars: number): number {
    return bars * this.truth.timeSignature.numerator;
  }

  /**
   * Convert beats to bars using the current time signature
   */
  beatsToBars(beats: number): number {
    return beats / this.truth.timeSignature.numerator;
  }
}

/**
 * SINGLETON INSTANCE - The ONE source of musical truth
 * Import and use this in ALL playback-related code
 */
export const musicalTruth = new MusicalTruthAuthority();
