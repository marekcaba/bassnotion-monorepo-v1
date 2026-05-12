# Fretboard Animation Systems - Visual Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FretboardCard.tsx                           │
│                   (Master Orchestrator)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌────────────┐  ┌─────────────┐  ┌──────────────┐
        │ Sentinel   │  │ 2D Fretboard│  │ 3D Overlay   │
        │ Observer   │  │ Container   │  │ Canvas       │
        │ (IO)       │  │ (CSS Fade)  │  │ (Three.js)   │
        └────────────┘  └─────────────┘  └──────────────┘
             │               │                    │
             │               │                    │
          trigger        showFretboardContent    transitionPhase
          reveal         initialFadeComplete     triggerZoomOnMount
          sequence       fadeOpacity             fadeOpacity
             │               │                    │
             └───────────────┴────────────────────┘
                        │
          Coordinates through:
          - forceInitialZoom
          - effectiveTransitionPhase
          - atomicDisplayData
```

## Initial Reveal Sequence (State Diagram)

```
┌─────────────┐
│   HIDDEN    │  State: isInitialRevealComplete=F, showFretboardContent=F
│             │  Action: IntersectionObserver watching sentinel
└──────┬──────┘
       │ User scrolls to sentinel
       │ Sentinel enters viewport (threshold=0)
       ▼
┌─────────────────────────┐
│    MOUNTING             │  State: showFretboardContent=T
│                         │  Action: CSS fadeIn animation starts
│  - 3D overlay mounts    │          initialFadeComplete=F
│  - DOM elements appear  │
└──────┬──────────────────┘
       │ After MOUNT_DELAY (200ms)
       │
       ▼
┌─────────────────────────┐
│    TRIGGERING           │  State: forceInitialZoom=T
│                         │  Action: Ring3DOverlayCanvas detects
│  - Zoom animation       │          triggerZoomOnMount=true
│    starts triggering    │          Camera zoom animation starts
└──────┬──────────────────┘
       │ Animation running (1500ms)
       │
       ▼
┌─────────────────────────┐
│    ANIMATING            │  State: CSS & camera animations active
│                         │  Action: Screen shows zoom + fade effect
│  - Camera moving        │          Blend of both animations
│  - Fade progressing     │
└──────┬──────────────────┘
       │ After INITIAL_FADE_DURATION (500ms)
       │ initialFadeComplete → T
       │ After ZOOM_DURATION (1500ms)
       │ forceInitialZoom → F
       ▼
┌─────────────────────────┐
│    REVEALED             │  State: All animations complete
│                         │  Action: Ready for normal operation
│  - Normal operation     │          Switch to useSnapshotTransition
│  - Ready for exercises  │          for exercise transitions
└─────────────────────────┘
```

## Timeline: Initial Reveal (100% = 1800ms)

```
0%     ├─ Sentinel enters viewport
       │  showFretboardContent = true
       │  CSS fadeIn animation starts
       │
       ▼
       CSS fadeIn Animation (500ms)
   ///////////////////////////////////////////////////////////////////////////////////
   │                                                                               │
   ▼                                                                               ▼
   0%                                                                            100%
   opacity: 0                                                                 opacity: 1

       ▼
11%    ├─ MOUNT_DELAY passed (200ms)
       │  forceInitialZoom = true
       │  Ring3DOverlayCanvas mounted with triggerZoomOnMount=true
       │  Camera zoom animation starts
       │
       ▼  (200-1700ms window = 1500ms duration)
       Zoom Animation (ease-out cubic)
       ///////////////////////////////////////////////////////////////////////////////////
       │                                                                               │
       ▼                                                                               ▼
       Z=920 (pulled back)                                                       Z=800 (target)
       startZ + (targetZ-startZ) × easeOutCubic(progress)

28%    ├─ CSS animation completes
       │  initialFadeComplete = true
       │  Switch from CSS animation to CSS transition
       │
       ▼  Fade opacity now controlled by useSnapshotTransition
       [Ready for exercise transitions]

94%    ├─ 50% through zoom (smooth in progress)
       │  easeOutCubic(0.5) = 0.875
       │  Z ≈ 815px (87.5% of the way there)
       │
       ▼

