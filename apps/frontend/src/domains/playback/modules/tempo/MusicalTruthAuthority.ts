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

// Helper to get Tone from window (returns null if not available)
// MusicalTruthAuthority can work without Tone.js - it just won't sync with Tone.Transport
function getTone(): any | null {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  return null; // Gracefully return null instead of throwing
}

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
 * Calculate actual exercise duration from exercise data
 *
 * Priority order (most reliable first):
 * 1. explicit total_bars field - authoritative, set by exercise creator
 * 2. duration_beats calculation - derived from beat count
 * 3. last note's measure position - can be off-by-one if 0-indexed
 * 4. fallback to 4 bars
 */
function calculateActualBarsFromNotes(exercise: Exercise): number {
  // PRIORITY 1: Use explicit total_bars field (most reliable)
  if (exercise.total_bars && exercise.total_bars > 0) {
    return exercise.total_bars;
  }

  // PRIORITY 2: Calculate from duration_beats
  if (exercise.duration_beats && exercise.timeSignature?.numerator) {
    return Math.ceil(
      exercise.duration_beats / exercise.timeSignature.numerator,
    );
  }

  // PRIORITY 3: Use last note's measure position (may be 0-indexed!)
  const lastNote = exercise.notes?.[exercise.notes.length - 1];
  const lastMeasure = lastNote?.position?.measure;
  if (lastMeasure && lastMeasure > 0) {
    // Add 1 because measure positions may be 0-indexed
    return lastMeasure + 1;
  }

  // Fallback: Default to 4 bars
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
   * Flag to track if user has manually modified the tempo via UI
   * Used by setFromExercise to decide whether to preserve user's tempo
   * This is the CENTRAL place for tracking user tempo modifications
   */
  private _userHasModifiedTempo = false;

  /**
   * Store the original exercise BPM to detect if user changed from it
   */
  private _originalExerciseBpm: number | null = null;

  /**
   * Check if user has manually modified the tempo
   * This is the ONE source of truth for tempo modification tracking
   */
  hasUserModifiedTempo(): boolean {
    return this._userHasModifiedTempo;
  }

  /**
   * Mark that user has modified the tempo
   * Called automatically by setBPM(), but can be set manually if needed
   */
  setUserModifiedTempo(value: boolean): void {
    this._userHasModifiedTempo = value;
    console.log(`🎵 [TEMPO] MusicalTruthAuthority._userHasModifiedTempo set to ${value}`);
  }

  /**
   * Reset the user modified tempo flag
   * Call this when loading a NEW exercise (not replaying same one)
   */
  resetUserModifiedTempo(): void {
    this._userHasModifiedTempo = false;
    this._originalExerciseBpm = null;
    console.log(`🎵 [TEMPO] MusicalTruthAuthority user tempo flag RESET`);
  }

  /**
   * Get the original exercise BPM (before user modifications)
   */
  getOriginalExerciseBpm(): number | null {
    return this._originalExerciseBpm;
  }

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

    // TEMPO FIX: Auto-detect if user has modified tempo
    // If options.preserveBPM is explicitly set, use that
    // Otherwise, use the internal _userHasModifiedTempo flag as the source of truth
    const shouldPreserveBpm = options?.preserveBPM ?? this._userHasModifiedTempo;
    const newBpm = shouldPreserveBpm ? currentBpm : exercise.bpm;

    // 🔍 TEMPO DIAGNOSTIC: Log exercise tempo loading
    console.log(`🎵 [TEMPO] MusicalTruthAuthority.setFromExercise() called`, {
      exerciseBpm: exercise.bpm,
      currentBpm,
      optionsPreserveBPM: options?.preserveBPM,
      userHasModifiedTempo: this._userHasModifiedTempo,
      shouldPreserveBpm,
      resultingBpm: newBpm,
      durationBars,
      timeSignature: `${exercise.timeSignature.numerator}/${exercise.timeSignature.denominator}`,
    });

    this.truth = {
      // TEMPO FIX: Preserve user's BPM if they manually modified it
      bpm: newBpm,
      timeSignature: exercise.timeSignature,
      durationBars: durationBars,
      countdownBars: 1, // Always 1 bar of countdown
      totalBars: durationBars + 1, // Exercise + countdown
    };

    // Store original exercise BPM for reference
    // Only update if we're NOT preserving user's tempo (i.e., loading fresh exercise)
    if (!shouldPreserveBpm) {
      this._originalExerciseBpm = exercise.bpm;
    }

    // Synchronize Tone.Transport if available
    // This ensures the Web Audio API timing matches our truth
    const Tone = getTone();
    if (Tone) {
      // Always sync Tone.Transport.bpm with our truth
      // Whether it's exercise BPM or user's preserved BPM, they should match
      Tone.Transport.bpm.value = this.truth.bpm;
      Tone.Transport.timeSignature = this.truth.timeSignature.numerator;
      console.log(`🎵 [TEMPO] Tone.Transport synced - bpm: ${Tone.Transport.bpm.value}, timeSignature: ${Tone.Transport.timeSignature}`);
    }
    // If Tone.js not loaded yet, Transport will sync when audio system initializes

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
      // 🔍 TEMPO DIAGNOSTIC: Log rejected BPM
      console.log(`🎵 [TEMPO] MusicalTruthAuthority.setBPM() REJECTED - out of range`, {
        requestedBpm: bpm,
        validRange: '20-300',
      });
      return;
    }

    const previousBpm = this.truth.bpm;
    this.truth.bpm = bpm;

    // TEMPO FIX: Automatically mark that user has modified tempo
    // This ensures setFromExercise() will preserve user's tempo on next play
    this._userHasModifiedTempo = true;

    // 🔍 TEMPO DIAGNOSTIC: Log user tempo change
    console.log(`🎵 [TEMPO] MusicalTruthAuthority.setBPM() called`, {
      previousBpm,
      newBpm: bpm,
      userHasModifiedTempo: this._userHasModifiedTempo,
      source: 'user slider or API',
    });

    // Synchronize Tone.Transport immediately if available
    const Tone = getTone();
    if (Tone) {
      Tone.Transport.bpm.value = bpm;
      // 🔍 TEMPO DIAGNOSTIC: Verify Tone.Transport sync
      console.log(`🎵 [TEMPO] Tone.Transport.bpm.value set to ${Tone.Transport.bpm.value}`);
    }
    // If Tone.js not loaded yet, Transport will sync when audio system initializes

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
    this.listeners.clear();
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
      return () => {
        /* no-op for disposed scope */
      };
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

    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch (_e) {
        // Ignore unsubscribe errors during dispose
      }
    }
    this.subscriptions = [];
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
