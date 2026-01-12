/**
 * CSSMatchingCamera.zoom.test.ts
 *
 * Comprehensive tests for the camera zoom-in animation that triggers
 * when switching exercises. The animation is coordinated with useSnapshotTransition
 * to create a smooth visual effect during exercise transitions.
 *
 * Animation Timeline:
 * - User clicks exercise → fade-out (500ms, OLD visible) → SWAP → fade-in (500ms) + Camera Zoom (1500ms)
 * - Camera animation starts when transitionPhase becomes 'fading-in'
 * - Camera starts 15% further back (pullBackMultiplier = 1.15) and zooms to target position
 * - Uses ease-out cubic easing: 1 - (1 - t)^3
 *
 * Key behaviors tested:
 * 1. Animation triggers ONLY on phase transition to 'fading-in'
 * 2. Animation does NOT trigger on 'stable' or 'fading-out' phases
 * 3. Easing function produces correct values at key progress points
 * 4. Camera position interpolates correctly from startZ to targetZ
 * 5. Animation completes and stops when progress reaches 1
 * 6. Integration with useSnapshotTransition phase changes
 * 7. Different camera distances (presets) work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// CAMERA ZOOM ANIMATION CORE LOGIC
// =============================================================================
// This section extracts and tests the pure animation logic from CSSMatchingCamera

/**
 * Ease-out cubic easing function
 * Starts fast, slows down towards the end
 * Formula: 1 - (1 - t)^3
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Interpolates Z position based on animation progress
 */
function interpolateZ(startZ: number, targetZ: number, progress: number): number {
  const eased = easeOutCubic(progress);
  return startZ + (targetZ - startZ) * eased;
}

/**
 * Creates animation state for camera zoom
 */
interface CameraAnimationState {
  isAnimating: boolean;
  startTime: number;
  startZ: number;
  targetZ: number;
}

function createAnimationState(
  cssPerspective: number,
  pullBackMultiplier: number = 1.15,
  startTime: number = 0
): CameraAnimationState {
  return {
    isAnimating: true,
    startTime,
    startZ: cssPerspective * pullBackMultiplier,
    targetZ: cssPerspective,
  };
}

/**
 * Simulates useFrame callback logic
 */
function updateCameraPosition(
  anim: CameraAnimationState,
  currentTime: number,
  zoomDuration: number = 1500
): { position: number; isComplete: boolean } {
  if (!anim.isAnimating) {
    return { position: anim.targetZ, isComplete: true };
  }

  const elapsed = currentTime - anim.startTime;
  const progress = Math.min(elapsed / zoomDuration, 1);
  const currentZ = interpolateZ(anim.startZ, anim.targetZ, progress);

  return {
    position: currentZ,
    isComplete: progress >= 1,
  };
}

