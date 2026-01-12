# STORY: Guitar Hero-Style Animated Ring Overlay System

## Story Overview

| Field | Value |
|-------|-------|
| **Story ID** | RING-OVERLAY-001 |
| **Title** | 3D Floating Torus Ring Overlay for Fretboard (Guitar Hero Style) |
| **Epic** | Visual Enhancement & Premium Features |
| **Priority** | HIGH |
| **Status** | READY FOR IMPLEMENTATION |
| **Created** | 2025-01-05 |
| **Last Updated** | 2026-01-05 |
| **Author** | Claude Code Analysis |
| **Reviewed By** | Claude Code FAANG Review |

## Problem Statement

BassNotion needs an enhanced visual feedback system for the fretboard that provides Guitar Hero-style moving ring animations as a premium feature.

**Current State:**
- The 2D fretboard uses a static yellow ring (CSS `box-shadow`) to highlight the currently playing note
- The highlight appears instantly at the note position - there's no approaching animation
- Users cannot visually prepare for upcoming notes like in Guitar Hero
- No differentiation between bass techniques in the visual feedback
- All users get the same visual experience regardless of subscription tier

**Desired State:**
- **3D floating torus/donut ring** that hovers above the **2D fretboard** and moves toward target notes
- Ring rendered using Three.js `TorusGeometry` in a **separate transparent canvas overlay** (same size as fretboard, positioned on top of the 2D FretboardGrid)
- The 2D fretboard stays as HTML/CSS - the ring is a transparent Three.js layer floating slightly above it
- Real 3D depth, lighting, and emissive glow as the ring approaches and descends
- Technique-specific ring styles (different colors/shapes for hammer-on, pull-off, slide, bend, etc.)
- Premium feature gating: 3 free tutorials with animated ring, rest behind paywall
- Modular system that supports multiple ring styles (classic, spotlight, guitarHero, technique, pulse, trail)
- **Works in 2D mode** - this is the primary use case; 3D fretboard mode is a separate PRO feature

## Business Context

**Monetization Strategy:**
- Free tier: 10 tutorials with classic static yellow ring
- Free tier bonus: 3 of those 10 tutorials include animated ring (teaser)
- Premium subscription ($14/month): Unlimited tutorials + animated ring on all
- Future: Pro tier with 3D Guitar Hero highway mode

**Value Proposition:**
- Animated ring significantly improves note preparation and timing accuracy
- Technique-specific colors help players recognize and learn bass techniques
- Premium visual experience differentiates BassNotion from competitors

---

## Critical Design Decisions

### Decision 1: Separate Canvas Overlay for 2D Mode

**Decision:** The Guitar Hero Ring Overlay uses a **separate Three.js canvas** (same dimensions as fretboard) positioned absolutely over the 2D FretboardGrid.

**Rationale:**
1. The 2D fretboard (HTML/CSS) is the primary view for free users - ring overlay enhances this
2. A lightweight Three.js canvas rendering only ring(s) has minimal GPU overhead
3. `pointerEvents: 'none'` allows clicks to pass through to the 2D fretboard underneath
4. `gl={{ alpha: true }}` makes the canvas transparent - only the 3D ring is visible
5. This approach provides a "wow factor" teaser that encourages upgrades to premium

**WebGL Context Limits:**
- Browsers limit ~8-16 WebGL contexts per page
- BassNotion typically has 1 context (if 3D mode is enabled) - adding 1 more is safe
- The ring canvas only renders a few meshes (lightweight) and only mounts when enabled

**User Experience:**
- Ring overlay toggle available in 2D mode (primary use case)
- When 3D fretboard mode is enabled, ring overlay is disabled (3D mode has its own visuals)
- Settings UI shows "Guitar Hero Ring Overlay" toggle - no "3D required" messaging

### Decision 2: Canvas Positioned Over 2D FretboardGrid

**Decision:** Create `Ring3DOverlayCanvas` component that renders a transparent R3F `<Canvas>` absolutely positioned over the 2D fretboard.

**Architecture:**
```tsx
// Ring3DOverlayCanvas.tsx - Separate overlay on 2D fretboard
function Ring3DOverlayCanvas({ fretboardRef, timeline, currentTime, config }) {
  return (
    <Canvas
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Clicks pass through to 2D fretboard
        zIndex: 30, // Above fretboard dots (z-index: 20)
      }}
      gl={{ alpha: true }} // Transparent background
      camera={{ position: [0, 10, 0], fov: 60, near: 0.1, far: 100 }}
    >
      <ambientLight intensity={0.6} />
      <RingOverlayGroup
        timeline={timeline}
        currentTime={currentTime}
        config={config}
        fretboardRect={fretboardRef.current?.getBoundingClientRect()}
      />
    </Canvas>
  );
}

// FretboardCard.tsx - Conditionally render overlay in 2D mode
function FretboardCard({ is3DMode, showRingOverlay, ... }) {
  return (
    <div style={{ position: 'relative' }}>
      {is3DMode ? (
        <Fretboard3D ... />
      ) : (
        <>
          <FretboardGrid ref={fretboardRef} ... />
          {showRingOverlay && (
            <Ring3DOverlayCanvas
              fretboardRef={fretboardRef}
              timeline={timeline}
              currentTime={currentTime}
              config={ringConfig}
            />
          )}
        </>
      )}
    </div>
  );
}
```

### Decision 3: Use BassArticulationType from Contracts

**Decision:** Use the existing `BassArticulationType` from `@bassnotion/contracts` for technique detection.

**Type Mapping:**
```typescript
// From libs/contracts/src/types/bass-articulation.ts
type BassArticulationType =
  | 'normal'
  | 'ghost-note'
  | 'accent'
  | 'hammer-on'    // Note: hyphens, not underscores
  | 'pull-off'
  | 'slide-up'
  | 'slide-down'
  | 'bend'
  | 'trill';
```

### Decision 4: Toggle Between Classic and Animated Ring

**Decision:** A single toggle switches between the existing CSS ring (classic) and the new 3D animated ring (Guitar Hero style). Both rings should NOT be visible at the same time.

**Toggle States:**

| Toggle State | Ring Type | CSS `.note-active` | 3D Canvas Overlay |
|--------------|-----------|-------------------|-------------------|
| **OFF** (default) | Classic | ✅ Enabled | ❌ Not mounted |
| **ON** (premium) | Animated 3D | ❌ Disabled | ✅ Mounted |

**Implementation:**
```tsx
// FretboardCard.tsx - Single toggle controls both systems
function FretboardCard({ showAnimatedRing, ... }) {
  return (
    <div style={{ position: 'relative' }}>
      <FretboardGrid
        // When animated ring is ON, disable CSS .note-active class
        disableClassicHighlight={showAnimatedRing}
        ...
      />

      {/* Only mount 3D canvas when animated ring is enabled */}
      {showAnimatedRing && (
        <Ring3DOverlayCanvas ... />
      )}
    </div>
  );
}

// FretboardDot.tsx - Conditionally apply .note-active class
const getDotClassName = () => {
  // Skip classic highlight if animated ring is enabled
  if (disableClassicHighlight) {
    return baseClassName; // No yellow ring
  }

  if (isCurrentNote) {
    return 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300'; // Classic
  }
  // ...
};
```

**User Experience:**
- Toggle labeled: "Guitar Hero Ring" or "Animated Ring Overlay"
- Located in tutorial settings panel (gear icon)
- Premium badge shown next to toggle if user doesn't have access
- When toggled ON: Classic yellow ring disappears, 3D ring appears
- When toggled OFF: 3D ring unmounts, classic yellow ring returns

**Why not show both?**
1. Visual clutter - two rings on same note is confusing
2. Performance - no need to render both highlight systems
3. Clear distinction - users see the "upgrade" difference immediately

---

## User Stories

### US-1: Classic Static Ring (Default/Free)
**As a** free user
**I want to** see a yellow ring highlight on the current note
**So that** I know which note is currently playing

**Acceptance Criteria:**
- [x] Yellow ring appears on current note position (EXISTING)
- [x] Ring uses CSS box-shadow for performance (EXISTING)
- [x] Ring appears instantly when note becomes active (EXISTING)
- [x] Ring disappears when note ends (EXISTING)

### US-2: Guitar Hero Moving 3D Ring (Premium)
**As a** premium subscriber
**I want to** see a 3D floating ring approaching notes before they need to be played
**So that** I can prepare my fingers and improve timing with an immersive visual experience

**Acceptance Criteria:**
- [ ] **3D torus/donut ring** rendered using Three.js `TorusGeometry`
- [ ] Ring **floats above** the fretboard (elevated on Y-axis)
- [ ] Ring starts from a distance and moves toward target note position
- [ ] Ring moves smoothly at 60fps using `useFrame` from React Three Fiber
- [ ] Ring arrives at note position exactly when note should be played
- [ ] Ring has **real 3D depth** with lighting and optional shadow
- [ ] Ring has **emissive glow** effect for visibility
- [ ] Ring size matches standard fretboard dots (~13px radius equivalent)
- [ ] Multiple upcoming notes can be shown with decreasing opacity/scale
- [ ] Ring **descends** toward the fretboard as it approaches (Y-axis animation)
- [ ] **Ring works in 2D mode** - separate Three.js canvas overlays the 2D fretboard
- [ ] Ring overlay is disabled when 3D fretboard mode is enabled (3D has its own visuals)

### US-3: Technique-Specific Ring Colors
**As a** user learning bass techniques
**I want to** see different ring colors for different techniques
**So that** I can recognize and prepare for hammer-ons, pull-offs, slides, etc.