100%   ├─ All animations complete
       │  forceInitialZoom = false
       │  Z = 800px (target reached)
       │  opacity = 1 (fully visible)
       │
       ▼
       ┌─ Ready for normal operation
       │  - Exercise transitions use useSnapshotTransition
       │  - Camera zoom on exercise changes
       │  - Manual scroll detection active
       └─
```

## Timeline: Exercise Transition (100% = 500ms)

```
User clicks different exercise
       │
       ▼
0%     ├─ Transition starts
       │  transitionPhase = 'stable'
       │  fadeOpacity = 1 (old exercise visible)
       │  ↓ useSnapshotTransition activates
       │
       ▼
       Fade-Out Phase (first ~250ms of 500ms)
       ///////////////////////////////////////////////////////////////////////////////////
       │   Old data visible, opacity decreasing                                        │
       │   fadeOpacity: 1 ──────────────────────────► 0                                │
       │   phase: 'stable' ────────────► 'fading-out'                                  │
       ▼                                                                                ▼
       0%                                                                             50%

50%    ├─ SWAP Point (instantaneous)
       │  atomicDisplayData updates to NEW exercise
       │  notes, tempo, overlay3DConfig all change together
       │  phase transitions: 'fading-out' → 'fading-in'
       │
       ▼
       Fade-In Phase (last ~250ms of 500ms)
       ///////////////////////////////////////////////////////////////////////////////////
       │   New data visible, opacity increasing                                        │
       │   Camera zoom animation running (if supported)                                │
       │   fadeOpacity: 0 ──────────────────────────► 1                                │
       │   phase: 'fading-in'                                                          │
       ▼                                                                                ▼
       50%                                                                            100%

100%   ├─ Transition complete
       │  transitionPhase = 'stable'
       │  fadeOpacity = 1 (new exercise fully visible)
       │  atomicDisplayData locked in
       │
       ▼
       Ready for next exercise change
```

## Camera Zoom Mathematics

```
Easing Function: easeOutCubic(t) = 1 - (1 - t)³

Progress (t)  │  easeOutCubic(t)  │  Z Position  │  Description
──────────────┼──────────────────┼──────────────┼─────────────────────
     0.0      │      0.000       │    920px     │ Start (pulled back)
     0.1      │      0.271       │    848px     │ 27% progress
     0.2      │      0.488       │    823px     │ 49% progress
     0.3      │      0.657       │    806px     │ 66% progress
     0.4      │      0.784       │    795px     │ 78% progress
     0.5      │      0.875       │    785px     │ 88% progress (midpoint)
     0.6      │      0.936       │    776px     │ 94% progress
     0.7      │      0.973       │    770px     │ 97% progress
     0.8      │      0.992       │    767px     │ 99% progress
     0.9      │      0.999       │    766px     │ ~100% progress
     1.0      │      1.000       │    800px     │ Target reached

Key insight: Ease-out means 87.5% progress at 50% time
            → Animation feels fast initially, slows at end
            → Creates smooth "zoom in" effect
```

## State Machine: Phase Transitions

```
                    ┌──────────────┐
                    │   'stable'   │ (Normal, no animation)
                    │ fadeOpacity=1│
                    │   No zoom    │
                    └────┬─────────┘
                         │
         User changes ←──┤ exercise
                         │
                         ▼
         ┌──────────────────────────────┐
         │   'fading-out'               │ (Fade old data out)
         │ fadeOpacity: 1 → 0           │ (First 250ms)
         │ OLD data visible             │
         │ Phase change detected        │
         │ (if from stable)             │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │   [ATOMIC SWAP]              │ (Instant data swap)
         │ atomicDisplayData updates    │
         │ All data changes together:   │
         │ - notes                      │
         │ - tempo                      │
         │ - overlay3DConfig            │
         └──────────┬───────────────────┘
                    │
                    ▼
         ┌──────────────────────────────┐
         │   'fading-in'                │ (Fade new data in)
         │ fadeOpacity: 0 → 1           │ (Last 250ms)
         │ NEW data visible             │
         │ Camera zoom animation runs   │
         │ (if triggerZoomOnMount or    │
         │  phase change detected)      │
         └──────────┬───────────────────┘
                    │
         After 500ms total
                    ▼
         ┌──────────────────────────────┐
         │   'stable' (again)           │
         │ fadeOpacity=1                │
         │ Ready for next change        │
         └──────────────────────────────┘