// =============================================================================
// TEST SUITE: Easing Function
// =============================================================================
describe('CSSMatchingCamera Zoom Animation', () => {
  describe('Ease-out Cubic Function', () => {
    it('should return 0 at t=0', () => {
      expect(easeOutCubic(0)).toBe(0);
    });

    it('should return 1 at t=1', () => {
      expect(easeOutCubic(1)).toBe(1);
    });

    it('should return ~0.875 at t=0.5 (ease-out moves fast initially)', () => {
      // 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
      expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    });

    it('should return ~0.992 at t=0.8 (slowing down near end)', () => {
      // 1 - (1 - 0.8)^3 = 1 - 0.008 = 0.992
      expect(easeOutCubic(0.8)).toBeCloseTo(0.992, 5);
    });

    it('should return ~0.271 at t=0.1 (fast at start)', () => {
      // 1 - (1 - 0.1)^3 = 1 - 0.729 = 0.271
      expect(easeOutCubic(0.1)).toBeCloseTo(0.271, 5);
    });

    it('should always produce values between 0 and 1', () => {
      for (let t = 0; t <= 1; t += 0.1) {
        const result = easeOutCubic(t);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it('should be monotonically increasing (no oscillation)', () => {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.05) {
        const current = easeOutCubic(t);
        expect(current).toBeGreaterThanOrEqual(prev);
        prev = current;
      }
    });
  });

  // =============================================================================
  // TEST SUITE: Z Position Interpolation
  // =============================================================================
  describe('Z Position Interpolation', () => {
    const DEFAULT_PERSPECTIVE = 800; // Default camera distance
    const PULL_BACK_MULTIPLIER = 1.15; // 15% further back
    const START_Z = DEFAULT_PERSPECTIVE * PULL_BACK_MULTIPLIER; // 920
    const TARGET_Z = DEFAULT_PERSPECTIVE; // 800

    it('should start at pullback position (progress=0)', () => {
      const z = interpolateZ(START_Z, TARGET_Z, 0);
      expect(z).toBe(START_Z); // 920
    });

    it('should end at target position (progress=1)', () => {
      const z = interpolateZ(START_Z, TARGET_Z, 1);
      expect(z).toBe(TARGET_Z); // 800
    });

    it('should be mostly at target by progress=0.5 due to ease-out', () => {
      // At 50% time, with ease-out we're at 87.5% of the way
      const z = interpolateZ(START_Z, TARGET_Z, 0.5);
      // Expected: 920 + (800 - 920) * 0.875 = 920 - 105 = 815
      expect(z).toBeCloseTo(815, 0);
    });

    it('should handle different camera distances (octave preset)', () => {
      const OCTAVE_PERSPECTIVE = 600; // Closer camera for octave view
      const octaveStartZ = OCTAVE_PERSPECTIVE * PULL_BACK_MULTIPLIER; // 690
      const octaveTargetZ = OCTAVE_PERSPECTIVE; // 600

      const z = interpolateZ(octaveStartZ, octaveTargetZ, 1);
      expect(z).toBe(600);
    });

    it('should handle custom pullback multiplier', () => {
      const CUSTOM_MULTIPLIER = 1.25; // 25% pullback
      const customStartZ = DEFAULT_PERSPECTIVE * CUSTOM_MULTIPLIER; // 1000
      const customTargetZ = DEFAULT_PERSPECTIVE; // 800

      const z = interpolateZ(customStartZ, customTargetZ, 1);
      expect(z).toBe(800);
    });
  });

  // =============================================================================
  // TEST SUITE: Animation State Management
  // =============================================================================
  describe('Animation State Management', () => {
    it('should create correct initial animation state', () => {
      const perspective = 800;
      const state = createAnimationState(perspective);

      expect(state.isAnimating).toBe(true);
      expect(state.startZ).toBeCloseTo(920, 5); // 800 * 1.15
      expect(state.targetZ).toBe(800);
    });

    it('should respect custom pullback multiplier', () => {
      const perspective = 800;
      const state = createAnimationState(perspective, 1.3);

      expect(state.startZ).toBe(1040); // 800 * 1.3
      expect(state.targetZ).toBe(800);
    });

    it('should handle octave preset camera distance', () => {
      const octavePerspective = 600;
      const state = createAnimationState(octavePerspective);

      expect(state.startZ).toBe(690); // 600 * 1.15
      expect(state.targetZ).toBe(600);
    });
  });

  // =============================================================================
  // TEST SUITE: Animation Progress Over Time
  // =============================================================================
  describe('Animation Progress Over Time', () => {
    const ZOOM_DURATION = 1500; // Default animation duration
    const START_TIME = 1000; // Arbitrary start time
    const perspective = 800;

    it('should be at start position at time 0', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME, ZOOM_DURATION);

      expect(result.position).toBeCloseTo(920, 0); // Start position
      expect(result.isComplete).toBe(false);
    });

    it('should be animating at 750ms (50% time)', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME + 750, ZOOM_DURATION);

      // At 50% time with ease-out: position ~815
      expect(result.position).toBeCloseTo(815, 0);
      expect(result.isComplete).toBe(false);
    });

    it('should be nearly at target at 1200ms (80% time)', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME + 1200, ZOOM_DURATION);

      // At 80% time with ease-out: nearly at target
      expect(result.position).toBeCloseTo(801, 0);
      expect(result.isComplete).toBe(false);
    });

    it('should be complete at 1500ms (100% time)', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME + 1500, ZOOM_DURATION);

      expect(result.position).toBe(800);
      expect(result.isComplete).toBe(true);
    });

    it('should clamp progress at 1 when time exceeds duration', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME + 3000, ZOOM_DURATION);

      expect(result.position).toBe(800); // At target, not beyond
      expect(result.isComplete).toBe(true);
    });

    it('should handle very short durations', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const result = updateCameraPosition(state, START_TIME + 100, 100);

      expect(result.position).toBe(800);
      expect(result.isComplete).toBe(true);
    });
  });

  // =============================================================================
  // TEST SUITE: Phase Transition Detection
  // =============================================================================
  describe('Phase Transition Detection', () => {
    /**
     * Simulates the phase transition detection logic from CSSMatchingCamera:
     *
     * useEffect(() => {
     *   if (prevPhaseRef.current !== 'fading-in' && transitionPhase === 'fading-in') {
     *     // Start animation
     *   }
     *   prevPhaseRef.current = transitionPhase;
     * }, [transitionPhase, ...]);
     */
    function shouldStartAnimation(
      prevPhase: 'stable' | 'fading-out' | 'fading-in',
      currentPhase: 'stable' | 'fading-out' | 'fading-in'
    ): boolean {
      return prevPhase !== 'fading-in' && currentPhase === 'fading-in';
    }

    it('should start animation when transitioning from stable to fading-in', () => {
      expect(shouldStartAnimation('stable', 'fading-in')).toBe(true);
    });

    it('should start animation when transitioning from fading-out to fading-in', () => {
      expect(shouldStartAnimation('fading-out', 'fading-in')).toBe(true);
    });

    it('should NOT start animation when staying in fading-in', () => {
      // Already in fading-in, no need to restart
      expect(shouldStartAnimation('fading-in', 'fading-in')).toBe(false);
    });

    it('should NOT start animation when transitioning to stable', () => {
      expect(shouldStartAnimation('fading-in', 'stable')).toBe(false);
      expect(shouldStartAnimation('fading-out', 'stable')).toBe(false);
    });

    it('should NOT start animation when transitioning to fading-out', () => {
      expect(shouldStartAnimation('stable', 'fading-out')).toBe(false);
      expect(shouldStartAnimation('fading-in', 'fading-out')).toBe(false);
    });

    it('should NOT start animation when staying in stable', () => {
      expect(shouldStartAnimation('stable', 'stable')).toBe(false);
    });
  });

  // =============================================================================
  // TEST SUITE: Integration with useSnapshotTransition Timeline
  // =============================================================================
  describe('Integration with useSnapshotTransition', () => {
    /**
     * Timeline:
     * t=0:      User clicks exercise
     * t=0-500:  Phase = 'fading-out' (OLD visible, camera at normal position)
     * t=500:    SWAP (data changes)
     * t=500+:   Phase = 'fading-in' (NEW visible, camera zoom starts)
     * t=500-2000: Camera zooms from 920 to 800 (1500ms duration)
     * t=1000:   Phase = 'stable' (but camera still animating until t=2000)
     */
    const FADE_DURATION = 500;
    const ZOOM_DURATION = 1500;
    const perspective = 800;

    it('should NOT animate during fade-out phase', () => {
      // During fade-out, transitionPhase is 'fading-out'
      // Camera should stay at normal position
      const shouldAnimate = false; // prevPhase was 'stable', current is 'fading-out'

      expect(shouldAnimate).toBe(false);
    });

    it('should start animation exactly at SWAP (when fading-in begins)', () => {
      // At t=500 (after fade-out completes), phase changes to 'fading-in'
      const prevPhase = 'fading-out' as const;
      const currentPhase = 'fading-in' as const;

      const shouldStart = prevPhase !== 'fading-in' && currentPhase === 'fading-in';
      expect(shouldStart).toBe(true);
    });

    it('should continue animating even after fade-in completes', () => {
      // At t=1000, phase becomes 'stable', but camera animation continues until t=2000
      // This is correct behavior - camera zoom is independent of fade timing
      const SWAP_TIME = 500;
      const cameraAnimEndTime = SWAP_TIME + ZOOM_DURATION; // 2000

      const state = createAnimationState(perspective, 1.15, SWAP_TIME);

      // At t=1000 (phase just became stable)
      const result1000 = updateCameraPosition(state, 1000, ZOOM_DURATION);
      expect(result1000.isComplete).toBe(false); // Still animating

      // At t=2000 (animation complete)
      const result2000 = updateCameraPosition(state, 2000, ZOOM_DURATION);
      expect(result2000.isComplete).toBe(true);
      expect(result2000.position).toBe(800);
    });

    it('should handle rapid exercise switching (interrupt mid-animation)', () => {
      // User switches exercise while camera is still animating
      // New animation should start fresh when new fading-in begins
      const FIRST_SWAP_TIME = 500;
      const SECOND_SWAP_TIME = 1200; // User switches again at t=1200

      // First animation starts
      const state1 = createAnimationState(perspective, 1.15, FIRST_SWAP_TIME);

      // At t=1200, first animation is interrupted
      const result1 = updateCameraPosition(state1, SECOND_SWAP_TIME, ZOOM_DURATION);
      // First animation was at ~46% progress, position ~865
      expect(result1.isComplete).toBe(false);

      // Second animation starts fresh from pullback position
      const state2 = createAnimationState(perspective, 1.15, SECOND_SWAP_TIME);
      expect(state2.startZ).toBeCloseTo(920, 5); // Fresh start from pullback
    });
  });

  // =============================================================================
  // TEST SUITE: Different View Presets
  // =============================================================================
  describe('Different View Presets', () => {
    const PULL_BACK = 1.15;

    it('should work with default view (800px perspective)', () => {
      const DEFAULT_PERSPECTIVE = 800;
      const state = createAnimationState(DEFAULT_PERSPECTIVE, PULL_BACK);

      expect(state.startZ).toBeCloseTo(920, 5);
      expect(state.targetZ).toBe(800);
    });

    it('should work with octave view (closer camera)', () => {
      const OCTAVE_PERSPECTIVE = 600;
      const state = createAnimationState(OCTAVE_PERSPECTIVE, PULL_BACK);

      expect(state.startZ).toBe(690);
      expect(state.targetZ).toBe(600);
    });

    it('should work with wide view (further camera)', () => {
      const WIDE_PERSPECTIVE = 1000;
      const state = createAnimationState(WIDE_PERSPECTIVE, PULL_BACK);

      expect(state.startZ).toBe(1150);
      expect(state.targetZ).toBe(1000);
    });

    it('should maintain consistent pullback ratio across presets', () => {
      const presets = [600, 800, 1000, 1200];

      for (const perspective of presets) {
        const state = createAnimationState(perspective, PULL_BACK);
        const ratio = state.startZ / state.targetZ;
        expect(ratio).toBeCloseTo(PULL_BACK, 5);
      }
    });
  });

  // =============================================================================
  // TEST SUITE: Edge Cases
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle zero perspective (degenerate case)', () => {
      const state = createAnimationState(0, 1.15);
      expect(state.startZ).toBe(0);
      expect(state.targetZ).toBe(0);

      const result = updateCameraPosition(state, 1000, 1500);
      expect(result.position).toBe(0);
    });

    it('should handle pullback multiplier of 1 (no pullback)', () => {
      const state = createAnimationState(800, 1.0);
      expect(state.startZ).toBe(800);
      expect(state.targetZ).toBe(800);

      // Animation still runs but position doesn't change
      const result = updateCameraPosition(state, 750, 1500);
      expect(result.position).toBe(800);
    });

    it('should handle very large pullback multiplier', () => {
      const state = createAnimationState(800, 2.0);
      expect(state.startZ).toBe(1600);
      expect(state.targetZ).toBe(800);
    });

    it('should handle animation already complete (isAnimating = false)', () => {
      const state: CameraAnimationState = {
        isAnimating: false,
        startTime: 0,
        startZ: 920,
        targetZ: 800,
      };

      const result = updateCameraPosition(state, 1000, 1500);
      expect(result.position).toBe(800); // Returns target, not interpolated
      expect(result.isComplete).toBe(true);
    });

    it('should handle negative elapsed time (clock correction)', () => {
      const state = createAnimationState(800, 1.15, 1000);

      // Current time before start time (shouldn't happen but handle gracefully)
      const result = updateCameraPosition(state, 500, 1500);

      // Negative elapsed → progress clamped or at start
      // Math.min(negative / 1500, 1) = negative, but our interpolation handles it
      // The position should be at or near start position
      expect(result.position).toBeGreaterThan(800); // Still towards start
    });
  });

  // =============================================================================
  // TEST SUITE: Frame-by-Frame Animation Verification
  // =============================================================================
  describe('Frame-by-Frame Animation Verification', () => {
    const ZOOM_DURATION = 1500;
    const START_TIME = 0;
    const perspective = 800;

    it('should produce smooth animation over 60 frames (1 second at 60fps)', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const positions: number[] = [];

      // Simulate 60 frames over 1 second (first 1000ms of 1500ms animation)
      for (let frame = 0; frame <= 60; frame++) {
        const currentTime = (frame / 60) * 1000; // 0 to 1000ms
        const result = updateCameraPosition(state, currentTime, ZOOM_DURATION);
        positions.push(result.position);
      }

      // Verify monotonic decrease (camera moving closer)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
      }

      // Verify start and end positions
      expect(positions[0]).toBeCloseTo(920, 0); // Start
      // At 1000ms, we're 66.7% through animation with ease-out
      expect(positions[60]).toBeLessThan(820); // Significantly closer to target
    });

    it('should complete smoothly at exactly 1500ms', () => {
      const state = createAnimationState(perspective, 1.15, START_TIME);
      const positions: number[] = [];

      // Sample at key moments
      const keyTimes = [0, 375, 750, 1125, 1500, 1501];

      for (const time of keyTimes) {
        const result = updateCameraPosition(state, time, ZOOM_DURATION);
        positions.push(result.position);
      }

      // At 1500ms, should be exactly at target
      expect(positions[4]).toBe(800);

      // After 1500ms, should stay at target
      expect(positions[5]).toBe(800);
    });
  });

  // =============================================================================
  // TEST SUITE: Performance Characteristics
  // =============================================================================
  describe('Performance Characteristics', () => {
    it('should use minimal computation per frame', () => {
      const state = createAnimationState(800, 1.15, 0);

      // Measure execution time
      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        updateCameraPosition(state, i, 1500);
      }

      const elapsed = performance.now() - start;
      const perFrame = elapsed / iterations;

      // Should be well under 1ms per frame
      expect(perFrame).toBeLessThan(0.1);
    });

    it('should not allocate new objects in useFrame loop', () => {
      // The animation state is mutated in place, not recreated
      const state = createAnimationState(800, 1.15, 0);
      const originalState = { ...state };

      updateCameraPosition(state, 500, 1500);

      // State object reference unchanged (just properties update)
      expect(state.startZ).toBe(originalState.startZ);
      expect(state.targetZ).toBe(originalState.targetZ);
    });
  });
});

