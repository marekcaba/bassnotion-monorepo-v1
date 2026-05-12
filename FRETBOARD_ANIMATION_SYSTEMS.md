# Fretboard Fade-In Animation & Scroll-Triggered Visibility System

## Overview

The BassNotion fretboard features a sophisticated two-part animation system:

1. **Initial Scroll-Triggered Reveal** - Fretboard content fades in when user scrolls to sentinel
2. **Exercise Transition Animations** - Smooth fade and camera zoom when switching exercises

Both animations are coordinated through CSS animations, React state, and Three.js camera control.

---

## Architecture Overview

### 1. Initial Fretboard Reveal on Scroll

**Purpose:** Delay fretboard rendering until user scrolls to the fretboard area, improving perceived performance.

**How it works:**
```
User scrolls down
    ↓
IntersectionObserver detects sentinel
    ↓
showFretboardContent → true
    ↓
CSS fadeIn animation starts (500ms)
    ↓
200ms delay (mount delay)
    ↓
forceInitialZoom → true
    ↓
Ring3DOverlayCanvas detects phase change
    ↓
Camera zoom animation starts (1500ms)
    ↓
Animation completes
```

**Key Components:**
- `animationTriggerSentinelRef` - Invisible marker element at bottom of fretboard container
- `IntersectionObserver` - Watches sentinel for viewport entry
- `showFretboardContent` - React state controlling fretboard visibility
- `initialFadeComplete` - Tracks when CSS animation completes

### 2. Exercise Transition Animations

**Purpose:** Create smooth visual transition when switching exercises, including opacity fade and camera zoom.

**How it works:**
```
User clicks exercise
    ↓
useSnapshotTransition activates
    ↓
Fade-out phase (500ms)
    - OLD exercise data visible
    - fadeOpacity: 1 → 0
    ↓
SWAP phase (instant)
    - atomicDisplayData updates
    - atomicSourceData changed
    ↓
Fade-in phase (500ms)
    - NEW exercise data visible
    - fadeOpacity: 0 → 1
    - Camera zoom animation runs
```

---

## Core Files & Their Roles

### Main Component

#### `FretboardCard.tsx` (1665 lines)
- **Location:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/`
- **Role:** Master component coordinating animations
- **Key State:**
  ```typescript
  const [isInitialRevealComplete, setIsInitialRevealComplete] = useState(false);
  const [showFretboardContent, setShowFretboardContent] = useState(false);
  const [initialFadeComplete, setInitialFadeComplete] = useState(false);
  const [forceInitialZoom, setForceInitialZoom] = useState(false);
  const [effectiveTransitionPhase, setEffectiveTransitionPhase] = useState('stable');
  ```

- **Key Lines:**
  - **15-28**: Global CSS keyframes injection (`@keyframes fretboardFadeIn`)
  - **519-576**: IntersectionObserver setup for sentinel
  - **578-595**: CSS animation completion tracking
  - **945-975**: Initial zoom animation triggering
  - **1362-1379**: Fretboard container with animation styles
  - **1474-1519**: 3D overlay render with fade synchronization
  - **1531**: Sentinel element

### Overlay & Animation Components

#### `Ring3DOverlayCanvas.tsx` (600+ lines)
- **Location:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/`
- **Role:** Three.js canvas container for 3D ring animation
- **Props:**
  - `transitionPhase` - 'stable' | 'fading-out' | 'fading-in'
  - `triggerZoomOnMount` - Forces zoom animation on initial mount
  - `fadeOpacity` - From useSnapshotTransition
  - `exerciseId` - For detecting exercise changes

#### `RingOverlayGroup.tsx` (123 lines)
- **Role:** Manages individual ring rendering for upcoming notes
- **Key Method:** Filters timeline and creates FloatingTorusRing instances

#### `FloatingTorusRing.tsx`
- **Role:** Individual 3D ring visual for each note
- **Animation:** Appears in lookahead window, disappears when note plays

### Hooks & Utilities