```

## IntersectionObserver: Sentinel Detection

```
┌─────────────────────────────────────────────────┐
│           Viewport (visible area)               │
│                                                 │
│  [Page content above fretboard section]         │
│                                                 │
│  ╔════════════════════════════════════════════╗│
│  ║         FretboardCard Component            ║│
│  ║   [FretboardGrid or 3D Overlay content]   ║│
│  ║   [... fretboard visualization ...]        ║│
│  ║                                            ║│
│  ╠════════════════════════════════════════════╣│  ← threshold: 0
│  ║  ● Sentinel Element (1px height)           ║│     (top edge of sentinel)
│  ╚════════════════════════════════════════════╝│
│                                                 │
│  [Page content below fretboard section]         │
└─────────────────────────────────────────────────┘

Before scroll:              After user scrolls down:
─────────────────          ────────────────────────
  ┌─ Viewport              ┌─ Viewport
  │ ┌───────────┐          │ ┌───────────┐
  │ │ Content   │          │ │           │
  │ └───────────┘          │ │[Fretboard]│
  │ ┌───────────┐          │ │   [~~~]   │  ← IntersectionObserver
  │ │[Fretboard]│          │ │   [●●●]   │     detects sentinel!
  │ │   [~~~]   │          │ └───────────┘     isIntersecting = true
  │ │           │          │
  │ └───────────┘          └─
  │ [Sentinel] ⚫           Triggers:
  │   ↓                    - showFretboardContent = true
  └─ (below viewport)      - CSS fadeIn starts
                           - 200ms later: zoom animation
```

## Coordinate Flow: From User Action to Screen

```
User scrolls down
       │
       ▼
[IntersectionObserver callback]
       │
       ├─ setShowFretboardContent(true)
       ├─ setIsInitialRevealComplete(true)
       │
       ▼
[FretboardCard re-renders]
       │
       ├─ Fretboard container gets CSS animation
       ├─ 3D overlay container gets CSS animation
       ├─ Both apply: animation="fretboardFadeIn 500ms ease-out forwards"
       │
       ▼
[Browser renders CSS animation]
       │
       ├─ Elements fade from opacity 0 to 1 over 500ms
       │
       ▼ (200ms into animation)
[useEffect timer fires]
       │
       ├─ setForceInitialZoom(true)
       │
       ▼
[Ring3DOverlayCanvas receives triggerZoomOnMount=true]
       │
       ├─ Detects: shouldStartZoomAnimation returns true
       ├─ Sets up animation state: isAnimating = true
       │
       ▼
[useFrame callback in Three.js]
       │
       ├─ Calculate progress: elapsed / 1500ms
       ├─ Interpolate Z: startZ + (targetZ - startZ) × easeOutCubic(progress)
       ├─ Set camera.position.z = interpolatedZ
       │
       ▼
[Three.js renders new frame]
       │
       ├─ Camera positioned at new Z
       ├─ Scene rendered from new perspective
       ├─ Rings appear to zoom inward
       │
       ▼
[After ~1500ms total]
       │
       ├─ Animation progress = 1
       ├─ setForceInitialZoom(false)
       ├─ Ready for normal operation
```

## Atomic Data Transition: The Fix

```
WITHOUT ATOMIC TRANSITION (Race Condition):
════════════════════════════════════════════

Exercise A → Exercise B

Timeline:
t=0ms    Exercise A data loaded
t=250ms  Fade out completes
         ⚠️ RACE CONDITION: Independent hooks update
         - Notes hook updates → notes from B
         - Tempo hook updates → tempo from A (not yet updated!)
         - Overlay hook updates → config from A
         RESULT: Screen shows B's notes with A's tempo! ❌

RESULT: Visual glitch - mismatched data


WITH ATOMIC TRANSITION (Fixed):
════════════════════════════════

Exercise A → Exercise B

Timeline:
t=0ms    All A data loaded
         atomicSourceData = {
           notes: A.notes,
           tempo: A.tempo,
           overlay3DConfig: A.config
         }

