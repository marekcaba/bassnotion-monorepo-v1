# Fretboard Animation Systems - Quick Reference

## File Locations

```
apps/frontend/src/domains/widgets/
├── components/YouTubeWidgetPage/
│   └── FretboardCard/
│       ├── FretboardCard.tsx                    ⭐ Main component (1665 lines)
│       ├── overlays/
│       │   ├── Ring3DOverlayCanvas.tsx         ⭐ 3D canvas (600+ lines)
│       │   ├── RingOverlayGroup.tsx            Ring container (123 lines)
│       │   ├── FloatingTorusRing.tsx           Individual ring
│       │   ├── RingOverlayConfig.ts            Configuration
│       │   ├── ringStyles.ts                   Styling
│       │   ├── useRingOverlay.ts               Ring setup hook
│       │   └── __tests__/
│       │       ├── CSSMatchingCamera.zoom.test.ts    ⭐ Zoom animation tests
│       │       └── Ring3DOverlayCanvas.exercise-cleanup.test.ts
│       ├── hooks/
│       │   ├── useFretboard.ts                 Main fretboard hook
│       │   └── (other domain hooks...)
│       └── __tests__/
│           ├── initialRevealSequence.test.ts   ⭐ Reveal sequence tests (775 lines)
│           ├── FretboardCard.freeze.test.tsx   Render loop tests
│           └── (other tests...)
├── hooks/
│   ├── useSmoothScroll.ts                      ⭐ Scroll animation (263 lines)
│   └── useFretboardNoteSync.ts                 Timeline building
├── machines/
│   └── usePageInitialization.ts                ⭐ Initialization state machine (435 lines)
└── examples/
    └── (example integrations...)
```

## Core State Variables

### In FretboardCard.tsx

| State | Type | Purpose |
|-------|------|---------|
| `isInitialRevealComplete` | boolean | Whether initial reveal sequence finished |
| `showFretboardContent` | boolean | Show/hide fretboard content |
| `initialFadeComplete` | boolean | CSS fade animation completed |
| `forceInitialZoom` | boolean | Trigger zoom animation on mount |
| `effectiveTransitionPhase` | 'stable' \| 'fading-out' \| 'fading-in' | Current transition phase |
| `fadeOpacity` | number | 0-1, controlled by useSnapshotTransition |
| `zoomLevel` | number | Default 1.15 (115%) |
| `scrollMode` | 'follow' \| 'locked' | Auto-scroll behavior during playback |

## Timeline Overview

### Initial Reveal Sequence
```
t=0ms     → User scrolls, IntersectionObserver fires
t=1ms     → showFretboardContent = true
t=1-500ms → CSS fadeIn animation runs
t=200ms   → forceInitialZoom = true
t=200ms   → Ring3DOverlayCanvas detects triggerZoomOnMount
t=200-1700ms → Camera zoom animation runs
t=500ms   → initialFadeComplete = true (CSS animation done)
t=1700ms  → Zoom animation complete
```

### Exercise Transition
```
t=0ms     → User clicks exercise
t=0-250ms → Fade-out (fadeOpacity: 1 → 0)
t=250ms   → Atomic data SWAP
t=250-500ms → Fade-in (fadeOpacity: 0 → 1)
t=200-1700ms → Camera zoom animation (if phase changed)
```

## Key Props & Parameters

### FretboardCard Component
```typescript
interface FretboardCardProps {
  selectedDots3D?: Map<string, number[]>;
  setSelectedDots3D?: (dots: Map<string, number[]>) => void;
  stringCount3D?: 4 | 5 | 6;
  setStringCount3D?: (count: 4 | 5 | 6) => void;
  maxFrets?: number;
  exercises?: any[];
  selectedExerciseId?: string | null;
  onExerciseSelect?: (exerciseId: string) => void;
  overlay3DConfig?: { rotationX, rotationY, ... };
  hide2DFretboard?: boolean;
  hide3DFretboard?: boolean;
}
```

### Ring3DOverlayCanvas Props
```typescript
interface Ring3DOverlayCanvasProps {
  exerciseNotes: ExerciseNote[];
  currentTime: number;
  isPlaying: boolean;
  config: RingOverlayConfig;
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  tempo: number;
  fadeOpacity: number;              // From useSnapshotTransition
  fadeDuration: number;
  transitionPhase: 'stable' | 'fading-out' | 'fading-in';
  triggerZoomOnMount: boolean;      // ⭐ Critical for initial reveal
  // ... other props
}
```

## Animation Values

### CSS Fade Animation
- **Duration:** 500ms
- **Easing:** ease-out
- **Properties:** opacity 0 → 1