#### `useFretboardNoteSync` Hook
- **Location:** `apps/frontend/src/domains/widgets/hooks/`
- **Purpose:** Builds timeline from exercise notes for ring positioning
- **Exports:** `findNoteAtTime()`, `NoteTimelineEntry`

#### `useSmoothScroll` Hook
- **Location:** `apps/frontend/src/domains/widgets/hooks/useSmoothScroll.ts` (263 lines)
- **Purpose:** Smooth horizontal scroll animation with manual scroll detection
- **Features:**
  - requestAnimationFrame-based smooth scrolling
  - Cubic ease-out easing (natural deceleration)
  - Detects user manual scroll and disables auto-scroll
  - Cancelable animations
- **Key Methods:**
  - `scrollTo(targetX)` - Animate to target position
  - `cancelScroll()` - Stop animation
  - `disableAutoScroll()` - Called when user manually scrolls
  - `enableAutoScroll()` - Re-enable after manual scroll

#### `usePageInitialization` Hook
- **Location:** `apps/frontend/src/domains/widgets/machines/usePageInitialization.ts` (435 lines)
- **Purpose:** Page initialization state machine with XState
- **Features:**
  - Detects when user scrolls to trigger element
  - Manages audio/sample loading phases
  - Integrates with DevTools for debugging

### Test Files

#### `initialRevealSequence.test.ts` (775 lines)
- **Location:** `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/__tests__/`
- **Tests:** Sentinel detection, reveal timing, race condition scenarios
- **Key Test Scenarios:**
  - Reveal state transitions (hidden → mounting → triggering → animating → revealed)
  - Race condition fix with `triggerZoomOnMount` prop
  - CSS fade animation timing (500ms)
  - Zoom animation timing (1500ms total, 200ms delay)
  - IntersectionObserver integration
  - Cleanup on unmount

#### `CSSMatchingCamera.zoom.test.ts` (150+ lines)
- **Tests:** Camera zoom animation mathematics
- **Key Tests:**
  - Easing function (ease-out cubic)
  - Z position interpolation
  - Camera pull-back multiplier (1.15 = 15% further back)
  - Default perspective (800px)

#### Other Test Files
- `Ring3DOverlayCanvas.exercise-cleanup.test.ts` - Exercise transition cleanup
- `FretboardCard.freeze.test.tsx` - Render loop detection
- `dotAnimationIntegration.test.tsx` - Dot animation timing
- `FretboardCard.deps.test.tsx` - Dependency management

---

## Animation Systems Breakdown

### System 1: CSS Fade-In Animation

**Duration:** 500ms
**Easing:** ease-out
**Keyframes:**
```css
@keyframes fretboardFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Applied to:**
- Fretboard container (`fretboardContainerRef`)
- 3D overlay wrapper div
- Both use same animation for synchronization

**Style Application (FretboardCard.tsx, line 1377):**
```typescript
animation: !initialFadeComplete
  ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
  : undefined,
```

**When Applied:**
- Initially: When `showFretboardContent` becomes true AND `initialFadeComplete` is false
- Switches to: CSS `transition` after `initialFadeComplete` becomes true

### System 2: Exercise Transition Fade

**Duration:** Configurable, default 500ms (FADE_DURATION_MS in FretboardCard)
**Mechanism:** useSnapshotTransition hook
**Opacity Control:** `fadeOpacity` state variable

**How it Works:**
```typescript
const {
  displayData: atomicDisplayData,
  opacity: fadeOpacity,
  fadeDuration,
  phase: transitionPhase,
} = useSnapshotTransition(
  atomicSourceData,
  selectedExerciseId,
  { fadeDuration: FADE_DURATION_MS }
);
```

**Style Application (FretboardCard.tsx, line 1378):**
```typescript
transition: initialFadeComplete
  ? `opacity ${fadeDuration}ms ease-out`
  : undefined,
opacity: initialFadeComplete ? fadeOpacity : undefined,
```

**Phases:**
- `stable` - Normal operation, fadeOpacity = 1
- `fading-out` - OLD exercise visible, fadeOpacity 1 → 0
- `fading-in` - NEW exercise visible, fadeOpacity 0 → 1

### System 3: Camera Zoom Animation

**Duration:** 1500ms
**Easing:** ease-out cubic
**Camera Movement:** Z position pull-back → normal

**Mathematical Formula:**
```typescript
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// CSS Perspective = 800px
// Pull-back multiplier = 1.15 (15% further)
// Start Z = 800 * 1.15 = 920
// Target Z = 800

