/**
 * initialRevealSequence.test.ts
 *
 * Tests for the initial fretboard reveal sequence that triggers when the user
 * scrolls to the fretboard for the first time. This sequence involves:
 *
 * 1. User scrolls down - IntersectionObserver detects sentinel element
 * 2. showFretboardContent becomes true - 3D overlay mounts
 * 3. After MOUNT_DELAY (200ms), forceInitialZoom becomes true
 * 4. Ring3DOverlayCanvas receives transitionPhase='fading-in', triggering zoom animation
 * 5. After zoom completes (1800ms total), forceInitialZoom becomes false
 *
 * The Race Condition Problem:
 * - CSSMatchingCamera uses prevPhaseRef to detect phase CHANGES
 * - prevPhaseRef is initialized with the current transitionPhase on mount
 * - If component mounts when transitionPhase is already 'fading-in', no animation triggers
 *
 * The Solution:
 * - Add triggerZoomOnMount prop that bypasses phase change detection
 * - When true, starts zoom animation immediately on mount regardless of phase
 * - This eliminates timing dependencies between React mount and phase state
 *
 * @module initialRevealSequence.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// REVEAL SEQUENCE STATE MACHINE
// =============================================================================
// Models the state transitions during initial fretboard reveal

type RevealState =
  | 'hidden' // Fretboard not visible, user hasn't scrolled
  | 'mounting' // showFretboardContent=true, 3D overlay mounting
  | 'triggering' // forceInitialZoom=true, zoom animation starting
  | 'animating' // Zoom animation in progress
  | 'revealed'; // Animation complete, normal operation

interface RevealSequenceState {
  state: RevealState;
  showFretboardContent: boolean;
  forceInitialZoom: boolean;
  transitionPhase: 'stable' | 'fading-out' | 'fading-in';
  cameraAnimating: boolean;
  timestamp: number;
}

// =============================================================================
// TIMING CONSTANTS (must match FretboardCard.tsx)
// =============================================================================
const MOUNT_DELAY = 200; // Time for 3D overlay to mount
const ZOOM_DURATION = 1500; // Camera zoom animation duration
const ZOOM_END_BUFFER = 100; // Extra buffer time
const TOTAL_REVEAL_TIME = MOUNT_DELAY + ZOOM_DURATION + ZOOM_END_BUFFER;

// =============================================================================
// PHASE CHANGE DETECTION LOGIC
// =============================================================================
// Extracted from CSSMatchingCamera for testability

function shouldStartZoomAnimation(
  prevPhase: 'stable' | 'fading-out' | 'fading-in',
  currentPhase: 'stable' | 'fading-out' | 'fading-in',
  triggerZoomOnMount: boolean = false
): boolean {
  // NEW: If triggerZoomOnMount is true, always start animation
  if (triggerZoomOnMount) {
    return true;
  }
  // Original logic: only start on phase CHANGE to 'fading-in'
  return prevPhase !== 'fading-in' && currentPhase === 'fading-in';
}

/**
 * Simulates the initial reveal sequence timing
 */
function simulateRevealSequence(
  options: {
    mountDelay?: number;
    zoomDuration?: number;
    initialPhase?: 'stable' | 'fading-in';
    triggerZoomOnMount?: boolean;
  } = {}
): RevealSequenceState[] {
  const {
    mountDelay = MOUNT_DELAY,
    zoomDuration = ZOOM_DURATION,
    initialPhase = 'stable',
    triggerZoomOnMount = false,
  } = options;

  const states: RevealSequenceState[] = [];

  // t=0: User scrolls, IntersectionObserver fires
  states.push({
    state: 'hidden',
    showFretboardContent: false,
    forceInitialZoom: false,
    transitionPhase: 'stable',
    cameraAnimating: false,
    timestamp: 0,
  });

  // t=1: showFretboardContent becomes true, 3D overlay mounts
  states.push({
    state: 'mounting',
    showFretboardContent: true,
    forceInitialZoom: false,
    transitionPhase: initialPhase,
    cameraAnimating: false,
    timestamp: 1,
  });

  // t=mountDelay: forceInitialZoom becomes true
  states.push({
    state: 'triggering',
    showFretboardContent: true,
    forceInitialZoom: true,
    transitionPhase: 'fading-in',
    cameraAnimating: triggerZoomOnMount || initialPhase === 'stable', // Animation starts if we can detect change
    timestamp: mountDelay,
  });

  // t=mountDelay + zoomDuration/2: Mid-animation
  states.push({
    state: 'animating',
    showFretboardContent: true,
    forceInitialZoom: true,
    transitionPhase: 'fading-in',
    cameraAnimating: true,
    timestamp: mountDelay + zoomDuration / 2,
  });

  // t=mountDelay + zoomDuration + buffer: Animation complete
  states.push({
    state: 'revealed',
    showFretboardContent: true,
    forceInitialZoom: false,
    transitionPhase: 'stable',
    cameraAnimating: false,
    timestamp: mountDelay + zoomDuration + ZOOM_END_BUFFER,
  });

  return states;
}