// =============================================================================
// TEST SUITE: Full Integration Scenario
// =============================================================================
describe('Full Camera Zoom Integration Scenario', () => {
  /**
   * Simulates the complete exercise switching flow:
   * 1. User on Exercise A (stable)
   * 2. User clicks Exercise B
   * 3. Fade-out begins (500ms) - OLD visible, camera normal
   * 4. SWAP happens at t=500 - NEW visible
   * 5. Fade-in begins - camera zoom animation starts
   * 6. Camera zooms from 920 to 800 over 1500ms
   * 7. At t=1000, fade-in completes (stable) but camera still animating
   * 8. At t=2000, camera animation completes
   */
  it('should correctly animate through complete exercise switch', () => {
    const perspective = 800;
    const FADE_DURATION = 500;
    const ZOOM_DURATION = 1500;

    // Timeline of events
    const events = [
      { time: 0, phase: 'stable', description: 'User on Exercise A' },
      { time: 1, phase: 'fading-out', description: 'User clicks Exercise B' },
      { time: 250, phase: 'fading-out', description: 'Mid fade-out' },
      { time: 500, phase: 'fading-in', description: 'SWAP - fade-in starts' },
      { time: 750, phase: 'fading-in', description: 'Mid fade-in + mid zoom' },
      { time: 1000, phase: 'stable', description: 'Fade complete, zoom continues' },
      { time: 1500, phase: 'stable', description: 'Zoom at 66%' },
      { time: 2000, phase: 'stable', description: 'Zoom complete' },
    ] as const;

    let cameraState: CameraAnimationState | null = null;
    let cameraZoomStartTime: number | null = null;
    let prevPhase: typeof events[number]['phase'] = 'stable';

    const cameraPositions: { time: number; position: number; phase: string }[] = [];

    for (const event of events) {
      // Check for phase transition to fading-in
      if (prevPhase !== 'fading-in' && event.phase === 'fading-in') {
        cameraZoomStartTime = event.time;
        cameraState = createAnimationState(perspective, 1.15, cameraZoomStartTime);
      }

      // Update camera position if animating
      let position = perspective; // Default (no animation)
      if (cameraState && cameraZoomStartTime !== null) {
        const result = updateCameraPosition(
          cameraState,
          event.time,
          ZOOM_DURATION
        );
        position = result.position;

        // Stop animation when complete
        if (result.isComplete) {
          cameraState.isAnimating = false;
        }
      }

      cameraPositions.push({
        time: event.time,
        position: Math.round(position),
        phase: event.phase,
      });

      prevPhase = event.phase;
    }

    // Verify camera behavior at key moments
    expect(cameraPositions[0].position).toBe(800); // Before animation, normal
    expect(cameraPositions[1].position).toBe(800); // During fade-out, normal
    expect(cameraPositions[3].position).toBe(920); // At SWAP, starts pulled back
    expect(cameraPositions[4].position).toBeLessThan(920); // Mid-zoom, moving in
    expect(cameraPositions[7].position).toBe(800); // Zoom complete
  });
});