// At progress t:
currentZ = startZ + (targetZ - startZ) * easeOutCubic(t)
```

**Timeline:**
- t=0: Camera at Z=920 (pulled back)
- t=0.5: Camera at Z≈815 (87.5% progress due to ease-out)
- t=1.0: Camera at Z=800 (target position)

**Triggers:**
1. **Normal Exercise Change:** Phase transitions from `stable`/`fading-out` → `fading-in`
2. **Initial Reveal:** `forceInitialZoom` prop set to true (bypasses phase change detection)

**Implementation:** In `Ring3DOverlayCanvas`, `CSSMatchingCamera` component
- Uses `useFrame` callback from @react-three/fiber
- Updates camera Z position based on elapsed time
- Detects phase changes via `prevPhaseRef`
- Respects `triggerZoomOnMount` prop for initial reveal

---

## Sentinel & IntersectionObserver Details

### Sentinel Element
```typescript
// FretboardCard.tsx, line 1531
<div ref={animationTriggerSentinelRef} aria-hidden="true" style={{ height: 1 }} />
```

**Purpose:** Invisible 1px div that triggers reveal when scrolled into view

**Location:** Inside `<ZoneCard>`, after fretboard content

**Detection:** IntersectionObserver watches for when sentinel enters viewport

### IntersectionObserver Setup (FretboardCard.tsx, line 535-576)

```typescript
useEffect(() => {
  if (isInitialRevealComplete) {
    console.log('[ZOOM-DEBUG] Initial reveal already complete, skipping observer');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        console.log('[ZOOM-DEBUG] 🎯 Sentinel in view! Revealing fretboard content');
        setShowFretboardContent(true);
        setIsInitialRevealComplete(true);
      }
    },
    {
      threshold: 0,
      rootMargin: '0px',
    }
  );

  observer.observe(sentinel);
  return () => observer.disconnect();
}, [isInitialRevealComplete]);
```

**Key Properties:**
- `threshold: 0` - Trigger as soon as sentinel enters viewport (1px in view)
- `rootMargin: '0px'` - No margin/padding for detection
- Cleanup: Observer automatically disconnects on unmount

---

## Race Condition Fix: triggerZoomOnMount

### The Problem

**Scenario:** Component mounts after `forceInitialZoom` is already true
- `forceInitialZoom` set to true → timer queued
- React re-render occurs before timer fires
- `Ring3DOverlayCanvas` mounts with `transitionPhase='fading-in'` (current state)
- `prevPhaseRef` initialized to `'fading-in'` (current value)
- Phase change detection fails: `prevPhase === currentPhase` → no animation

**Result:** Zoom animation never starts

### The Solution

**New Prop:** `triggerZoomOnMount`

**Usage (FretboardCard.tsx, line 1516):**
```typescript
<Ring3DOverlayCanvas
  // ... other props
  triggerZoomOnMount={forceInitialZoom}
/>
```

**In Ring3DOverlayCanvas (detection logic):**
```typescript
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
```

**Effect:** Bypasses phase change detection to guarantee animation starts on initial mount

---

## State Flow & Coordination

### Initial Reveal Flow

```
1. Page Load
   - isInitialRevealComplete = false
   - showFretboardContent = false
   - initialFadeComplete = false
   - forceInitialZoom = false

2. User Scrolls to Sentinel
   - IntersectionObserver fires
   - isInitialRevealComplete → true
   - showFretboardContent → true
   - CSS fadeIn animation starts immediately

3. After MOUNT_DELAY (200ms)
   - forceInitialZoom → true
   - Ring3DOverlayCanvas receives triggerZoomOnMount=true
   - Camera zoom animation starts

4. After INITIAL_FADE_DURATION (500ms)
   - initialFadeComplete → true
   - CSS animation stops
   - Switch to useSnapshotTransition opacity control