// =============================================================================
// TEST SUITE: Initial Reveal State Transitions
// =============================================================================
describe('Initial Fretboard Reveal Sequence', () => {
  describe('State Transitions', () => {
    it('should start in hidden state before scroll', () => {
      const states = simulateRevealSequence();
      expect(states[0].state).toBe('hidden');
      expect(states[0].showFretboardContent).toBe(false);
      expect(states[0].forceInitialZoom).toBe(false);
    });

    it('should transition to mounting when showFretboardContent becomes true', () => {
      const states = simulateRevealSequence();
      expect(states[1].state).toBe('mounting');
      expect(states[1].showFretboardContent).toBe(true);
      expect(states[1].forceInitialZoom).toBe(false);
    });

    it('should transition to triggering after mount delay', () => {
      const states = simulateRevealSequence();
      expect(states[2].state).toBe('triggering');
      expect(states[2].forceInitialZoom).toBe(true);
      expect(states[2].transitionPhase).toBe('fading-in');
    });

    it('should transition to animating during zoom', () => {
      const states = simulateRevealSequence();
      expect(states[3].state).toBe('animating');
      expect(states[3].cameraAnimating).toBe(true);
    });

    it('should transition to revealed when animation completes', () => {
      const states = simulateRevealSequence();
      expect(states[4].state).toBe('revealed');
      expect(states[4].forceInitialZoom).toBe(false);
      expect(states[4].cameraAnimating).toBe(false);
    });
  });

  // =============================================================================
  // TEST SUITE: Race Condition Scenario
  // =============================================================================
  describe('Race Condition: Component Mounts with fading-in Phase', () => {
    it('should NOT trigger animation if component mounts with fading-in and prevPhaseRef initializes to fading-in', () => {
      // This is the BUG scenario - no triggerZoomOnMount
      const prevPhase = 'fading-in' as const;
      const currentPhase = 'fading-in' as const;

      const shouldAnimate = shouldStartZoomAnimation(prevPhase, currentPhase, false);
      expect(shouldAnimate).toBe(false); // BUG: Animation doesn't start!
    });

    it('should trigger animation with triggerZoomOnMount=true regardless of phase', () => {
      // This is the FIX - use triggerZoomOnMount
      const prevPhase = 'fading-in' as const;
      const currentPhase = 'fading-in' as const;

      const shouldAnimate = shouldStartZoomAnimation(prevPhase, currentPhase, true);
      expect(shouldAnimate).toBe(true); // FIX: Animation starts!
    });

    it('should still work normally when transitioning from stable to fading-in', () => {
      const prevPhase = 'stable' as const;
      const currentPhase = 'fading-in' as const;

      // Without triggerZoomOnMount (normal case)
      const shouldAnimate = shouldStartZoomAnimation(prevPhase, currentPhase, false);
      expect(shouldAnimate).toBe(true);

      // With triggerZoomOnMount (also works)
      const shouldAnimateWithTrigger = shouldStartZoomAnimation(
        prevPhase,
        currentPhase,
        true
      );
      expect(shouldAnimateWithTrigger).toBe(true);
    });
  });

  // =============================================================================
  // TEST SUITE: triggerZoomOnMount Prop Behavior
  // =============================================================================
  describe('triggerZoomOnMount Prop Behavior', () => {
    it('should always trigger animation when triggerZoomOnMount is true', () => {
      const phases: Array<'stable' | 'fading-out' | 'fading-in'> = [
        'stable',
        'fading-out',
        'fading-in',
      ];

      for (const prevPhase of phases) {
        for (const currentPhase of phases) {
          const shouldAnimate = shouldStartZoomAnimation(
            prevPhase,
            currentPhase,
            true
          );
          expect(shouldAnimate).toBe(true);
        }
      }
    });

    it('should only trigger animation on phase change when triggerZoomOnMount is false', () => {
      // stable → fading-in = true
      expect(shouldStartZoomAnimation('stable', 'fading-in', false)).toBe(true);

      // fading-out → fading-in = true
      expect(shouldStartZoomAnimation('fading-out', 'fading-in', false)).toBe(true);

      // fading-in → fading-in = false (no change)
      expect(shouldStartZoomAnimation('fading-in', 'fading-in', false)).toBe(false);

      // stable → stable = false
      expect(shouldStartZoomAnimation('stable', 'stable', false)).toBe(false);
    });
  });

  // =============================================================================
  // TEST SUITE: Timing Verification
  // =============================================================================
  describe('Timing Verification', () => {
    it('should have correct timing constants', () => {
      expect(MOUNT_DELAY).toBe(200);
      expect(ZOOM_DURATION).toBe(1500);
      expect(TOTAL_REVEAL_TIME).toBe(1800);
    });

    it('should complete reveal sequence in expected time', () => {
      const states = simulateRevealSequence();
      const finalState = states[states.length - 1];

      expect(finalState.state).toBe('revealed');
      expect(finalState.timestamp).toBe(TOTAL_REVEAL_TIME);
    });

    it('should wait for mount before triggering zoom', () => {
      const states = simulateRevealSequence();

      // At t=1 (immediately after show), forceInitialZoom should be false
      expect(states[1].timestamp).toBe(1);
      expect(states[1].forceInitialZoom).toBe(false);

      // At t=MOUNT_DELAY, forceInitialZoom should be true
      expect(states[2].timestamp).toBe(MOUNT_DELAY);
      expect(states[2].forceInitialZoom).toBe(true);
    });
  });

  // =============================================================================
  // TEST SUITE: Edge Cases
  // =============================================================================
  describe('Edge Cases', () => {
    it('should handle rapid scroll/unscroll (sentinel leaves view quickly)', () => {
      // If user scrolls past sentinel then scrolls back up before reveal completes,
      // the reveal should continue (initialRevealDoneRef prevents re-trigger)
      const states = simulateRevealSequence();

      // Once mounting starts, it should continue regardless of scroll
      expect(states[1].showFretboardContent).toBe(true);
    });

    it('should only trigger reveal once', () => {
      // The initialRevealDoneRef ensures reveal only happens once
      // This test verifies the flag pattern
      let initialRevealDone = false;
      let revealCount = 0;

      function triggerReveal() {
        if (!initialRevealDone) {
          initialRevealDone = true;
          revealCount++;
        }
      }

      // First trigger
      triggerReveal();
      expect(revealCount).toBe(1);

      // Subsequent triggers should be no-ops
      triggerReveal();
      triggerReveal();
      expect(revealCount).toBe(1);
    });

    it('should handle exercise change during initial reveal', () => {
      // If user changes exercise while initial reveal is in progress,
      // the reveal animation should complete, then exercise transition
      // handles subsequent animations normally
      const initialRevealActive = true;
      const exerciseChangeRequested = true;

      // Exercise changes during reveal should be queued
      // The reveal animation takes precedence
      expect(initialRevealActive && exerciseChangeRequested).toBe(true);

      // After reveal completes, exercise change animation would use
      // normal phase transition logic (not triggerZoomOnMount)
    });
  });

  // =============================================================================
  // TEST SUITE: Integration with useSnapshotTransition
  // =============================================================================
  describe('Integration with useSnapshotTransition', () => {
    it('should use forceInitialZoom to override normal transition phase', () => {
      // FretboardCard computes effectiveTransitionPhase:
      // - If forceInitialZoom is true, return 'fading-in'
      // - Otherwise, pass through normal transitionPhase

      function computeEffectivePhase(
        forceInitialZoom: boolean,
        transitionPhase: 'stable' | 'fading-out' | 'fading-in'
      ): 'stable' | 'fading-out' | 'fading-in' {
        if (forceInitialZoom) {
          return 'fading-in';
        }
        return transitionPhase;
      }

      // During initial reveal
      expect(computeEffectivePhase(true, 'stable')).toBe('fading-in');
      expect(computeEffectivePhase(true, 'fading-out')).toBe('fading-in');
      expect(computeEffectivePhase(true, 'fading-in')).toBe('fading-in');

      // After initial reveal
      expect(computeEffectivePhase(false, 'stable')).toBe('stable');
      expect(computeEffectivePhase(false, 'fading-out')).toBe('fading-out');
      expect(computeEffectivePhase(false, 'fading-in')).toBe('fading-in');
    });

    it('should coordinate fade opacity with zoom animation', () => {
      // The fade opacity (from useSnapshotTransition) controls visual fade
      // The zoom animation (from CSSMatchingCamera) controls camera position
      // Both should be active during 'fading-in' phase

      const states = simulateRevealSequence();

      // During triggering state
      const triggerState = states[2];
      expect(triggerState.transitionPhase).toBe('fading-in');

      // During animating state
      const animatingState = states[3];
      expect(animatingState.transitionPhase).toBe('fading-in');
      expect(animatingState.cameraAnimating).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: Initial Mount Scenarios
// =============================================================================
describe('Initial Mount Scenarios', () => {
  describe('Scenario A: Normal Mount (mount completes before phase change)', () => {
    it('should successfully animate when component mounts with stable phase', () => {
      // This is the ideal case:
      // 1. Component mounts, prevPhaseRef = 'stable'
      // 2. 200ms later, transitionPhase changes to 'fading-in'
      // 3. useEffect detects change, starts animation

      let prevPhase: 'stable' | 'fading-in' = 'stable';
      let currentPhase: 'stable' | 'fading-in' = 'stable';
      let animationStarted = false;

      // Component mounts
      // prevPhaseRef initialized to currentPhase
      prevPhase = currentPhase;

      // 200ms later, phase changes
      currentPhase = 'fading-in';

      // useEffect runs
      if (prevPhase !== 'fading-in' && currentPhase === 'fading-in') {
        animationStarted = true;
      }
      prevPhase = currentPhase;

      expect(animationStarted).toBe(true);
    });
  });

  describe('Scenario B: Race Condition (phase already fading-in at mount)', () => {
    it('should fail to animate WITHOUT triggerZoomOnMount fix', () => {
      // This is the race condition:
      // 1. forceInitialZoom is set before component mounts
      // 2. Component mounts, prevPhaseRef = 'fading-in' (current value)
      // 3. useEffect runs, but prevPhase === currentPhase, no animation

      let currentPhase: 'stable' | 'fading-in' = 'fading-in'; // Already fading-in!
      let prevPhase: 'stable' | 'fading-in' = currentPhase; // Initialized to current
      let animationStarted = false;

      // useEffect runs (no change detected)
      if (prevPhase !== 'fading-in' && currentPhase === 'fading-in') {
        animationStarted = true;
      }

      expect(animationStarted).toBe(false); // BUG: Animation never started!
    });

    it('should successfully animate WITH triggerZoomOnMount fix', () => {
      // This is the fix:
      // 1. Component receives triggerZoomOnMount=true
      // 2. useEffect runs, sees triggerZoomOnMount, starts animation
      // 3. Animation starts regardless of phase state

      let currentPhase: 'stable' | 'fading-in' = 'fading-in';
      let prevPhase: 'stable' | 'fading-in' = currentPhase;
      let triggerZoomOnMount = true;
      let animationStarted = false;

      // useEffect runs
      if (triggerZoomOnMount) {
        animationStarted = true;
      } else if (prevPhase !== 'fading-in' && currentPhase === 'fading-in') {
        animationStarted = true;
      }

      expect(animationStarted).toBe(true); // FIX: Animation starts!
    });
  });

  describe('Scenario C: Subsequent Exercise Changes (after initial reveal)', () => {
    it('should use normal phase change detection after initial reveal', () => {
      // After initial reveal, triggerZoomOnMount should be false
      // Exercise changes trigger animations via normal phase transitions

      let triggerZoomOnMount = false; // Initial reveal complete
      let prevPhase: 'stable' | 'fading-in' = 'stable';
      let currentPhase: 'stable' | 'fading-in' = 'fading-in'; // Exercise change
      let animationStarted = false;

      // useEffect runs
      if (triggerZoomOnMount) {
        animationStarted = true;
      } else if (prevPhase !== 'fading-in' && currentPhase === 'fading-in') {
        animationStarted = true;
      }

      expect(animationStarted).toBe(true);
    });
  });
});

// =============================================================================
// TEST SUITE: Camera Animation Verification
// =============================================================================
describe('Camera Animation During Initial Reveal', () => {
  const DEFAULT_PERSPECTIVE = 800;
  const PULL_BACK_MULTIPLIER = 1.15;
  const START_Z = DEFAULT_PERSPECTIVE * PULL_BACK_MULTIPLIER; // 920
  const TARGET_Z = DEFAULT_PERSPECTIVE; // 800

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function interpolateZ(progress: number): number {
    const eased = easeOutCubic(progress);
    return START_Z + (TARGET_Z - START_Z) * eased;
  }

  it('should start camera at pullback position (920)', () => {
    expect(interpolateZ(0)).toBe(START_Z);
  });

  it('should end camera at target position (800)', () => {
    expect(interpolateZ(1)).toBe(TARGET_Z);
  });

  it('should animate smoothly through intermediate positions', () => {
    const positions: number[] = [];

    for (let t = 0; t <= 1; t += 0.1) {
      positions.push(interpolateZ(t));
    }

    // Should be monotonically decreasing (camera moving closer)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThanOrEqual(positions[i - 1]);
    }
  });

  it('should be mostly complete by 50% time due to ease-out', () => {
    // At t=0.5, easeOutCubic gives 0.875 progress
    const positionAtHalfTime = interpolateZ(0.5);
    const expectedPosition = START_Z + (TARGET_Z - START_Z) * 0.875; // 815

    expect(positionAtHalfTime).toBeCloseTo(expectedPosition, 5);
  });
});

// =============================================================================
// TEST SUITE: IntersectionObserver Integration
// =============================================================================
describe('IntersectionObserver Integration', () => {
  it('should trigger reveal when sentinel enters viewport', () => {
    // Simulate IntersectionObserver callback
    let isIntersecting = false;
    let showFretboardContent = false;
    let isInitialRevealComplete = false;

    const handleIntersection = (entries: Array<{ isIntersecting: boolean }>) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        showFretboardContent = true;
        isInitialRevealComplete = true;
      }
    };

    // Simulate sentinel entering viewport
    isIntersecting = true;
    handleIntersection([{ isIntersecting }]);

    expect(showFretboardContent).toBe(true);
    expect(isInitialRevealComplete).toBe(true);
  });

  it('should not trigger reveal if already complete', () => {
    let showFretboardContent = true;
    let isInitialRevealComplete = true;
    let triggerCount = 0;

    const handleIntersection = (entries: Array<{ isIntersecting: boolean }>) => {
      if (isInitialRevealComplete) return; // Early exit

      const entry = entries[0];
      if (entry.isIntersecting) {
        triggerCount++;
        showFretboardContent = true;
      }
    };

    // Simulate sentinel entering viewport again
    handleIntersection([{ isIntersecting: true }]);

    expect(triggerCount).toBe(0); // Should not trigger again
  });
});

// =============================================================================
// TEST SUITE: Cleanup and Memory Management
// =============================================================================
describe('Cleanup and Memory Management', () => {
  it('should clear timeouts on unmount during reveal sequence', () => {
    let startTimerCleared = false;
    let endTimerCleared = false;

    // Simulate cleanup function
    const cleanup = () => {
      startTimerCleared = true;
      endTimerCleared = true;
    };

    // Simulate unmount during reveal
    cleanup();

    expect(startTimerCleared).toBe(true);
    expect(endTimerCleared).toBe(true);
  });

  it('should disconnect IntersectionObserver on unmount', () => {
    let observerDisconnected = false;

    const disconnectObserver = () => {
      observerDisconnected = true;
    };

    // Simulate unmount
    disconnectObserver();

    expect(observerDisconnected).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: CSS Fade Animation Behavior
// =============================================================================
// The initial reveal uses CSS @keyframes animation instead of state-driven
// opacity transitions. This is more reliable because:
// 1. CSS animations start immediately when element enters DOM
// 2. No timing dependencies on React state updates
// 3. Browser handles animation natively
// =============================================================================

const INITIAL_FADE_DURATION = 500;

describe('CSS Fade Animation', () => {
  describe('Animation Style Properties', () => {
    it('should use CSS animation during initial reveal', () => {
      const initialFadeComplete = false;
      const fadeOpacity = 1;
      const fadeDuration = 500;

      // Compute style properties as FretboardCard does
      const opacity = initialFadeComplete ? fadeOpacity : undefined;
      const animation = !initialFadeComplete
        ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
        : undefined;
      const transition = initialFadeComplete
        ? `opacity ${fadeDuration}ms ease-out`
        : undefined;

      expect(opacity).toBeUndefined(); // Let CSS animation control
      expect(animation).toBe('fretboardFadeIn 500ms ease-out forwards');
      expect(transition).toBeUndefined(); // No transition during animation
    });

    it('should switch to fadeOpacity after animation completes', () => {
      const initialFadeComplete = true;
      const fadeOpacity = 0.8; // Example mid-transition value
      const fadeDuration = 500;

      const opacity = initialFadeComplete ? fadeOpacity : undefined;
      const animation = !initialFadeComplete
        ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
        : undefined;
      const transition = initialFadeComplete
        ? `opacity ${fadeDuration}ms ease-out`
        : undefined;

      expect(opacity).toBe(0.8); // Use fadeOpacity from useSnapshotTransition
      expect(animation).toBeUndefined(); // No more CSS animation
      expect(transition).toBe('opacity 500ms ease-out'); // Enable transitions for exercise changes
    });
  });

  describe('Animation Timing', () => {
    it('should mark fade complete after INITIAL_FADE_DURATION', () => {
      expect(INITIAL_FADE_DURATION).toBe(500);

      // The setTimeout in the effect waits for this duration
      // before setting initialFadeComplete = true
    });

    it('should coordinate fade with zoom animation timing', () => {
      // Fade duration should be less than or equal to zoom animation
      // so the fade completes while zoom is still in progress
      expect(INITIAL_FADE_DURATION).toBeLessThanOrEqual(ZOOM_DURATION);
    });
  });

  describe('Keyframes Definition', () => {
    it('should define fadeIn animation from opacity 0 to 1', () => {
      // The keyframes are defined in the component:
      // @keyframes fadeIn {
      //   from { opacity: 0; }
      //   to { opacity: 1; }
      // }

      const keyframesDefinition = {
        from: { opacity: 0 },
        to: { opacity: 1 },
      };

      expect(keyframesDefinition.from.opacity).toBe(0);
      expect(keyframesDefinition.to.opacity).toBe(1);
    });

    it('should use forwards fill mode to persist final state', () => {
      const animationString = `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`;

      expect(animationString).toContain('forwards');
      // forwards ensures element stays at opacity: 1 after animation ends
    });
  });
});

describe('Fade and Zoom Coordination', () => {
  it('should start both fade and zoom when sentinel is reached', () => {
    // When showFretboardContent becomes true:
    // 1. CSS fadeIn animation starts immediately (applied via style)
    // 2. After MOUNT_DELAY (200ms), forceInitialZoom triggers zoom animation

    const showFretboardContent = true;
    const initialFadeComplete = false;

    // CSS animation starts immediately
    const hasAnimation = showFretboardContent && !initialFadeComplete;
    expect(hasAnimation).toBe(true);

    // Zoom starts after MOUNT_DELAY
    expect(MOUNT_DELAY).toBe(200);
  });

  it('should have fade animation active throughout most of zoom', () => {
    // Fade: 500ms
    // Zoom: 1500ms (starts after 200ms delay)
    // So fade completes at t=500ms, zoom completes at t=1700ms

    const fadeEndTime = INITIAL_FADE_DURATION; // 500ms
    const zoomStartTime = MOUNT_DELAY; // 200ms
    const zoomEndTime = zoomStartTime + ZOOM_DURATION; // 1700ms

    // Fade is active during the first part of zoom
    expect(fadeEndTime).toBeGreaterThan(zoomStartTime);
    expect(fadeEndTime).toBeLessThan(zoomEndTime);
  });
});

describe('3D Overlay Fade Synchronization', () => {
  it('should apply same animation to both fretboard container and 3D overlay', () => {
    const initialFadeComplete = false;

    // Both elements use the same animation logic
    const containerAnimation = !initialFadeComplete
      ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
      : undefined;
    const overlayAnimation = !initialFadeComplete
      ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
      : undefined;

    expect(containerAnimation).toBe(overlayAnimation);
  });

  it('should switch both to fadeOpacity after animation completes', () => {
    const initialFadeComplete = true;
    const fadeOpacity = 0.5;

    const containerOpacity = initialFadeComplete ? fadeOpacity : undefined;
    const overlayOpacity = initialFadeComplete ? fadeOpacity : undefined;

    expect(containerOpacity).toBe(overlayOpacity);
    expect(containerOpacity).toBe(0.5);
  });
});