### Exercise Transition Fade
- **Duration:** 500ms (configurable)
- **Easing:** ease-out
- **Properties:** opacity, controlled by fadeOpacity

### Camera Zoom
- **Duration:** 1500ms
- **Easing:** ease-out cubic: `1 - (1-t)³`
- **Movement:** Z: 920px → 800px
- **Pull-back:** 1.15x (15% further back)

## Key Functions & Hooks

### useSmoothScroll
```typescript
const { scrollTo, isAutoScrollDisabled, enableAutoScroll } = useSmoothScroll({
  containerRef,
  duration: 200,  // ms
  easing: easeOutCubic,
});
scrollTo(targetX);  // Smooth scroll to position
```

### useSnapshotTransition
```typescript
const { displayData, opacity, phase, fadeDuration } = useSnapshotTransition(
  atomicSourceData,  // Combined data object
  selectedExerciseId,
  { fadeDuration: 500 }
);
```

### IntersectionObserver
```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      setShowFretboardContent(true);
    }
  },
  { threshold: 0, rootMargin: '0px' }
);
observer.observe(sentinelElement);
```

## Common Code Patterns

### Conditional Animation Application
```typescript
// During initial reveal: use CSS animation
// After reveal: use transition for exercise changes
style={{
  animation: !initialFadeComplete
    ? `fretboardFadeIn 500ms ease-out forwards`
    : undefined,
  transition: initialFadeComplete
    ? `opacity 500ms ease-out`
    : undefined,
  opacity: initialFadeComplete ? fadeOpacity : undefined,
}}
```

### Atomic Data Transition
```typescript
const atomicSourceData = useMemo(() => ({
  notes: exerciseNotes,
  tempo: tempo,
  overlay3DConfig: config,
  exerciseId: id,
}), [exerciseNotes, tempo, config, id]);

const { displayData: atomicDisplayData, opacity } =
  useSnapshotTransition(atomicSourceData, id, options);

// All data in displayData swap together
const { notes: displayNotes, tempo: displayTempo } = atomicDisplayData;
```

### Phase Change Detection
```typescript
const shouldAnimate = (prevPhase, currentPhase, triggerZoomOnMount) => {
  if (triggerZoomOnMount) return true;  // ⭐ Initial reveal fix
  return prevPhase !== 'fading-in' && currentPhase === 'fading-in';
};
```

## Debug Tips

### Enable Logging
```javascript
// Browser console
window.logger.setLevel(window.LogLevel.DEBUG);
window.RING_DEBUG = true;
```

### Check State
```javascript
// Look for [ZOOM-DEBUG] messages in console
// Check FretboardCard render count
// Watch useSnapshotTransition phase changes
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Zoom doesn't trigger | `triggerZoomOnMount` missing | Add to Ring3DOverlayCanvas |
| Reveal doesn't start | Sentinel not in viewport | Check IntersectionObserver |
| Multiple reveals | Ref not preventing re-trigger | Check `initialRevealDoneRef` |
| Fade to black | CSS animation still running | Verify `initialFadeComplete` timing |
| Wrong data displayed | Atomic transition failed | Check atomicSourceData dependencies |

## Essential Lines in FretboardCard.tsx

```
15-28        CSS keyframes injection
519-576      IntersectionObserver setup
578-595      CSS animation completion tracking
892-906      Atomic data creation
910-921      useSnapshotTransition call
945-975      Initial zoom trigger
977-987      Effective phase computation
1362-1379    Fretboard container styles
1474-1519    3D overlay render
1531         Sentinel element
```

## Testing Commands

```bash
# Run reveal sequence tests
pnpm vitest run apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/__tests__/initialRevealSequence.test.ts

# Run camera zoom tests
pnpm vitest run apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/__tests__/CSSMatchingCamera.zoom.test.ts

# Watch all fretboard tests
pnpm vitest --watch apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard
```

## Related Concepts

- **Sentinel Pattern:** Invisible element triggers animation on scroll
- **IntersectionObserver:** Browser API for efficient scroll detection
- **useSnapshotTransition:** Custom hook for coordinated data + opacity transitions
- **Atomic Transactions:** All related data updates simultaneously
- **Race Condition Fix:** triggerZoomOnMount prop bypasses timing dependencies
- **Ease-Out Cubic:** Animation easing: 1 - (1-t)³

---

**Last Updated:** Based on current codebase state
**Status:** Initial reveal + exercise transitions fully implemented
**Test Coverage:** Comprehensive (see test files)
**Performance Target:** 60fps animations, <50ms audio latency