5. After ZOOM_DURATION (1500ms total, including 200ms delay)
   - forceInitialZoom → false
   - Zoom animation completes
   - Ready for normal exercise transitions
```

### Exercise Transition Flow

```
1. User Clicks Exercise
   - effectiveTransitionPhase controlled by useSnapshotTransition
   - Starts: phase = 'stable', fadeOpacity = 1

2. Fade-Out Phase (~250ms of 500ms fade)
   - phase = 'fading-out'
   - fadeOpacity: 1 → 0
   - OLD exercise data visible
   - CSS transition: opacity ${fadeDuration}ms ease-out

3. Swap Phase (instantaneous)
   - atomicDisplayData updates to NEW exercise
   - fadeOpacity continues interpolating

4. Fade-In Phase (~250ms of 500ms fade)
   - phase = 'fading-in'
   - fadeOpacity: 0 → 1
   - NEW exercise data visible
   - Camera zoom animation runs (if prevPhase changed)

5. Complete
   - phase = 'stable'
   - fadeOpacity = 1
   - forceInitialZoom = false (if was set)
```

---

## Atomic Data Transition Pattern (FAANG)

### Problem
Three independent `useSnapshotTransition` hooks (notes, tempo, overlay3D) can get out of sync:
- Exercise A notes displayed with Exercise B tempo
- Temporal mismatches cause incorrect visual state

### Solution
Combine ALL transition-sensitive data into **single atomic object**:

```typescript
interface AtomicExerciseDisplayData {
  notes: ExerciseNote[];
  tempo: number;
  overlay3DConfig: FretboardCardProps['overlay3DConfig'] | null;
  exerciseId: string | undefined;
}

const atomicSourceData = React.useMemo<AtomicExerciseDisplayData>(() => ({
  notes: fretboard.exerciseData.exerciseNotes,
  tempo: fretboard.exercise.tempo,
  overlay3DConfig: effectiveOverlay3DConfig ?? null,
  exerciseId: fretboard.exerciseData.selectedExercise?.id,
}), [
  fretboard.exerciseData.exerciseNotes,
  fretboard.exercise.tempo,
  effectiveOverlay3DConfig,
  fretboard.exerciseData.selectedExercise?.id,
]);

const {
  displayData: atomicDisplayData,
  opacity: fadeOpacity,
  // ... rest of transition
} = useSnapshotTransition(atomicSourceData, selectedExerciseId, options);
```

### Result
- ALL data swaps **simultaneously** during SWAP phase
- No transient mismatches
- Notes, tempo, and 3D config always in sync

---

## Configuration & Defaults

### Timing Constants
- `INITIAL_FADE_DURATION`: 500ms (CSS animation)
- `FADE_DURATION_MS`: 500ms (Exercise transitions)
- `MOUNT_DELAY`: 200ms (Time before zoom animation starts)
- `ZOOM_DURATION`: 1500ms (Camera zoom animation)
- `TOTAL_REVEAL_TIME`: 1800ms (200 + 1500 + 100ms buffer)

### Camera Configuration
- `CSS_PERSPECTIVE`: 800px
- `PULL_BACK_MULTIPLIER`: 1.15 (15% further back)
- `START_Z`: 800 * 1.15 = 920px
- `TARGET_Z`: 800px

### Ring Overlay Configuration
- `lookaheadMs`: How far ahead to show rings
- `transitionDuration`: Duration for individual note animations
- See `RingOverlayConfig.ts` for full config

---

## CSS Classes & Styles

### Debug Logging
Throughout FretboardCard and overlays, look for:
- `[ZOOM-DEBUG]` - Initial reveal sequence
- `[FRETBOARD-CONFIG-DEBUG]` - Exercise config detection

### Performance Notes
- `show: render`, `hide: no render` for 2D fretboard (based on `hide2DFretboard` prop)
- 3D overlay only renders when `showFretboardContent && !hide3DFretboard`
- Lazy rendering prevents unnecessary DOM elements

---

## Testing Overview

### Test Files
1. **initialRevealSequence.test.ts** (775 lines)
   - Reveal state machine
   - IntersectionObserver integration
   - Race condition scenarios
   - CSS animation timing

2. **CSSMatchingCamera.zoom.test.ts** (150+ lines)
   - Easing function mathematics
   - Z position interpolation
   - Pull-back animation

3. **Ring3DOverlayCanvas.exercise-cleanup.test.ts**
   - Exercise transition cleanup

### Key Test Scenarios
- Initial reveal only triggers once
- Zoom animation completes in expected time
- Phase changes trigger animation correctly
- triggerZoomOnMount bypasses normal detection
- CSS animations coordinate with zoom

---

## Debugging Guide

### Enable Debug Logging
```typescript
// In browser console
window.logger.setLevel(window.LogLevel.DEBUG);