t=250ms  Fade out completes, SWAP occurs
         atomicSourceData = {
           notes: B.notes,      ← ALL update
           tempo: B.tempo,      ← at same
           overlay3DConfig: B.config  ← moment
         }
         useSnapshotTransition sees NEW atomic object
         All display data swaps together
         RESULT: ✅ Perfect sync

RESULT: Clean transition - all data matches
```

## Debug Output Example

```
[ZOOM-DEBUG] IntersectionObserver setup - sentinel: <div>
[ZOOM-DEBUG] IntersectionObserver callback: {
  isIntersecting: true,
  intersectionRatio: 0.5
}
[ZOOM-DEBUG] 🎯 Sentinel in view! Revealing fretboard content

[ZOOM-DEBUG] 🌟 CSS fade-in animation started

[ZOOM-DEBUG] Render state: {
  isInitialRevealComplete: false,
  showFretboardContent: true,
  initialFadeComplete: false,
  fadeOpacity: 0.45,
  usingCSSAnimation: true,
  sentinelExists: true
}

[ZOOM-DEBUG] 🎬 Initial reveal - scheduling fading-in after mount
[ZOOM-DEBUG] 🚀 Now forcing fading-in to trigger zoom animation
[ZOOM-DEBUG] effectiveTransitionPhase: FORCING fading-in for initial reveal

[ZOOM-DEBUG] ✅ Initial fade animation complete
[ZOOM-DEBUG] ✅ Zoom animation complete - clearing forceInitialZoom
[ZOOM-DEBUG] Render state: {
  isInitialRevealComplete: true,
  showFretboardContent: true,
  initialFadeComplete: true,
  fadeOpacity: 1,
  usingCSSAnimation: false,
  sentinelExists: true
}
```

## Performance Profile: Animation Frames

```
Frame Rate Target: 60fps (16.67ms per frame)

Initial Reveal Timeline (with frame count):
═══════════════════════════════════════════

Frame 0 (0ms)     │ Sentinel detected
                  │ showFretboardContent = true
                  │ CSS animation applied
                  │
Frames 1-30       │ CSS fadeIn animation running
(0-500ms)         │ Browser handles rendering natively
                  │ React frame rate: Normal
                  │ ✓ Smooth 60fps
                  │
Frame 30 (500ms)  │ initialFadeComplete = true
                  │ CSS animation ends
                  │ forceInitialZoom queued
                  │
Frame 32 (533ms)  │ forceInitialZoom = true
                  │ Ring3DOverlayCanvas re-render
                  │ Three.js scene initializes
                  │
Frames 33-133     │ Camera zoom animation running
(533-2133ms)      │ useFrame callback updating camera Z
                  │ Three.js rendering new frames
                  │ ✓ Smooth 60fps (in WebGL context)
                  │
Frame 133 (2133ms)│ zoom progress = 1, animation ends
                  │ forceInitialZoom = false
                  │ Ready for normal interaction
```

---

## Key Takeaways (Visual)

```
┌─────────────────────────────────────────────────────┐
│ INITIAL REVEAL                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Sentinel detection (IntersectionObserver)          │
│        ↓                                            │
│  CSS fade-in (500ms) + Camera zoom (1500ms)        │
│        ↓                                            │
│  Both animations run in parallel, coordinated       │
│        ↓                                            │
│  Ready for exercise transitions                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ EXERCISE TRANSITIONS                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  useSnapshotTransition manages:                    │
│  - Fade out (500ms)                                │
│  - Atomic swap (instant)                           │
│  - Fade in (500ms)                                 │
│  - Camera zoom (if phase changed)                  │
│                                                     │
│  Result: Smooth, coordinated visual transition     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ RACE CONDITION FIX                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Problem:                                          │
│  Component mounts after phase already 'fading-in'  │
│  → Phase change detection fails                    │
│  → Animation never starts                          │
│                                                     │
│  Solution:                                         │
│  triggerZoomOnMount prop bypasses detection        │
│  → Forces animation to start on mount              │
│  → Guaranteed animation every time                 │
└─────────────────────────────────────────────────────┘
```

