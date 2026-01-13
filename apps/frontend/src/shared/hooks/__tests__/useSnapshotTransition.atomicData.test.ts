/**
 * Comprehensive Tests for useSnapshotTransition with ATOMIC data objects
 *
 * These tests verify the FAANG atomic transition pattern where multiple
 * related data fields are combined into a single object to ensure they
 * swap together atomically.
 *
 * KEY INVARIANT: ALL fields in the atomic object MUST swap at the EXACT same
 * moment. There should NEVER be a state where notes are from exercise A but
 * tempo is from exercise B.
 *
 * REAL-WORLD SCENARIOS TESTED:
 * - Different tempos (60 BPM to 180 BPM)
 * - Different time signatures (4/4, 3/4, 6/8)
 * - Different exercise durations (4 bars to 32 bars)
 * - Different fretboard configurations (tilt angles, zoom levels)
 * - Different 3D overlay configs (camera positions, rotations)
 * - Widget type variations (bass, harmony, drums)
 * - Exercises with/without sustain pedal
 * - Different note densities (sparse to dense)
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSnapshotTransition } from '../useSnapshotTransition';

// Mock timers for precise control
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper to advance time and flush RAF
const advanceTimersAndRAF = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {
    vi.advanceTimersByTime(32); // ~2 frames at 60fps
  });
};

// =============================================================================
// REALISTIC EXERCISE NOTE TYPE (matching ExerciseNote from contracts)
// =============================================================================
interface ExerciseNote {
  id: string;
  pitch: number;           // MIDI pitch (0-127)
  string: number;          // Bass string (0-3 for 4-string, 0-4 for 5-string)
  fret: number;            // Fret position (0-24)
  startTime: number;       // Start time in seconds
  duration: number;        // Duration in seconds
  velocity: number;        // MIDI velocity (0-127)
  technique?: string;      // e.g., 'hammer-on', 'pull-off', 'slide', 'slap'
  fingerNumber?: number;   // Suggested fingering
}

// =============================================================================
// REALISTIC 3D OVERLAY CONFIG (matching FretboardCard's overlay3DConfig)
// =============================================================================
interface Overlay3DConfig {
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  sceneX: number;
  sceneY: number;
  sceneZ: number;
  cameraDistance: number;
  fovOffset: number;
  originX: number;
  originY: number;
  contentScale: number;
  positioningMode: 'flat' | 'tilted-plane' | 'screen-space';
  tiltAxisOffset: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
}

// =============================================================================
// COMPREHENSIVE ATOMIC EXERCISE DATA TYPE
// =============================================================================
interface ComprehensiveExerciseData {
  // Core identity
  exerciseId: string;
  exerciseName: string;
  tutorialId: string;

  // Musical timing
  tempo: number;                    // BPM
  timeSignature: { numerator: number; denominator: number };
  totalBars: number;
  totalDuration: number;            // seconds

  // Notes and patterns
  notes: ExerciseNote[];
  noteCount: number;
  hasSustainPedal: boolean;
  cc64Timeline: Array<{ time: number; value: boolean }>;

  // Fretboard configuration
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  tiltAngle: number;
  zoomLevel: number;

  // 3D overlay
  overlay3DConfig: Overlay3DConfig | null;

  // Widget metadata
  widgetType: 'bass' | 'harmony' | 'drums';
  scrollMode: 'follow' | 'locked';

  // View preset
  viewPreset: string;
}

// =============================================================================
// HELPER: Verify atomic consistency
// =============================================================================
function verifyAtomicConsistency(
  display: ComprehensiveExerciseData,
  expected: ComprehensiveExerciseData,
  context: string
): void {
  // ALL fields must be from the SAME exercise
  expect(display.exerciseId, `${context}: exerciseId mismatch`).toBe(expected.exerciseId);
  expect(display.tempo, `${context}: tempo mismatch`).toBe(expected.tempo);
  expect(display.timeSignature, `${context}: timeSignature mismatch`).toEqual(expected.timeSignature);
  expect(display.notes.length, `${context}: noteCount mismatch`).toBe(expected.notes.length);
  expect(display.stringCount, `${context}: stringCount mismatch`).toBe(expected.stringCount);
  expect(display.tiltAngle, `${context}: tiltAngle mismatch`).toBe(expected.tiltAngle);
  expect(display.widgetType, `${context}: widgetType mismatch`).toBe(expected.widgetType);

  if (expected.overlay3DConfig === null) {
    expect(display.overlay3DConfig, `${context}: overlay3D should be null`).toBeNull();
  } else {
    expect(display.overlay3DConfig?.cameraDistance, `${context}: cameraDistance mismatch`)
      .toBe(expected.overlay3DConfig.cameraDistance);
    expect(display.overlay3DConfig?.tiltAxisOffset, `${context}: tiltAxisOffset mismatch`)
      .toBe(expected.overlay3DConfig.tiltAxisOffset);
  }
}

// =============================================================================
// TEST EXERCISE LIBRARY - Realistic exercises with different characteristics
// =============================================================================

// Exercise 1: Slow ballad - 60 BPM, 4/4, sparse notes, 5-string bass, tilted view
const slowBallad: ComprehensiveExerciseData = {
  exerciseId: 'slow-ballad-001',
  exerciseName: 'Slow Ballad in E Minor',
  tutorialId: 'tutorial-ballad-basics',
  tempo: 60,
  timeSignature: { numerator: 4, denominator: 4 },
  totalBars: 8,
  totalDuration: 32, // 8 bars * 4 beats * (60/60) = 32 seconds
  notes: [
    { id: 'sb-1', pitch: 40, string: 3, fret: 0, startTime: 0, duration: 2, velocity: 80, technique: 'sustain' },
    { id: 'sb-2', pitch: 45, string: 2, fret: 0, startTime: 4, duration: 2, velocity: 75, fingerNumber: 1 },
    { id: 'sb-3', pitch: 47, string: 2, fret: 2, startTime: 8, duration: 1.5, velocity: 70 },
    { id: 'sb-4', pitch: 52, string: 1, fret: 2, startTime: 12, duration: 4, velocity: 85, technique: 'let-ring' },
  ],
  noteCount: 4,
  hasSustainPedal: true,
  cc64Timeline: [
    { time: 0, value: true },
    { time: 4, value: false },
    { time: 4.1, value: true },
    { time: 8, value: false },
  ],
  stringCount: 5,
  maxFrets: 24,
  tiltAngle: 35,
  zoomLevel: 1.0,
  overlay3DConfig: {
    rotationX: 35, rotationY: 0, rotationZ: 0,
    scaleX: 1.0, scaleY: 1.0,
    offsetX: 0, offsetY: 50,
    sceneX: 0, sceneY: 0, sceneZ: -100,
    cameraDistance: 500,
    fovOffset: 0,
    originX: 50, originY: 50,
    contentScale: 1.0,
    positioningMode: 'tilted-plane',
    tiltAxisOffset: 20,
    bloomEnabled: true,
    bloomIntensity: 0.3,
  },
  widgetType: 'bass',
  scrollMode: 'follow',
  viewPreset: 'ballad-view',
};

// Exercise 2: Fast funk - 120 BPM, 4/4, dense slap patterns, 4-string bass
const fastFunk: ComprehensiveExerciseData = {
  exerciseId: 'fast-funk-002',
  exerciseName: 'Funky Slap Groove',
  tutorialId: 'tutorial-slap-fundamentals',
  tempo: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  totalBars: 4,
  totalDuration: 8, // 4 bars * 4 beats * (60/120) = 8 seconds
  notes: [
    // Dense 16th note pattern
    { id: 'ff-1', pitch: 36, string: 3, fret: 1, startTime: 0, duration: 0.125, velocity: 110, technique: 'slap' },
    { id: 'ff-2', pitch: 36, string: 3, fret: 1, startTime: 0.25, duration: 0.125, velocity: 100, technique: 'pop' },
    { id: 'ff-3', pitch: 43, string: 2, fret: 3, startTime: 0.375, duration: 0.125, velocity: 90, technique: 'hammer-on' },
    { id: 'ff-4', pitch: 36, string: 3, fret: 1, startTime: 0.5, duration: 0.125, velocity: 115, technique: 'slap' },
    { id: 'ff-5', pitch: 48, string: 1, fret: 3, startTime: 0.625, duration: 0.125, velocity: 95, technique: 'pop' },
    { id: 'ff-6', pitch: 43, string: 2, fret: 3, startTime: 0.75, duration: 0.125, velocity: 85 },
    { id: 'ff-7', pitch: 41, string: 2, fret: 1, startTime: 0.875, duration: 0.125, velocity: 80, technique: 'pull-off' },
    { id: 'ff-8', pitch: 36, string: 3, fret: 1, startTime: 1, duration: 0.25, velocity: 120, technique: 'slap' },
    // ... more notes for realism
    { id: 'ff-9', pitch: 38, string: 3, fret: 3, startTime: 1.5, duration: 0.125, velocity: 105, technique: 'slap' },
    { id: 'ff-10', pitch: 50, string: 1, fret: 5, startTime: 1.75, duration: 0.125, velocity: 100, technique: 'pop' },
    { id: 'ff-11', pitch: 43, string: 2, fret: 3, startTime: 2, duration: 0.5, velocity: 90 },
    { id: 'ff-12', pitch: 36, string: 3, fret: 1, startTime: 3, duration: 0.125, velocity: 115, technique: 'dead-note' },
  ],
  noteCount: 12,
  hasSustainPedal: false,
  cc64Timeline: [],
  stringCount: 4,
  maxFrets: 21,
  tiltAngle: 45,
  zoomLevel: 1.25,
  overlay3DConfig: {
    rotationX: 45, rotationY: 5, rotationZ: 0,
    scaleX: 1.1, scaleY: 1.0,
    offsetX: -20, offsetY: 30,
    sceneX: 10, sceneY: -15, sceneZ: -80,
    cameraDistance: 400,
    fovOffset: 5,
    originX: 45, originY: 55,
    contentScale: 1.15,
    positioningMode: 'screen-space',
    tiltAxisOffset: 0,
    bloomEnabled: false,
    bloomIntensity: 0,
  },
  widgetType: 'bass',
  scrollMode: 'locked',
  viewPreset: 'funk-slap-view',
};

// Exercise 3: Jazz waltz - 180 BPM, 3/4, walking bass, 6-string bass
const jazzWaltz: ComprehensiveExerciseData = {
  exerciseId: 'jazz-waltz-003',
  exerciseName: 'Jazz Waltz Walking Line',
  tutorialId: 'tutorial-jazz-essentials',
  tempo: 180,
  timeSignature: { numerator: 3, denominator: 4 },
  totalBars: 16,
  totalDuration: 16, // 16 bars * 3 beats * (60/180) = 16 seconds
  notes: [
    // Walking bass pattern
    { id: 'jw-1', pitch: 36, string: 4, fret: 1, startTime: 0, duration: 0.333, velocity: 85 },
    { id: 'jw-2', pitch: 38, string: 4, fret: 3, startTime: 0.333, duration: 0.333, velocity: 80 },
    { id: 'jw-3', pitch: 40, string: 4, fret: 5, startTime: 0.666, duration: 0.333, velocity: 75 },
    { id: 'jw-4', pitch: 41, string: 3, fret: 1, startTime: 1, duration: 0.333, velocity: 90 },
    { id: 'jw-5', pitch: 43, string: 3, fret: 3, startTime: 1.333, duration: 0.333, velocity: 85, technique: 'slide' },
    { id: 'jw-6', pitch: 45, string: 3, fret: 5, startTime: 1.666, duration: 0.333, velocity: 80 },
    { id: 'jw-7', pitch: 47, string: 2, fret: 2, startTime: 2, duration: 0.5, velocity: 95 },
    { id: 'jw-8', pitch: 48, string: 2, fret: 3, startTime: 2.5, duration: 0.5, velocity: 90 },
  ],
  noteCount: 8,
  hasSustainPedal: false,
  cc64Timeline: [],
  stringCount: 6,
  maxFrets: 24,
  tiltAngle: 30,
  zoomLevel: 0.9,
  overlay3DConfig: {
    rotationX: 30, rotationY: -3, rotationZ: 2,
    scaleX: 0.95, scaleY: 0.95,
    offsetX: 10, offsetY: 60,
    sceneX: -5, sceneY: 10, sceneZ: -120,
    cameraDistance: 600,
    fovOffset: -5,
    originX: 52, originY: 48,
    contentScale: 0.9,
    positioningMode: 'flat',
    tiltAxisOffset: 35,
    bloomEnabled: true,
    bloomIntensity: 0.15,
  },
  widgetType: 'bass',
  scrollMode: 'follow',
  viewPreset: 'jazz-standard-view',
};

// Exercise 4: Harmony exercise - Piano chords, different widget type
const harmonyChords: ComprehensiveExerciseData = {
  exerciseId: 'harmony-chords-004',
  exerciseName: 'II-V-I Chord Progression',
  tutorialId: 'tutorial-harmony-basics',
  tempo: 90,
  timeSignature: { numerator: 4, denominator: 4 },
  totalBars: 4,
  totalDuration: 10.67,
  notes: [
    // Dm7 chord
    { id: 'hc-1', pitch: 62, string: 0, fret: 0, startTime: 0, duration: 2.67, velocity: 70 },
    { id: 'hc-2', pitch: 65, string: 0, fret: 0, startTime: 0, duration: 2.67, velocity: 70 },
    { id: 'hc-3', pitch: 69, string: 0, fret: 0, startTime: 0, duration: 2.67, velocity: 70 },
    { id: 'hc-4', pitch: 72, string: 0, fret: 0, startTime: 0, duration: 2.67, velocity: 70 },
    // G7 chord
    { id: 'hc-5', pitch: 67, string: 0, fret: 0, startTime: 2.67, duration: 2.67, velocity: 75 },
    { id: 'hc-6', pitch: 71, string: 0, fret: 0, startTime: 2.67, duration: 2.67, velocity: 75 },
    { id: 'hc-7', pitch: 74, string: 0, fret: 0, startTime: 2.67, duration: 2.67, velocity: 75 },
    { id: 'hc-8', pitch: 77, string: 0, fret: 0, startTime: 2.67, duration: 2.67, velocity: 75 },
    // Cmaj7 chord
    { id: 'hc-9', pitch: 60, string: 0, fret: 0, startTime: 5.33, duration: 5.33, velocity: 80 },
    { id: 'hc-10', pitch: 64, string: 0, fret: 0, startTime: 5.33, duration: 5.33, velocity: 80 },
    { id: 'hc-11', pitch: 67, string: 0, fret: 0, startTime: 5.33, duration: 5.33, velocity: 80 },
    { id: 'hc-12', pitch: 71, string: 0, fret: 0, startTime: 5.33, duration: 5.33, velocity: 80 },
  ],
  noteCount: 12,
  hasSustainPedal: true,
  cc64Timeline: [
    { time: 0, value: true },
    { time: 2.5, value: false },
    { time: 2.67, value: true },
    { time: 5.2, value: false },
    { time: 5.33, value: true },
    { time: 10.5, value: false },
  ],
  stringCount: 4, // Not applicable for harmony but required
  maxFrets: 24,
  tiltAngle: 0, // Flat view for piano
  zoomLevel: 1.0,
  overlay3DConfig: null, // No 3D overlay for harmony widget
  widgetType: 'harmony',
  scrollMode: 'locked',
  viewPreset: 'harmony-default',
};

// Exercise 5: No exercise selected state
const noExercise: ComprehensiveExerciseData = {
  exerciseId: '',
  exerciseName: '',
  tutorialId: '',
  tempo: 120, // Default
  timeSignature: { numerator: 4, denominator: 4 },
  totalBars: 0,
  totalDuration: 0,
  notes: [],
  noteCount: 0,
  hasSustainPedal: false,
  cc64Timeline: [],
  stringCount: 4,
  maxFrets: 24,
  tiltAngle: 45,
  zoomLevel: 1.15,
  overlay3DConfig: null,
  widgetType: 'bass',
  scrollMode: 'follow',
  viewPreset: 'default',
};

// Exercise 6: Extreme high tempo metal - 200 BPM, 4/4
const extremeMetal: ComprehensiveExerciseData = {
  exerciseId: 'extreme-metal-006',
  exerciseName: 'Blast Beat Bass Pattern',
  tutorialId: 'tutorial-metal-techniques',
  tempo: 200,
  timeSignature: { numerator: 4, denominator: 4 },
  totalBars: 8,
  totalDuration: 9.6, // 8 bars * 4 beats * (60/200)
  notes: Array.from({ length: 64 }, (_, i) => ({
    id: `em-${i}`,
    pitch: 28 + (i % 12), // Low B to mid range
    string: Math.floor(i / 16) % 4,
    fret: (i % 5) + 1,
    startTime: i * 0.15,
    duration: 0.1,
    velocity: 100 + (i % 27),
    technique: i % 4 === 0 ? 'pick' : undefined,
  })),
  noteCount: 64,
  hasSustainPedal: false,
  cc64Timeline: [],
  stringCount: 5,
  maxFrets: 24,
  tiltAngle: 50,
  zoomLevel: 1.5,
  overlay3DConfig: {
    rotationX: 50, rotationY: 0, rotationZ: 0,
    scaleX: 1.2, scaleY: 1.0,
    offsetX: 0, offsetY: 20,
    sceneX: 0, sceneY: -20, sceneZ: -60,
    cameraDistance: 350,
    fovOffset: 10,
    originX: 50, originY: 60,
    contentScale: 1.3,
    positioningMode: 'screen-space',
    tiltAxisOffset: -10,
    bloomEnabled: true,
    bloomIntensity: 0.5,
  },
  widgetType: 'bass',
  scrollMode: 'follow',
  viewPreset: 'metal-aggressive',
};

// Exercise 7: 6/8 compound time signature
const compoundTime: ComprehensiveExerciseData = {
  exerciseId: 'compound-time-007',
  exerciseName: 'Irish Jig Bass Line',
  tutorialId: 'tutorial-world-rhythms',
  tempo: 132,
  timeSignature: { numerator: 6, denominator: 8 },
  totalBars: 8,
  totalDuration: 14.5,
  notes: [
    { id: 'ct-1', pitch: 45, string: 2, fret: 0, startTime: 0, duration: 0.227, velocity: 90 },
    { id: 'ct-2', pitch: 45, string: 2, fret: 0, startTime: 0.227, duration: 0.227, velocity: 70 },
    { id: 'ct-3', pitch: 45, string: 2, fret: 0, startTime: 0.454, duration: 0.227, velocity: 70 },
    { id: 'ct-4', pitch: 50, string: 1, fret: 0, startTime: 0.681, duration: 0.227, velocity: 85 },
    { id: 'ct-5', pitch: 52, string: 1, fret: 2, startTime: 0.908, duration: 0.227, velocity: 75 },
    { id: 'ct-6', pitch: 50, string: 1, fret: 0, startTime: 1.135, duration: 0.227, velocity: 70 },
  ],
  noteCount: 6,
  hasSustainPedal: false,
  cc64Timeline: [],
  stringCount: 4,
  maxFrets: 21,
  tiltAngle: 40,
  zoomLevel: 1.1,
  overlay3DConfig: {
    rotationX: 40, rotationY: 2, rotationZ: 0,
    scaleX: 1.05, scaleY: 1.0,
    offsetX: 5, offsetY: 40,
    sceneX: 0, sceneY: 0, sceneZ: -90,
    cameraDistance: 450,
    fovOffset: 0,
    originX: 50, originY: 50,
    contentScale: 1.05,
    positioningMode: 'tilted-plane',
    tiltAxisOffset: 15,
    bloomEnabled: false,
    bloomIntensity: 0,
  },
  widgetType: 'bass',
  scrollMode: 'follow',
  viewPreset: 'folk-standard',
};

describe('useSnapshotTransition - Comprehensive Real-World Scenarios', () => {
  const FADE_DURATION = 500;

  describe('Tempo Variation Transitions', () => {
    it('should maintain atomicity when switching from 60 BPM to 200 BPM', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Verify initial slow exercise
      expect(result.current.displayData.tempo).toBe(60);
      expect(result.current.displayData.noteCount).toBe(4);

      // Switch to extreme metal (200 BPM, 64 notes)
      rerender({ data: extremeMetal, key: extremeMetal.exerciseId });

      // During fade-out, should still show slow ballad data
      await advanceTimersAndRAF(200);
      verifyAtomicConsistency(result.current.displayData, slowBallad, 'mid-fade-out');

      // After SWAP, should show extreme metal atomically
      await advanceTimersAndRAF(FADE_DURATION);
      verifyAtomicConsistency(result.current.displayData, extremeMetal, 'post-swap');
    });

    it('should handle rapid tempo changes: 60→120→180→90 BPM', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Rapid sequence of tempo changes
      rerender({ data: fastFunk, key: fastFunk.exerciseId }); // 120 BPM
      await advanceTimersAndRAF(50);

      rerender({ data: jazzWaltz, key: jazzWaltz.exerciseId }); // 180 BPM
      await advanceTimersAndRAF(50);

      rerender({ data: harmonyChords, key: harmonyChords.exerciseId }); // 90 BPM
      await advanceTimersAndRAF(50);

      // Should still show original (slowBallad) during transition
      expect(result.current.displayData.tempo).toBe(60);
      expect(result.current.displayData.exerciseId).toBe(slowBallad.exerciseId);

      // After transition completes, should show FINAL destination (harmonyChords)
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.tempo).toBe(90);
      expect(result.current.displayData.exerciseId).toBe(harmonyChords.exerciseId);
    });
  });

  describe('Time Signature Transitions', () => {
    it('should handle 4/4 to 3/4 transition atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: fastFunk, key: fastFunk.exerciseId } }
      );

      expect(result.current.displayData.timeSignature).toEqual({ numerator: 4, denominator: 4 });

      rerender({ data: jazzWaltz, key: jazzWaltz.exerciseId });

      // Mid-transition: still 4/4
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.timeSignature).toEqual({ numerator: 4, denominator: 4 });

      // Post-SWAP: now 3/4
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.timeSignature).toEqual({ numerator: 3, denominator: 4 });
    });

    it('should handle compound time (6/8) transitions', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: fastFunk, key: fastFunk.exerciseId } }
      );

      rerender({ data: compoundTime, key: compoundTime.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.displayData.timeSignature).toEqual({ numerator: 6, denominator: 8 });
      expect(result.current.displayData.tempo).toBe(132);
    });
  });

  describe('Widget Type Transitions', () => {
    it('should handle bass→harmony widget transition atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: fastFunk, key: fastFunk.exerciseId } }
      );

      expect(result.current.displayData.widgetType).toBe('bass');
      expect(result.current.displayData.overlay3DConfig).not.toBeNull();

      rerender({ data: harmonyChords, key: harmonyChords.exerciseId });

      // Mid-transition: still bass widget data
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.widgetType).toBe('bass');
      expect(result.current.displayData.overlay3DConfig).not.toBeNull();

      // Post-SWAP: harmony widget (no 3D overlay)
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.widgetType).toBe('harmony');
      expect(result.current.displayData.overlay3DConfig).toBeNull();
    });
  });

  describe('3D Overlay Configuration Transitions', () => {
    it('should transition camera positions atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Initial: camera at 500
      expect(result.current.displayData.overlay3DConfig?.cameraDistance).toBe(500);

      rerender({ data: extremeMetal, key: extremeMetal.exerciseId });

      // Mid-transition: still original camera
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.overlay3DConfig?.cameraDistance).toBe(500);

      // Post-SWAP: new camera position
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.overlay3DConfig?.cameraDistance).toBe(350);
    });

    it('should handle tiltAngle and zoomLevel changes atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Initial: 35° tilt, 1.0 zoom
      expect(result.current.displayData.tiltAngle).toBe(35);
      expect(result.current.displayData.zoomLevel).toBe(1.0);

      rerender({ data: extremeMetal, key: extremeMetal.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      // After: 50° tilt, 1.5 zoom
      expect(result.current.displayData.tiltAngle).toBe(50);
      expect(result.current.displayData.zoomLevel).toBe(1.5);
    });

    it('should handle positioningMode transitions', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      expect(result.current.displayData.overlay3DConfig?.positioningMode).toBe('tilted-plane');

      rerender({ data: jazzWaltz, key: jazzWaltz.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.displayData.overlay3DConfig?.positioningMode).toBe('flat');
    });
  });

  describe('String Count and Fret Range Transitions', () => {
    it('should handle 4-string to 5-string to 6-string transitions', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: fastFunk, key: fastFunk.exerciseId } }
      );

      expect(result.current.displayData.stringCount).toBe(4);

      // To 5-string - need to complete FULL transition cycle (fade-out + fade-in + stable)
      rerender({ data: slowBallad, key: slowBallad.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-out + RAF
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-in + stable
      expect(result.current.displayData.stringCount).toBe(5);

      // To 6-string
      rerender({ data: jazzWaltz, key: jazzWaltz.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-out + RAF
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-in + stable
      expect(result.current.displayData.stringCount).toBe(6);
    });
  });

  describe('Sustain Pedal Timeline Transitions', () => {
    it('should handle exercises with/without sustain pedal atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Initial: has sustain pedal
      expect(result.current.displayData.hasSustainPedal).toBe(true);
      expect(result.current.displayData.cc64Timeline.length).toBeGreaterThan(0);

      rerender({ data: fastFunk, key: fastFunk.exerciseId });

      // Mid-transition: still shows pedal data from old exercise
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.hasSustainPedal).toBe(true);

      // Post-SWAP: no pedal
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.hasSustainPedal).toBe(false);
      expect(result.current.displayData.cc64Timeline.length).toBe(0);
    });
  });

  describe('Note Density Transitions', () => {
    it('should handle sparse (4 notes) to dense (64 notes) transitions', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      expect(result.current.displayData.noteCount).toBe(4);

      rerender({ data: extremeMetal, key: extremeMetal.exerciseId });

      // Mid-transition: still sparse
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.noteCount).toBe(4);

      // Post-SWAP: dense
      await advanceTimersAndRAF(FADE_DURATION);
      expect(result.current.displayData.noteCount).toBe(64);
    });
  });

  describe('Exercise Selection/Deselection', () => {
    it('should handle deselecting exercise (going to empty state)', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: fastFunk, key: fastFunk.exerciseId } }
      );

      expect(result.current.displayData.noteCount).toBe(12);

      rerender({ data: noExercise, key: noExercise.exerciseId || undefined });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.displayData.notes.length).toBe(0);
      expect(result.current.displayData.exerciseId).toBe('');
    });

    it('should handle selecting first exercise from empty state', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: noExercise, key: noExercise.exerciseId || undefined } }
      );

      expect(result.current.displayData.notes.length).toBe(0);

      rerender({ data: fastFunk, key: fastFunk.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.displayData.noteCount).toBe(12);
      expect(result.current.displayData.tempo).toBe(120);
    });
  });

  describe('Stress Testing - Rapid Sequential Switching', () => {
    it('should handle 10 rapid switches maintaining consistency', async () => {
      const exercises = [
        slowBallad, fastFunk, jazzWaltz, harmonyChords, extremeMetal,
        compoundTime, slowBallad, fastFunk, jazzWaltz, harmonyChords,
      ];

      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exercises[0], key: exercises[0].exerciseId } }
      );

      // Rapidly switch through all exercises using minimal time advancement
      // Each advanceTimersAndRAF call adds ~32ms for RAF, so we use act directly
      // to avoid exceeding FADE_DURATION during the rapid switches
      for (let i = 1; i < exercises.length; i++) {
        rerender({ data: exercises[i], key: exercises[i].exerciseId });
        // Minimal time advance - just trigger the rerender without waiting
        await act(async () => {
          vi.advanceTimersByTime(10); // Very fast - 10ms between clicks
        });
      }

      // During all rapid switches, should still show ORIGINAL exercise
      // because we haven't exceeded FADE_DURATION total time
      verifyAtomicConsistency(result.current.displayData, exercises[0], 'during-rapid-switches');

      // After transition completes, should show LAST exercise
      // Need full transition cycle: fade-out + fade-in
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-out
      await advanceTimersAndRAF(FADE_DURATION + 50); // fade-in + stable
      verifyAtomicConsistency(result.current.displayData, exercises[exercises.length - 1], 'after-rapid-switches');
    });

    it('should handle A→B→A return pattern with different exercises', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // A→B
      rerender({ data: extremeMetal, key: extremeMetal.exerciseId });
      await advanceTimersAndRAF(100);

      // B→A (return to original)
      rerender({ data: slowBallad, key: slowBallad.exerciseId });

      // Should still show original A during entire transition
      await advanceTimersAndRAF(200);
      expect(result.current.displayData.tempo).toBe(60);
      expect(result.current.displayData.noteCount).toBe(4);

      // After SWAP, should show A (the final destination)
      await advanceTimersAndRAF(FADE_DURATION);
      verifyAtomicConsistency(result.current.displayData, slowBallad, 'return-to-A');
    });
  });

  describe('Edge Cases', () => {
    it('should handle exercises with same tempo but different everything else', async () => {
      // Create two exercises with same tempo but different data
      const exercise1: ComprehensiveExerciseData = {
        ...slowBallad,
        exerciseId: 'same-tempo-1',
        tempo: 100,
        noteCount: 10,
        stringCount: 4,
      };
      const exercise2: ComprehensiveExerciseData = {
        ...fastFunk,
        exerciseId: 'same-tempo-2',
        tempo: 100, // Same tempo!
        noteCount: 20,
        stringCount: 5,
      };

      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: exercise1, key: exercise1.exerciseId } }
      );

      rerender({ data: exercise2, key: exercise2.exerciseId });

      // Should trigger transition even though tempo is same (key changed)
      expect(result.current.phase).toBe('fading-out');

      await advanceTimersAndRAF(FADE_DURATION + 50);

      // All other fields should have changed
      expect(result.current.displayData.exerciseId).toBe('same-tempo-2');
      expect(result.current.displayData.stringCount).toBe(5);
    });

    it('should handle very short fade duration (100ms)', async () => {
      const SHORT_FADE = 100;

      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: SHORT_FADE }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      rerender({ data: fastFunk, key: fastFunk.exerciseId });

      // With short fade, should swap quickly
      await advanceTimersAndRAF(SHORT_FADE + 50);

      expect(result.current.displayData.exerciseId).toBe(fastFunk.exerciseId);
    });

    it('should handle very long fade duration (2000ms)', async () => {
      const LONG_FADE = 2000;

      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: LONG_FADE }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      rerender({ data: fastFunk, key: fastFunk.exerciseId });

      // At 1000ms (half the fade), should still show old data
      await advanceTimersAndRAF(1000);
      expect(result.current.displayData.exerciseId).toBe(slowBallad.exerciseId);

      // At 2050ms, should show new data
      await advanceTimersAndRAF(1100);
      expect(result.current.displayData.exerciseId).toBe(fastFunk.exerciseId);
    });
  });

  describe('Bloom Effect Transitions', () => {
    it('should handle bloom on/off transitions atomically', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      // Initial: bloom enabled
      expect(result.current.displayData.overlay3DConfig?.bloomEnabled).toBe(true);
      expect(result.current.displayData.overlay3DConfig?.bloomIntensity).toBe(0.3);

      rerender({ data: fastFunk, key: fastFunk.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      // After: bloom disabled
      expect(result.current.displayData.overlay3DConfig?.bloomEnabled).toBe(false);
      expect(result.current.displayData.overlay3DConfig?.bloomIntensity).toBe(0);
    });
  });

  describe('Scroll Mode Transitions', () => {
    it('should handle follow→locked scroll mode transition', async () => {
      const { result, rerender } = renderHook(
        ({ data, key }) => useSnapshotTransition(data, key, { fadeDuration: FADE_DURATION }),
        { initialProps: { data: slowBallad, key: slowBallad.exerciseId } }
      );

      expect(result.current.displayData.scrollMode).toBe('follow');

      rerender({ data: fastFunk, key: fastFunk.exerciseId });
      await advanceTimersAndRAF(FADE_DURATION + 50);

      expect(result.current.displayData.scrollMode).toBe('locked');
    });
  });
});