**Acceptance Criteria:**
- [ ] Hammer-on: Red (#FF6B6B) ring
- [ ] Pull-off: Teal (#4ECDC4) ring
- [ ] Slide: Blue (#45B7D1) ring
- [ ] Bend: Green (#96CEB4) ring
- [ ] Harmonic: Gold (#FFD700) diamond shape
- [ ] Slap/Pop: Purple (#A855F7) ring with pulse
- [ ] Ghost note: Dim/transparent ring
- [ ] Normal note: Yellow (#FACC15) ring (default)

### US-4: Ring Style Selection
**As a** premium subscriber
**I want to** choose my preferred ring animation style
**So that** I can customize my learning experience

**Acceptance Criteria:**
- [ ] Settings panel to choose ring style
- [ ] Available styles: classic, spotlight, guitarHero, technique, pulse, trail
- [ ] Preview of each style before selection
- [ ] Preference persisted in user settings
- [ ] Settings UI available in 2D mode (no "3D required" messaging)

### US-5: Premium Feature Gating
**As a** BassNotion business owner
**I want to** gate animated ring behind subscription
**So that** we can monetize premium visual features

**Acceptance Criteria:**
- [ ] Free users see classic static ring by default
- [ ] 3 designated tutorials have animated ring enabled for free (teaser)
- [ ] Premium subscribers get animated ring on all tutorials
- [ ] Clear UI indication when animated ring is premium-locked
- [ ] Upsell prompt when free user tries to enable animated ring

---

## Technical Architecture

### Investigation Findings (2025-01-05, Updated 2026-01-05)

#### Existing Systems to Leverage

**1. Note Timing & Sync (REUSE)**
- `useFretboardNoteSync.ts` - Binary search for sub-16ms precision
- Provides `timeline: NoteTimelineEntry[]` with `startTime`, `endTime`, `position`
- `onMeasureChange` callback for triggering React updates on measure boundaries
- `findNoteAtTime()` - Binary search for current note
- `findNextNoteAfterTime()` - For getting upcoming notes

**2. Technique Definitions (REUSE)**
- `TechniqueRenderer.tsx` - 3D technique visualization with colors
- `bass-articulation.ts` - Complete technique type definitions (`BassArticulationType`)
- Colors already defined: hammer-on (red), pull-off (teal), slide (blue), bend (green), harmonic (gold)

**3. Billing/Premium System (REUSE)**
- `PremiumGate.tsx` - Component for feature gating with `requireSubscription` prop
- `useBilling.ts` - Hooks for subscription checks (`useHasPremiumAccess`)
- Full Stripe integration already in place

**4. Three.js Infrastructure (REUSE)**
- `@react-three/fiber` - Already in bundle (v9.1.4) - create NEW separate canvas for ring overlay
- `@react-three/drei` - Helper components (v9.122.0)
- `THREE.TorusGeometry` - Perfect for donut/ring shape
- `THREE.MeshStandardMaterial` - Supports emissive glow
- Note: `Fretboard3D.tsx` has its own canvas - ring overlay uses a SEPARATE lightweight canvas

**5. Animation Infrastructure (REUSE)**
- `useSmoothScroll.ts` - RAF-based 60fps animation pattern
- `fretboardAnimation.ts` - Measure-based lookahead logic
- `fretboard-notes.css` - CSS transition definitions

---

### Proposed Architecture (2D OVERLAY APPROACH)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FretboardCard.tsx                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  is3DMode = false (PRIMARY USE CASE)                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            FretboardGrid (2D HTML/CSS dots)         │  │  │
│  │  │  - Static note positions                            │  │  │
│  │  │  - CSS .note-active for classic highlight           │  │  │
│  │  │  - position: relative (container for overlay)       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                           ↑                                │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │    Ring3DOverlayCanvas (NEW - Separate Canvas)      │  │ ← Premium
│  │  │  - position: absolute, pointerEvents: none          │  │  │
│  │  │  - gl={{ alpha: true }} for transparency            │  │  │
│  │  │  - zIndex: 30 (above dots at z-index: 20)           │  │  │
│  │  │  ┌─────────────────────────────────────────────┐    │  │  │
│  │  │  │         RingOverlayGroup                    │    │  │  │
│  │  │  │  - FloatingTorusRing components             │    │  │  │
│  │  │  │  - useFrame animation at 60fps              │    │  │  │
│  │  │  │  - Maps 2D fret/string to 3D coords         │    │  │  │
│  │  │  └─────────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              OR                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  is3DMode = true (PRO feature - NO ring overlay here)     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │        Fretboard3D (Full 3D experience)             │  │  │
│  │  │  - Has its own visual effects                       │  │  │
│  │  │  - Ring overlay DISABLED in 3D mode                 │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↑                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              useFretboardNoteSync (existing)              │  │
│  │  - Provides timeline[], current note, upcoming notes      │  │
│  │  - Binary search for sub-16ms precision                   │  │
│  │  - onMeasureChange callback                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↑                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │           useRingOverlay (NEW - Hook)                     │  │
│  │  - Ring style settings from user preferences              │  │
│  │  - Premium access state from useBilling                   │  │
│  │  - 2D→3D coordinate mapping                               │  │
│  │  - Progress calculation for each ring                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Design

#### Ring3DOverlayCanvas.tsx (Main Canvas Container - NEW)
```typescript
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
import type { RingOverlayConfig } from './RingOverlayConfig';

interface Ring3DOverlayCanvasProps {
  fretboardRect: DOMRect | null;
  timeline: NoteTimelineEntry[];
  currentTime: number;
  config: RingOverlayConfig;
}

export function Ring3DOverlayCanvas({
  fretboardRect,
  timeline,
  currentTime,
  config,
}: Ring3DOverlayCanvasProps) {
  if (!fretboardRect) return null;

  return (
    <Canvas
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Clicks pass through to 2D fretboard
        zIndex: 30, // Above fretboard dots (z-index: 20)
      }}
      gl={{ alpha: true }} // Transparent background
      camera={{
        position: [0, 15, 0], // Looking down at fretboard
        fov: 50,
        near: 0.1,
        far: 100,
      }}
    >
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <Suspense fallback={null}>
        <RingOverlayGroup
          timeline={timeline}
          currentTime={currentTime}
          config={config}
          fretboardRect={fretboardRect}
        />
      </Suspense>
    </Canvas>
  );
}
```

#### RingOverlayGroup.tsx (Container for Multiple Rings)
```typescript
import { useMemo } from 'react';
import type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
import type { RingOverlayConfig } from './RingOverlayConfig';

interface RingOverlayGroupProps {
  timeline: NoteTimelineEntry[];
  currentTime: number;
  config: RingOverlayConfig;
  fretboardRect: DOMRect; // For 2D→3D coordinate mapping
}

export function RingOverlayGroup({
  timeline,
  currentTime,
  config,
  fretboardRect
}: RingOverlayGroupProps) {
  // Find upcoming notes within lookahead window
  const upcomingNotes = useMemo(() => {
    const lookaheadSec = config.lookaheadMs / 1000;
    return timeline
      .filter(entry =>
        entry.type === 'note' &&
        entry.startTime > currentTime &&
        entry.startTime <= currentTime + lookaheadSec
      )
      .slice(0, config.showUpcoming);
  }, [timeline, currentTime, config.lookaheadMs, config.showUpcoming]);

  // Convert 2D fretboard coordinates to 3D world coordinates
  const get3DPosition = useCallback((stringIndex: number, fret: number | 'open'): [number, number, number] => {
    // Map fret position (0-24) to X axis (-10 to 10)
    const fretNum = fret === 'open' ? 0 : fret;
    const x = ((fretNum / 24) * 20) - 10;

    // Map string index (0-3 for bass) to Z axis
    const z = ((stringIndex / 3) * 6) - 3;

    // Y is handled by animation (descending)
    return [x, 0, z];
  }, []);

  return (
    <group name="ring-overlay-group">
      {upcomingNotes.map((note, index) => (
        <FloatingTorusRing
          key={`ring-${note.noteIndex}`}
          note={note}
          currentTime={currentTime}
          config={config}
          get3DPosition={get3DPosition}
          ringIndex={index}
        />
      ))}
    </group>
  );
}
```

#### FloatingTorusRing.tsx (Individual 3D Ring)
```typescript
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
import type { BassArticulationType } from '@bassnotion/contracts';
import { TECHNIQUE_COLORS } from './ringStyles';

interface FloatingTorusRingProps {
  note: NoteTimelineEntry;
  currentTime: number;
  config: RingOverlayConfig;
  get3DPosition: (stringIndex: number, fret: number | 'open') => [number, number, number];
  ringIndex: number;
}

export function FloatingTorusRing({
  note,
  currentTime,
  config,
  get3DPosition,
  ringIndex
}: FloatingTorusRingProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Calculate progress (0 = just entered lookahead, 1 = at note position)
  const progress = useMemo(() => {
    const lookaheadSec = config.lookaheadMs / 1000;
    const entryTime = note.startTime - lookaheadSec;

    if (currentTime < entryTime) return 0;
    if (currentTime >= note.startTime) return 1;

    return (currentTime - entryTime) / lookaheadSec;
  }, [note.startTime, currentTime, config.lookaheadMs]);

  // Get target position from note
  const targetPosition = useMemo(() => {
    return get3DPosition(note.position.stringIndex, note.position.fret);
  }, [note.position, get3DPosition]);

  // Get technique color
  const technique = (note.note as any)?.technique as BassArticulationType | undefined;
  const color = config.techniqueColors && technique
    ? TECHNIQUE_COLORS[technique] || TECHNIQUE_COLORS.normal
    : TECHNIQUE_COLORS.normal;

  // Calculate opacity based on ring index (further = more transparent)
  const opacity = Math.max(0.3, 1 - (ringIndex * 0.2));

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Animate Y position (descend toward fretboard)
    const startY = 5;  // Start floating above
    const endY = 0.5;  // End just above fretboard surface
    meshRef.current.position.y = THREE.MathUtils.lerp(startY, endY, progress);

    // Animate XZ position toward target
    meshRef.current.position.x = THREE.MathUtils.lerp(
      meshRef.current.position.x,
      targetPosition[0],
      Math.min(delta * 5, 1)
    );
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetPosition[2],
      Math.min(delta * 5, 1)
    );

    // Gentle rotation for visual interest
    meshRef.current.rotation.x += delta * 0.5;
  });

  return (
    <mesh ref={meshRef} position={[targetPosition[0], 5, targetPosition[2]]}>
      <torusGeometry args={[0.6, 0.15, 16, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={config.glowIntensity}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
```

#### ringStyles.ts (Technique Colors - USING BassArticulationType)
```typescript
import type { BassArticulationType } from '@bassnotion/contracts';

// Colors matching existing TechniqueRenderer.tsx
export const TECHNIQUE_COLORS: Record<BassArticulationType | 'normal', string> = {
  'normal': '#FACC15',      // Yellow (default)
  'hammer-on': '#FF6B6B',   // Red
  'pull-off': '#4ECDC4',    // Teal
  'slide-up': '#45B7D1',    // Blue
  'slide-down': '#45B7D1',  // Blue
  'bend': '#96CEB4',        // Green
  'ghost-note': '#6B7280',  // Gray (dimmed)
  'accent': '#EF4444',      // Bright Red
  'trill': '#22C55E',       // Green (lighter)
};

// Extended colors for additional techniques (future use)
export const EXTENDED_TECHNIQUE_COLORS = {
  ...TECHNIQUE_COLORS,
  'harmonic': '#FFD700',    // Gold
  'slap': '#A855F7',        // Purple
  'pop': '#EC4899',         // Pink
  'tap': '#F97316',         // Orange
  'vibrato': '#22C55E',     // Green (lighter)
};
```

#### RingOverlayConfig.ts
```typescript
export type RingStyle =
  | 'classic'        // Yellow static highlight (free)
  | 'spotlight'      // Moving yellow dot (premium)
  | 'guitarHero'     // Approaching notes from distance (premium)
  | 'technique'      // Color changes by technique (premium)
  | 'pulse'          // Rhythmic pulse effect (premium)
  | 'trail';         // Ghost trail behind ring (pro)

export interface RingOverlayConfig {
  enabled: boolean;
  style: RingStyle;
  lookaheadMs: number;      // How far ahead to show incoming notes (default: 2000)
  animationSpeed: number;   // Movement speed multiplier (default: 1.0)
  techniqueColors: boolean; // Use technique-specific colors
  showUpcoming: number;     // Number of upcoming notes to show (default: 3)
  ringSize: number;         // Ring radius in Three.js units (default: 0.6)
  glowIntensity: number;    // Glow effect intensity 0-1 (default: 0.5)
}

export const DEFAULT_CONFIG: RingOverlayConfig = {
  enabled: false,
  style: 'guitarHero',
  lookaheadMs: 2000,
  animationSpeed: 1.0,
  techniqueColors: true,
  showUpcoming: 3,
  ringSize: 0.6,
  glowIntensity: 0.5,
};
```

#### useRingOverlay.ts (Main Hook)
```typescript
import { useMemo, useCallback } from 'react';
import { useHasPremiumAccess } from '@/domains/billing/hooks/useBilling';
import type { RingOverlayConfig } from './RingOverlayConfig';
import { DEFAULT_CONFIG } from './RingOverlayConfig';

interface UseRingOverlayOptions {
  tutorialSlug?: string;
  userPreferences?: Partial<RingOverlayConfig>;
}

// Tutorials that get free animated ring (teaser)
const FREE_ANIMATED_RING_TUTORIALS = [
  'intro-to-bass',
  'basic-rhythms',
  'first-song'
];

export function useRingOverlay(options: UseRingOverlayOptions = {}) {
  const { isPremium, isLoading } = useHasPremiumAccess();

  const hasFreeAccess = useMemo(() => {
    return options.tutorialSlug
      ? FREE_ANIMATED_RING_TUTORIALS.includes(options.tutorialSlug)
      : false;
  }, [options.tutorialSlug]);

  const hasAccess = isPremium || hasFreeAccess;

  const config: RingOverlayConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...options.userPreferences,
    // Override enabled if user doesn't have access
    enabled: hasAccess && (options.userPreferences?.enabled ?? false),
  }), [hasAccess, options.userPreferences]);

  const enableRingOverlay = useCallback((enable: boolean) => {
    if (!hasAccess && enable) {
      // Trigger upsell modal
      return { success: false, reason: 'premium_required' };
    }
    return { success: true };
  }, [hasAccess]);

  return {
    config,
    hasAccess,
    hasFreeAccess,
    isPremium,
    isLoading,
    enableRingOverlay,
  };
}
```

---

## Files to Create

```
apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/
├── overlays/
│   ├── index.ts                      # Barrel export
│   ├── Ring3DOverlayCanvas.tsx       # Main R3F Canvas container (separate overlay canvas)
│   ├── RingOverlayGroup.tsx          # Container for multiple rings
│   ├── FloatingTorusRing.tsx         # Individual 3D torus mesh with useFrame animation
│   ├── RingOverlayConfig.ts          # Types and configuration
│   ├── useRingOverlay.ts             # Hook for access control and config
│   ├── ringStyles.ts                 # Technique-specific colors using BassArticulationType
│   ├── utils/
│   │   └── fretboardTo3DCoords.ts    # Convert 2D fret/string positions to 3D world coords
│   └── __tests__/
│       ├── Ring3DOverlayCanvas.test.tsx
│       ├── RingOverlayGroup.test.tsx
│       ├── FloatingTorusRing.test.tsx
│       └── useRingOverlay.test.ts
```

## Files to Modify

| File | Changes |
|------|---------|
| `FretboardCard.tsx` | Add `Ring3DOverlayCanvas` as sibling to `FretboardGrid` when 2D mode + overlay enabled |
| `FretboardCard.tsx` | Ensure parent container has `position: relative` for absolute overlay positioning |
| `FretboardCard.tsx` | Pass `disableClassicHighlight` prop to FretboardGrid when animated ring is ON |
| `FretboardCard.tsx` | Disable ring overlay when `is3DMode = true` (3D mode has its own visuals) |
| `FretboardDot.tsx` | Add `disableClassicHighlight` prop to skip CSS `.note-active` class when animated ring is ON |
| `FretboardGrid.tsx` | Pass `disableClassicHighlight` prop down to FretboardDot components |
| `useFretboardNoteSync.ts` | No changes needed - already exports timeline and timing data |

---

## Implementation Phases

### Phase 1: Foundation (2-3 days) 🟡 MEDIUM RISK

**Objective:** Create 3D floating torus ring overlay as a SEPARATE canvas layer on top of the 2D fretboard.

#### Task 1.1: Create Overlay Infrastructure
- [x] **1.1.1** Create `overlays/` folder structure with index.ts barrel ✅
- [x] **1.1.2** Create `RingOverlayConfig.ts` with types and defaults ✅
- [x] **1.1.3** Create `ringStyles.ts` using `BassArticulationType` from contracts ✅
- [x] **1.1.4** Create `useRingOverlay.ts` hook for access control ✅
- [x] **1.1.5** Create `utils/fretboardTo3DCoords.ts` for 2D→3D coordinate mapping ✅ ⚠️ NEEDS FIX: coordinates not calibrated to 2D pixel positions

#### Task 1.2: Build Separate Canvas Overlay
- [x] **1.2.1** Create `Ring3DOverlayCanvas.tsx` with R3F `<Canvas>` ✅
- [x] **1.2.2** Configure `gl={{ alpha: true }}` for transparent background ✅
- [x] **1.2.3** Set `pointerEvents: 'none'` to allow clicks through to 2D fretboard ✅
- [x] **1.2.4** Set `zIndex: 30` (above fretboard dots at z-index: 20) ✅
- [x] **1.2.5** Add camera looking down at fretboard plane ✅ ⚠️ NEEDS FIX: camera angle doesn't match 35° tilted 2D fretboard
- [x] **1.2.6** Add ambient + point lights for 3D depth ✅

#### Task 1.3: Build Ring Components
- [x] **1.3.1** Create `FloatingTorusRing.tsx` with TorusGeometry ✅
- [x] **1.3.2** Use `useFrame` for 60fps GPU-accelerated animation ✅
- [x] **1.3.3** Implement progress-based Y-axis descent animation ✅
- [x] **1.3.4** Implement XZ movement toward target note position ✅
- [x] **1.3.5** Add `MeshStandardMaterial` with emissive glow ✅
- [x] **1.3.6** Create `RingOverlayGroup.tsx` container for multiple rings ✅

#### Task 1.4: 2D→3D Coordinate Mapping
- [x] **1.4.1** Get fretboard dimensions from `fretboardRef.current.getBoundingClientRect()` ✅
- [x] **1.4.2** Map fret positions (0-24) to 3D X axis ✅ ⚠️ NEEDS FIX: doesn't account for CENTER_OFFSET, FRET_OFFSET
- [x] **1.4.3** Map string indices (0-3 for bass) to 3D Z axis ✅
- [ ] **1.4.4** Calibrate camera FOV to align 3D rings with 2D dot positions ❌ NOT DONE - rings won't align visually
- [ ] **1.4.5** Handle fretboard resize (recalculate coords) ❌ NOT DONE

#### Task 1.5: Timing Integration
- [x] **1.5.1** Connect to `useFretboardNoteSync` for timeline data ✅
- [x] **1.5.2** Implement `calculateProgress()` function ✅
- [x] **1.5.3** Filter upcoming notes within lookahead window ✅
- [x] **1.5.4** Handle note transitions smoothly (ring exits on arrival) ✅
- [x] **1.5.5** **Do NOT show rings during countdown beats** (check `countdownBeats` config) ✅

#### Task 1.6: Connect to FretboardCard
- [x] **1.6.1** Add `Ring3DOverlayCanvas` as sibling to `FretboardGrid` in 2D mode ✅
- [x] **1.6.2** Ensure parent container has `position: relative` ✅
- [x] **1.6.3** Pass `fretboardRef`, `timeline`, `currentTime`, `config` props ✅
- [x] **1.6.4** Disable ring overlay when `is3DMode = true` (3D has its own visuals) ✅
- [ ] **1.6.5** Add UI toggle for ring overlay in 2D mode controls ❌ NOT DONE

**⚠️ BLOCKING ISSUES BEFORE PHASE 1 COMPLETE:**
1. **Coordinate mapping not calibrated** - 3D world coords (-10 to +10) don't match 2D pixel positions
2. **Camera angle mismatch** - Camera looks straight down but 2D fretboard is tilted 35°
3. **Fret spacing incorrect** - Linear mapping ignores CENTER_OFFSET (15px) and FRET_OFFSET (38px)

**Definition of Done:**
- ⬜ 3D torus ring floats above 2D fretboard and descends toward note position (code exists, alignment broken)
- ⬜ Ring arrives at note exactly when note should play (timing works, position wrong)
- ✅ Animation runs at 60fps GPU-accelerated via useFrame
- ✅ Clicks pass through overlay to 2D fretboard underneath
- ✅ Ring overlay only available in 2D mode (disabled in 3D mode)
- ✅ Rings do NOT appear during countdown

---

### Phase 2: Technique Colors (1 day) 🟢 LOW RISK

**Objective:** Add technique-specific ring colors using `BassArticulationType`.

#### Task 2.1: Implement Technique Material System
- [ ] **2.1.1** Map `BassArticulationType` to colors in `ringStyles.ts`
- [ ] **2.1.2** Detect technique from `note.note?.technique` field
- [ ] **2.1.3** Apply `color` and `emissive` properties dynamically
- [ ] **2.1.4** Adjust `emissiveIntensity` per technique for glow variation

#### Task 2.2: Test All Techniques
- [ ] **2.2.1** Test `hammer-on` → red ring
- [ ] **2.2.2** Test `pull-off` → teal ring
- [ ] **2.2.3** Test `slide-up`/`slide-down` → blue ring
- [ ] **2.2.4** Test `bend` → green ring
- [ ] **2.2.5** Test `ghost-note` → dim/transparent ring

**Definition of Done:**
- ✅ Each technique displays correct color and emissive glow
- ✅ Colors match existing TechniqueRenderer (3D fretboard)
- ✅ Config toggle allows disabling technique colors

---

### Phase 3: Premium Gating (1 day) 🟢 LOW RISK

**Objective:** Gate animated ring behind subscription.

#### Task 3.1: Implement Access Control
- [ ] **3.1.1** Use `useHasPremiumAccess()` from billing hooks
- [ ] **3.1.2** Define `FREE_ANIMATED_RING_TUTORIALS` array
- [ ] **3.1.3** Create `useRingOverlay` hook with access logic

#### Task 3.2: Integrate with UI
- [ ] **3.2.1** Wrap ring overlay toggle with access check
- [ ] **3.2.2** Show "Premium" badge on ring settings when locked
- [ ] **3.2.3** Trigger upsell modal when locked user tries to enable
- [ ] **3.2.4** Enable for free on designated teaser tutorials

#### Task 3.3: Persist User Preference
- [ ] **3.3.1** Store ring config in user settings (localStorage or API)
- [ ] **3.3.2** Load saved preference on tutorial page mount
- [ ] **3.3.3** Sync with user profile if logged in

**Definition of Done:**
- ✅ Free users see classic static ring by default
- ✅ 3 free tutorials have animated ring enabled
- ✅ Premium users get animated ring everywhere
- ✅ Clear upsell messaging for locked features

---

### Phase 4: Multiple Upcoming Notes (1-2 days) 🟡 MEDIUM RISK

**Objective:** Show multiple approaching 3D rings like Guitar Hero.

#### Task 4.1: Track Multiple Notes
- [ ] **4.1.1** Get next N notes from timeline within lookahead window
- [ ] **4.1.2** Apply decreasing opacity based on ring index (further = more transparent)
- [ ] **4.1.3** Stagger Y start positions (further notes start higher up)

#### Task 4.2: Handle Edge Cases
- [ ] **4.2.1** Handle notes on same string/fret (stack with offset)
- [ ] **4.2.2** Handle rapid note sequences gracefully
- [ ] **4.2.3** Smooth ring exit animation when note completes

#### Task 4.3: Performance Optimization
- [ ] **4.3.1** Use `InstancedMesh` if >5 rings visible simultaneously:
    ```typescript
    const ringInstances = useMemo(() => {
      if (upcomingNotes.length <= 5) return null;

      const mesh = new THREE.InstancedMesh(
        sharedTorusGeometry,
        sharedRingMaterial,
        upcomingNotes.length
      );
      return mesh;
    }, [upcomingNotes.length > 5]);
    ```
- [ ] **4.3.2** Share geometry and material between ring instances
- [ ] **4.3.3** Profile GPU performance with 10+ visible rings

**Definition of Done:**
- ✅ 3+ upcoming 3D rings visible at once
- ✅ Rings fade as they get further in the future
- ✅ Smooth 60fps animation for all rings
- ✅ Efficient rendering with shared geometry/materials

---

### Phase 5: Polish & Advanced Styles (2-3 days) 🟢 LOW RISK

**Objective:** Add advanced ring styles and performance optimization.

#### Task 5.1: Implement Style Variants
- [ ] **5.1.1** `spotlight`: Simple torus with high emissive glow
- [ ] **5.1.2** `guitarHero`: Full descending animation (default)
- [ ] **5.1.3** `pulse`: Scale pulsing using sin wave in useFrame
- [ ] **5.1.4** `trail`: Ghost meshes with decreasing opacity following ring
- [ ] **5.1.5** `technique`: Dynamic colors based on note technique

#### Task 5.2: Add Settings UI
- [ ] **5.2.1** Style selector dropdown in tutorial settings
- [ ] **5.2.2** Lookahead slider (1-4 seconds)
- [ ] **5.2.3** Animation speed control
- [ ] **5.2.4** Glow/emissive intensity slider

#### Task 5.3: Mobile Performance
- [ ] **5.3.1** Add quality settings (`low`/`medium`/`high`)
- [ ] **5.3.2** Reduce geometry segments on low-end (8 instead of 32)
- [ ] **5.3.3** Use `MeshBasicMaterial` fallback on mobile
- [ ] **5.3.4** Profile on iPhone 12+, Android mid-range

**Definition of Done:**
- ✅ All style variants implemented
- ✅ Settings UI functional
- ✅ 60fps maintained on target devices
- ✅ Graceful degradation on mobile

---

## Developer Implementation Guide

This section provides granular, actionable subtasks for developers implementing the Guitar Hero Ring Overlay system. Each subtask is designed to be completable in 1-2 hours and has clear success criteria.

### Pre-Implementation Checklist

Before starting any implementation work, verify the following:

| Check | How to Verify | Status |
|-------|---------------|--------|
| **Node.js 18+** | `node --version` | [ ] |
| **pnpm installed** | `pnpm --version` | [ ] |
| **Dependencies installed** | `pnpm install` completes without errors | [ ] |
| **Frontend runs** | `pm2 status` shows `bassnotion-frontend` online | [ ] |
| **Backend runs** | `pm2 status` shows `bassnotion-backend` online | [ ] |
| **Three.js available** | Check `package.json` for `three@^0.170.0` | [ ] |
| **R3F available** | Check `package.json` for `@react-three/fiber@^9.1.4` | [ ] |
| **Drei available** | Check `package.json` for `@react-three/drei@^9.122.0` | [ ] |
| **FretboardCard exists** | File at `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx` | [ ] |
| **useFretboardNoteSync exists** | File at `apps/frontend/src/domains/widgets/hooks/useFretboardNoteSync.ts` | [ ] |
| **BassArticulationType exists** | Export in `libs/contracts/src/types/bass-articulation.ts` | [ ] |
| **PremiumGate exists** | File at `apps/frontend/src/domains/billing/components/PremiumGate.tsx` | [ ] |
| **Billing hooks work** | `useHasPremiumAccess` hook is functional | [ ] |

**Environment Setup Commands:**
```bash
# Ensure clean state
pm2 restart all
pnpm nx reset  # Clear nx cache if builds act strange

# Verify frontend loads
open http://localhost:3001

# Check PM2 logs for errors
pm2 logs bassnotion-frontend --lines 50
```

---

### Phase 1: Foundation - Detailed Subtasks

**Phase Duration:** 2-3 days
**Risk Level:** MEDIUM
**Prerequisites:** None (starting point)

#### Task P1-1.1: Create Overlay Infrastructure

##### P1-1.1.1a: Create folder structure
**Effort:** XS (15 min)
**Dependencies:** None
**Parallel:** Yes - can run with P1-1.1.2a

**Steps:**
1. Create directory: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/`
2. Create subdirectory: `overlays/utils/`
3. Create subdirectory: `overlays/__tests__/`

**Definition of Done:**
- [ ] Folder `overlays/` exists with `utils/` and `__tests__/` subdirs
- [ ] No errors when running `ls -la` on the path

---

##### P1-1.1.1b: Create barrel export index.ts
**Effort:** XS (15 min)
**Dependencies:** P1-1.1.1a
**Parallel:** No

**Steps:**
1. Create `overlays/index.ts`
2. Add placeholder exports (will be populated as components are created)

**Code to write:**
```typescript
// overlays/index.ts - Barrel export for ring overlay components
export { Ring3DOverlayCanvas } from './Ring3DOverlayCanvas.js';
export { RingOverlayGroup } from './RingOverlayGroup.js';
export { FloatingTorusRing } from './FloatingTorusRing.js';
export { useRingOverlay } from './useRingOverlay.js';
export { TECHNIQUE_COLORS, EXTENDED_TECHNIQUE_COLORS } from './ringStyles.js';
export type { RingOverlayConfig, RingStyle } from './RingOverlayConfig.js';
export { DEFAULT_CONFIG } from './RingOverlayConfig.js';
```

**Definition of Done:**
- [ ] `index.ts` created with all planned exports
- [ ] TypeScript doesn't error on file (exports will resolve as components are created)

---

##### P1-1.1.2a: Create RingOverlayConfig.ts types
**Effort:** S (30 min)
**Dependencies:** P1-1.1.1a
**Parallel:** Yes - can run with P1-1.1.1b, P1-1.1.3a

**Steps:**
1. Create `overlays/RingOverlayConfig.ts`
2. Define `RingStyle` union type
3. Define `RingOverlayConfig` interface
4. Export `DEFAULT_CONFIG` object

**Definition of Done:**
- [ ] All types compile without errors
- [ ] Default config has sensible values
- [ ] JSDoc comments on all exported types
- [ ] `pnpm nx run @bassnotion/frontend:typecheck` passes

---

##### P1-1.1.3a: Create ringStyles.ts with technique colors
**Effort:** S (30 min)
**Dependencies:** P1-1.1.1a
**Parallel:** Yes - can run with P1-1.1.2a

**Steps:**
1. Create `overlays/ringStyles.ts`
2. Import `BassArticulationType` from `@bassnotion/contracts`
3. Define `TECHNIQUE_COLORS` record
4. Define `EXTENDED_TECHNIQUE_COLORS` for future techniques

**Definition of Done:**
- [ ] All `BassArticulationType` values have a color mapping
- [ ] Colors match the values in Appendix A of this story
- [ ] Export is typed as `Record<BassArticulationType | 'normal', string>`
- [ ] No TypeScript errors

---

##### P1-1.1.4a: Create useRingOverlay hook (basic structure)
**Effort:** M (1 hour)
**Dependencies:** P1-1.1.2a, P1-1.1.3a
**Parallel:** No

**Steps:**
1. Create `overlays/useRingOverlay.ts`
2. Import `useHasPremiumAccess` from billing hooks
3. Define `FREE_ANIMATED_RING_TUTORIALS` array
4. Implement access control logic
5. Return config with access state

**Definition of Done:**
- [ ] Hook compiles without errors
- [ ] Hook correctly identifies premium vs free users
- [ ] Hook returns `config`, `hasAccess`, `hasFreeAccess`, `isPremium`
- [ ] Free tutorials list is configurable

---

##### P1-1.1.5a: Create fretboardTo3DCoords utility
**Effort:** M (1 hour)
**Dependencies:** P1-1.1.1a
**Parallel:** Yes - can run with P1-1.1.4a

**Steps:**
1. Create `overlays/utils/fretboardTo3DCoords.ts`
2. Implement `mapFretTo3DX(fret: number | 'open'): number`
3. Implement `mapStringTo3DZ(stringIndex: number): number`
4. Implement `get3DPosition(stringIndex, fret): [x, y, z]`
5. Add JSDoc with coordinate system explanation

**Definition of Done:**
- [ ] Fret 0 maps to X = -10, fret 24 maps to X = +10
- [ ] String 0 (G) maps to Z = -3, String 3 (E) maps to Z = +3
- [ ] Y is always 0 (animation handles Y)
- [ ] Unit tests pass for edge cases (open string, fret 24)

---

#### Task P1-1.2: Build Separate Canvas Overlay

##### P1-1.2.1a: Create Ring3DOverlayCanvas component shell
**Effort:** M (1 hour)
**Dependencies:** P1-1.1.1b
**Parallel:** No

**Steps:**
1. Create `overlays/Ring3DOverlayCanvas.tsx`
2. Import `Canvas` from `@react-three/fiber`
3. Define props interface with `fretboardRect`, `timeline`, `currentTime`, `config`
4. Return null if `fretboardRect` is null (guard)
5. Render empty `<Canvas>` with correct style props

**Definition of Done:**
- [ ] Component renders without errors
- [ ] Canvas has `position: absolute`, `pointerEvents: 'none'`
- [ ] Canvas has `zIndex: 30`
- [ ] TypeScript props interface is complete

---

##### P1-1.2.2a: Configure transparent WebGL context
**Effort:** S (30 min)
**Dependencies:** P1-1.2.1a
**Parallel:** No

**Steps:**
1. Add `gl={{ alpha: true }}` to Canvas
2. Add `style={{ background: 'transparent' }}`
3. Test that underlying 2D fretboard is visible through canvas

**Definition of Done:**
- [ ] Canvas background is fully transparent
- [ ] 2D fretboard dots are visible underneath
- [ ] No visual artifacts or color bleeding

---

##### P1-1.2.3a: Verify click passthrough
**Effort:** S (30 min)
**Dependencies:** P1-1.2.2a
**Parallel:** No

**Steps:**
1. Add test click handler to 2D fretboard dot
2. Verify clicks pass through 3D canvas to dot
3. Test on both desktop (mouse) and mobile (touch)

**Definition of Done:**
- [ ] Mouse clicks pass through to 2D fretboard
- [ ] Touch events pass through on mobile
- [ ] No pointer events captured by 3D canvas

---

##### P1-1.2.4a: Configure z-index layering
**Effort:** XS (15 min)
**Dependencies:** P1-1.2.1a
**Parallel:** Yes

**Steps:**
1. Verify fretboard dots have z-index: 20 (check existing CSS)
2. Set canvas z-index: 30
3. Test visual stacking order

**Definition of Done:**
- [ ] 3D canvas renders above 2D dots
- [ ] Ring will appear on top of dot highlighting
- [ ] z-index documented in code comment

---

##### P1-1.2.5a: Configure orthographic camera
**Effort:** M (1 hour)
**Dependencies:** P1-1.2.2a
**Parallel:** No

**Steps:**
1. Set camera position looking down: `[0, 15, 0]`
2. Set camera FOV: 50 (adjust for fretboard coverage)
3. Set near/far planes: 0.1, 100
4. Optionally switch to OrthographicCamera for better 2D alignment

**Definition of Done:**
- [ ] Camera sees entire fretboard area
- [ ] 3D coordinates map roughly to 2D positions
- [ ] No perspective distortion at edges (or acceptable distortion)

---

##### P1-1.2.6a: Add lighting setup
**Effort:** S (30 min)
**Dependencies:** P1-1.2.5a
**Parallel:** No

**Steps:**
1. Add `<ambientLight intensity={0.6} />`
2. Add `<pointLight position={[0, 10, 0]} intensity={0.5} />`
3. Test ring visibility with different emissive values

**Definition of Done:**
- [ ] Ring is clearly visible against transparent background
- [ ] Emissive glow is visible
- [ ] No harsh shadows or lighting artifacts

---

#### Task P1-1.3: Build Ring Components

##### P1-1.3.1a: Create FloatingTorusRing component shell
**Effort:** M (1 hour)
**Dependencies:** P1-1.2.6a
**Parallel:** No

**Steps:**
1. Create `overlays/FloatingTorusRing.tsx`
2. Define props interface
3. Create mesh ref with `useRef<THREE.Mesh>(null)`
4. Render `<mesh>` with `<torusGeometry>` and `<meshStandardMaterial>`
5. Use static position for initial testing

**Definition of Done:**
- [ ] Torus renders in 3D canvas
- [ ] Torus is visible (correct size, color)
- [ ] Component accepts note, currentTime, config props

---

##### P1-1.3.2a: Implement useFrame animation loop
**Effort:** M (1 hour)
**Dependencies:** P1-1.3.1a
**Parallel:** No

**Steps:**
1. Import `useFrame` from `@react-three/fiber`
2. Add useFrame callback
3. Update mesh position.y based on progress
4. Add gentle rotation for visual interest

**Definition of Done:**
- [ ] Ring animates smoothly at 60fps
- [ ] Animation uses delta time for frame-rate independence
- [ ] No jank or stuttering

---

##### P1-1.3.3a: Implement Y-axis descent animation
**Effort:** M (1 hour)
**Dependencies:** P1-1.3.2a
**Parallel:** No

**Steps:**
1. Calculate progress (0-1) based on currentTime vs note.startTime
2. Use `THREE.MathUtils.lerp` for smooth Y interpolation
3. Start Y at 5 (floating above)
4. End Y at 0.5 (just above fretboard surface)

**Definition of Done:**
- [ ] Ring descends from Y=5 to Y=0.5
- [ ] Descent is linear with progress (can add easing later)
- [ ] Ring arrives at Y=0.5 when progress = 1

---

##### P1-1.3.4a: Implement XZ movement to target
**Effort:** M (1 hour)
**Dependencies:** P1-1.3.3a, P1-1.1.5a
**Parallel:** No

**Steps:**
1. Use `get3DPosition` utility for target position
2. Lerp X toward target X
3. Lerp Z toward target Z
4. Tune lerp speed for smooth arrival

**Definition of Done:**
- [ ] Ring moves horizontally toward note position
- [ ] Ring arrives at correct XZ when progress = 1
- [ ] Movement is smooth, not jerky

---

##### P1-1.3.5a: Add emissive glow material
**Effort:** S (30 min)
**Dependencies:** P1-1.3.1a
**Parallel:** Yes - can run with P1-1.3.2a

**Steps:**
1. Set `color` prop on MeshStandardMaterial
2. Set `emissive` to same color
3. Set `emissiveIntensity` from config (default 0.5)
4. Set `transparent: true`, `opacity` based on ring index

**Definition of Done:**
- [ ] Ring has visible glow effect
- [ ] Glow intensity is configurable
- [ ] Opacity fades for further rings

---

##### P1-1.3.6a: Create RingOverlayGroup container
**Effort:** M (1 hour)
**Dependencies:** P1-1.3.1a
**Parallel:** No

**Steps:**
1. Create `overlays/RingOverlayGroup.tsx`
2. Accept timeline, currentTime, config, fretboardRect props
3. Filter upcoming notes within lookahead window
4. Map to `FloatingTorusRing` components with keys

**Definition of Done:**
- [ ] Container renders correct number of rings
- [ ] Rings filtered to lookahead window
- [ ] Keys use note index for stable identity
- [ ] useMemo used for performance

---

#### Task P1-1.4: 2D to 3D Coordinate Mapping

##### P1-1.4.1a: Get fretboard dimensions via ref
**Effort:** S (30 min)
**Dependencies:** P1-1.3.6a
**Parallel:** No

**Steps:**
1. Pass `fretboardRef` from FretboardCard to Ring3DOverlayCanvas
2. Call `getBoundingClientRect()` on ref
3. Pass rect to RingOverlayGroup

**Definition of Done:**
- [ ] Rect contains width, height, top, left
- [ ] Rect updates on resize
- [ ] Null guard prevents crash if ref not ready

---

##### P1-1.4.2a: Map fret positions to 3D X
**Effort:** S (30 min)
**Dependencies:** P1-1.1.5a
**Parallel:** Yes

**Steps:**
1. Fret 0 (nut) = X -10
2. Fret 24 = X +10
3. Linear interpolation: `x = ((fret / 24) * 20) - 10`
4. Handle 'open' string as fret 0

**Definition of Done:**
- [ ] Open string maps to X = -10
- [ ] Fret 12 maps to X = 0
- [ ] Fret 24 maps to X = +10

---

##### P1-1.4.3a: Map string indices to 3D Z
**Effort:** S (30 min)
**Dependencies:** P1-1.1.5a
**Parallel:** Yes

**Steps:**
1. String 0 (G string) = Z -3
2. String 3 (E string) = Z +3
3. Linear interpolation: `z = ((stringIndex / 3) * 6) - 3`

**Definition of Done:**
- [ ] G string (0) maps to Z = -3
- [ ] D string (1) maps to Z = -1
- [ ] A string (2) maps to Z = +1
- [ ] E string (3) maps to Z = +3

---

##### P1-1.4.4a: Calibrate camera FOV alignment
**Effort:** L (2 hours)
**Dependencies:** P1-1.4.2a, P1-1.4.3a, P1-1.2.5a
**Parallel:** No

**Steps:**
1. Place test ring at fret 0, string 0
2. Verify ring visually aligns with 2D dot at same position
3. Adjust camera FOV or position as needed
4. Test at fret 12, fret 24
5. Test all 4 strings

**Definition of Done:**
- [ ] Ring at [fret 0, string 0] aligns with 2D dot
- [ ] Ring at [fret 12, string 2] aligns with 2D dot
- [ ] Ring at [fret 24, string 3] aligns with 2D dot
- [ ] Alignment error < 5px visual offset

---

##### P1-1.4.5a: Handle fretboard resize
**Effort:** M (1 hour)
**Dependencies:** P1-1.4.4a
**Parallel:** No

**Steps:**
1. Add ResizeObserver to fretboard container
2. Update fretboardRect state on resize
3. Re-render canvas with new dimensions
4. Test by resizing browser window

**Definition of Done:**
- [ ] Rings reposition correctly on resize
- [ ] No jank during resize
- [ ] ResizeObserver cleaned up on unmount

---

#### Task P1-1.5: Timing Integration

##### P1-1.5.1a: Connect to useFretboardNoteSync
**Effort:** M (1 hour)
**Dependencies:** P1-1.3.6a
**Parallel:** No

**Steps:**
1. Import `useFretboardNoteSync` in FretboardCard (if not already)
2. Pass `timeline` array to Ring3DOverlayCanvas
3. Pass `currentTime` from transport
4. Verify timeline contains note timing data

**Definition of Done:**
- [ ] timeline prop contains NoteTimelineEntry[]
- [ ] currentTime updates at ~60fps
- [ ] Ring can access note.startTime, note.endTime

---

##### P1-1.5.2a: Implement calculateProgress function
**Effort:** M (1 hour)
**Dependencies:** P1-1.5.1a
**Parallel:** No

**Steps:**
1. Create pure function: `calculateProgress(note, currentTime, lookaheadMs)`
2. Calculate entry time: `note.startTime - (lookaheadMs / 1000)`
3. Return 0 if currentTime < entryTime
4. Return 1 if currentTime >= note.startTime
5. Return linear interpolation otherwise

**Definition of Done:**
- [ ] Progress = 0 when note just enters lookahead window
- [ ] Progress = 1 when currentTime = note.startTime
- [ ] Progress is clamped to [0, 1]
- [ ] Unit tests cover edge cases

---

##### P1-1.5.3a: Filter upcoming notes by lookahead
**Effort:** S (30 min)
**Dependencies:** P1-1.5.1a
**Parallel:** Yes

**Steps:**
1. Filter timeline to notes where startTime > currentTime
2. Filter to notes where startTime <= currentTime + lookaheadSec
3. Slice to first N notes (config.showUpcoming)

**Definition of Done:**
- [ ] Only notes within lookahead window are shown
- [ ] Max N rings rendered (performance)
- [ ] Filter runs in useMemo for performance

---

##### P1-1.5.4a: Handle note exit animation
**Effort:** M (1 hour)
**Dependencies:** P1-1.5.2a
**Parallel:** No

**Steps:**
1. When progress >= 1, ring should "hit" the target
2. Option A: Fade out opacity quickly
3. Option B: Scale down to 0
4. Remove ring from render after animation

**Definition of Done:**
- [ ] Ring visually "hits" the note position
- [ ] Ring disappears smoothly (not abruptly)
- [ ] No lingering rings after note ends

---

##### P1-1.5.5a: Skip rings during countdown
**Effort:** S (30 min)
**Dependencies:** P1-1.5.1a
**Parallel:** Yes

**Steps:**
1. Check if current time is in countdown phase
2. Get countdownBeats config from transport or playback state
3. If in countdown, render no rings (return empty)

**Definition of Done:**
- [ ] No rings appear during countdown beats
- [ ] Rings start appearing after countdown ends
- [ ] Smooth transition into first note

---

#### Task P1-1.6: Connect to FretboardCard

##### P1-1.6.1a: Add Ring3DOverlayCanvas to 2D mode
**Effort:** M (1 hour)
**Dependencies:** P1-1.2.6a, P1-1.3.6a
**Parallel:** No

**Steps:**
1. Open `FretboardCard.tsx`
2. Import `Ring3DOverlayCanvas` from `./overlays`
3. Add conditional render after `FretboardGrid` when `!is3DMode && showAnimatedRing`
4. Pass all required props

**Definition of Done:**
- [ ] Ring canvas renders in 2D mode
- [ ] Ring canvas does NOT render in 3D mode
- [ ] No TypeScript errors

---

##### P1-1.6.2a: Ensure container has relative positioning
**Effort:** XS (15 min)
**Dependencies:** P1-1.6.1a
**Parallel:** Yes

**Steps:**
1. Verify FretboardCard wrapper has `position: relative`
2. Add if missing
3. Test that absolute overlay positions correctly

**Definition of Done:**
- [ ] Ring canvas positions relative to fretboard container
- [ ] No layout shift when ring canvas mounts

---

##### P1-1.6.3a: Pass props through component chain
**Effort:** M (1 hour)
**Dependencies:** P1-1.6.1a, P1-1.5.1a
**Parallel:** No

**Steps:**
1. Create ref for FretboardGrid: `const fretboardRef = useRef(null)`
2. Pass ref to FretboardGrid
3. Pass fretboardRef.current to Ring3DOverlayCanvas
4. Pass timeline, currentTime, config

**Definition of Done:**
- [ ] All required props flow to Ring3DOverlayCanvas
- [ ] fretboardRect is available for coordinate mapping
- [ ] Props update correctly during playback

---

##### P1-1.6.4a: Disable ring overlay in 3D mode
**Effort:** S (30 min)
**Dependencies:** P1-1.6.1a
**Parallel:** Yes

**Steps:**
1. Add condition: `!is3DMode` before rendering Ring3DOverlayCanvas
2. Verify 3D fretboard mode has its own visuals
3. Test mode switching

**Definition of Done:**
- [ ] Ring overlay only appears in 2D mode
- [ ] Switching to 3D mode removes ring overlay
- [ ] No WebGL context conflicts

---

##### P1-1.6.5a: Add toggle in UI controls
**Effort:** M (1 hour)
**Dependencies:** P1-1.6.1a
**Parallel:** No

**Steps:**
1. Find tutorial settings panel (gear icon area)
2. Add toggle: "Guitar Hero Ring" or "Animated Ring"
3. Connect toggle to `showAnimatedRing` state
4. Persist preference (localStorage for now)

**Definition of Done:**
- [ ] Toggle appears in settings panel
- [ ] Toggle enables/disables ring overlay
- [ ] Preference persists across page reloads

---

##### P1-1.6.6a: Disable classic highlight when animated ring is ON
**Effort:** M (1 hour)
**Dependencies:** P1-1.6.1a
**Parallel:** No

**Steps:**
1. Add `disableClassicHighlight` prop to FretboardGrid
2. Pass `disableClassicHighlight={showAnimatedRing}`
3. In FretboardDot, skip `.note-active` class when `disableClassicHighlight` is true
4. Test that only one highlight system is active at a time

**Definition of Done:**
- [ ] Classic yellow ring hidden when animated ring is ON
- [ ] Classic yellow ring shows when animated ring is OFF
- [ ] No double-highlight visual

---

### Phase 2: Technique Colors - Detailed Subtasks

**Phase Duration:** 1 day
**Risk Level:** LOW
**Prerequisites:** Phase 1 complete

#### Task P2-2.1: Implement Technique Material System

##### P2-2.1.1a: Map BassArticulationType to colors
**Effort:** S (30 min)
**Dependencies:** P1-1.1.3a complete
**Parallel:** No

**Steps:**
1. Verify `ringStyles.ts` has all BassArticulationType values
2. Add any missing technique types
3. Ensure colors match TechniqueRenderer.tsx

**Definition of Done:**
- [ ] All 9 BassArticulationType values have colors
- [ ] Colors match existing 3D fretboard technique colors
- [ ] TypeScript enforces completeness

---

##### P2-2.1.2a: Detect technique from note data
**Effort:** M (1 hour)
**Dependencies:** P2-2.1.1a
**Parallel:** No

**Steps:**
1. In FloatingTorusRing, access `note.note?.technique`
2. Cast to `BassArticulationType | undefined`
3. Handle undefined as 'normal'
4. Add logging for debugging

**Definition of Done:**
- [ ] Technique detected from note data
- [ ] Undefined technique defaults to 'normal'
- [ ] Debug log shows detected technique

---

##### P2-2.1.3a: Apply dynamic color to material
**Effort:** S (30 min)
**Dependencies:** P2-2.1.2a
**Parallel:** No

**Steps:**
1. Get color from `TECHNIQUE_COLORS[technique]`
2. Apply to `color` prop
3. Apply to `emissive` prop

**Definition of Done:**
- [ ] Ring color matches technique
- [ ] Emissive matches ring color
- [ ] Color changes between notes

---

##### P2-2.1.4a: Add emissive intensity variation
**Effort:** S (30 min)
**Dependencies:** P2-2.1.3a
**Parallel:** No

**Steps:**
1. Define intensity map per technique (optional)
2. Ghost notes: lower intensity (0.2)
3. Accents: higher intensity (0.8)
4. Default: config.glowIntensity (0.5)

**Definition of Done:**
- [ ] Ghost notes appear dimmer
- [ ] Accents appear brighter
- [ ] Normal notes use default intensity

---

#### Task P2-2.2: Test All Techniques

##### P2-2.2.1a: Test hammer-on displays red
**Effort:** XS (15 min)
**Dependencies:** P2-2.1.3a
**Parallel:** Yes - all P2-2.2.x can run in parallel

**Steps:**
1. Load a tutorial/exercise with hammer-on notes
2. Verify ring is red (#FF6B6B)
3. Screenshot for documentation

**Definition of Done:**
- [ ] Hammer-on note shows red ring
- [ ] Color is clearly different from normal yellow

---

##### P2-2.2.2a: Test pull-off displays teal
**Effort:** XS (15 min)
**Dependencies:** P2-2.1.3a
**Parallel:** Yes

**Steps:**
1. Load a tutorial/exercise with pull-off notes
2. Verify ring is teal (#4ECDC4)

**Definition of Done:**
- [ ] Pull-off note shows teal ring

---

##### P2-2.2.3a: Test slides display blue
**Effort:** XS (15 min)
**Dependencies:** P2-2.1.3a
**Parallel:** Yes

**Steps:**
1. Test `slide-up` shows blue (#45B7D1)
2. Test `slide-down` shows blue (#45B7D1)

**Definition of Done:**
- [ ] Slide-up and slide-down both show blue

---

##### P2-2.2.4a: Test bend displays green
**Effort:** XS (15 min)
**Dependencies:** P2-2.1.3a
**Parallel:** Yes

**Steps:**
1. Load a tutorial/exercise with bend notes
2. Verify ring is green (#96CEB4)

**Definition of Done:**
- [ ] Bend note shows green ring

---

##### P2-2.2.5a: Test ghost-note displays dimmed
**Effort:** XS (15 min)
**Dependencies:** P2-2.1.3a
**Parallel:** Yes

**Steps:**
1. Load a tutorial/exercise with ghost notes
2. Verify ring is gray (#6B7280) and dimmer
3. Verify low emissive intensity

**Definition of Done:**
- [ ] Ghost note shows dim gray ring
- [ ] Clearly distinguishable from normal notes

---

##### P2-2.2.6a: Add config toggle for technique colors
**Effort:** S (30 min)
**Dependencies:** P2-2.2.1a through P2-2.2.5a
**Parallel:** No

**Steps:**
1. Add `techniqueColors` boolean to config
2. When false, use 'normal' color for all notes
3. Add toggle in settings UI

**Definition of Done:**
- [ ] User can disable technique-specific colors
- [ ] When disabled, all rings are yellow
- [ ] Preference persists

---

### Phase 3: Premium Gating - Detailed Subtasks

**Phase Duration:** 1 day
**Risk Level:** LOW
**Prerequisites:** Phase 1 complete (Phase 2 can run in parallel)

#### Task P3-3.1: Implement Access Control

##### P3-3.1.1a: Integrate useHasPremiumAccess hook
**Effort:** S (30 min)
**Dependencies:** P1-1.1.4a
**Parallel:** No

**Steps:**
1. Import `useHasPremiumAccess` from billing hooks
2. Destructure `isPremium` and `isLoading`
3. Handle loading state (show nothing or classic ring)

**Definition of Done:**
- [ ] Premium status correctly detected
- [ ] Loading state handled gracefully
- [ ] No flash of wrong content

---

##### P3-3.1.2a: Define free tutorial list
**Effort:** XS (15 min)
**Dependencies:** None
**Parallel:** Yes

**Steps:**
1. Define array: `FREE_ANIMATED_RING_TUTORIALS`
2. Add 3 tutorial slugs for teaser
3. Export from useRingOverlay or config

**Definition of Done:**
- [ ] 3 tutorials identified for free access
- [ ] Array is easily modifiable
- [ ] Documented which tutorials are free

---

##### P3-3.1.3a: Complete useRingOverlay access logic
**Effort:** M (1 hour)
**Dependencies:** P3-3.1.1a, P3-3.1.2a
**Parallel:** No

**Steps:**
1. Check if current tutorial is in free list
2. `hasFreeAccess = FREE_ANIMATED_RING_TUTORIALS.includes(tutorialSlug)`
3. `hasAccess = isPremium || hasFreeAccess`
4. Return all access flags

**Definition of Done:**
- [ ] Premium users have access everywhere
- [ ] Free users have access on 3 tutorials
- [ ] Access denied on other tutorials for free users

---

#### Task P3-3.2: Integrate with UI

##### P3-3.2.1a: Wrap toggle with access check
**Effort:** S (30 min)
**Dependencies:** P3-3.1.3a, P1-1.6.5a
**Parallel:** No

**Steps:**
1. Get `hasAccess` from useRingOverlay
2. If `!hasAccess`, disable toggle or show lock icon
3. Show tooltip explaining premium requirement

**Definition of Done:**
- [ ] Toggle disabled for non-premium users (except free tutorials)
- [ ] Visual indicator shows locked state
- [ ] Toggle works normally when access is granted

---

##### P3-3.2.2a: Add premium badge
**Effort:** S (30 min)
**Dependencies:** P3-3.2.1a
**Parallel:** No

**Steps:**
1. Add "Premium" badge next to toggle label
2. Style with gold/purple accent color
3. Only show when user doesn't have premium

**Definition of Done:**
- [ ] Badge clearly visible
- [ ] Badge hidden for premium users
- [ ] Badge matches app's premium styling

---

##### P3-3.2.3a: Trigger upsell modal
**Effort:** M (1 hour)
**Dependencies:** P3-3.2.1a
**Parallel:** No

**Steps:**
1. Import upsell modal or dialog component
2. On click when locked, show modal
3. Modal explains premium features
4. Modal has CTA to upgrade

**Definition of Done:**
- [ ] Modal appears when locked user clicks toggle
- [ ] Modal explains animated ring feature
- [ ] Modal has working upgrade button
- [ ] Modal can be dismissed

---

##### P3-3.2.4a: Auto-enable for free tutorials
**Effort:** S (30 min)
**Dependencies:** P3-3.1.3a
**Parallel:** No

**Steps:**
1. On page load, check if tutorial is in free list
2. If free and user hasn't disabled, enable animated ring
3. Show indicator that this is a "premium preview"

**Definition of Done:**
- [ ] Animated ring auto-enabled on free tutorials
- [ ] User can still toggle off if desired
- [ ] Preview indicator visible

---

#### Task P3-3.3: Persist User Preference

##### P3-3.3.1a: Store in localStorage
**Effort:** S (30 min)
**Dependencies:** P3-3.1.3a
**Parallel:** No

**Steps:**
1. On toggle change, save to localStorage
2. Key: `bassnotion:ringOverlay:config`
3. Store full config object as JSON

**Definition of Done:**
- [ ] Preference saved on change
- [ ] Preference loaded on mount
- [ ] Works for anonymous users

---

##### P3-3.3.2a: Load preference on mount
**Effort:** S (30 min)
**Dependencies:** P3-3.3.1a
**Parallel:** No

**Steps:**
1. In useRingOverlay init, check localStorage
2. Parse stored config
3. Merge with defaults

**Definition of Done:**
- [ ] Saved preference applied on page load
- [ ] Graceful handling of missing/corrupt data
- [ ] Defaults used when no saved preference

---

##### P3-3.3.3a: Sync with user profile (optional)
**Effort:** L (2 hours)
**Dependencies:** P3-3.3.1a, P3-3.3.2a
**Parallel:** No

**Steps:**
1. If user is logged in, save to user profile API
2. Merge server preference with local on login
3. Handle offline/online sync

**Definition of Done:**
- [ ] Preference syncs to server for logged-in users
- [ ] Preference available across devices
- [ ] Graceful fallback when offline

---

### Phase 4: Multiple Upcoming Notes - Detailed Subtasks

**Phase Duration:** 1-2 days
**Risk Level:** MEDIUM
**Prerequisites:** Phase 1 complete

#### Task P4-4.1: Track Multiple Notes

##### P4-4.1.1a: Get next N notes from timeline
**Effort:** S (30 min)
**Dependencies:** P1-1.5.3a
**Parallel:** No

**Steps:**
1. Already filtering in RingOverlayGroup
2. Adjust `config.showUpcoming` to control count
3. Default to 3 upcoming notes

**Definition of Done:**
- [ ] Correct number of notes returned
- [ ] Notes sorted by startTime
- [ ] Count configurable via settings

---

##### P4-4.1.2a: Apply opacity gradient
**Effort:** S (30 min)
**Dependencies:** P4-4.1.1a
**Parallel:** No

**Steps:**
1. Pass `ringIndex` to FloatingTorusRing
2. Calculate opacity: `Math.max(0.3, 1 - (ringIndex * 0.2))`
3. Apply to material opacity

**Definition of Done:**
- [ ] First ring (closest) is most opaque
- [ ] Further rings are progressively more transparent
- [ ] Minimum opacity is 0.3 (still visible)

---

##### P4-4.1.3a: Stagger Y start positions
**Effort:** S (30 min)
**Dependencies:** P4-4.1.1a
**Parallel:** Yes

**Steps:**
1. Calculate start Y based on ring index
2. `startY = 5 + (ringIndex * 2)` (further rings start higher)
3. All rings descend toward Y = 0.5

**Definition of Done:**
- [ ] Further rings start higher up
- [ ] Creates visual "highway" effect
- [ ] All rings arrive at same Y on hit

---

#### Task P4-4.2: Handle Edge Cases

##### P4-4.2.1a: Handle same position notes
**Effort:** M (1 hour)
**Dependencies:** P4-4.1.1a
**Parallel:** No

**Steps:**
1. Detect notes on same string/fret
2. Add small X offset for stacking
3. Or merge into single larger ring

**Definition of Done:**
- [ ] Notes on same position don't overlap confusingly
- [ ] User can distinguish multiple notes
- [ ] No z-fighting artifacts

---

##### P4-4.2.2a: Handle rapid sequences
**Effort:** M (1 hour)
**Dependencies:** P4-4.1.1a
**Parallel:** No

**Steps:**
1. Test with 16th note passages
2. Ensure rings don't pile up
3. May need to reduce showUpcoming for fast passages

**Definition of Done:**
- [ ] Fast passages don't cause visual overload
- [ ] Rings still readable at high tempos
- [ ] Performance maintained at 60fps

---

##### P4-4.2.3a: Smooth ring exit animation
**Effort:** M (1 hour)
**Dependencies:** P1-1.5.4a
**Parallel:** No

**Steps:**
1. When ring hits target (progress >= 1), trigger exit
2. Fade opacity to 0 over 100ms
3. Or scale down to 0
4. Remove from render after animation

**Definition of Done:**
- [ ] Rings don't disappear abruptly
- [ ] Exit animation is quick but visible
- [ ] Memory properly freed after exit

---

#### Task P4-4.3: Performance Optimization

##### P4-4.3.1a: Implement InstancedMesh for many rings
**Effort:** L (2 hours)
**Dependencies:** P4-4.1.1a
**Parallel:** No

**Steps:**
1. If >5 rings visible, switch to InstancedMesh
2. Create shared geometry and material
3. Update instance matrices in useFrame

**Definition of Done:**
- [ ] InstancedMesh used when >5 rings
- [ ] Draw calls reduced to 1 for all rings
- [ ] Visual appearance unchanged

---

##### P4-4.3.2a: Share geometry between instances
**Effort:** S (30 min)
**Dependencies:** P4-4.3.1a
**Parallel:** No

**Steps:**
1. Create `sharedTorusGeometry` once
2. Reuse for all ring instances
3. Store in useMemo or module scope

**Definition of Done:**
- [ ] Single geometry object for all rings
- [ ] Memory usage reduced
- [ ] No visual difference

---

##### P4-4.3.3a: Profile GPU performance
**Effort:** M (1 hour)
**Dependencies:** P4-4.3.1a, P4-4.3.2a
**Parallel:** No

**Steps:**
1. Enable Chrome DevTools Performance
2. Record with 10+ visible rings
3. Verify 60fps maintained
4. Check GPU memory usage

**Definition of Done:**
- [ ] 60fps with 10 rings visible
- [ ] No memory leaks over time
- [ ] GPU usage reasonable (<30% on desktop)

---

### Phase 5: Polish & Advanced Styles - Detailed Subtasks

**Phase Duration:** 2-3 days
**Risk Level:** LOW
**Prerequisites:** Phases 1-4 complete

#### Task P5-5.1: Implement Style Variants

##### P5-5.1.1a: Implement spotlight style
**Effort:** M (1 hour)
**Dependencies:** Phase 1 complete
**Parallel:** Yes - all P5-5.1.x can run in parallel

**Steps:**
1. High emissive intensity (0.8)
2. Simple torus, no descent animation
3. Just appears at note position

**Definition of Done:**
- [ ] Spotlight style clearly different from guitarHero
- [ ] High glow effect visible
- [ ] Style selectable in settings

---

##### P5-5.1.2a: Implement guitarHero style (default)
**Effort:** S (30 min) - Already implemented
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. This is the default implementation
2. Verify descent animation works
3. Document as default style

**Definition of Done:**
- [ ] guitarHero is the default style
- [ ] Full descent animation from Y=5 to Y=0.5
- [ ] Style documented

---

##### P5-5.1.3a: Implement pulse style
**Effort:** M (1 hour)
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. Add scale animation using sin wave
2. `scale = 1 + Math.sin(time * 4) * 0.2`
3. Pulse on beat subdivision

**Definition of Done:**
- [ ] Ring pulses rhythmically
- [ ] Pulse tempo matches music BPM
- [ ] Visual effect is subtle, not distracting

---

##### P5-5.1.4a: Implement trail style
**Effort:** L (2 hours)
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. Store previous N positions (trail length 5)
2. Render ghost meshes at previous positions
3. Decreasing opacity along trail

**Definition of Done:**
- [ ] Trail follows ring movement
- [ ] Trail fades toward tail
- [ ] Trail length configurable

---

##### P5-5.1.5a: Implement technique style
**Effort:** S (30 min) - Mostly done in Phase 2
**Dependencies:** Phase 2 complete
**Parallel:** Yes

**Steps:**
1. Enable technique colors
2. Same as Phase 2 implementation
3. Add as selectable style option

**Definition of Done:**
- [ ] Technique style is a named option
- [ ] Enables technique-specific colors
- [ ] Style selectable in settings

---

#### Task P5-5.2: Add Settings UI

##### P5-5.2.1a: Create style selector dropdown
**Effort:** M (1 hour)
**Dependencies:** P5-5.1.1a through P5-5.1.5a
**Parallel:** No

**Steps:**
1. Add dropdown/select in settings panel
2. Options: classic, spotlight, guitarHero, technique, pulse, trail
3. Show style name and brief description
4. Update config on change

**Definition of Done:**
- [ ] Dropdown shows all style options
- [ ] Selection updates ring style immediately
- [ ] Current selection persisted

---

##### P5-5.2.2a: Add lookahead slider
**Effort:** M (1 hour)
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. Add range slider: 1000ms to 4000ms
2. Default: 2000ms
3. Show current value in ms or seconds
4. Update config.lookaheadMs on change

**Definition of Done:**
- [ ] Slider controls lookahead time
- [ ] Ring appears earlier with higher value
- [ ] Reasonable min/max limits

---

##### P5-5.2.3a: Add animation speed control
**Effort:** S (30 min)
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. Add range slider: 0.5x to 2x
2. Default: 1x
3. Multiply animation delta by speed

**Definition of Done:**
- [ ] Speed affects animation smoothness
- [ ] 2x makes ring arrive faster (visually)
- [ ] Works correctly with timing

---

##### P5-5.2.4a: Add glow intensity slider
**Effort:** S (30 min)
**Dependencies:** Phase 1 complete
**Parallel:** Yes

**Steps:**
1. Add range slider: 0 to 1
2. Default: 0.5
3. Updates emissiveIntensity

**Definition of Done:**
- [ ] Glow adjustable from none to bright
- [ ] Real-time preview
- [ ] Preference saved

---

#### Task P5-5.3: Mobile Performance

##### P5-5.3.1a: Add quality settings
**Effort:** M (1 hour)
**Dependencies:** Phase 4 complete
**Parallel:** No

**Steps:**
1. Define quality levels: low, medium, high
2. Low: reduced geometry, basic material, fewer rings
3. Medium: standard settings
4. High: full quality, trails, effects

**Definition of Done:**
- [ ] Three quality levels available
- [ ] Each level has defined parameters
- [ ] Settings UI shows quality selector

---

##### P5-5.3.2a: Reduce geometry on low quality
**Effort:** S (30 min)
**Dependencies:** P5-5.3.1a
**Parallel:** No

**Steps:**
1. TorusGeometry args: (radius, tube, radialSegments, tubularSegments)
2. High: (0.6, 0.15, 16, 32)
3. Low: (0.6, 0.15, 8, 16)
4. Fewer segments = faster rendering

**Definition of Done:**
- [ ] Low quality uses fewer segments
- [ ] Visual still acceptable on low
- [ ] Performance improved on low-end devices

---

##### P5-5.3.3a: Use MeshBasicMaterial fallback
**Effort:** S (30 min)
**Dependencies:** P5-5.3.1a
**Parallel:** Yes

**Steps:**
1. On low quality, use MeshBasicMaterial
2. No lighting calculations needed
3. Still apply color and opacity

**Definition of Done:**
- [ ] BasicMaterial used on low quality
- [ ] Glow effect simulated with bright color
- [ ] Performance improved

---

##### P5-5.3.4a: Profile on target mobile devices
**Effort:** L (2 hours)
**Dependencies:** P5-5.3.1a, P5-5.3.2a, P5-5.3.3a
**Parallel:** No

**Steps:**
1. Test on iPhone 12 (Safari)
2. Test on Android mid-range (Chrome)
3. Verify 60fps or graceful degradation
4. Document device compatibility matrix

**Definition of Done:**
- [ ] 60fps on iPhone 12+
- [ ] 30fps minimum on older devices
- [ ] Auto-quality detection considered

---

### Parallel Work Opportunities

The following task groups can be worked on simultaneously by different developers:

#### Parallel Group A: Infrastructure (1 developer)
- P1-1.1.1a through P1-1.1.5a (folder structure, types, configs)
- Estimated: 4-5 hours

#### Parallel Group B: Canvas & Rendering (1 developer)
- P1-1.2.1a through P1-1.2.6a (Canvas setup)
- P1-1.3.1a through P1-1.3.6a (Ring components)
- Estimated: 6-8 hours
- **Dependency:** Needs P1-1.1.1b complete first

#### Parallel Group C: Coordinate Mapping (1 developer)
- P1-1.4.1a through P1-1.4.5a
- Can start after P1-1.1.5a complete
- Estimated: 4-5 hours

#### Parallel Group D: Integration (1 developer)
- P1-1.5.1a through P1-1.5.5a (Timing)
- P1-1.6.1a through P1-1.6.6a (FretboardCard)
- Needs Groups B and C complete
- Estimated: 5-6 hours

#### Phase 2 & 3 Parallelization
Phase 2 (Technique Colors) and Phase 3 (Premium Gating) can run in parallel after Phase 1:
- Developer 1: Phase 2 (all P2 tasks) - 4-5 hours
- Developer 2: Phase 3 (all P3 tasks) - 4-5 hours

#### Phase 5 Style Variants
All P5-5.1.x tasks (style implementations) can be parallelized:
- Each style variant is independent
- 5 developers could implement 5 styles simultaneously

---

### Critical Path (MVP)

The minimum set of tasks required for a functional MVP:

```
P1-1.1.1a → P1-1.1.1b → P1-1.1.2a → P1-1.2.1a → P1-1.2.2a → P1-1.2.5a → P1-1.2.6a
                                                    ↓
                                              P1-1.3.1a → P1-1.3.2a → P1-1.3.3a → P1-1.3.6a
                                                    ↓
P1-1.1.5a → P1-1.4.2a → P1-1.4.3a → P1-1.4.4a
                                                    ↓
P1-1.5.1a → P1-1.5.2a → P1-1.5.3a → P1-1.6.1a → P1-1.6.3a → P1-1.6.5a → P1-1.6.6a
```

**MVP Definition:**
- Single 3D ring descends toward current note position
- Ring arrives at note when note should play
- Toggle enables/disables animated ring (replaces classic highlight)
- Works in 2D mode only

**MVP Estimated Effort:** 2-3 days (1 developer)

**Not in MVP (can defer):**
- Technique colors (Phase 2)
- Premium gating (Phase 3)
- Multiple upcoming notes (Phase 4)
- Style variants (Phase 5)
- Mobile optimization (Phase 5)

---

### Task Dependency Diagram

```
Phase 1 Dependencies:
                        ┌─────────────┐
                        │ P1-1.1.1a   │ Create folders
                        └──────┬──────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ P1-1.1.1b   │     │ P1-1.1.2a   │     │ P1-1.1.3a   │
    │ index.ts    │     │ Config.ts   │     │ styles.ts   │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
           │                   └───────┬───────────┘
           │                           ▼
           │                    ┌─────────────┐
           │                    │ P1-1.1.4a   │ useRingOverlay
           │                    └─────────────┘
           │
           ▼
    ┌─────────────┐
    │ P1-1.2.1a   │ Canvas shell
    └──────┬──────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌─────────┐
│ 1.2.2a  │  │ 1.2.4a  │
│ alpha   │  │ z-index │
└────┬────┘  └────┬────┘
     │            │
     └─────┬──────┘
           ▼
    ┌─────────────┐
    │ P1-1.2.5a   │ Camera
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ P1-1.2.6a   │ Lighting
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ P1-1.3.1a   │ FloatingTorusRing
    └──────┬──────┘
           │
    ┌──────┴──────┬───────────┐
    ▼             ▼           ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ 1.3.2a  │  │ 1.3.5a  │  │ 1.3.6a  │
│ useFrame│  │ emissive│  │ Group   │
└────┬────┘  └─────────┘  └────┬────┘
     │                         │
     ▼                         │
┌─────────────┐                │
│ P1-1.3.3a   │ Y descent      │
└──────┬──────┘                │
       │                       │
       ▼                       │
┌─────────────┐                │
│ P1-1.3.4a   │ XZ movement    │
└──────┬──────┘                │
       │                       │
       └───────────┬───────────┘
                   │
                   ▼
            ┌─────────────┐
            │ P1-1.5.1a   │ Connect to noteSync
            └──────┬──────┘
                   │
            ┌──────┴──────┐
            ▼             ▼
     ┌─────────────┐ ┌─────────────┐
     │ P1-1.5.2a   │ │ P1-1.5.3a   │
     │ progress    │ │ filter      │
     └──────┬──────┘ └──────┬──────┘
            │              │
            └──────┬───────┘
                   │
                   ▼
            ┌─────────────┐
            │ P1-1.6.1a   │ Add to FretboardCard
            └──────┬──────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ 1.6.2a  │ │ 1.6.3a  │ │ 1.6.4a  │
  └────┬────┘ └────┬────┘ └────┬────┘
       │          │           │
       └──────────┼───────────┘
                  │
                  ▼
           ┌─────────────┐
           │ P1-1.6.5a   │ Toggle UI
           └──────┬──────┘
                  │
                  ▼
           ┌─────────────┐
           │ P1-1.6.6a   │ Disable classic
           └─────────────┘
                  │
                  ▼
           ═══════════════
           PHASE 1 COMPLETE
           ═══════════════
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌─────────────┐       ┌─────────────┐
│  PHASE 2    │       │  PHASE 3    │
│  Technique  │       │  Premium    │
│  Colors     │       │  Gating     │
└──────┬──────┘       └──────┬──────┘
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
           ┌─────────────┐
           │  PHASE 4    │
           │  Multiple   │
           │  Notes      │
           └──────┬──────┘
                  │
                  ▼
           ┌─────────────┐
           │  PHASE 5    │
           │  Polish     │
           └─────────────┘
```

---

## Testing Strategy

### Unit Tests (Required Per Phase)

| Phase | Tests |
|-------|-------|
| Phase 1 | `useRingOverlay.test.ts` - access control logic, config merging |
| Phase 1 | `calculateProgress.test.ts` - timing math edge cases |
| Phase 2 | `ringStyles.test.ts` - technique color mapping |
| Phase 3 | `useRingOverlay.test.ts` - premium gating logic |
| Phase 4 | `RingOverlayGroup.test.tsx` - multiple ring rendering |

### Integration Tests

| Test | Description |
|------|-------------|
| Ring appears on note | Verify ring descends to correct position at correct time |
| Ring uses correct color | Verify technique detection and color application |
| Premium gating works | Verify free vs premium access |
| 2D mode overlay | Verify ring overlay appears over 2D fretboard |
| 3D mode disabled | Verify ring toggle disabled when 3D fretboard mode is enabled |
| Click passthrough | Verify clicks pass through overlay to 2D fretboard dots |

### Performance Tests

| Metric | Target | Test Method |
|--------|--------|-------------|
| Frame rate | 60fps | Chrome DevTools Performance tab |
| Ring sync accuracy | <16ms | Compare ring arrival to audio timestamp |
| Memory | <50MB increase | Chrome Memory profiler |

---

## Database Changes

### User Settings (JSONB in existing user_settings or profiles table)
```sql
-- Add ring preferences to user_settings JSONB
-- Example structure:
{
  "ring_overlay": {
    "enabled": true,
    "style": "technique",
    "lookahead_ms": 2000,
    "show_upcoming": 3,
    "technique_colors": true,
    "glow_intensity": 0.5
  }
}
```

**Note:** Free animated ring tutorials are hardcoded in frontend (not database) for simplicity. Can move to database later if needed for admin control.

---

## Observability & Monitoring

### Metrics to Track

| Metric | Purpose | Implementation |
|--------|---------|----------------|
| `ring_overlay_enabled` | Feature adoption | Analytics event on toggle |
| `ring_overlay_style` | Style preference | Analytics with style value |
| `ring_3d_mode_auto_enabled` | UX flow tracking | When ring enables 3D mode |
| `ring_premium_upsell_shown` | Conversion tracking | When locked user tries to enable |
| `ring_premium_upsell_clicked` | Conversion tracking | When user clicks upsell CTA |

### Error Tracking

- WebGL context errors → Log to Sentry with device info
- Performance degradation → Log FPS drops below 30 with device/browser info

---

## Rollback Plan

### If Issues Arise After Deployment

1. **Feature Flag Disable:** Set `ring_overlay_enabled: false` globally via config
2. **Remove from FretboardCard:** Comment out `<Ring3DOverlayCanvas />` render in 2D mode
3. **Fallback to Classic:** Users continue seeing static CSS ring (existing behavior)

### Data Migration Rollback

No database migrations required - user preferences stored in JSONB can be ignored if feature disabled.

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **GPU performance on mobile** | HIGH | MEDIUM | Quality settings, MeshBasicMaterial fallback, reduce geometry segments |
| **Sync drift with audio** | HIGH | LOW | Reuse proven `useFretboardNoteSync` timing |
| **WebGL context limits** | MEDIUM | LOW | Single additional canvas (browsers support 8-16 contexts) |
| **2D→3D coordinate alignment** | MEDIUM | MEDIUM | Careful camera calibration, test with multiple fret positions |
| **Canvas resize handling** | MEDIUM | MEDIUM | Recalculate coordinates on resize, use ResizeObserver |
| **Style variant complexity** | MEDIUM | LOW | Start with guitarHero only, add others incrementally |
| **Premium gating edge cases** | LOW | MEDIUM | Use existing `useHasPremiumAccess` pattern |

---

## Success Metrics

1. **Performance:** 60fps animation on target devices (iPhone 12+, Chrome desktop)
2. **Accuracy:** Ring arrives at note position within 16ms of note start
3. **Adoption:** 50%+ of premium users enable animated ring within 30 days
4. **Conversion:** 10%+ of free users who see animated ring teaser convert to premium
5. **UX:** User can enable/disable animated ring in <3 clicks
6. **Retention:** Users with ring enabled have 20%+ higher session duration

---

## Dependencies

### Must Have Before Starting
- [x] `useFretboardNoteSync` working with timing data ✅ Verified
- [x] `PremiumGate` component functional ✅ Verified
- [x] `BassArticulationType` defined in contracts ✅ Verified
- [x] Fretboard3D rendering correctly ✅ Verified
- [x] Three.js, R3F, Drei in bundle ✅ Verified (v0.170.0, v9.1.4, v9.122.0)

### External Dependencies
- Three.js (already in bundle via Fretboard3D)
- React Three Fiber `@react-three/fiber` (already in bundle)
- React Three Drei `@react-three/drei` (already in bundle)
- WebGL 2.0 (browser native, widely supported)

---

## Timeline Summary

| Phase | Effort | Risk | Dependencies |
|-------|--------|------|--------------|
| Phase 1: Foundation | 2-3 days | 🟡 MEDIUM | None |
| Phase 2: Technique Colors | 1 day | 🟢 LOW | Phase 1 |
| Phase 3: Premium Gating | 1 day | 🟢 LOW | Phase 1 |
| Phase 4: Multiple Notes | 1-2 days | 🟡 MEDIUM | Phase 1 |
| Phase 5: Polish & Styles | 2-3 days | 🟢 LOW | Phases 1-4 |

**TOTAL ESTIMATE:** 7-10 days

---

## References

- [FretboardCard.tsx](../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard.tsx)
- [Fretboard3D.tsx](../../apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/FretboardCard/components/Fretboard3D.tsx) - Line 921 has existing Canvas
- [useFretboardNoteSync.ts](../../apps/frontend/src/domains/widgets/hooks/useFretboardNoteSync.ts)
- [fretboard-notes.css](../../apps/frontend/src/shared/styles/effects/fretboard-notes.css)
- [TechniqueRenderer.tsx](../../apps/frontend/src/domains/playback/components/FretboardVisualizer/components/TechniqueRenderer.tsx)
- [bass-articulation.ts](../../libs/contracts/src/types/bass-articulation.ts) - BassArticulationType definition
- [PremiumGate.tsx](../../apps/frontend/src/domains/billing/components/PremiumGate.tsx)
- [useBilling.ts](../../apps/frontend/src/domains/billing/hooks/useBilling.ts)

---

## Appendix A: Technique Color Reference

| Technique (BassArticulationType) | Hex Color | Visual |
|----------------------------------|-----------|--------|
| `normal` | `#FACC15` | 🟡 Yellow |
| `hammer-on` | `#FF6B6B` | 🔴 Red |
| `pull-off` | `#4ECDC4` | 🔵 Teal |
| `slide-up` | `#45B7D1` | 🔵 Blue |
| `slide-down` | `#45B7D1` | 🔵 Blue |
| `bend` | `#96CEB4` | 🟢 Green |
| `ghost-note` | `#6B7280` | ⚪ Gray (dim) |
| `accent` | `#EF4444` | 🔴 Bright Red |
| `trill` | `#22C55E` | 🟢 Green (lighter) |

---

## Appendix B: Ring Style Descriptions

| Style | Description | User Tier |
|-------|-------------|-----------|
| `classic` | Static yellow ring on current note (existing 2D behavior) | Free |
| `spotlight` | Simple torus with high emissive glow | Premium |
| `guitarHero` | Notes approach from above, descend to target | Premium |
| `technique` | Colors change based on technique type | Premium |
| `pulse` | Ring pulses on beat for rhythm feedback | Premium |
| `trail` | Ghost trail follows the ring | Pro |

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-01-05 | Claude Code | Initial story creation |
| 2025-01-05 | Claude Code | Added complete technical architecture |
| 2025-01-05 | Claude Code | Changed from Canvas 2D to 3D Three.js approach |
| 2026-01-05 | Claude Code (FAANG Review) | Fixed type to use `BassArticulationType` instead of custom `TechniqueType` |
| 2026-01-05 | Claude Code (FAANG Review) | Added timing integration details with `calculateProgress()` implementation |
| 2026-01-05 | Claude Code (FAANG Review) | Added countdown beats handling (rings should NOT show during countdown) |
| 2026-01-05 | Claude Code (FAANG Review) | Added Testing Strategy section with unit, integration, and performance tests |
| 2026-01-05 | Claude Code (FAANG Review) | Added Observability & Monitoring section with metrics and error tracking |
| 2026-01-05 | Claude Code (FAANG Review) | Added Rollback Plan section |
| 2026-01-05 | Claude Code | **RESTORED:** Original 2D overlay approach per user request |
| 2026-01-05 | Claude Code | Ring overlay uses SEPARATE Three.js canvas over 2D FretboardGrid |
| 2026-01-05 | Claude Code | Ring works in 2D mode (primary use case) - NOT requiring 3D mode |
| 2026-01-05 | Claude Code | Ring is DISABLED when 3D fretboard mode is enabled (3D has its own visuals) |
| 2026-01-05 | Claude Code | Added `Ring3DOverlayCanvas.tsx` component for separate canvas layer |
| 2026-01-05 | Claude Code | Added 2D→3D coordinate mapping (`fretboardTo3DCoords.ts`) |
| 2026-01-05 | Claude Code | Updated architecture diagram to show overlay on 2D fretboard |
| 2026-01-05 | Claude Code | Updated Phase 1 tasks for separate canvas approach |
