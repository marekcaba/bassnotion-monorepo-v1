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
 * Options for setFromExercise method
 */
export interface SetFromExerciseOptions {
  /**
   * If true, preserves the current user-set BPM instead of using exercise.bpm
   * Use this when user has manually modified tempo and clicks Play again
   */
  preserveBPM?: boolean;
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
   *
   * @param exercise - The exercise to load
   * @param options - Optional settings
   * @param options.preserveBPM - If true, keeps current BPM (for user tempo preference)
   */
  setFromExercise(exercise: Exercise, options?: SetFromExerciseOptions): void {
    const durationBars = calculateActualBarsFromNotes(exercise);
    const currentBpm = this.truth.bpm;
    const shouldPreserveBpm = options?.preserveBPM === true;

    this.truth = {
      // TEMPO FIX: Preserve user's BPM if they manually modified it
      bpm: shouldPreserveBpm ? currentBpm : exercise.bpm,
      timeSignature: exercise.timeSignature,
      durationBars: durationBars,
      countdownBars: 1, // Always 1 bar of countdown
      totalBars: durationBars + 1, // Exercise + countdown
    };

    // [TEMPO-FIX] Debug logs commented out after fix verification
    // console.log('🎯 [TEMPO-FIX] MusicalTruthAuthority.setFromExercise()', {...});

    // Synchronize Tone.Transport immediately
    // This ensures the Web Audio API timing matches our truth
    // Only update BPM if we're not preserving user's tempo
    if (!shouldPreserveBpm) {
      Tone.Transport.bpm.value = this.truth.bpm;
    }
    // Note: When preserveBPM=true, we skip Tone.Transport.bpm update to preserve user's tempo
    Tone.Transport.timeSignature = this.truth.timeSignature.numerator;

    console.log('🎵 [MUSICAL TRUTH] Tone.Transport synchronized:', {
      'Tone.Transport.bpm.value': Tone.Transport.bpm.value,
      'Tone.Transport.timeSignature': Tone.Transport.timeSignature,
      'preservedUserBpm': shouldPreserveBpm,
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
   * Set BPM (tempo) without changing other values
   * Use this for user tempo changes via slider during playback.
   * For exercise selection, use setFromExercise() instead.
   *
   * This updates:
   * - Internal truth.bpm
   * - Tone.Transport.bpm.value
   * - Notifies all listeners
   */
  setBPM(bpm: number): void {
    if (bpm < 20 || bpm > 300) {
      console.warn('🎵 [MUSICAL TRUTH] Invalid BPM ignored:', bpm);
      return;
    }

    const previousBpm = this.truth.bpm;
    this.truth.bpm = bpm;

    // Synchronize Tone.Transport immediately
    Tone.Transport.bpm.value = bpm;

    console.log('🎵 [MUSICAL TRUTH] BPM updated via setBPM():', {
      previousBpm,
      newBpm: bpm,
      'Tone.Transport.bpm.value': Tone.Transport.bpm.value,
    });

    // Notify all listeners (systems that need to react to tempo changes)
    this.listeners.forEach((fn) => fn(this.truth));
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

  /**
   * Create a scoped subscription manager.
   * All subscriptions made through the scope will be automatically
   * unsubscribed when the scope is disposed.
   */
  createScope(name?: string): MusicalTruthScope {
    return new MusicalTruthScope(this, name);
  }

  /**
   * Clear all listeners (use with caution - mainly for testing)
   */
  clearListeners(): void {
    const count = this.listeners.size;
    this.listeners.clear();
    console.log(`[MusicalTruthAuthority] Cleared ${count} listeners`);
  }

  /**
   * Get listener count (for debugging)
   */
  getListenerCount(): number {
    return this.listeners.size;
  }
}

/**
 * MusicalTruthScope - Scoped subscriptions with automatic cleanup
 *
 * Similar to EventScope, this prevents listener accumulation by
 * tracking all subscriptions made through this scope and automatically
 * unsubscribing them when the scope is disposed.
 */
export class MusicalTruthScope {
  private authority: MusicalTruthAuthority;
  private subscriptions: Array<() => void> = [];
  private isDisposed = false;
  private scopeId: string;

  constructor(authority: MusicalTruthAuthority, name?: string) {
    this.authority = authority;
    this.scopeId = name || `truth-scope-${Date.now()}`;
  }

  /**
   * Subscribe to musical truth changes through this scope.
   * Will be automatically unsubscribed when scope is disposed.
   */
  subscribe(callback: (truth: MusicalTruth) => void): () => void {
    if (this.isDisposed) {
      console.warn(`[MusicalTruthScope] ${this.scopeId} already disposed`);
      return () => {};
    }

    const unsubscribe = this.authority.subscribe(callback);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Dispose this scope, removing ALL subscriptions made through it.
   */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    const count = this.subscriptions.length;
    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch (e) {
        console.error(`[MusicalTruthScope] Error unsubscribing:`, e);
      }
    }
    this.subscriptions = [];

    console.log(`[MusicalTruthScope] ${this.scopeId} disposed, removed ${count} subscriptions`);
  }

  /**
   * Get current BPM (delegated to authority)
   */
  getBPM(): number {
    return this.authority.getBPM();
  }

  /**
   * Get time signature (delegated to authority)
   */
  getTimeSignature(): TimeSignature {
    return this.authority.getTimeSignature();
  }

  /**
   * Get the complete truth (delegated to authority)
   */
  getTruth(): Readonly<MusicalTruth> {
    return this.authority.getTruth();
  }

  /**
   * Convert seconds to beats (delegated to authority)
   */
  secondsToBeats(seconds: number): number {
    return this.authority.secondsToBeats(seconds);
  }

  /**
   * Convert beats to seconds (delegated to authority)
   */
  beatsToSeconds(beats: number): number {
    return this.authority.beatsToSeconds(beats);
  }
}

/**
 * SINGLETON INSTANCE - The ONE source of musical truth
 * Import and use this in ALL playback-related code
 */
export const musicalTruth = new MusicalTruthAuthority();