// Or set env var
NEXT_PUBLIC_LOG_LEVEL=DEBUG
```

### Debug Flags
- `DEBUG_OVERLAY` (Ring3DOverlayCanvas.tsx line 30) - Show 3D debug visualization
- `window.RING_DEBUG = true/false` - Toggle ring debug logging

### Common Issues

**Issue:** Zoom animation doesn't trigger on initial reveal
- **Cause:** triggerZoomOnMount prop missing or false
- **Fix:** Ensure `Ring3DOverlayCanvas` receives `triggerZoomOnMount={forceInitialZoom}`

**Issue:** Fretboard doesn't appear after scrolling
- **Cause:** IntersectionObserver not firing
- **Debug:** Check [ZOOM-DEBUG] logs for "No sentinel element found"
- **Fix:** Verify `animationTriggerSentinelRef` is attached to DOM

**Issue:** Multiple reveal animations trigger
- **Cause:** `initialRevealDoneRef` not preventing re-trigger
- **Fix:** Check if component is remounting or state not persisting

**Issue:** Exercises fade to black instead of fading
- **Cause:** `initialFadeComplete` still false, CSS animation still active
- **Debug:** Check if timeout completing correctly
- **Fix:** Verify `INITIAL_FADE_DURATION` matches CSS animation

---

## Files Reference Table

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| FretboardCard.tsx | 1665 | Main component, animation coordination | FretboardCard, FretboardCardContent |
| Ring3DOverlayCanvas.tsx | 600+ | Three.js canvas container | Ring3DOverlayCanvas |
| RingOverlayGroup.tsx | 123 | Ring rendering, timeline filtering | RingOverlayGroup |
| FloatingTorusRing.tsx | ? | Individual 3D ring component | FloatingTorusRing |
| useSmoothScroll.ts | 263 | Smooth scroll animation hook | useSmoothScroll |
| usePageInitialization.ts | 435 | Page initialization state machine | usePageInitialization |
| useFretboardNoteSync | ? | Timeline building from exercises | useFretboardNoteSync |
| RingOverlayConfig.ts | ? | Configuration constants | RingOverlayConfig |
| initialRevealSequence.test.ts | 775 | Reveal sequence tests | Tests only |
| CSSMatchingCamera.zoom.test.ts | 150+ | Camera animation tests | Tests only |

---

## Related Documentation

- `/docs/fretboard-3d-implementation.md` - 3D fretboard architecture
- `/docs/REACT-RENDERING-GOTCHAS.md` - Common render loop issues
- `/docs/CLICK-BLOCKING-DEBUG-PROGRESS.md` - Click handling debugging
- CLAUDE.md - React best practices and critical patterns

---

## Key Takeaways

1. **Dual Animation System:** CSS for initial reveal, useSnapshotTransition for exercises
2. **Sentinel Pattern:** IntersectionObserver watches invisible element for scroll trigger
3. **Race Condition Fix:** triggerZoomOnMount prop guarantees initial animation triggers
4. **Atomic Transitions:** All data swaps simultaneously to prevent mismatches
5. **Smooth Scrolling:** useSmoothScroll provides eased horizontal scroll
6. **Extensive Testing:** Comprehensive test coverage prevents animation regressions
7. **Debug Support:** Multiple debug flags and logging for troubleshooting

