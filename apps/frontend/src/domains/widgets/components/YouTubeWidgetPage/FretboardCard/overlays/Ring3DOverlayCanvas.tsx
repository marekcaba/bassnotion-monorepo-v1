'use client';

/**
 * Ring3DOverlayCanvas - Main React Three Fiber Canvas Container
 *
 * This component renders a transparent Three.js canvas that overlays the 2D fretboard.
 * The canvas:
 * - Is positioned absolutely over the FretboardGrid
 * - Has a transparent background (gl={{ alpha: true }})
 * - Passes pointer events through to the 2D fretboard below
 * - Contains the RingOverlayGroup which manages individual rings
 *
 * Key architectural decisions:
 * 1. Separate canvas from main Fretboard3D to minimize WebGL context usage
 * 2. Lightweight scene with only rings (no fretboard geometry)
 * 3. Camera positioned looking down at the fretboard plane
 * 4. Only mounted when ring overlay is enabled AND in 2D mode
 * 5. Uses useFretboardNoteSync internally to build timeline from exerciseNotes
 *
 * @module Ring3DOverlayCanvas
 * @since Phase 1 - Foundation
 */

// =============================================================================
// DEBUG CONFIGURATION
// Toggle this to show/hide debug visualization for 3D canvas calibration
// =============================================================================
// PERFORMANCE: Set to false to eliminate ~50 mesh objects that cause frame drops
// Enable only when actively calibrating 3D/2D alignment
const DEBUG_OVERLAY = true; // TEMPORARILY ENABLED for visibility debugging

// =============================================================================
// 3D ALIGNMENT APPROACH - ARCHITECT'S SOLUTION
// =============================================================================
// The key insight: CSS perspective can be EXACTLY matched with Three.js!
//
// CSS perspective formula:
//   perspective: 800px means "virtual camera is 800px away from the screen"
//
// Three.js equivalent:
//   FOV = 2 * atan(canvasHeight / (2 * perspective))
//   Camera position Z = perspective value
//   Tilt is applied via SCENE rotation, not camera rotation
//
// This produces IDENTICAL projection to CSS perspective + rotateX!
// =============================================================================
const CSS_PERSPECTIVE = 800; // Must match the CSS perspective value in FretboardCard

// =============================================================================
// PERFORMANCE: Debug logging toggle
// Toggle from browser console: window.RING_DEBUG = true/false
// =============================================================================
if (typeof window !== 'undefined') {
  window.RING_DEBUG = window.RING_DEBUG ?? false;
}
// Helper to check debug flag - returns false during SSR
const isDebugEnabled = () =>
  typeof window !== 'undefined' && window.RING_DEBUG === true;

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
// Note: drei's Text component removed - it caused rendering failures due to font loading issues
// Using canvas-based texture approach instead for string labels
import * as THREE from 'three';

// =============================================================================
// GLOBAL CLIPPING PLANES - Used to clip 3D content to viewport bounds
// =============================================================================
// These planes are created once and updated dynamically based on scroll position.
// Left plane clips content on the left edge, right plane clips on the right edge.
// This achieves the same effect as CSS overflow:hidden but for WebGL content.
// =============================================================================
const globalClippingPlanes = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), // Left plane (clips -X side)
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), // Right plane (clips +X side)
];
import {
  useFretboardNoteSync,
  findNoteAtTime,
  type NoteTimelineEntry,
} from '@/domains/widgets/hooks/useFretboardNoteSync';
import { buildQuantizedTimeline } from '@/domains/widgets/utils/exerciseToMusicXML';
import { getAtomicPlaybackClock } from '@/domains/playback/services/core/AtomicPlaybackClock';
import { isVerboseDebugEnabled, verboseLog } from '@/config/debug';
import type { RingOverlayConfig } from './RingOverlayConfig.js';
import { OVERLAY_LIGHTING_CONFIG } from './RingOverlayConfig.js';
import { RingOverlayGroup } from './RingOverlayGroup.js';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import {
  type PlayheadConfig,
  DEFAULT_PLAYHEAD_CONFIG,
  playheadGlide,
  playheadPulse,
} from '@/domains/training-engine/equipment/scales/playheadConfig';

/** Max concentric rings in the playhead landing-ripple pool (config picks how many show). */
const MAX_RIPPLE_RINGS = 6;
/** Max ghost-ball notes in the anticipation runway pool (config picks how many show). */
const MAX_RUNWAY = 6;
/** Max static root-marker rings (one per root/octave dot visible on the neck). */
const MAX_ROOT_RINGS = 8;

/**
 * Custom perspective camera for 3D ring overlay.
 * Positioned to view the fretboard from the same angle as the CSS tilt.
 *
 * The 2D fretboard uses CSS rotateX(tiltAngle) with perspective to create
 * the tilted view. We need to match this by positioning the camera at
 * an equivalent angle in 3D space.
 */

// =============================================================================
// CSS-MATCHING PERSPECTIVE CAMERA (Architect's Solution)
// =============================================================================
// This camera produces IDENTICAL projection to CSS perspective!
//
// The math:
//   CSS: perspective: Npx means camera is N pixels from the screen
//   Three.js FOV = 2 * atan(canvasHeight / (2 * perspective))
//   Camera Z = perspective value (looking at origin)
//
// The tilt is applied via SCENE rotation (not camera), which matches CSS rotateX
// =============================================================================
interface CSSMatchingCameraProps {
  canvasHeight: number;
  cssPerspective: number;
  /** Fine-tune FOV offset in degrees (added to calculated value) */
  fovOffset?: number;
  /** Camera Y offset to adjust perspective vanishing point (affects top/bottom ratio when tilted) */
  cameraY?: number;
  /** Transition phase - triggers zoom animation on 'fading-in' */
  transitionPhase?: 'stable' | 'fading-out' | 'fading-in';
  /** Zoom animation duration in ms (default 1500) */
  zoomDuration?: number;
  /** How much to pull back the camera at start (multiplier, default 1.15 = 15% further) */
  pullBackMultiplier?: number;
  /**
   * When true, triggers zoom animation immediately on mount regardless of phase.
   * This bypasses the phase change detection and solves the race condition where
   * the component might mount when transitionPhase is already 'fading-in'.
   * Use this for the initial fretboard reveal sequence.
   */
  triggerZoomOnMount?: boolean;
}

function CSSMatchingCamera({
  canvasHeight,
  cssPerspective,
  fovOffset = 0,
  cameraY = 0,
  transitionPhase = 'stable',
  zoomDuration = 1500,
  pullBackMultiplier = 1.15,
  triggerZoomOnMount = false,
}: CSSMatchingCameraProps) {
  const { set, size } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Animation state - using ref to avoid re-renders during animation
  const animationRef = useRef({
    isAnimating: false,
    startTime: 0,
    startZ: cssPerspective * pullBackMultiplier,
    targetZ: cssPerspective,
  });
  const prevPhaseRef = useRef(transitionPhase);
  // Track if we've handled the triggerZoomOnMount to avoid re-triggering
  const hasTriggeredOnMountRef = useRef(false);

  // Handle triggerZoomOnMount - start animation immediately on mount
  // This bypasses the phase change detection and solves the race condition
  useEffect(() => {
    if (triggerZoomOnMount && !hasTriggeredOnMountRef.current) {
      hasTriggeredOnMountRef.current = true;
      // Start zoom animation immediately
      animationRef.current = {
        isAnimating: true,
        startTime: performance.now(),
        startZ: cssPerspective * pullBackMultiplier,
        targetZ: cssPerspective,
      };
      verboseLog(
        '[CSSMatchingCamera] 🎬 Starting zoom animation on mount (triggerZoomOnMount):',
        {
          startZ: cssPerspective * pullBackMultiplier,
          targetZ: cssPerspective,
          duration: zoomDuration,
        },
      );
    }
  }, [triggerZoomOnMount, cssPerspective, pullBackMultiplier, zoomDuration]);

  // Detect phase change to 'fading-in' to start zoom animation (normal exercise changes)
  useEffect(() => {
    // Skip if triggerZoomOnMount is active - that takes precedence
    if (triggerZoomOnMount && hasTriggeredOnMountRef.current) {
      prevPhaseRef.current = transitionPhase;
      return;
    }

    if (
      prevPhaseRef.current !== 'fading-in' &&
      transitionPhase === 'fading-in'
    ) {
      // Start zoom animation - camera zooms IN from pulled back position
      animationRef.current = {
        isAnimating: true,
        startTime: performance.now(),
        startZ: cssPerspective * pullBackMultiplier,
        targetZ: cssPerspective,
      };
      isDebugEnabled() &&
        verboseLog(
          '[CSSMatchingCamera] 🎬 Starting zoom animation (phase change):',
          {
            startZ: cssPerspective * pullBackMultiplier,
            targetZ: cssPerspective,
            duration: zoomDuration,
          },
        );
    }
    prevPhaseRef.current = transitionPhase;
  }, [
    transitionPhase,
    cssPerspective,
    pullBackMultiplier,
    zoomDuration,
    triggerZoomOnMount,
  ]);

  // Smooth animation with useFrame (60fps)
  useFrame(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const anim = animationRef.current;

    if (anim.isAnimating) {
      const elapsed = performance.now() - anim.startTime;
      const progress = Math.min(elapsed / zoomDuration, 1);

      // Ease-out cubic: 1 - (1 - t)^3 - starts fast, slows down
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate Z position (camera moves closer as it zooms in)
      const currentZ = anim.startZ + (anim.targetZ - anim.startZ) * eased;
      camera.position.z = currentZ;
      camera.updateProjectionMatrix();

      if (progress >= 1) {
        anim.isAnimating = false;
        isDebugEnabled() &&
          verboseLog('[CSSMatchingCamera] 🎬 Zoom animation complete');
      }
    }
  });

  // Initial camera setup
  useEffect(() => {
    if (cameraRef.current) {
      const camera = cameraRef.current;

      // If we're starting with zoom animation (fading-in phase or triggerZoomOnMount),
      // start camera pulled back so it can zoom in
      const shouldStartPulledBack =
        transitionPhase === 'fading-in' || triggerZoomOnMount;
      const initialZ = shouldStartPulledBack
        ? cssPerspective * pullBackMultiplier
        : cssPerspective;

      // Calculate FOV that matches CSS perspective
      // Formula: FOV = 2 * atan(canvasHeight / (2 * perspective))
      const fovRad = 2 * Math.atan(canvasHeight / (2 * cssPerspective));
      const calculatedFOV = (fovRad * 180) / Math.PI;
      const fovDeg = calculatedFOV + fovOffset; // Apply fine-tune offset

      // Position camera at Z = perspective (or pulled back), with optional Y offset
      // Y offset shifts the perspective vanishing point, affecting top/bottom ratio when tilted
      // This is equivalent to CSS perspective-origin Y offset
      camera.position.set(0, cameraY, initialZ);
      camera.fov = fovDeg;
      camera.aspect = size.width / size.height;
      camera.near = 1;
      camera.far = cssPerspective * 3; // Far enough to see tilted content

      // Look at target point (same Y offset to keep vanishing point consistent)
      camera.lookAt(0, cameraY, 0);
      camera.updateProjectionMatrix();
      set({ camera });

      isDebugEnabled() &&
        verboseLog('[CSSMatchingCamera] 📷 CSS-MATCHING CAMERA:', {
          cssPerspective,
          canvasHeight,
          cameraY,
          calculatedFOV: calculatedFOV.toFixed(2) + '°',
          fovOffset: fovOffset + '°',
          finalFOV: fovDeg.toFixed(2) + '°',
          position: { x: 0, y: cameraY, z: initialZ },
          aspect: camera.aspect.toFixed(2),
          transitionPhase,
          note: 'Tilt is applied via scene rotation, not camera. cameraY affects top/bottom perspective ratio.',
        });
    }
  }, [
    canvasHeight,
    cssPerspective,
    fovOffset,
    cameraY,
    set,
    size,
    transitionPhase,
    pullBackMultiplier,
    triggerZoomOnMount,
  ]);

  return <perspectiveCamera ref={cameraRef} near={1} far={2400} />;
}

// =============================================================================
// CLIPPING PLANES MANAGER - Enables and updates viewport clipping
// =============================================================================
// This component enables local clipping on the WebGL renderer and updates
// the clipping plane positions based on the viewport width and content scale.
//
// The clipping planes are in WORLD coordinates. Since the content is scaled
// by contentScale (1.30x), we need to widen the clipping boundaries to show
// the same amount of content as the 2D viewport.
//
// Additionally, we add extra margin to ensure edge content (like fret 12's
// rounded rectangle) is fully visible without being clipped.
// =============================================================================
interface ClippingPlanesManagerProps {
  viewportWidth: number;
  contentScale: number;
  sceneX: number;
  enabled?: boolean;
}

function ClippingPlanesManager({
  viewportWidth,
  contentScale,
  sceneX,
  enabled = true,
}: ClippingPlanesManagerProps) {
  const { gl } = useThree();

  useEffect(() => {
    // Enable local clipping on the renderer
    gl.localClippingEnabled = enabled;

    isDebugEnabled() &&
      verboseLog('[ClippingPlanesManager] 🔪 Clipping enabled:', {
        enabled,
        viewportWidth,
        contentScale,
        sceneX,
        rendererLocalClipping: gl.localClippingEnabled,
      });

    return () => {
      // Cleanup: disable clipping when unmounted
      gl.localClippingEnabled = false;
    };
  }, [gl, enabled]);

  useEffect(() => {
    // Calculate clipping plane positions in world coordinates
    // The viewport is 568px wide, centered at origin (0,0,0)
    // Content is scaled by contentScale (1.30x), so world coordinates are larger
    // We add significant margin to ensure fret 12 (at ~450px from left) is fully visible
    const baseHalfWidth = viewportWidth / 2;
    const scaledHalfWidth = baseHalfWidth * contentScale;
    const margin = 80 * contentScale; // Larger margin to include fret 12
    const halfWidth = scaledHalfWidth + margin;

    // Adjust for scene X offset
    const leftBound = -halfWidth + sceneX;
    const rightBound = halfWidth + sceneX;

    // Left clipping plane: clips everything with X < leftBound
    // Plane equation: normal.x * x + constant >= 0 means visible
    // normal = (1, 0, 0), constant = -leftBound → x - leftBound >= 0 → x >= leftBound
    globalClippingPlanes[0].constant = -leftBound;

    // Right clipping plane: clips everything with X > rightBound
    // normal = (-1, 0, 0), constant = rightBound → -x + rightBound >= 0 → x <= rightBound
    globalClippingPlanes[1].constant = rightBound;

    isDebugEnabled() &&
      verboseLog('[ClippingPlanesManager] 📐 Updated clipping planes:', {
        viewportWidth,
        contentScale,
        sceneX,
        baseHalfWidth,
        scaledHalfWidth,
        margin,
        halfWidth,
        leftBound,
        rightBound,
        leftPlane: `x >= ${leftBound}`,
        rightPlane: `x <= ${rightBound}`,
      });
  }, [viewportWidth, contentScale, sceneX]);

  return null;
}

// =============================================================================
// SCROLL SYNC MANAGER - Reads scroll position without React re-renders
// =============================================================================
// This component runs inside the Three.js render loop and reads scroll position
// directly from the DOM. It updates a shared ref that other components can read.
// This eliminates the need to pass scroll as a prop, avoiding React re-renders.
// =============================================================================
interface ScrollSyncManagerProps {
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  scrollLeftRef: React.MutableRefObject<number>;
}

function ScrollSyncManager({
  scrollContainerRef,
  scrollLeftRef,
}: ScrollSyncManagerProps) {
  // Read scroll position every frame without React re-render
  useFrame(() => {
    if (scrollContainerRef?.current) {
      scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    }
  });

  return null;
}

// =============================================================================
// SCROLL OFFSET GROUP - Moves 3D content to match scroll position
// =============================================================================
// This component wraps content and updates its position imperatively each frame
// based on the scroll position ref. This avoids React re-renders while keeping
// the 3D content synchronized with the 2D scrolling fretboard.
//
// SMOOTHING: Uses linear interpolation (lerp) to smooth scroll movement.
// This prevents visual stuttering caused by:
// 1. Discrete scroll values (scrollLeft is integer, no fractional pixels)
// 2. Frame timing mismatch between scroll events and render frames
// 3. Variable scroll event rates vs fixed render rate
//
// The lerp factor controls responsiveness:
// - Higher value (0.3-0.5) = more responsive but slightly choppy
// - Lower value (0.1-0.2) = smoother but more lag
// - Current: 0.25 balances smoothness with responsiveness
// =============================================================================
interface ScrollOffsetGroupProps {
  scrollLeftRef: React.MutableRefObject<number>;
  viewportWidth: number;
  fullContentWidth: number;
  children: React.ReactNode;
}

// =============================================================================
// SCROLL SMOOTHING CONFIGURATION
// =============================================================================
// The scroll smoothing uses exponential smoothing with delta-time compensation.
// This handles two problematic patterns observed in production:
//
// Pattern A: Alternating fast/slow frames (vsync/double-buffering)
//   - Browser batches scroll updates, delivering them in bursts
//   - Frame N: ~50ms with small scroll delta (2-5px)
//   - Frame N+1: ~2ms with large scroll delta (10-32px)
//
// Pattern B: Consistent slow frames (main thread blocking)
//   - React renders, API calls, etc. block the main thread
//   - Every frame is ~47-52ms with consistent scroll deltas
//
// Solution: Use exponential smoothing with:
// 1. Delta-time compensation to handle variable frame times
// 2. Minimum delta floor to prevent over-smoothing on burst frames
// 3. Mathematically correct exponential decay formula
// =============================================================================

// Smoothing time constant in milliseconds
// Higher = smoother but more lag, Lower = more responsive but can be jerky
// 50ms gives a good balance of responsiveness and smoothness
const SMOOTHING_TIME_CONSTANT = 50;

// Minimum delta time to use for calculations (prevents over-smoothing on burst frames)
const MIN_DELTA_TIME = 8; // ms - roughly half a frame at 60fps

// Debug: Track frame timing to detect dropped frames
// Toggle from browser console: window.SCROLL_DEBUG = true (logs only lag)
// Toggle from browser console: window.SCROLL_DEBUG_ALL = true (logs every frame)
const isScrollDebugEnabled = () =>
  typeof window !== 'undefined' && window.SCROLL_DEBUG === true;
const isScrollDebugAllEnabled = () =>
  typeof window !== 'undefined' && window.SCROLL_DEBUG_ALL === true;

function ScrollOffsetGroup({
  scrollLeftRef,
  viewportWidth,
  fullContentWidth,
  children,
}: ScrollOffsetGroupProps) {
  const groupRef = useRef<THREE.Group>(null);
  // Track the current smoothed position to interpolate toward target
  const currentPositionRef = useRef<number | null>(null);
  // Track timing for delta-time compensation
  const lastFrameTimeRef = useRef<number>(0);
  // Debug only
  const lastScrollLeftRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  // Update position every frame with smooth interpolation
  // Uses EXPONENTIAL SMOOTHING with delta-time compensation
  useFrame(() => {
    if (groupRef.current) {
      const now = performance.now();
      const scrollLeft = scrollLeftRef.current;

      // Calculate target scroll offset
      const targetOffset =
        viewportWidth / 2 - fullContentWidth / 2 - scrollLeft;

      // Calculate delta time with minimum floor to handle burst frames
      const rawDeltaTime =
        lastFrameTimeRef.current > 0 ? now - lastFrameTimeRef.current : 16.67;
      const deltaTime = Math.max(rawDeltaTime, MIN_DELTA_TIME);
      lastFrameTimeRef.current = now;

      // Debug: Detect frame drops and scroll jumps
      if (isScrollDebugEnabled() || isScrollDebugAllEnabled()) {
        frameCountRef.current++;
        const scrollDelta = Math.abs(scrollLeft - lastScrollLeftRef.current);
        const hasLag = rawDeltaTime > 20 || scrollDelta > 5;

        // Log if lag detected OR if SCROLL_DEBUG_ALL is enabled
        if (hasLag || isScrollDebugAllEnabled()) {
          verboseLog(
            hasLag
              ? '[ScrollOffsetGroup] 🔴 LAG:'
              : '[ScrollOffsetGroup] 🟢 OK:',
            {
              frame: frameCountRef.current,
              frameDeltaMs: rawDeltaTime.toFixed(1),
              scrollLeft,
              scrollDelta: scrollDelta.toFixed(1),
            },
          );
        }

        lastScrollLeftRef.current = scrollLeft;
      }

      // Initialize current position on first frame
      if (currentPositionRef.current === null) {
        currentPositionRef.current = targetOffset;
        groupRef.current.position.x = targetOffset;
        return;
      }

      // =============================================================================
      // EXPONENTIAL SMOOTHING WITH DELTA-TIME COMPENSATION
      // =============================================================================
      // Standard exponential smoothing: newPos = currentPos + (target - currentPos) * alpha
      // where alpha = 1 - e^(-deltaTime / timeConstant)
      //
      // This formula ensures consistent smoothing regardless of frame rate:
      // - At 60fps (16.67ms): alpha ≈ 0.28
      // - At 30fps (33.33ms): alpha ≈ 0.49
      // - At 20fps (50ms):    alpha ≈ 0.63
      //
      // The time constant (τ) determines how quickly we approach the target:
      // - After τ ms, we're at ~63% of the way to target
      // - After 2τ ms, we're at ~86% of the way
      // - After 3τ ms, we're at ~95% of the way
      // =============================================================================
      const alpha = 1 - Math.exp(-deltaTime / SMOOTHING_TIME_CONSTANT);

      const currentX = currentPositionRef.current;
      const diff = targetOffset - currentX;

      // If very close to target, snap to avoid infinite tiny movements
      if (Math.abs(diff) < 0.05) {
        currentPositionRef.current = targetOffset;
        groupRef.current.position.x = targetOffset;
      } else {
        // Apply exponential smoothing
        const newX = currentX + diff * alpha;
        currentPositionRef.current = newX;
        groupRef.current.position.x = newX;
      }
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

/**
 * Exercise note input interface for building timeline.
 * Matches the format from FretboardCard.
 */
interface ExerciseNoteInput {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  duration?: string;
  durationTicks?: number;
  position?: {
    measure?: number;
    beat?: number;
    subdivision?: number;
    tick?: number;
  };
  finger_index?: 1 | 2 | 3 | 4 | 'O'; // Finger number for this note (O=open string)
}

/**
 * Props for the Ring3DOverlayCanvas component.
 */
export interface Ring3DOverlayCanvasProps {
  /** Reference to the fretboard container for sizing */
  fretboardRef?: React.RefObject<HTMLDivElement>;
  /** Exercise notes to build timeline from */
  exerciseNotes: ExerciseNoteInput[];
  /** Current playback time in seconds */
  currentTime: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Ring overlay configuration */
  config: RingOverlayConfig;
  /** Number of strings on the fretboard */
  stringCount?: 4 | 5 | 6;
  /** Maximum fret number */
  maxFrets?: number;
  /** Override the rendered viewport width (px). Default 580 (shows ~fret 12).
   *  Widen it to show MORE frets — used by the gym equipment fretboard tools. */
  viewportWidthOverride?: number;
  /** When true, ALL exercise-note positions render as lit scale dots (the whole
   *  scale shape visible at once), with the active note still emphasized — instead
   *  of the tutorial's moving-lookahead window (only the next ~2 notes lit). Used by
   *  the gym Scales tool. Default false → tutorial behavior unchanged. */
  showAllNotes?: boolean;
  /** Root-note positions (1-based string + fret). In showAllNotes mode these paint a
   *  DARKER green than the rest of the scale so the home note stands out. Scales-tool
   *  only; the tutorial passes nothing. */
  rootPositions?: Array<{ string: number; fret: number }>;
  /** GYM PLAYHEAD: the sequencer's live position in beats (null when not playing) + the
   *  played note sequence (string/fret + startBeat). The canvas glides an orange sphere
   *  along it on its OWN clock (the gym doesn't run the AtomicPlaybackClock). */
  getPlaybackBeat?: () => number | null;
  playheadNotes?: Array<{ string: number; fret: number; startBeat: number }>;
  /** Loop length in beats — for gliding the playhead across the loop seam (last → first). */
  loopBeats?: number;
  /** Playhead sphere appearance + animation config (size/color/anim/bezier). */
  playheadConfig?: PlayheadConfig;
  /** Number of countdown beats (to exclude from rings) */
  countdownBeats?: number;
  /** Tempo in BPM */
  tempo?: number;
  /** Tilt angle of the 2D fretboard (degrees) - 3D camera will match this */
  tiltAngle?: number;
  /** DEBUG: Full XYZ rotation for calibration */
  debugRotation?: { x: number; y: number; z: number };
  /** DEBUG: 3D Overlay-specific calibration controls */
  overlay3DConfig?: {
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    offsetX: number;
    offsetY: number;
    // NEW: Scene position controls (in pixels, matching CSS coordinate system)
    sceneX: number;
    sceneY: number;
    sceneZ: number;
    // NEW: Camera controls
    cameraDistance: number;
    fovOffset: number;
    // NEW: Transform origin (pivot point for rotations)
    originX: number;
    originY: number;
    // NEW: Content scale for fine-tuning 3D/2D size match
    contentScale: number;
    // NEW: Independent X scale for fixing horizontal stretch (perspective distortion)
    contentScaleX?: number;
    // NEW: Independent Y scale for fixing vertical stretch (perspective distortion)
    contentScaleY?: number;
    // NEW: Camera Y offset to adjust perspective vanishing point (affects top/bottom ratio)
    cameraY: number;
    // NEW: Perspective multiplier - scales how much perspective effect applies when tilted
    // 1.0 = normal, <1.0 = less perspective (top/bottom more equal), >1.0 = more perspective
    perspectiveMultiplier?: number;
    // NEW: Top edge width scale - scales X width of dots near the top of fretboard
    // 1.0 = no change, <1.0 = narrower top edge, >1.0 = wider top edge
    topEdgeScale?: number;
    // NEW: Bottom edge width scale - scales X width of dots near the bottom of fretboard
    // 1.0 = no change, <1.0 = narrower bottom edge, >1.0 = wider bottom edge
    bottomEdgeScale?: number;
    // NEW: Positioning mode for 3D dots - determines how dots are placed relative to tilt
    // 'flat' = original approach (dots at Z=0, scene rotation handles tilt)
    // 'tilted-plane' = dots placed ON an actual tilted plane in 3D
    // 'screen-space' = dots positioned to match CSS-transformed screen positions
    positioningMode?: 'flat' | 'tilted-plane' | 'screen-space';
    // NEW: Tilt axis offset - slides content along the tilted plane axis
    // Positive = slide toward top (away from camera), Negative = toward bottom
    tiltAxisOffset?: number;
    // NEW: Tilt axis X offset - slides content left/right on the tilted plane
    tiltAxisOffsetX?: number;
    // Edge fade zone settings (percentage of viewport width)
    leftFadeZone?: number; // 0-20%, default 8% when scrolled
    rightFadeZone?: number; // 0-20%, default 8%
    // Tilt angle for the edge fade mask (independent of fretboard tilt for fine-tuning)
    fadeTiltAngle?: number; // Defaults to match fretboard tilt (DEPRECATED - use fadeEdgeAngle instead)
    // Fade edge angle - controls the angle of the fade edge lines toward vanishing point
    // Positive = edges angle inward (toward center/vanishing point)
    // 0 = vertical edges (no perspective)
    // Range: 0-45 degrees
    fadeEdgeAngle?: number;
    // Yellow active ring controls
    activeRingZOffset?: number; // Z offset above the dot (default 1)
    activeRingRadius?: number; // Outer radius of ring (default 15)
    activeRingTubeRadius?: number; // Thickness of the tube (default 1.5)
    // Active dot color (currently playing note)
    activeDotColor?: string; // Hex color string (default '#3b82f6')
    // Active ring color (yellow ring indicator)
    activeRingColor?: string; // Hex color string (default '#facc15')
    // Bloom post-processing controls
    bloomEnabled?: boolean; // Enable/disable bloom (default true)
    bloomIntensity?: number; // Bloom brightness 0-2 (default 0)
    bloomThreshold?: number; // Luminance threshold 0-1 (default 1)
    // Finger label positioning (for default view adjustment)
    fingerLabelOffsetX?: number; // X offset from dot center (default 0)
    fingerLabelOffsetY?: number; // Y offset from dot center (default 0)
  };
  /** DEPRECATED: Use scrollContainerRef instead for better performance */
  scrollLeft?: number;
  /** Reference to scroll container - reads scroll position without causing React re-renders */
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  /** Exercise ID for detecting exercise changes (used for fade transitions) */
  exerciseId?: string | null;
  /** Fade opacity controlled by parent for exercise transitions (0-1) */
  fadeOpacity?: number;
  /** Fade transition duration in ms (default 500) */
  fadeDuration?: number;
  /** Transition phase from useSnapshotTransition - triggers camera zoom on 'fading-in' */
  transitionPhase?: 'stable' | 'fading-out' | 'fading-in';
  /**
   * When true, triggers zoom animation immediately on mount regardless of phase.
   * This bypasses the phase change detection and solves the race condition where
   * the component might mount when transitionPhase is already 'fading-in'.
   * Use this for the initial fretboard reveal sequence.
   */
  triggerZoomOnMount?: boolean;
}

// Stable time signature reference to avoid timeline rebuilds
const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 } as const;

/**
 * Debug visualization component for calibrating 3D overlay alignment.
 *
 * ARCHITECT'S SOLUTION: Uses PIXEL coordinates!
 * The CSS-matching camera is at Z=800px looking at origin, with FOV calculated
 * to match CSS perspective. So all 3D objects should be positioned in pixel units.
 *
 * Coordinate system:
 * - Origin (0,0,0) = CENTER of the canvas
 * - X = horizontal (right is positive)
 * - Y = vertical (up is positive) - this is the "height above fretboard" axis
 * - Z = depth (towards camera is positive, but scene is rotated so we work in Y)
 */
interface DebugVisualizationProps {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
  contentWidth: number; // FULL content width (all frets) - used for centering calculations
  contentHeight: number; // Content height (fixed 290px)
  tiltAngle: number; // CSS rotateX angle in degrees
  cssPerspective: number; // CSS perspective value in pixels
  positioningMode: 'flat' | 'tilted-plane' | 'screen-space'; // Which approach to use
  tiltAxisOffset: number; // Slides content along the tilted plane Y axis (in pixels)
  tiltAxisOffsetX: number; // Slides content along the tilted plane X axis (in pixels)
  perspectiveMultiplier: number; // Scales perspective effect - <1 = less perspective, >1 = more
  topEdgeScale: number; // Scales X width at top edge - <1 = narrower, >1 = wider
  bottomEdgeScale: number; // Scales X width at bottom edge - <1 = narrower, >1 = wider
  scrollLeftRef: React.MutableRefObject<number>; // PERFORMANCE: Ref to scroll position (no re-renders)
  viewportWidth: number; // Viewport width (568px) for edge fade calculation
  // NEW: Highlighted dots with time-based gradient lookahead
  exerciseNotes: ExerciseNoteInput[]; // Exercise notes array for timeline building
  tempo: number; // BPM for timing calculations
  isPlaying: boolean; // Playback state for enabling updates
  showAllNotes?: boolean; // light the WHOLE scale at once (gym Scales tool), not lookahead
  rootPositions?: Array<{ string: number; fret: number }>; // roots → darker green
  getPlaybackBeat?: () => number | null; // gym playhead clock (beats)
  playheadNotes?: Array<{ string: number; fret: number; startBeat: number }>; // glide path
  loopBeats?: number; // loop length (beats) for seam glide
  playheadConfig?: PlayheadConfig; // sphere appearance + animation
  countdownBeats?: number; // Countdown beats before exercise starts (default 4)
  // Yellow active ring customization
  activeRingZOffset?: number; // Z offset above the dot (default 1)
  activeRingRadius?: number; // Outer radius of ring (default 15)
  activeRingTubeRadius?: number; // Thickness of the tube (default 1.5)
  // Active dot color (currently playing note)
  activeDotColor?: string; // Hex color string (default '#3b82f6')
  // Active ring color (yellow ring indicator)
  activeRingColor?: string; // Hex color string (default '#facc15')
  // Finger label positioning (for default view adjustment)
  fingerLabelOffsetX?: number; // X offset from dot center (default 0)
  fingerLabelOffsetY?: number; // Y offset from dot center (default 0)
}

/**
 * Creates a rounded rectangle shape for Three.js ShapeGeometry
 * Used for open string and fret 12 dots to match 2D rounded-md style
 */
function createRoundedRectShape(
  width: number,
  height: number,
  radius: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2); // Clamp radius to half of smallest dimension

  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

/**
 * Convert ExerciseNote string number to fretboard stringIndex
 *
 * This matches the logic in useFretboardNoteSync.ts:noteStringToFretboardIndex
 *
 * Exercise strings are 1-based (1=highest pitch played string):
 * - 4-string: E(1), A(2), D(3), G(4)
 * - 5-string: B(1), E(2), A(3), D(4), G(5)
 *
 * Fretboard visual layout (top to bottom): G, D, A, E, B
 * - Index 0 = G (top), Index 1 = D, Index 2 = A, Index 3 = E, Index 4 = B
 *
 * So string 1 (E on 4-string) should map to visual index 3 (E row)
 * And string 4 (G on 4-string) should map to visual index 0 (G row)
 */
function noteStringToVisualIndex(
  noteString: number,
  stringCount: number,
): number {
  // Visual index increases from top (G=0) to bottom (B/E)
  // Note string increases from highest pitch played (E=1 on 4-string) to lowest
  // For 4-string: string 1->index 3, string 2->index 2, string 3->index 1, string 4->index 0
  // For 5-string: string 1->index 4, string 2->index 3, string 3->index 2, string 4->index 1, string 5->index 0
  return stringCount - noteString;
}

/**
 * DebugVisualization - Shows 3D dots for calibration with different positioning modes:
 *
 * 'flat': Current approach - dots at Z=0, scene rotated (doesn't match CSS)
 * 'tilted-plane': Option 1 - dots placed ON an actual tilted plane in 3D space
 * 'screen-space': Option 4 - dots positioned to match CSS-transformed screen positions
 */
function DebugVisualization({
  stringCount,
  maxFrets,
  contentWidth,
  contentHeight,
  tiltAngle,
  cssPerspective,
  positioningMode = 'flat',
  tiltAxisOffset = 0,
  tiltAxisOffsetX = 0,
  perspectiveMultiplier = 1.0,
  topEdgeScale = 1.0,
  bottomEdgeScale = 1.0,
  scrollLeftRef,
  viewportWidth = 568,
  exerciseNotes,
  tempo,
  isPlaying,
  showAllNotes = false,
  rootPositions,
  getPlaybackBeat,
  playheadNotes,
  loopBeats,
  playheadConfig = DEFAULT_PLAYHEAD_CONFIG,
  countdownBeats = 4,
  activeRingZOffset = -1,
  activeRingRadius = 13,
  activeRingTubeRadius = 1,
  activeDotColor = '#3b82f6',
  activeRingColor = '#facc15',
  fingerLabelOffsetX = 0,
  fingerLabelOffsetY = 0,
}: DebugVisualizationProps) {
  // PERFORMANCE FIX: Disable fade effect to prevent re-renders
  // The 3D overlay now doesn't use scroll position at all during React render.
  // This eliminates scroll-triggered re-renders that were causing stuttering.
  //
  // The fade effect is DISABLED for now - all elements render at full opacity.
  // To re-enable: implement proper imperative material updates via useFrame
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void scrollLeftRef; // Keep the prop for future use

  // =============================================================================
  // HIGHLIGHTED DOTS CONFIGURATION - Time-based gradient lookahead
  // =============================================================================
  // Visual behavior:
  // - GREEN color for currently playing note (with yellow ring)
  // - BLUE color for next/preview note (with orange ring)
  // - GREY color for all other positions
  // - Gradient lookahead DISABLED - only current + preview visible
  // =============================================================================
  const LOOKAHEAD_CONFIG = {
    lookaheadTimeMs: 2000, // 2 seconds ahead
    maxVisibleNotes: 2, // 2 upcoming notes (preview + one more)
    opacityLevels: [1.0, 1.0, 0.8], // Active 100%, preview 100%, third note 80%
  };

  // Convert hex color strings to numbers (e.g., '#3b82f6' -> 0x3b82f6)
  const activeDotColorHex = parseInt(activeDotColor.replace('#', ''), 16);
  const activeRingColorHex = parseInt(activeRingColor.replace('#', ''), 16);

  const DOT_COLORS = {
    BLUE: activeDotColorHex, // Currently playing note (from prop, default blue)
    GREEN: 0x16a34a, // Preview/next note (green-600, darker)
    GREEN_DARK: 0x14532d, // Scale ROOT note (green-900) — the home note stands out
    GREEN_DIM: 0x1d3a2a, // Out-of-window scale note while playing — a SOLID muted green (not
    // a low-opacity fade); dim enough to recede but the mesh stays opaque (no see-through).
    GREEN_DIM_ROOT: 0x0f2a1c, // Dim version of the root's dark green (keeps roots distinct).
    GREY: 0x475569, // Regular fret positions (slate-600)
    GREY_LIGHT: 0x64748b, // Marker frets: open, 3, 5, 7, 9, 12, 15, 17, 19, 21 (slate-500)
    ACTIVE_RING: activeRingColorHex, // Ring color (from prop)
    PREVIEW_RING: 0xfacc15, // Yellow-400 for next note preview ring
  };

  // Marker frets that should be lighter grey (matching 2D fretboard)
  const MARKER_FRETS = new Set(['open', 3, 5, 7, 9, 12, 15, 17, 19, 21]);

  // =============================================================================
  // TIMELINE AND POSITION MAPPING - Built once from exercise notes
  // =============================================================================
  // Build the quantized timeline from exercise notes for visual synchronization.
  // Also create a position-to-notes mapping for quick lookup during useFrame.
  // =============================================================================

  // Build the quantized timeline with proper countdown offset
  const timeline = useMemo<NoteTimelineEntry[]>(() => {
    if (!exerciseNotes || exerciseNotes.length === 0) {
      return [];
    }

    // Build timeline using the shared utility (accepts options object)
    // Create a map to preserve finger_index by note index
    const fingerIndexMap = new Map<number, 1 | 2 | 3 | 4 | 'O' | undefined>();
    exerciseNotes.forEach((note, idx) => {
      fingerIndexMap.set(idx, note.finger_index);
    });

    // DEBUG: Log finger_index values from exercise notes
    const notesWithFinger = exerciseNotes.filter(
      (n) => n.finger_index !== undefined,
    );
    verboseLog('[FINGER-DEBUG] Exercise notes with finger_index:', {
      totalNotes: exerciseNotes.length,
      notesWithFinger: notesWithFinger.length,
      fingerIndexValues: notesWithFinger.map((n) => ({
        string: n.string,
        fret: n.fret,
        finger: n.finger_index,
      })),
    });

    const quantizedEntries = buildQuantizedTimeline({
      notes: exerciseNotes.map((note) => ({
        string: note.string,
        fret: note.fret,
        duration: note.duration,
        durationTicks: note.durationTicks,
        position: note.position,
      })),
      bpm: tempo,
      timeSignature: { numerator: 4, denominator: 4 },
      countdownBeats: countdownBeats,
    });

    // Convert QuantizedTimelineEntry to NoteTimelineEntry format
    // The buildQuantizedTimeline already returns entries with proper timing
    return quantizedEntries.map(
      (entry): NoteTimelineEntry => ({
        type: entry.type,
        startTime: entry.startTime,
        endTime: entry.endTime,
        position: {
          // Convert 1-based string number to visual stringIndex (0=top G, 3=bottom E for 4-string)
          stringIndex: noteStringToVisualIndex(
            entry.note?.string ?? 1,
            stringCount,
          ),
          fret: entry.note?.fret ?? 0,
        },
        noteIndex: entry.noteIndex,
        note: entry.note
          ? {
              string: entry.note.string as 1 | 2 | 3 | 4 | 5 | 6,
              fret: entry.note.fret,
              duration: entry.note.duration,
              durationTicks: entry.note.durationTicks,
              position: entry.note.position,
              finger_index: fingerIndexMap.get(entry.noteIndex), // Preserve finger_index
            }
          : undefined,
        measure: entry.measure,
        durationBeats: entry.durationBeats,
      }),
    );
  }, [exerciseNotes, tempo, countdownBeats, stringCount]);

  // Create a mapping from position key (stringIndex,fret) to notes at that position
  // This enables O(1) lookup in useFrame for each dot position
  const positionToNotes = useMemo(() => {
    const mapping = new Map<string, NoteTimelineEntry[]>();

    timeline
      .filter((entry) => entry.type === 'note')
      .forEach((entry) => {
        const key = `${entry.position.stringIndex},${entry.position.fret}`;
        if (!mapping.has(key)) {
          mapping.set(key, []);
        }
        mapping.get(key)!.push(entry);
      });

    return mapping;
  }, [timeline]);

  // Root-note position keys ("visualStringIndex,fret"), same format as positionToNotes,
  // so calculateDotState can paint roots a darker green. Built from the 1-based
  // rootPositions prop via the same string→visual-index conversion used for the timeline.
  const rootPositionKeys = useMemo(() => {
    const keys = new Set<string>();
    (rootPositions ?? []).forEach(({ string, fret }) => {
      keys.add(`${noteStringToVisualIndex(string, stringCount)},${fret}`);
    });
    return keys;
  }, [rootPositions, stringCount]);

  // =============================================================================
  // DOT MESH REFS - Store references to each dot mesh for useFrame updates
  // =============================================================================
  // Using a Map to store refs by position key, allowing direct material updates
  // without causing React re-renders.
  // =============================================================================
  const dotMeshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // Active ring refs - circular for regular frets, rounded rect for open/fret 12
  const activeRingRef = useRef<THREE.Mesh>(null); // Circular torus ring
  const activeRingRectRef = useRef<THREE.Mesh>(null); // Rounded rectangle ring (tube geometry)
  // Glow ring refs - soft outer glow behind main rings
  const activeRingGlowRef = useRef<THREE.Mesh>(null); // Circular glow ring
  const activeRingRectGlowRef = useRef<THREE.Mesh>(null); // Rounded rectangle glow ring
  // Preview ring refs - shows the NEXT note (orange, pulsing)
  const previewRingRef = useRef<THREE.Mesh>(null); // Circular preview ring
  const previewRingRectRef = useRef<THREE.Mesh>(null); // Rounded rectangle preview ring
  // PLAYHEAD SPHERE (gym Scales tool) — a small orange sphere that sits at the active note's
  // dot center and glides center-to-center to the next note ("quick glide + hold"). Guitar
  // Hero-style. Only used in showAllNotes mode (the active ring is held there).
  const playheadSphereRef = useRef<THREE.Mesh>(null);
  // LANDING RIPPLE ("dartboard"): concentric rings that expand at the dot when the sphere
  // touches down — like it bounced off an invisible platform. A FIXED pool of ring meshes
  // (MAX_RIPPLE_RINGS); `rippleRings` config controls how many are shown (density). The
  // others stay hidden. rippleStateRef tracks which note last triggered it + elapsed [0..1].
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([]);
  // Trailing SECOND ripple (its own pool), fires a beat behind the first in ripple2Color.
  const ripple2Refs = useRef<(THREE.Mesh | null)[]>([]);
  // ANTICIPATION RUNWAY: ghost-ball spheres on the next few notes + connecting tracer lines
  // between them (fixed pools; `runwayCount` config decides how many show). Pass 1.
  const ghostRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tracerRefs = useRef<(THREE.Mesh | null)[]>([]);
  // APPROACH RING — shrinks onto the NEXT dot as its beat arrives (timing cue). Pass 2.
  const approachRingRef = useRef<THREE.Mesh>(null);
  // ROOT MARKER RINGS — static rings around the root + octave dots (the dark-green ones).
  // Two pools: circular torus for regular frets, rounded-rect tube for fret 0/12 (so the ring
  // matches the rounded-rect DOT shape there instead of an oval slapped over a rectangle).
  const rootRingRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rootRingRectRefs = useRef<(THREE.Mesh | null)[]>([]);
  // ROLLING LIT WINDOW (gym) — while PLAYING, only the current note + the next few light up
  // (a moving runway); the rest grey out. When NOT playing (pending/stopped) the whole scale
  // lights (litWindowActive=false). The playhead useFrame fills these each frame; the dot-color
  // path (calculateDotState) reads them. Position-key Set format matches dotMeshRefs keys.
  const litWindowKeysRef = useRef<Set<string>>(new Set());
  const litWindowActiveRef = useRef<boolean>(false);
  // Per-dot brightness [0..1] (0 = dim green, 1 = full bright), eased toward each dot's window
  // target every frame so the highlight FADES in/out (ease-in-out) instead of snapping. Keyed by
  // dot position. Window size / smoothing / colors are panel-tunable (ph.lit*).
  const dotBrightnessRef = useRef<Map<string, number>>(new Map());
  // Reusable scratch colors for the per-frame dim↔bright lerp (no per-frame allocation).
  const scratchDimColor = useRef(new THREE.Color());
  const scratchBrightColor = useRef(new THREE.Color());
  // Ripple state: which note last fired it, elapsed [0..1], AND the dot position it fired AT
  // (anchored) so a long ripple keeps animating where it landed even after the playhead moves on
  // — without the anchor the in-flight ripple snaps to the new note's dot and looks clipped.
  const rippleStateRef = useRef<{
    noteIdx: number;
    t: number;
    x: number;
    y: number;
    z: number;
  }>({
    noteIdx: -1,
    t: 1,
    x: 0,
    y: 0,
    z: 0,
  });
  // Normalized playhead config (sphere appearance + animation), default-filled.
  const ph = playheadConfig ?? DEFAULT_PLAYHEAD_CONFIG;
  // Track pulse animation time
  const pulseTimeRef = useRef(0);
  // Dynamic note label refs - shows note name on current and next notes
  const currentNoteLabelRef = useRef<THREE.Mesh>(null);
  const nextNoteLabelRef = useRef<THREE.Mesh>(null);
  // Track current label textures to swap them dynamically
  const currentNoteLabelTextureRef = useRef<string | null>(null);
  const nextNoteLabelTextureRef = useRef<string | null>(null);
  // Track positions with active finger labels - used to hide anchor labels when finger numbers shown
  // Format: Set of "stringIndex,fret" keys where finger labels are currently visible
  const activeFingerPositionsRef = useRef<Set<string>>(new Set());
  // Refs for fret note anchor labels so we can hide them when finger numbers are shown
  const fretNoteLabelRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // =============================================================================
  // CALCULATE DOT STATE - Determine color and opacity based on playback position
  // =============================================================================
  // This function is called during useFrame for each dot to determine its visual state.
  // - Active note: BLUE at full opacity, with yellow ring
  // - Upcoming notes (within lookahead): BLUE with gradient opacity
  // - Marker frets (open, 3, 5, 7, 9, 12, 15, 17, 19, 21): GREY_LIGHT at full opacity
  // - All other positions: GREY at full opacity
  // =============================================================================
  const calculateDotState = useCallback(
    (
      positionKey: string,
      activeNoteIndex: number,
      upcomingNotes: NoteTimelineEntry[],
    ): {
      color: number;
      opacity: number;
      isActive: boolean;
      isRoundedRect: boolean;
    } => {
      const notesAtPosition = positionToNotes.get(positionKey);

      // Parse fret from position key (format: "stringIndex,fret" where fret=0 means open string)
      const [, fretStr] = positionKey.split(',');
      const fretNum = parseInt(fretStr, 10);
      // fret 0 = open string, which is a marker fret
      const fret = fretNum === 0 ? 'open' : fretNum;
      const isMarkerFret = MARKER_FRETS.has(fret);
      const greyColor = isMarkerFret ? DOT_COLORS.GREY_LIGHT : DOT_COLORS.GREY;
      // Open string (fret=0) and fret 12 use rounded rectangle shape
      const isRoundedRect = fretNum === 0 || fretNum === 12;

      // Not an exercise position - render as appropriate GREY
      if (!notesAtPosition || notesAtPosition.length === 0) {
        return {
          color: greyColor,
          opacity: 1.0,
          isActive: false,
          isRoundedRect,
        };
      }

      // SCALE MODE (gym Scales tool): every exercise-note position is a lit scale dot,
      // so the WHOLE scale shape is visible at once (not just the lookahead window).
      // Scoped to showAllNotes, which ONLY the Scales tool sets — the tutorial is
      // untouched.
      //
      // A/B HOLD: the BLUE active-note dot + orange highlight ring are commented out
      // here for now. We'll build a SECONDARY highlight animation and A/B-test both, so
      // in scale mode no note is marked active (every scale note stays GREEN). To
      // restore the original blue-dot behaviour, move the active-note block back ABOVE
      // this early-return.
      if (showAllNotes) {
        // Root notes paint a DARKER green so the scale's home note stands out.
        const isRoot = rootPositionKeys.has(positionKey);
        // ROLLING LIT WINDOW (low-motion): while PLAYING, the WHOLE scale stays GREEN but the
        // out-of-window notes use a SOLID muted-green COLOR (not low opacity — that read as
        // translucent/see-through). Only the small moving window (current + next + next-next) is
        // FULL bright green. When NOT playing (pending/stopped) the whole scale is full bright.
        const dimmed =
          litWindowActiveRef.current &&
          !litWindowKeysRef.current.has(positionKey);
        const color = dimmed
          ? isRoot
            ? DOT_COLORS.GREEN_DIM_ROOT
            : DOT_COLORS.GREEN_DIM
          : isRoot
            ? DOT_COLORS.GREEN_DARK
            : DOT_COLORS.GREEN;
        return {
          color,
          opacity: 1.0, // always solid — dimming is by color, never opacity
          isActive: false,
          isRoundedRect,
        };
      }

      // Check if this position is the ACTIVE note - show as BLUE
      const activeNote = notesAtPosition.find(
        (n) => n.noteIndex === activeNoteIndex,
      );
      if (activeNote) {
        return {
          color: DOT_COLORS.BLUE,
          opacity: LOOKAHEAD_CONFIG.opacityLevels[0],
          isActive: true,
          isRoundedRect,
        };
      }

      // Check if this position is the NEXT note (first upcoming) - show as GREEN
      const nextUpcoming = upcomingNotes[0];
      if (
        nextUpcoming &&
        notesAtPosition.some((n) => n.noteIndex === nextUpcoming.noteIndex)
      ) {
        return {
          color: DOT_COLORS.GREEN,
          opacity: LOOKAHEAD_CONFIG.opacityLevels[1] ?? 1.0,
          isActive: false,
          isRoundedRect,
        };
      }

      // Third note and beyond - keep default grey color (black ring will indicate it)
      // Outside lookahead window - render as appropriate GREY
      return { color: greyColor, opacity: 1.0, isActive: false, isRoundedRect };
    },
    [
      positionToNotes,
      rootPositionKeys,
      DOT_COLORS,
      MARKER_FRETS,
      LOOKAHEAD_CONFIG.opacityLevels,
      showAllNotes,
    ],
  );

  // =============================================================================
  // 2D Fretboard geometry constants - MUST MATCH FretboardGrid.tsx EXACTLY!
  // =============================================================================
  // FretboardGrid.tsx uses these constants (lines 887-900):
  //   STRING_SPACING = 32px between string centers
  //   FRET_SPACING = 36px between fret centers
  //   DOT_RADIUS = 13px
  //   CENTER_OFFSET = 15px (open string X)
  //   FRET_OFFSET = 38px (from open to fret 1)
  //   getStringY(index) = index * STRING_SPACING
  //   getFretX(fret) = CENTER_OFFSET + FRET_OFFSET + (fret-1) * FRET_SPACING
  //                  = 15 + 38 + (fret-1) * 36 = 53 + (fret-1) * 36
  //
  // NOTE: fretboardGeometry.ts has DIFFERENT values (42px string spacing, etc.)
  // We use FretboardGrid.tsx values since that's what actually renders the 2D dots.
  // =============================================================================
  const STRING_SPACING = 32; // px between string centers (from FretboardGrid.tsx)
  const CENTER_OFFSET = 15; // px for open string X position
  const FRET_OFFSET = 38; // px from open string to first fret center
  const FRET_SPACING = 36; // px between fret centers
  const DOT_RADIUS = 13; // px radius of dots

  // String names indexed by VISUAL ROW. stringIndex 0 = the BOTTOM row (the lowest pitch,
  // closest/biggest), ascending to the TOP. So index 0 is the lowest string:
  //   4-string: E A D G   5-string: B E A D G   6-string: B E A D G C
  // (The old fixed ['B','E','A','D','G','C'] was right for 6-string but a 4-string took
  //  its first 4 → 'B E A D' — wrong. Now sized to the count, bottom-up.)
  const STRING_NAMES = useMemo(() => {
    const byCount: Record<number, string[]> = {
      4: ['E', 'A', 'D', 'G'],
      5: ['B', 'E', 'A', 'D', 'G'],
      6: ['B', 'E', 'A', 'D', 'G', 'C'],
    };
    return byCount[stringCount] ?? ['B', 'E', 'A', 'D', 'G', 'C'];
  }, [stringCount]);

  // =============================================================================
  // CANVAS-BASED TEXT TEXTURES - For string labels without external font loading
  // =============================================================================
  // Creates textures from canvas for reliable text rendering in Three.js
  // Each string label gets a small canvas with the letter drawn on it
  // =============================================================================
  // Light textures (default - white text for grey dots)
  const stringLabelTextures = useMemo(() => {
    const textures: Map<string, THREE.CanvasTexture> = new Map();

    STRING_NAMES.forEach((name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Transparent background
        ctx.clearRect(0, 0, 64, 64);
        // Draw text
        ctx.fillStyle = '#e2e8f0'; // slate-200
        ctx.font =
          '600 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 32, 32);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      textures.set(name, texture);
    });

    return textures;
  }, [STRING_NAMES]);

  // Dark textures (for active/preview notes - black text on green/blue dots)
  const stringLabelTexturesDark = useMemo(() => {
    const textures: Map<string, THREE.CanvasTexture> = new Map();

    STRING_NAMES.forEach((name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Transparent background
        ctx.clearRect(0, 0, 64, 64);
        // Draw text in black for visibility on green/blue backgrounds
        ctx.fillStyle = '#000000'; // black
        ctx.font =
          '600 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, 32, 32);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      textures.set(name, texture);
    });

    return textures;
  }, [STRING_NAMES]);

  // Refs to track string label meshes for dynamic texture updates
  const stringLabelMeshRefs = useRef<Map<string, THREE.Mesh>>(new Map());

  // =============================================================================
  // FRET NOTE LABELS - Smaller labels for specific fret positions
  // =============================================================================
  // Labels for key reference notes:
  // - E string (index 1): fret 3 = G, fret 5 = A, fret 7 = B
  // - A string (index 2): fret 3 = C, fret 5 = D, fret 7 = E
  // These use a smaller font than the open string labels
  // =============================================================================
  // Helper note-name dots ALWAYS on the E and A strings, whatever the string count.
  // The E/A rows shift visually when low strings are added (4-str: E=0,A=1; 5/6-str:
  // E=1,A=2), so we look up their VISUAL index from STRING_NAMES (which is per-count and
  // bottom-up) instead of hardcoding — otherwise they'd land on the wrong rows on a 5/6.
  const FRET_NOTE_LABELS = useMemo(() => {
    const eIndex = STRING_NAMES.indexOf('E');
    const aIndex = STRING_NAMES.indexOf('A');
    const labels: Array<{ stringIndex: number; fret: number; label: string }> =
      [];
    // E string: fret 3=G, 5=A, 7=B — and the same one octave up (15, 17, 19).
    // A string: fret 3=C, 5=D, 7=E — likewise at 15, 17, 19. The neck repeats past fret 12.
    const E_NOTES: [number, string][] = [
      [3, 'G'],
      [5, 'A'],
      [7, 'B'],
    ];
    const A_NOTES: [number, string][] = [
      [3, 'C'],
      [5, 'D'],
      [7, 'E'],
    ];
    if (eIndex >= 0) {
      for (const [fret, label] of E_NOTES) {
        labels.push({ stringIndex: eIndex, fret, label });
        labels.push({ stringIndex: eIndex, fret: fret + 12, label }); // 2nd octave
      }
    }
    if (aIndex >= 0) {
      for (const [fret, label] of A_NOTES) {
        labels.push({ stringIndex: aIndex, fret, label });
        labels.push({ stringIndex: aIndex, fret: fret + 12, label }); // 2nd octave
      }
    }
    return labels;
  }, [STRING_NAMES]);

  const fretNoteLabelTextures = useMemo(() => {
    const textures: Map<string, THREE.CanvasTexture> = new Map();
    const uniqueLabels = [...new Set(FRET_NOTE_LABELS.map((l) => l.label))];

    uniqueLabels.forEach((label) => {
      const canvas = document.createElement('canvas');
      canvas.width = 48; // Smaller canvas for smaller labels
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Transparent background
        ctx.clearRect(0, 0, 48, 48);
        // Draw text - smaller font, black color
        ctx.fillStyle = '#000000'; // black
        ctx.font =
          '600 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 24, 24);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      textures.set(label, texture);
    });

    return textures;
  }, []);

  // =============================================================================
  // ANCHOR LABEL CHECK - Skip dynamic labels where permanent labels exist
  // =============================================================================
  // Check if a position already has a permanent anchor label (open strings or fret 3/5/7 on E/A)
  // Returns true if we should SKIP rendering a dynamic label at this position
  const hasAnchorLabel = useCallback(
    (stringIndex: number, fret: number): boolean => {
      // Open strings (fret 0) and fret 12 have permanent string name labels
      if (fret === 0 || fret === 12) return true;

      // E string (index 1) and A string (index 2) have labels at frets 3, 5, 7
      if (
        (stringIndex === 1 || stringIndex === 2) &&
        (fret === 3 || fret === 5 || fret === 7)
      ) {
        return true;
      }

      return false;
    },
    [],
  );

  // =============================================================================
  // FINGER NUMBER LABELS - Display finger numbers on notes (1-4, O for open string)
  // =============================================================================
  // 1=Index, 2=Middle, 3=Ring, 4=Pinky, O=Open string
  const FINGER_LABELS = ['1', '2', '3', '4', 'O'] as const;

  // Pre-generate textures for finger number labels
  // Using larger canvas and font for better visibility
  const SYMBOL_CANVAS_SIZE = 128;
  const SYMBOL_FONT_SIZE = 100;

  const fingerLabelTextures = useMemo(() => {
    const textures: Map<string, THREE.CanvasTexture> = new Map();

    // Create textures for all finger numbers
    FINGER_LABELS.forEach((label) => {
      const canvas = document.createElement('canvas');
      canvas.width = SYMBOL_CANVAS_SIZE;
      canvas.height = SYMBOL_CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, SYMBOL_CANVAS_SIZE, SYMBOL_CANVAS_SIZE);
        ctx.fillStyle = '#000000'; // black text
        // Bold sans-serif font for finger numbers
        ctx.font = `700 ${SYMBOL_FONT_SIZE}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, SYMBOL_CANVAS_SIZE / 2, SYMBOL_CANVAS_SIZE / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      textures.set(label, texture);
    });

    return textures;
  }, []);

  // =============================================================================
  // EXACT 2D FRETBOARD GRID REPLICATION IN 3D
  // =============================================================================
  // This creates the EXACT same grid as the 2D fretboard:
  // - Dot at each string/fret intersection
  // - String lines (horizontal)
  // - Fret lines (vertical)
  // All positions use the same geometry formulas as FretboardGrid.tsx
  // =============================================================================

  // =============================================================================
  // CONTENT CENTER vs VIEWPORT - CRITICAL FOR ROTATION ALIGNMENT
  // =============================================================================
  // CSS structure:
  //   fretboardContainerRef (568x290) has perspective: 800px
  //   └── scrollContainerRef has transform-origin: center center
  //       └── Full fretboard content (wider than viewport)
  //
  // The CSS transform-origin: center center on the scroll container means the
  // rotation pivot is at the CENTER OF THE FULL CONTENT (all frets), not the
  // viewport. This is why all fret columns converge to the same point.
  //
  // For the 3D to match, we use contentWidth (full content width) for
  // centering calculations, not viewport width.
  // =============================================================================

  // Use CONTENT center (full fretboard width) for X, fixed height center for Y
  const halfWidth = contentWidth / 2; // Center of FULL content (all frets)
  const halfHeight = contentHeight / 2;

  // Convert 2D pixel position to 3D coordinate
  // In 2D: (0,0) is top-left, Y increases downward
  // In 3D: origin is center of FULL CONTENT, Y is up (so we negate and offset)
  const to3DX = (x2d: number) => x2d - halfWidth;
  const to3DY = (y2d: number) => -(y2d - halfHeight); // Negate because 3D Y is up, 2D Y is down

  // =============================================================================
  // Get dot CENTER position in 2D pixels - MUST MATCH FretboardGrid.tsx EXACTLY!
  // =============================================================================
  // FretboardGrid.tsx positions dots at:
  //   X: fret === 'open' ? CENTER_OFFSET : CENTER_OFFSET + FRET_OFFSET + (fret-1) * FRET_SPACING
  //   Y: absoluteVisualPosition * STRING_SPACING (where absoluteVisualPosition = 5 - absoluteStringIndex)
  //
  // The dot center is at (x + DOT_RADIUS, y + DOT_RADIUS) because dots are positioned
  // by their top-left corner in FretboardGrid.tsx
  //
  // CRITICAL: FretboardGrid uses absoluteVisualPosition = 5 - stringIndex to flip the string order!
  // This maps: B(0)→5, E(1)→4, A(2)→3, D(3)→2, G(4)→1, C(5)→0
  // Without this transformation, 3D strings render in opposite order from 2D.
  // =============================================================================
  const getDotPosition2D = (stringIndex: number, fret: number | 'open') => {
    // CRITICAL FIX: Apply the same visual position transformation as FretboardGrid.tsx
    // FretboardGrid uses: absoluteVisualPosition = 5 - absoluteStringIndex
    // This ensures 3D strings render in the same order as 2D strings
    const absoluteVisualPosition = 5 - stringIndex;

    // Y position: absoluteVisualPosition * STRING_SPACING (visual string position)
    // Add DOT_RADIUS to get center (dots positioned by top-left corner)
    const y = absoluteVisualPosition * STRING_SPACING + DOT_RADIUS;

    // X position: open string or fret position
    // Add DOT_RADIUS to get center (dots positioned by top-left corner)
    let x;
    if (fret === 'open') {
      x = CENTER_OFFSET + DOT_RADIUS;
    } else {
      x = CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING + DOT_RADIUS;
    }
    return { x, y };
  };

  // =============================================================================
  // EDGE FADE OPACITY - Matches 2D fretboard fade effect
  // =============================================================================
  // The 2D fretboard uses a 40px fade zone on each edge to smoothly hide content
  // that's scrolling out of view. We replicate this for 3D elements.
  //
  // - Left fade: Only applies when scrolled (scrollLeft > 0)
  // - Right fade: Always applies
  // - fadeZoneWidth for 3D is wider to start fade at fret 12 (~462px from left)
  //   With viewport=568px, we need fade zone of ~120px to reach fret 12
  // =============================================================================
  const FADE_ZONE_WIDTH = 60; // Fade zone width in pixels

  // PERFORMANCE: Fade effect DISABLED to prevent scroll re-renders
  // Always returns 1 (full opacity) - all elements visible
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const calculateFadeOpacity = (_x2d: number): number => {
    // DISABLED: Return full opacity to eliminate scroll-based re-renders
    // The original fade logic has been removed for performance.
    // To re-enable fade: implement imperative material updates in useFrame
    return 1;
  };

  // Suppress unused warning - viewportWidth is reserved for future fade implementation
  void viewportWidth;

  // =============================================================================
  // OPTION 1: TILTED PLANE POSITIONING
  // =============================================================================
  // Instead of placing dots at Z=0 and rotating the scene, we place each dot
  // on an ACTUAL tilted plane in 3D space. The plane rotates around the X-axis
  // at the center of the canvas (transform-origin: center center).
  //
  // CSS rotateX(θ) rotates around a horizontal axis:
  // - Points above center move AWAY from camera (positive Z becomes negative)
  // - Points below center move TOWARD camera (negative Z becomes positive)
  //
  // For a point at 2D position (x2d, y2d), on a plane tilted by θ around center:
  //   - Distance from center Y: dy = y2d - centerY
  //   - After rotation:
  //     - new Y = centerY + dy * cos(θ)
  //     - new Z = -dy * sin(θ)  (negative because CSS rotateX tilts top away)
  // =============================================================================
  const getTiltedPlanePosition = (
    x2d: number,
    y2d: number,
    heightAbovePlane = 0,
  ) => {
    const tiltRad = (tiltAngle * Math.PI) / 180;
    // Use CONTENT center for rotation axis (matches CSS transform-origin: center center)
    const centerY2D = contentHeight / 2;

    // Distance from rotation axis (center of content)
    const dy = y2d - centerY2D;

    // =============================================================================
    // TOP/BOTTOM EDGE WIDTH SCALING (trapezoid shaping)
    // =============================================================================
    // IMPORTANT: Normalize based on FRETBOARD CONTENT bounds, not canvas center!
    // The fretboard strings occupy only a portion of the canvas.
    // =============================================================================

    // Calculate fretboard Y bounds (string positions)
    const firstStringY2D = DOT_RADIUS; // String 0 Y center
    const lastStringY2D = (stringCount - 1) * STRING_SPACING + DOT_RADIUS; // Last string Y center
    const fretboardCenterY = (firstStringY2D + lastStringY2D) / 2;
    const fretboardHalfHeight = (lastStringY2D - firstStringY2D) / 2;

    // Normalize Y relative to fretboard content bounds
    const fretboardRelativeY = y2d - fretboardCenterY;
    const normalizedY =
      fretboardHalfHeight > 0 ? fretboardRelativeY / fretboardHalfHeight : 0;

    // Interpolate X scale based on vertical position within fretboard:
    // USER PERSPECTIVE (looking at tilted fretboard):
    // - "Top Edge" slider = should control visual top of screen = string 0 = FAR edge
    // - "Bottom Edge" slider = should control visual bottom of screen = last string = NEAR edge
    //
    // normalizedY: -1 = string 0 (screen top, far edge)
    // normalizedY: +1 = last string (screen bottom, near edge)
    //
    // User reported controls were swapped, so we swap the scale assignments:
    let xScale: number;
    if (normalizedY <= 0) {
      // Screen TOP (string 0, far edge): "Top Edge" slider should control this
      // t=0 at extreme top, t=1 at center
      const t = Math.min(1, normalizedY + 1);
      xScale = topEdgeScale + t * (1.0 - topEdgeScale);
    } else {
      // Screen BOTTOM (last string, near edge): "Bottom Edge" slider should control this
      // t=0 at center, t=1 at extreme bottom
      const t = Math.min(1, normalizedY);
      xScale = 1.0 + t * (bottomEdgeScale - 1.0);
    }

    // Apply perspective multiplier to dy - this controls how much the distance from center
    // affects the perspective distortion. <1 = less perspective (top/bottom more equal),
    // >1 = more perspective (more dramatic size difference between top and bottom)
    const adjustedDy = dy * perspectiveMultiplier;

    // Convert to 3D coordinates with tilt applied
    const cx = x2d - halfWidth; // X distance from center
    const scaledCx = cx * xScale; // Apply edge scale to X position

    // Y position on tilted plane (in 3D, Y is up, so we negate and apply cos)
    const y3dOnPlane = -adjustedDy * Math.cos(tiltRad);

    // Z position - how far toward/away from camera
    // Top of fretboard (negative dy) should go away (negative Z)
    const z3dOnPlane = -adjustedDy * Math.sin(tiltRad);

    // =============================================================================
    // CSS PERSPECTIVE PROJECTION (X-axis correction)
    // =============================================================================
    // CSS perspective affects X position too! Apply the same perspective scaling
    // to match how CSS projects the tilted content onto the screen.
    // =============================================================================
    const perspectiveScale = cssPerspective / (cssPerspective - z3dOnPlane);
    const x3d = scaledCx * perspectiveScale;
    const y3d = y3dOnPlane * perspectiveScale;

    // Add height above the tilted plane (perpendicular to the plane)
    // The plane's normal vector after rotation is (0, sin(θ), cos(θ))
    const finalY = y3d + heightAbovePlane * Math.sin(tiltRad);
    const z3d = z3dOnPlane + heightAbovePlane * Math.cos(tiltRad);

    return { x: x3d, y: finalY, z: z3d };
  };

  // =============================================================================
  // OPTION 4: SCREEN-SPACE ALIGNMENT (CSS Transform Matching)
  // =============================================================================
  // CSS applies perspective + rotateX to 2D elements. We need to find the SCREEN
  // position where a 2D point appears, then place a 3D dot that projects there.
  //
  // CSS Perspective Math (with d = 800px, transform-origin: center center):
  // 1. Start with point at (x2d, y2d) - convert to center-relative: (cx, cy)
  // 2. rotateX(θ): y' = cy * cos(θ), z' = -cy * sin(θ)  (x unchanged)
  // 3. Perspective division: scale = d / (d - z')
  //    screenX = cx * scale
  //    screenY = y' * scale
  //
  // For BOTTOM edge (cy = +145px at 60° tilt):
  //   z' = -145 * sin(60°) = -145 * 0.866 = -125.6 (toward camera in CSS!)
  //   scale = 800 / (800 - (-125.6)) = 800 / 925.6 = 0.864
  //
  // Wait - CSS rotateX POSITIVE tilts the TOP away. So for positive cy (below center):
  //   z' = -cy * sin(θ) = -145 * sin(60°) = -125.6 (NEGATIVE = away from camera)
  //
  // Actually in CSS, positive Z is TOWARD the viewer. rotateX(positive angle)
  // tilts the top edge AWAY (negative Z) and bottom edge TOWARD (positive Z).
  //
  // Let me recalculate:
  // - cy > 0 (below center): z' = -cy * sin(θ) < 0 when sin(θ) > 0
  //   This means BOTTOM goes AWAY from camera (negative Z)
  //
  // That's backwards! Let me check CSS behavior...
  // CSS rotateX(60deg): TOP tilts away, BOTTOM comes toward viewer
  // So for bottom (cy > 0): z should be POSITIVE (toward camera)
  //
  // The correct formula for CSS is: z' = cy * sin(θ) (not negative!)
  // Because rotateX rotates around X-axis, and positive angle brings bottom forward.
  //
  // CORRECTED CSS Math:
  // - rotatedY = cy * cos(θ)
  // - rotatedZ = cy * sin(θ)  (positive cy + positive θ = positive Z = toward camera)
  //
  // Perspective scaling:
  // - scale = d / (d - rotatedZ)
  // =============================================================================
  const getScreenSpacePosition = (
    x2d: number,
    y2d: number,
    heightAbovePlane = 0,
  ) => {
    const tiltRad = (tiltAngle * Math.PI) / 180;

    // Convert to center-relative coordinates
    // X: positive is right (same in both 2D and 3D)
    // Y: In 2D, Y increases downward. In 3D, Y increases upward.
    //    So we NEGATE cy to convert from 2D to 3D coordinate system.
    const cx = x2d - halfWidth;
    const cy = -(y2d - halfHeight); // NEGATED: converts 2D Y-down to 3D Y-up

    // =============================================================================
    // TOP/BOTTOM EDGE WIDTH SCALING (trapezoid shaping)
    // =============================================================================
    // IMPORTANT: We need to normalize based on FRETBOARD CONTENT bounds, not canvas center!
    // The fretboard strings occupy only a portion of the canvas (typically top portion).
    //
    // For a 4-string bass with STRING_SPACING=32 and DOT_RADIUS=13:
    // - String 0 Y = 13px (topmost string)
    // - String 3 Y = 109px (bottommost string)
    // - Canvas center Y = 145px
    //
    // Without this fix, ALL strings would be in the "top half" (cy < 0) and
    // bottomEdgeScale would never be applied!
    //
    // Solution: Normalize Y position relative to the FRETBOARD BOUNDS, not canvas center.
    // =============================================================================

    // Calculate fretboard Y bounds (string positions)
    const firstStringY2D = DOT_RADIUS; // String 0 Y center
    const lastStringY2D = (stringCount - 1) * STRING_SPACING + DOT_RADIUS; // Last string Y center
    const fretboardCenterY = (firstStringY2D + lastStringY2D) / 2;
    const fretboardHalfHeight = (lastStringY2D - firstStringY2D) / 2;

    // Normalize Y relative to fretboard content bounds (not canvas center)
    // This ensures normalizedY spans [-1, +1] across the actual fretboard content
    const fretboardRelativeY = y2d - fretboardCenterY;
    const normalizedY =
      fretboardHalfHeight > 0 ? fretboardRelativeY / fretboardHalfHeight : 0;

    // Interpolate X scale based on vertical position within fretboard:
    // - At top string (normalizedY ≈ -1): use topEdgeScale (far edge when tilted)
    // - At center of strings (normalizedY = 0): use 1.0
    // - At bottom string (normalizedY ≈ +1): use bottomEdgeScale (near edge when tilted)
    let xScale: number;
    if (normalizedY <= 0) {
      // Top/far half: interpolate between topEdgeScale (at -1) and 1.0 (at 0)
      const t = Math.min(1, normalizedY + 1); // clamp to [0, 1]
      xScale = topEdgeScale + t * (1.0 - topEdgeScale);
    } else {
      // Bottom/near half: interpolate between 1.0 (at 0) and bottomEdgeScale (at +1)
      const t = Math.min(1, normalizedY); // clamp to [0, 1]
      xScale = 1.0 + t * (bottomEdgeScale - 1.0);
    }

    // Apply edge scale to X position
    const scaledCx = cx * xScale;

    // Apply perspective multiplier to cy - this controls how much the distance from center
    // affects the perspective distortion. <1 = less perspective (top/bottom more equal),
    // >1 = more perspective (more dramatic size difference between top and bottom)
    const adjustedCy = cy * perspectiveMultiplier;

    // After CSS rotateX, the 2D point is at these 3D coordinates (relative to center):
    const rotatedY = adjustedCy * Math.cos(tiltRad);
    const rotatedZ = -adjustedCy * Math.sin(tiltRad);

    // =============================================================================
    // CSS PERSPECTIVE PROJECTION (X-axis correction)
    // =============================================================================
    // CSS perspective ALSO affects X position! When content is tilted:
    //   screenX = cx * perspectiveScale
    //   screenY = rotatedY * perspectiveScale
    //   where perspectiveScale = perspective / (perspective - rotatedZ)
    //
    // For content ABOVE center (negative cy in 2D, positive cy in 3D after our flip):
    //   - rotatedZ is negative (tilting away from camera)
    //   - perspectiveScale = 800 / (800 - (-z)) = 800 / (800 + z) < 1
    //   - So content shrinks and moves TOWARD center
    //
    // For content BELOW center (positive cy in 2D, negative cy in 3D after our flip):
    //   - rotatedZ is positive (tilting toward camera)
    //   - perspectiveScale = 800 / (800 - z) > 1
    //   - So content grows and moves AWAY from center
    //
    // This is what causes the 2D fretboard to shift LEFT when tilted - the content
    // is mostly on the LEFT side of center, so the perspective shift affects X position.
    //
    // To match CSS, we need to apply the same perspectiveScale to our X position.
    // =============================================================================
    const perspectiveScale = cssPerspective / (cssPerspective - rotatedZ);
    const perspectiveX = scaledCx * perspectiveScale;

    // To match CSS screen position, we place our 3D dot at the SAME
    // 3D coordinates that CSS calculates after its rotation:
    const x3d = perspectiveX; // X with perspective scaling applied
    const y3d = rotatedY * perspectiveScale; // Y with perspective scaling
    const z3d = rotatedZ;

    // Add height above plane
    const finalY = y3d;
    const finalZ = z3d + heightAbovePlane;

    return { x: x3d, y: finalY, z: finalZ };
  };

  // =============================================================================
  // GET 3D POSITION BASED ON MODE (with tilt axis offsets applied)
  // =============================================================================
  // tiltAxisOffset (Y) slides content along the tilted plane up/down direction
  // tiltAxisOffsetX slides content left/right on the tilted plane (X axis)
  // All modes now apply these offsets directly to dot positions
  // =============================================================================
  const get3DPosition = (x2d: number, y2d: number, heightAbovePlane = 0) => {
    switch (positioningMode) {
      case 'tilted-plane': {
        // Calculate tilt axis offset contribution for tilted modes
        const tiltRad = (tiltAngle * Math.PI) / 180;
        const offsetY = tiltAxisOffset * Math.cos(tiltRad);
        const offsetZ = -tiltAxisOffset * Math.sin(tiltRad);
        const pos = getTiltedPlanePosition(x2d, y2d, heightAbovePlane);
        return {
          x: pos.x + tiltAxisOffsetX,
          y: pos.y + offsetY,
          z: pos.z + offsetZ,
        };
      }
      case 'screen-space': {
        // Calculate tilt axis offset contribution for tilted modes
        const tiltRad = (tiltAngle * Math.PI) / 180;
        const offsetY = tiltAxisOffset * Math.cos(tiltRad);
        const offsetZ = -tiltAxisOffset * Math.sin(tiltRad);
        const pos = getScreenSpacePosition(x2d, y2d, heightAbovePlane);
        return {
          x: pos.x + tiltAxisOffsetX,
          y: pos.y + offsetY,
          z: pos.z + offsetZ,
        };
      }
      case 'flat':
      default: {
        // Flat mode: dots at Z=0, scene rotation handles tilt
        // Apply tilt axis offsets directly to X and Y positions
        // tiltAxisOffsetX = left/right adjustment
        // tiltAxisOffset = up/down adjustment (Y in flat mode, before scene rotation)

        // =============================================================================
        // PERSPECTIVE X SCALING FOR FLAT MODE
        // =============================================================================
        // In flat mode, the Three.js camera provides perspective, but it may not match
        // CSS perspective exactly. We apply perspectiveMultiplier to scale X positions
        // based on Y position, simulating a closer/further vanishing point.
        //
        // perspectiveMultiplier > 1.0: More dramatic perspective (closer vanishing point)
        //   - Bottom edge dots spread wider, top edge dots narrower
        // perspectiveMultiplier < 1.0: Less perspective (further vanishing point)
        //   - More uniform spacing across rows
        // perspectiveMultiplier = 1.0: No adjustment (use camera's natural perspective)
        // =============================================================================

        const baseX = to3DX(x2d);
        const baseY = to3DY(y2d);

        // Only apply if perspectiveMultiplier != 1.0
        let adjustedX = baseX;
        if (perspectiveMultiplier !== 1.0) {
          // Calculate Y position relative to fretboard content center
          const firstStringY2D = DOT_RADIUS;
          const lastStringY2D = (stringCount - 1) * STRING_SPACING + DOT_RADIUS;
          const fretboardCenterY = (firstStringY2D + lastStringY2D) / 2;
          const fretboardHalfHeight = (lastStringY2D - firstStringY2D) / 2;

          // Normalize Y: -1 at top string (far), +1 at bottom string (near)
          const normalizedY =
            fretboardHalfHeight > 0
              ? (y2d - fretboardCenterY) / fretboardHalfHeight
              : 0;

          // Scale factor: 1.0 at center, adjusted toward edges based on perspectiveMultiplier
          // For perspectiveMultiplier > 1: bottom (normalizedY=+1) gets wider, top gets narrower
          const perspectiveAdjustment = (perspectiveMultiplier - 1.0) * 0.15; // Scale down the effect
          const xScale = 1.0 + normalizedY * perspectiveAdjustment;

          adjustedX = baseX * xScale;
        }

        return {
          x: adjustedX + tiltAxisOffsetX,
          y: baseY + tiltAxisOffset,
          z: heightAbovePlane,
        };
      }
    }
  };

  // PERFORMANCE: Only log on first render or when positioning mode changes
  // Removed per-scroll console.logs to prevent 60+ logs/sec during scrolling

  // Calculate fretboard bounds (dot centers, not edges)
  // CRITICAL: Use getDotPosition2D to get correct Y positions with visual transformation applied
  // String 0 is now at the BOTTOM visually (high Y), last string is at TOP (low Y)
  const firstStringPos = getDotPosition2D(0, 'open'); // String 0 → visual position 5 (bottom)
  const lastStringPos = getDotPosition2D(stringCount - 1, 'open'); // Last string → visual position at top
  const firstStringY = lastStringPos.y; // Top string Y (smaller Y value)
  const lastStringY = firstStringPos.y; // Bottom string Y (larger Y value)
  const openStringX = CENTER_OFFSET + DOT_RADIUS; // Open string X center
  const lastFretX =
    CENTER_OFFSET + FRET_OFFSET + (maxFrets - 1) * FRET_SPACING + DOT_RADIUS; // Last fret X center

  // Sizes for grid elements
  const dotRadius = 13; // Match 2D dot radius exactly
  const gridLineThickness = 1; // Thin lines for both strings and frets

  // Shared rounded-rectangle ring PATH (the tube the active-ring-rect — and now the root-marker
  // rect rings — follow at fret 0/12). Same geometry the active ring uses, hoisted here so the
  // root rings can adopt the EXACT rounded-rect outline instead of a circular torus. Pure curve;
  // depends only on the dot size.
  const roundedRectRingCurve = useMemo(() => {
    const rectWidth = dotRadius * 2 + 2; // Slightly larger than dot
    const rectHeight = dotRadius * 2 + 2;
    const cornerRadius = 6; // Match rounded-md
    const halfW = rectWidth / 2;
    const halfH = rectHeight / 2;
    const cr = Math.min(cornerRadius, halfW, halfH);
    const pathPoints: THREE.Vector3[] = [];
    const segments = 8; // segments per corner
    // Bottom-left → bottom-right → top-right → top-left corners (clockwise).
    const corners: [number, number, number][] = [
      [-halfW + cr, -halfH + cr, Math.PI],
      [halfW - cr, -halfH + cr, Math.PI * 1.5],
      [halfW - cr, halfH - cr, 0],
      [-halfW + cr, halfH - cr, Math.PI / 2],
    ];
    for (const [ox, oy, base] of corners) {
      for (let i = 0; i <= segments; i++) {
        const angle = base + (i / segments) * (Math.PI / 2);
        pathPoints.push(
          new THREE.Vector3(ox + cr * Math.cos(angle), oy + cr * Math.sin(angle), 0),
        );
      }
    }
    const first = pathPoints[0];
    if (first) pathPoints.push(first.clone());
    return new THREE.CatmullRomCurve3(pathPoints, true);
  }, [dotRadius]);

  // PERFORMANCE: Memoize all dot positions - they only change when fretboard config changes
  // NOT when scrollLeft changes (scroll only affects opacity, not position)
  const allDots = useMemo(() => {
    const dots: Array<{
      stringIndex: number;
      fret: number | 'open';
      x2d: number; // 2D X position for fade calculation
      x3d: number;
      y3d: number;
      z3d: number; // Now includes Z for tilted/screen-space modes
    }> = [];

    for (let s = 0; s < stringCount; s++) {
      // Open string position
      const openPos = getDotPosition2D(s, 'open');
      const open3D = get3DPosition(openPos.x, openPos.y, 2); // Height 2 above plane
      dots.push({
        stringIndex: s,
        fret: 'open',
        x2d: openPos.x,
        x3d: open3D.x,
        y3d: open3D.y,
        z3d: open3D.z,
      });

      // Fret positions (1 to maxFrets)
      for (let f = 1; f <= maxFrets; f++) {
        const fretPos = getDotPosition2D(s, f);
        const fret3D = get3DPosition(fretPos.x, fretPos.y, 2); // Height 2 above plane
        dots.push({
          stringIndex: s,
          fret: f,
          x2d: fretPos.x,
          x3d: fret3D.x,
          y3d: fret3D.y,
          z3d: fret3D.z,
        });
      }
    }
    return dots;
  }, [
    stringCount,
    maxFrets,
    positioningMode,
    tiltAngle,
    cssPerspective,
    tiltAxisOffset,
    tiltAxisOffsetX,
    perspectiveMultiplier,
    topEdgeScale,
    bottomEdgeScale,
    contentWidth,
    contentHeight,
  ]);

  // Grid colors matching 2D fretboard slate palette
  const SLATE_700 = '#334155'; // Tailwind slate-700 (grid lines)

  // Calculate tilt rotation for grid elements in tilted-plane and screen-space modes
  // In these modes, the grid needs to be rotated to lie on the tilted plane
  const tiltRad = (tiltAngle * Math.PI) / 180;
  const gridRotationX = positioningMode === 'flat' ? 0 : -tiltRad;

  // =============================================================================
  // 60FPS MATERIAL UPDATES - Update dot colors/opacity based on playback position
  // =============================================================================
  // This useFrame hook runs at 60fps and updates each dot's material based on:
  // - Current playback position from AtomicPlaybackClock
  // - Which note is currently active (findNoteAtTime)
  // - Which notes are upcoming within the lookahead window
  //
  // Performance: Direct material updates bypass React entirely.
  // =============================================================================
  // =============================================================================
  // INITIAL STATE SETUP - Show first note highlighted when not playing
  // =============================================================================
  // This effect runs when timeline changes to set up the initial visual state
  // showing the first note as active with the yellow ring visible.
  // =============================================================================
  const updateInitialState = useCallback(() => {
    if (timeline.length === 0) {
      // When timeline is empty (e.g., switching to exercise with no bass notes),
      // hide all rings and reset dot colors to prevent stale visual state

      // Hide all ring meshes
      if (activeRingRef.current) activeRingRef.current.visible = false;
      if (activeRingGlowRef.current) activeRingGlowRef.current.visible = false;
      if (activeRingRectRef.current) activeRingRectRef.current.visible = false;
      if (activeRingRectGlowRef.current)
        activeRingRectGlowRef.current.visible = false;
      if (previewRingRef.current) previewRingRef.current.visible = false;
      if (previewRingRectRef.current)
        previewRingRectRef.current.visible = false;

      // Hide finger/note labels
      if (currentNoteLabelRef.current)
        currentNoteLabelRef.current.visible = false;
      if (nextNoteLabelRef.current) nextNoteLabelRef.current.visible = false;

      // Reset all dot colors to their default grey state
      dotMeshRefs.current.forEach((mesh, positionKey) => {
        const material = mesh.material as THREE.MeshBasicMaterial;
        // Parse position key to determine if it's a marker fret
        const [, fretStr] = positionKey.split(',');
        const fret = fretStr === 'open' ? 'open' : parseInt(fretStr, 10);
        const isMarkerFret =
          fret === 'open' || MARKER_FRETS.has(fret as number);

        material.color.setHex(
          isMarkerFret ? DOT_COLORS.GREY_LIGHT : DOT_COLORS.GREY,
        );
        material.opacity = 1.0;
        material.transparent = true;
        material.needsUpdate = true;
      });

      // Clear any active finger positions
      activeFingerPositionsRef.current = [];

      // Reset all string labels to their default light (white) texture
      stringLabelMeshRefs.current.forEach((mesh, posKey) => {
        if (!mesh) return;
        const material = mesh.material as THREE.MeshBasicMaterial;
        const stringIndexStr = posKey.split(',')[0];
        if (!stringIndexStr) return;
        const stringIndex = parseInt(stringIndexStr, 10);
        const stringName = STRING_NAMES[stringIndex];
        if (!stringName) return;

        const lightTexture = stringLabelTextures.get(stringName);
        if (lightTexture && material.map !== lightTexture) {
          material.map = lightTexture;
          material.needsUpdate = true;
        }
      });

      // Reset animation timing refs to prevent stale animation state
      pulseTimeRef.current = 0;

      // Reset texture cache refs so labels load fresh for new exercise
      currentNoteLabelTextureRef.current = null;
      nextNoteLabelTextureRef.current = null;

      return;
    }

    // When not playing, show note index 0 as active (first note)
    const initialActiveNoteIndex = 0;
    const upcomingNotes = timeline
      .filter((e) => e.type === 'note' && e.noteIndex > initialActiveNoteIndex)
      .slice(0, LOOKAHEAD_CONFIG.maxVisibleNotes);

    let activePosition: { x: number; y: number; z: number } | null = null;
    let activeIsRoundedRect = false;
    // Track the NEXT note position for preview ring
    let nextNotePosition: { x: number; y: number; z: number } | null = null;
    let nextNoteIsRoundedRect = false;

    // Get the next note entry (first upcoming note)
    const nextNoteEntry = upcomingNotes[0];
    const nextNotePositionKey = nextNoteEntry
      ? `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`
      : null;

    // Update each dot's material based on initial state
    dotMeshRefs.current.forEach((mesh, positionKey) => {
      const dotState = calculateDotState(
        positionKey,
        initialActiveNoteIndex,
        upcomingNotes,
      );
      const material = mesh.material as THREE.MeshBasicMaterial;

      material.color.setHex(dotState.color);
      material.opacity = dotState.opacity;
      material.transparent = true; // Always transparent to support opacity changes
      material.needsUpdate = true;

      if (dotState.isActive) {
        activePosition = {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        };
        activeIsRoundedRect = dotState.isRoundedRect;
      }

      // Track next note position for preview ring
      if (positionKey === nextNotePositionKey) {
        nextNotePosition = {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        };
        const fretNum = nextNoteEntry?.position.fret ?? 0;
        nextNoteIsRoundedRect = fretNum === 0 || fretNum === 12;
      }
    });

    // GYM (showAllNotes): the orange playhead sphere is the active-note indicator now, so the
    // tutorial's yellow active-note ring is DISMISSED here. (Its mesh stays mounted but hidden;
    // it gets repurposed as static root/interval markers elsewhere.)
    if (showAllNotes) {
      if (activeRingRef.current) activeRingRef.current.visible = false;
      if (activeRingGlowRef.current) activeRingGlowRef.current.visible = false;
      if (activeRingRectRef.current) activeRingRectRef.current.visible = false;
      if (activeRingRectGlowRef.current)
        activeRingRectGlowRef.current.visible = false;
    }
    // Position the yellow ring on the first note - choose shape based on fret type
    if (!showAllNotes && activePosition) {
      // Show circular ring for regular frets, hide for open/fret 12
      if (activeRingRef.current) {
        if (activeIsRoundedRect) {
          activeRingRef.current.visible = false;
        } else {
          activeRingRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset,
          );
          activeRingRef.current.visible = true;
          // Real-time color update for ring
          const ringMaterial = activeRingRef.current
            .material as THREE.MeshStandardMaterial;
          ringMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          ringMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        }
      }
      // Show circular glow ring for regular frets, hide for open/fret 12
      if (activeRingGlowRef.current) {
        if (activeIsRoundedRect) {
          activeRingGlowRef.current.visible = false;
        } else {
          activeRingGlowRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset - 0.5,
          );
          activeRingGlowRef.current.visible = true;
          const glowMaterial = activeRingGlowRef.current
            .material as THREE.MeshStandardMaterial;
          glowMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          glowMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        }
      }
      // Show rounded rect ring for open/fret 12, hide for regular frets
      if (activeRingRectRef.current) {
        if (activeIsRoundedRect) {
          activeRingRectRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset,
          );
          activeRingRectRef.current.visible = true;
          // Real-time color update for rounded rect ring
          const rectRingMaterial = activeRingRectRef.current
            .material as THREE.MeshStandardMaterial;
          rectRingMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          rectRingMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        } else {
          activeRingRectRef.current.visible = false;
        }
      }
      // Show rounded rect glow ring for open/fret 12, hide for regular frets
      if (activeRingRectGlowRef.current) {
        if (activeIsRoundedRect) {
          activeRingRectGlowRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset - 0.5,
          );
          activeRingRectGlowRef.current.visible = true;
          const rectGlowMaterial = activeRingRectGlowRef.current
            .material as THREE.MeshStandardMaterial;
          rectGlowMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          rectGlowMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        } else {
          activeRingRectGlowRef.current.visible = false;
        }
      }
    } else {
      // No active note - hide all rings (main + glow)
      if (activeRingRef.current) {
        activeRingRef.current.visible = false;
      }
      if (activeRingGlowRef.current) {
        activeRingGlowRef.current.visible = false;
      }
      if (activeRingRectRef.current) {
        activeRingRectRef.current.visible = false;
      }
      if (activeRingRectGlowRef.current) {
        activeRingRectGlowRef.current.visible = false;
      }
    }

    // Position the preview ring on the NEXT note (initial state - no pulsing)
    if (nextNotePosition) {
      // Show circular preview ring for regular frets
      if (previewRingRef.current) {
        if (nextNoteIsRoundedRect) {
          previewRingRef.current.visible = false;
        } else {
          previewRingRef.current.position.set(
            nextNotePosition.x,
            nextNotePosition.y,
            nextNotePosition.z + activeRingZOffset,
          );
          previewRingRef.current.visible = true;
          const previewMaterial = previewRingRef.current
            .material as THREE.MeshStandardMaterial;
          previewMaterial.color.setHex(DOT_COLORS.PREVIEW_RING);
          previewMaterial.emissive.setHex(DOT_COLORS.PREVIEW_RING);
        }
      }
      // Show rounded rect preview ring for open/fret 12
      if (previewRingRectRef.current) {
        if (nextNoteIsRoundedRect) {
          previewRingRectRef.current.position.set(
            nextNotePosition.x,
            nextNotePosition.y,
            nextNotePosition.z + activeRingZOffset,
          );
          previewRingRectRef.current.visible = true;
          const previewRectMaterial = previewRingRectRef.current
            .material as THREE.MeshStandardMaterial;
          previewRectMaterial.color.setHex(DOT_COLORS.PREVIEW_RING);
          previewRectMaterial.emissive.setHex(DOT_COLORS.PREVIEW_RING);
        } else {
          previewRingRectRef.current.visible = false;
        }
      }
    } else {
      // No next note - hide preview rings
      if (previewRingRef.current) {
        previewRingRef.current.visible = false;
      }
      if (previewRingRectRef.current) {
        previewRingRectRef.current.visible = false;
      }
    }

    // =========================================================================
    // DYNAMIC NOTE LABELS - Show note name on initial state (first and second notes)
    // =========================================================================
    // Find the active note entry (first note) for current label
    const activeNoteEntry = timeline.find(
      (e) => e.type === 'note' && e.noteIndex === initialActiveNoteIndex,
    );

    // Track positions with active finger labels for initial state
    const initialFingerPositions = new Set<string>();

    // Position and update CURRENT note label (first note)
    // Finger numbers take priority over anchor labels - show if finger_index is defined
    // Skip showing 'O' (open string) label - open string position is self-evident
    const currentFingerKey = activeNoteEntry?.note?.finger_index?.toString();
    const showCurrentFingerLabel = currentFingerKey && currentFingerKey !== 'O';

    // DEBUG: Log finger label visibility conditions
    verboseLog('[FINGER-LABEL-DEBUG] Initial note label check:', {
      hasCurrentNoteLabelRef: !!currentNoteLabelRef.current,
      hasActivePosition: !!activePosition,
      hasActiveNoteEntry: !!activeNoteEntry,
      currentFingerKey,
      showCurrentFingerLabel,
      activeNoteEntryFinger: activeNoteEntry?.note?.finger_index,
      noteIndex: activeNoteEntry?.noteIndex,
    });

    if (
      currentNoteLabelRef.current &&
      activePosition &&
      activeNoteEntry &&
      showCurrentFingerLabel
    ) {
      const texture = fingerLabelTextures.get(currentFingerKey);
      if (texture) {
        const material = currentNoteLabelRef.current
          .material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
        // Position with configurable X/Y offset, Z stays on mesh
        currentNoteLabelRef.current.position.set(
          activePosition.x + fingerLabelOffsetX,
          activePosition.y + fingerLabelOffsetY,
          activePosition.z + 1,
        );
        currentNoteLabelRef.current.visible = true;
        // Track this position
        initialFingerPositions.add(
          `${activeNoteEntry.position.stringIndex},${activeNoteEntry.position.fret}`,
        );
      }
    } else if (currentNoteLabelRef.current) {
      currentNoteLabelRef.current.visible = false;
    }

    // Position and update NEXT note label (second note)
    // Finger numbers take priority over anchor labels - show if finger_index is defined
    // Skip showing 'O' (open string) label - open string position is self-evident
    const nextFingerKey = nextNoteEntry?.note?.finger_index?.toString();
    const showNextFingerLabel = nextFingerKey && nextFingerKey !== 'O';
    if (
      nextNoteLabelRef.current &&
      nextNotePosition &&
      nextNoteEntry &&
      showNextFingerLabel
    ) {
      const texture = fingerLabelTextures.get(nextFingerKey);
      if (texture) {
        const material = nextNoteLabelRef.current
          .material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
        // Position with configurable X/Y offset, Z stays on mesh
        nextNoteLabelRef.current.position.set(
          nextNotePosition.x + fingerLabelOffsetX,
          nextNotePosition.y + fingerLabelOffsetY,
          nextNotePosition.z + 1,
        );
        nextNoteLabelRef.current.visible = true;
        // Track this position
        initialFingerPositions.add(
          `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`,
        );
      }
    } else if (nextNoteLabelRef.current) {
      nextNoteLabelRef.current.visible = false;
    }

    // Update active finger positions ref and hide corresponding anchor labels
    activeFingerPositionsRef.current = initialFingerPositions;
    fretNoteLabelRefs.current.forEach((mesh, posKey) => {
      if (mesh) {
        mesh.visible = !initialFingerPositions.has(posKey);
      }
    });

    // =========================================================================
    // STRING LABEL TEXT COLOR - Switch to black text when note is active/preview
    // =========================================================================
    // Get position keys for active and next notes (only for open string & fret 12)
    const activeNotePosKey = activeNoteEntry
      ? `${activeNoteEntry.position.stringIndex},${activeNoteEntry.position.fret}`
      : null;
    const nextNotePosKey = nextNoteEntry
      ? `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`
      : null;

    // Update string label textures based on note state
    stringLabelMeshRefs.current.forEach((mesh, posKey) => {
      if (!mesh) return;

      const material = mesh.material as THREE.MeshBasicMaterial;
      // Extract string index from posKey to get string name
      const stringIndexStr = posKey.split(',')[0];
      if (!stringIndexStr) return;
      const stringIndex = parseInt(stringIndexStr, 10);
      const stringName = STRING_NAMES[stringIndex];
      if (!stringName) return;

      // Determine if this position is active or preview
      const isActiveNote = posKey === activeNotePosKey;
      const isPreviewNote = posKey === nextNotePosKey;

      // Use dark texture (black text) for active/preview notes, light texture (white text) otherwise
      if (isActiveNote || isPreviewNote) {
        const darkTexture = stringLabelTexturesDark.get(stringName);
        if (darkTexture && material.map !== darkTexture) {
          material.map = darkTexture;
          material.needsUpdate = true;
        }
      } else {
        const lightTexture = stringLabelTextures.get(stringName);
        if (lightTexture && material.map !== lightTexture) {
          material.map = lightTexture;
          material.needsUpdate = true;
        }
      }
    });
  }, [
    timeline,
    calculateDotState,
    activeRingZOffset,
    DOT_COLORS.ACTIVE_RING,
    DOT_COLORS.PREVIEW_RING,
    DOT_COLORS.GREY,
    DOT_COLORS.GREY_LIGHT,
    LOOKAHEAD_CONFIG.maxVisibleNotes,
    fingerLabelTextures,
    fingerLabelOffsetX,
    fingerLabelOffsetY,
    stringLabelTextures,
    stringLabelTexturesDark,
  ]);

  // Track if we've initialized to avoid re-running unnecessarily
  const hasInitializedRef = useRef(false);

  // Reset initialization when timeline changes (new exercise selected)
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [timeline]);

  useFrame(() => {
    // When not playing, set up initial state showing first note
    // OR when timeline is empty, reset visuals (handles switching to exercise with no bass notes)
    if (!isPlaying && !hasInitializedRef.current) {
      // Use a small delay to ensure mesh refs are populated
      if (dotMeshRefs.current.size > 0) {
        updateInitialState();
        hasInitializedRef.current = true;
      }
      return;
    }

    // Reset initialization flag when we stop playing so it re-initializes
    if (!isPlaying) {
      return;
    }

    // Mark as needing re-initialization when playback stops
    hasInitializedRef.current = false;

    // Skip updates when no timeline
    if (timeline.length === 0) {
      return;
    }

    // Get current playback time from the atomic clock
    const clock = getAtomicPlaybackClock();
    const state = clock.getCurrentState();
    if (!state) {
      return;
    }

    const { visualSeconds } = state;

    // Find the active note at current time
    let activeNoteIndex = findNoteAtTime(timeline, visualSeconds);

    // During countdown (before first note), show the first note as active
    // findNoteAtTime returns -1 when time is before the first note's startTime
    if (activeNoteIndex === -1 && timeline.length > 0) {
      const firstNoteEntry = timeline.find((e) => e.type === 'note');
      if (firstNoteEntry && visualSeconds < firstNoteEntry.startTime) {
        // We're in countdown - highlight the first note
        activeNoteIndex = 0;
      }
    }

    // Find upcoming notes (next 5 notes after active)
    const upcomingNotes = timeline
      .filter((e) => e.type === 'note' && e.noteIndex > activeNoteIndex)
      .slice(0, LOOKAHEAD_CONFIG.maxVisibleNotes);

    // Track if we found an active dot for the ring and its shape type
    let activePosition: { x: number; y: number; z: number } | null = null;
    let activeIsRoundedRect = false;
    // Track the NEXT note position for preview ring
    let nextNotePosition: { x: number; y: number; z: number } | null = null;
    let nextNoteIsRoundedRect = false;

    // Get the next note entry (first upcoming note)
    const nextNoteEntry = upcomingNotes[0];
    const nextNotePositionKey = nextNoteEntry
      ? `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`
      : null;

    // Update each dot's material based on its state
    dotMeshRefs.current.forEach((mesh, positionKey) => {
      const dotState = calculateDotState(
        positionKey,
        activeNoteIndex,
        upcomingNotes,
      );
      const material = mesh.material as THREE.MeshBasicMaterial;

      // Update color
      material.color.setHex(dotState.color);

      // Update opacity
      material.opacity = dotState.opacity;
      material.transparent = true; // Always transparent to support opacity changes
      material.needsUpdate = true;

      // Track active position for the ring
      if (dotState.isActive) {
        activePosition = {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        };
        activeIsRoundedRect = dotState.isRoundedRect;
      }

      // Track next note position for preview ring
      if (positionKey === nextNotePositionKey) {
        nextNotePosition = {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        };
        // Check if next note is on open string or fret 12
        const fretNum = nextNoteEntry?.position.fret ?? 0;
        nextNoteIsRoundedRect = fretNum === 0 || fretNum === 12;
      }
    });


    // Pulse animation is calculated directly from real time and tempo below

    // Update active ring position - choose shape based on fret type
    if (activePosition) {
      // Show circular ring for regular frets, hide for open/fret 12
      if (activeRingRef.current) {
        if (activeIsRoundedRect) {
          activeRingRef.current.visible = false;
        } else {
          activeRingRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset, // Z offset controlled by prop
          );
          activeRingRef.current.visible = true;
          // Real-time color update for ring
          const ringMaterial = activeRingRef.current
            .material as THREE.MeshStandardMaterial;
          ringMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          ringMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        }
      }
      // Show circular glow ring for regular frets, hide for open/fret 12
      if (activeRingGlowRef.current) {
        if (activeIsRoundedRect) {
          activeRingGlowRef.current.visible = false;
        } else {
          activeRingGlowRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset - 0.5, // Slightly behind main ring
          );
          activeRingGlowRef.current.visible = true;
          // Real-time color update for glow ring
          const glowMaterial = activeRingGlowRef.current
            .material as THREE.MeshStandardMaterial;
          glowMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          glowMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        }
      }
      // Show rounded rect ring for open/fret 12, hide for regular frets
      if (activeRingRectRef.current) {
        if (activeIsRoundedRect) {
          activeRingRectRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset,
          );
          activeRingRectRef.current.visible = true;
          // Real-time color update for rounded rect ring
          const rectRingMaterial = activeRingRectRef.current
            .material as THREE.MeshStandardMaterial;
          rectRingMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          rectRingMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        } else {
          activeRingRectRef.current.visible = false;
        }
      }
      // Show rounded rect glow ring for open/fret 12, hide for regular frets
      if (activeRingRectGlowRef.current) {
        if (activeIsRoundedRect) {
          activeRingRectGlowRef.current.position.set(
            activePosition.x,
            activePosition.y,
            activePosition.z + activeRingZOffset - 0.5, // Slightly behind main ring
          );
          activeRingRectGlowRef.current.visible = true;
          // Real-time color update for glow ring
          const rectGlowMaterial = activeRingRectGlowRef.current
            .material as THREE.MeshStandardMaterial;
          rectGlowMaterial.color.setHex(DOT_COLORS.ACTIVE_RING);
          rectGlowMaterial.emissive.setHex(DOT_COLORS.ACTIVE_RING);
        } else {
          activeRingRectGlowRef.current.visible = false;
        }
      }
    } else {
      // No active note - hide all rings (main + glow)
      if (activeRingRef.current) {
        activeRingRef.current.visible = false;
      }
      if (activeRingGlowRef.current) {
        activeRingGlowRef.current.visible = false;
      }
      if (activeRingRectRef.current) {
        activeRingRectRef.current.visible = false;
      }
      if (activeRingRectGlowRef.current) {
        activeRingRectGlowRef.current.visible = false;
      }
    }

    // Calculate pulse scale for preview ring - synced to transport beat position
    // During countdown, continuousBeat is 0, so we calculate from visualSeconds instead
    // One full pulse cycle per quarter note (beat), in sync with the actual playback timeline
    let pulseScale: number;
    if (state.isCountdown) {
      // During countdown, calculate beat position from visualSeconds and tempo
      const beatsPerSecond = (state.currentBpm || tempo) / 60;
      const beatPosition = state.visualSeconds * beatsPerSecond;
      const beatFraction = beatPosition % 1;
      const pulsePhase = beatFraction * 2 * Math.PI;
      pulseScale = 1.05 + 0.05 * Math.sin(pulsePhase);
    } else {
      // Normal playback - use continuousBeat (counts eighth notes, so divide by 2)
      const quarterNoteBeat = state.continuousBeat / 2;
      const beatFraction = quarterNoteBeat % 1;
      const pulsePhase = beatFraction * 2 * Math.PI;
      pulseScale = 1.05 + 0.05 * Math.sin(pulsePhase);
    }

    // Update preview ring position - shows NEXT note
    if (nextNotePosition) {
      // Show circular preview ring for regular frets, hide for open/fret 12
      if (previewRingRef.current) {
        if (nextNoteIsRoundedRect) {
          previewRingRef.current.visible = false;
        } else {
          previewRingRef.current.position.set(
            nextNotePosition.x,
            nextNotePosition.y,
            nextNotePosition.z + activeRingZOffset,
          );
          previewRingRef.current.scale.setScalar(pulseScale);
          previewRingRef.current.visible = true;
          // Update color
          const previewMaterial = previewRingRef.current
            .material as THREE.MeshStandardMaterial;
          previewMaterial.color.setHex(DOT_COLORS.PREVIEW_RING);
          previewMaterial.emissive.setHex(DOT_COLORS.PREVIEW_RING);
        }
      }
      // Show rounded rect preview ring for open/fret 12, hide for regular frets
      if (previewRingRectRef.current) {
        if (nextNoteIsRoundedRect) {
          previewRingRectRef.current.position.set(
            nextNotePosition.x,
            nextNotePosition.y,
            nextNotePosition.z + activeRingZOffset,
          );
          previewRingRectRef.current.scale.setScalar(pulseScale);
          previewRingRectRef.current.visible = true;
          // Update color
          const previewRectMaterial = previewRingRectRef.current
            .material as THREE.MeshStandardMaterial;
          previewRectMaterial.color.setHex(DOT_COLORS.PREVIEW_RING);
          previewRectMaterial.emissive.setHex(DOT_COLORS.PREVIEW_RING);
        } else {
          previewRingRectRef.current.visible = false;
        }
      }
    } else {
      // No next note - hide preview rings
      if (previewRingRef.current) {
        previewRingRef.current.visible = false;
      }
      if (previewRingRectRef.current) {
        previewRingRectRef.current.visible = false;
      }
    }

    // =========================================================================
    // DYNAMIC NOTE LABELS - Show note name on current and next notes
    // Skip rendering if position already has a permanent anchor label
    // =========================================================================
    // Find the active note entry to get string/fret for note name calculation
    const activeNoteEntry = timeline.find(
      (e) => e.type === 'note' && e.noteIndex === activeNoteIndex,
    );

    // Track positions with active finger labels to hide anchor labels
    const newActiveFingerPositions = new Set<string>();

    // Position and update CURRENT note label
    // Finger numbers take priority over anchor labels - show if finger_index is defined
    // Skip showing 'O' (open string) label - open string position is self-evident
    const currentFingerKey = activeNoteEntry?.note?.finger_index?.toString();
    const showCurrentFingerLabel = currentFingerKey && currentFingerKey !== 'O';
    if (
      currentNoteLabelRef.current &&
      activePosition &&
      activeNoteEntry &&
      showCurrentFingerLabel
    ) {
      const texture = fingerLabelTextures.get(currentFingerKey);
      if (texture) {
        const material = currentNoteLabelRef.current
          .material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
        // Position with configurable X/Y offset, Z stays on mesh
        currentNoteLabelRef.current.position.set(
          activePosition.x + fingerLabelOffsetX,
          activePosition.y + fingerLabelOffsetY,
          activePosition.z + 1,
        );
        currentNoteLabelRef.current.visible = true;
        // Track this position as having a finger label
        newActiveFingerPositions.add(
          `${activeNoteEntry.position.stringIndex},${activeNoteEntry.position.fret}`,
        );
      }
    } else if (currentNoteLabelRef.current) {
      currentNoteLabelRef.current.visible = false;
    }

    // Position and update NEXT note label
    // Finger numbers take priority over anchor labels - show if finger_index is defined
    // Skip showing 'O' (open string) label - open string position is self-evident
    const nextFingerKey = nextNoteEntry?.note?.finger_index?.toString();
    const showNextFingerLabel = nextFingerKey && nextFingerKey !== 'O';
    if (
      nextNoteLabelRef.current &&
      nextNotePosition &&
      nextNoteEntry &&
      showNextFingerLabel
    ) {
      const texture = fingerLabelTextures.get(nextFingerKey);
      if (texture) {
        const material = nextNoteLabelRef.current
          .material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;
        // Position with configurable X/Y offset, Z stays on mesh
        nextNoteLabelRef.current.position.set(
          nextNotePosition.x + fingerLabelOffsetX,
          nextNotePosition.y + fingerLabelOffsetY,
          nextNotePosition.z + 1,
        );
        nextNoteLabelRef.current.visible = true;
        // Track this position as having a finger label
        newActiveFingerPositions.add(
          `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`,
        );
      }
    } else if (nextNoteLabelRef.current) {
      nextNoteLabelRef.current.visible = false;
    }

    // Update the ref with current active finger positions
    activeFingerPositionsRef.current = newActiveFingerPositions;

    // Update anchor label visibility - hide when finger number is shown at same position
    fretNoteLabelRefs.current.forEach((mesh, posKey) => {
      if (mesh) {
        // Hide anchor label if there's an active finger label at this position
        const hasFingerLabel = newActiveFingerPositions.has(posKey);
        mesh.visible = !hasFingerLabel;
      }
    });

    // =========================================================================
    // STRING LABEL TEXT COLOR - Switch to black text when note is active/preview
    // =========================================================================
    // Get position keys for active and next notes (only for open string & fret 12)
    const activeNotePosKey = activeNoteEntry
      ? `${activeNoteEntry.position.stringIndex},${activeNoteEntry.position.fret}`
      : null;
    const nextNotePosKey = nextNoteEntry
      ? `${nextNoteEntry.position.stringIndex},${nextNoteEntry.position.fret}`
      : null;

    // Update string label textures based on note state
    stringLabelMeshRefs.current.forEach((mesh, posKey) => {
      if (!mesh) return;

      const material = mesh.material as THREE.MeshBasicMaterial;
      // Extract string index from posKey to get string name
      const stringIndexStr = posKey.split(',')[0];
      if (!stringIndexStr) return;
      const stringIndex = parseInt(stringIndexStr, 10);
      const stringName = STRING_NAMES[stringIndex];
      if (!stringName) return;

      // Determine if this position is active or preview
      const isActiveNote = posKey === activeNotePosKey;
      const isPreviewNote = posKey === nextNotePosKey;

      // Use dark texture (black text) for active/preview notes, light texture (white text) otherwise
      if (isActiveNote || isPreviewNote) {
        const darkTexture = stringLabelTexturesDark.get(stringName);
        if (darkTexture && material.map !== darkTexture) {
          material.map = darkTexture;
          material.needsUpdate = true;
        }
      } else {
        const lightTexture = stringLabelTextures.get(stringName);
        if (lightTexture && material.map !== lightTexture) {
          material.map = lightTexture;
          material.needsUpdate = true;
        }
      }
    });
  });

  // ── GYM PLAYHEAD SPHERE — its OWN useFrame, independent of the active-note one above ────
  // The gym doesn't run the AtomicPlaybackClock, so the block above early-returns on a null
  // clock. This drives the orange sphere from the SEQUENCER's beat (getPlaybackBeat) + the
  // played note sequence (playheadNotes), shaped by `ph` (PlayheadConfig): the anim type +
  // bezier easing decide the in-between (see playheadGlide). When not playing (beat null) it
  // rests on the first note. Appearance (radius/color/opacity/emissive) is applied live so
  // the dev panel updates it without remounting.
  useFrame((state, delta) => {
    const sphere = playheadSphereRef.current;
    if (!sphere) return;

    // Live appearance from the config (panel-tunable).
    sphere.scale.setScalar(ph.radius);
    const mat = sphere.material as THREE.MeshStandardMaterial;
    mat.color.set(ph.color);
    mat.emissive.set(ph.color);
    mat.emissiveIntensity = ph.emissiveIntensity;
    mat.opacity = ph.opacity;

    if (!showAllNotes || !playheadNotes || playheadNotes.length === 0) {
      sphere.visible = false;
      rippleRefs.current.forEach((r) => r && (r.visible = false));
      ripple2Refs.current.forEach((r) => r && (r.visible = false));
      ghostRefs.current.forEach((g) => g && (g.visible = false));
      tracerRefs.current.forEach((tr) => tr && (tr.visible = false));
      if (approachRingRef.current) approachRingRef.current.visible = false;
      litWindowActiveRef.current = false; // no playback → whole scale lights
      return;
    }

    // Build the rolling lit-window key for a playhead note (matches dotMeshRefs key format).
    const winKey = (note: { string: number; fret: number }) =>
      `${noteStringToVisualIndex(note.string, stringCount)},${note.fret}`;

    // Recolor EVERY dot each frame (the gym has no AtomicPlaybackClock, so the shared one-shot
    // dot-color pass freezes after first paint — this keeps colors live). Exercise dots EASE
    // between their DIM and BRIGHT green: a per-dot brightness [0..1] is lerped toward its window
    // target every frame, so the highlight fades IN/OUT (ease-in-out) instead of snapping. Dimming
    // stays by COLOR (opacity locked at 1 → solid). Non-exercise dots are plain grey.
    const recolorGymDots = () => {
      const active = litWindowActiveRef.current;
      const winSet = litWindowKeysRef.current;
      const bright = scratchBrightColor.current;
      const dim = scratchDimColor.current;
      dotMeshRefs.current.forEach((mesh, positionKey) => {
        const m = mesh.material as THREE.MeshBasicMaterial;
        m.transparent = true;
        m.opacity = 1.0;

        // Non-exercise position → plain grey (marker frets a touch lighter). No animation.
        if (!positionToNotes.has(positionKey)) {
          const fretNum = parseInt(positionKey.split(',')[1] ?? '0', 10);
          const isMarker = MARKER_FRETS.has(fretNum === 0 ? 'open' : fretNum);
          m.color.setHex(isMarker ? DOT_COLORS.GREY_LIGHT : DOT_COLORS.GREY);
          m.needsUpdate = true;
          return;
        }

        // Exercise dot → ease brightness toward its target (1 = bright, 0 = dim), then lerp color.
        // Bright/dim greens + smoothing come from the panel-tunable config (ph).
        const isRoot = rootPositionKeys.has(positionKey);
        bright.set(isRoot ? ph.litBrightRootColor : ph.litBrightColor);
        dim.set(isRoot ? ph.litDimRootColor : ph.litDimColor);
        // When the window is inactive (stopped) every dot is bright; else only window members.
        const target = !active || winSet.has(positionKey) ? 1 : 0;
        const prev = dotBrightnessRef.current.get(positionKey) ?? target;
        const cur = prev + (target - prev) * ph.litSmoothing;
        dotBrightnessRef.current.set(positionKey, cur);
        m.color.copy(dim).lerp(bright, cur);
        m.needsUpdate = true;
      });
    };

    const dotPos = (note: { string: number; fret: number }) => {
      const key = `${noteStringToVisualIndex(note.string, stringCount)},${note.fret}`;
      const mesh = dotMeshRefs.current.get(key);
      return mesh ? mesh.position : null;
    };

    // Hide the LETTER on the dots the playhead is on / approaching / previewing, so the sphere's
    // bounce + the approach ring + the faint runway ghosts read clean. This covers BOTH letter
    // sets: the open-string / fret-12 string names (G/D/A/E/B) AND the fret-marker note names on
    // the 3rd/5th/7th… frets (fretNoteLabelRefs). Every other label is restored to visible.
    const labelKey = (note: { string: number; fret: number }) =>
      `${noteStringToVisualIndex(note.string, stringCount)},${note.fret}`;
    const hideLabelsFor = (notes: Array<{ string: number; fret: number }>) => {
      const occupied = new Set(notes.map(labelKey));
      stringLabelMeshRefs.current.forEach((mesh, posKey) => {
        if (mesh) mesh.visible = !occupied.has(posKey);
      });
      fretNoteLabelRefs.current.forEach((mesh, posKey) => {
        if (mesh) mesh.visible = !occupied.has(posKey);
      });
    };

    const beat = getPlaybackBeat ? getPlaybackBeat() : null;

    // Not playing (beat null) OR counting in (beat < 0) → the sphere waits on the first note.
    // Hide + reset the ripple so it re-fires from the first note when playback (re)starts.
    if (beat === null || beat < 0) {
      rippleRefs.current.forEach((r) => r && (r.visible = false));
      ripple2Refs.current.forEach((r) => r && (r.visible = false));
      tracerRefs.current.forEach((tr) => tr && (tr.visible = false));
      rippleStateRef.current = { noteIdx: -1, t: 1, x: 0, y: 0, z: 0 };

      const startPos = dotPos(playheadNotes[0]!);

      if (beat === null) {
        // STOPPED → light the WHOLE scale (overview before the student starts). No runway/ring.
        litWindowActiveRef.current = false;
        ghostRefs.current.forEach((g) => g && (g.visible = false));
        if (approachRingRef.current) approachRingRef.current.visible = false;
      } else {
        // COUNT-IN (beat < 0) → already DIM the scale and pre-light the START window (the first
        // notes + their rings) so the student sees where to begin before beat 0 hits. ALSO show
        // the anticipation target on the start note: the black runway ghost + the orange approach
        // ring sitting on top, so the full "next note" cue is present during the count-in.
        const win = new Set<string>();
        for (let k = 0; k <= ph.litWindowAhead; k++) {
          const n = playheadNotes[k % playheadNotes.length];
          if (n) win.add(winKey(n));
        }
        litWindowKeysRef.current = win;
        litWindowActiveRef.current = true;

        // First runway ghost (black dot/disc) on the start note — same styling as the nearest
        // ghost in the playing branch (i=0, full falloff).
        const isDisc = ph.runwayShape === 'disc';
        ghostRefs.current.forEach((g, i) => {
          if (!g) return;
          if (i !== 0 || ph.runwayOn <= 0 || !startPos) {
            g.visible = false;
            return;
          }
          const r = ph.radius * ph.runwaySize; // nearest ghost = full size
          g.position.set(
            startPos.x,
            startPos.y,
            startPos.z + (isDisc ? 0.5 : ph.zOffset),
          );
          if (isDisc) g.scale.set(r, r, 0.06);
          else g.scale.setScalar(r);
          const gmat = g.material as THREE.MeshStandardMaterial;
          gmat.color.set(ph.runwayColor);
          gmat.emissive.set(ph.runwayColor);
          gmat.opacity = ph.runwayOpacity;
          g.visible = true;
        });

        // Orange approach ring on the start note — held at its start size (the "get ready" target)
        // so it reads as the dot the student is about to play.
        const ar = approachRingRef.current;
        if (ar && startPos && ph.approachOn > 0) {
          ar.position.set(startPos.x, startPos.y, startPos.z + 1.5);
          ar.scale.setScalar(ph.radius * ph.approachStart);
          const armat = ar.material as THREE.MeshBasicMaterial;
          armat.color.set(ph.approachColor);
          armat.opacity = ph.approachOpacity;
          ar.visible = true;
        } else if (ar) {
          ar.visible = false;
        }
      }
      recolorGymDots();
      // Idle/count-in: the sphere waits on the first note — hide that one dot's letter.
      hideLabelsFor([playheadNotes[0]!]);
      const pos = startPos;
      if (pos) {
        // IDLE "pending" BOUNCE — a gentle hover on the first dot so the sphere feels alive
        // while waiting to start. A rectified sine (|sin|) reads as soft little bounces; the
        // sphere squashes slightly when it's lowest (near the dot).
        const tt = state.clock.elapsedTime * 3.2; // bounce speed
        const bob = Math.abs(Math.sin(tt)); // 0 (on the dot) → 1 (apex) → 0
        const lift = ph.zOffset + bob * ph.radius * 0.9; // hover height
        const squash = 1 - (1 - bob) * 0.18; // a touch flatter at the bottom
        sphere.position.set(pos.x, pos.y, pos.z + lift);
        sphere.scale.set(ph.radius, ph.radius * squash, ph.radius);
        sphere.visible = true;
      } else {
        sphere.visible = false;
      }
      return;
    }

    // Active note = the last note whose startBeat ≤ beat (sequence is ascending in beat).
    let idx = 0;
    for (let i = 0; i < playheadNotes.length; i++) {
      if (playheadNotes[i]!.startBeat <= beat) idx = i;
      else break;
    }
    const cur = playheadNotes[idx]!;
    // On the LAST note, the next note WRAPS to the first (the loop seam) so the sphere glides
    // back to the start instead of snapping. Its slot then runs to the loop end (loopBeats).
    const onLast = idx === playheadNotes.length - 1;
    const next = onLast
      ? (playheadNotes[0] ?? null)
      : (playheadNotes[idx + 1] ?? null);

    // ROLLING LIT WINDOW: light only what's AHEAD — the next `litWindowAhead` upcoming notes
    // (wrapping the loop). The CURRENT note is NOT in the window: it dims back with the rest (the
    // sphere already marks where you are; the bright dot marks where you're GOING). The dot-color
    // path reads litWindowKeysRef/Active each frame.
    const win = new Set<string>();
    for (let k = 1; k <= ph.litWindowAhead; k++) {
      const n = playheadNotes[(idx + k) % playheadNotes.length];
      if (n) win.add(winKey(n));
    }
    litWindowKeysRef.current = win;
    litWindowActiveRef.current = true;
    recolorGymDots();

    const fromPos = dotPos(cur);
    if (!fromPos) {
      sphere.visible = false;
      return;
    }
    const toPos = next ? dotPos(next) : null;

    // Progress through the CURRENT note's slot [0..1], then let the config's anim type +
    // bezier shape the glide t (current→next) + the vertical hop. For the last note the slot
    // ends at the loop length; otherwise at the next note's startBeat.
    const slotEnd = onLast
      ? loopBeats && loopBeats > cur.startBeat
        ? loopBeats
        : cur.startBeat + 0.5
      : (next?.startBeat ?? cur.startBeat + 0.5);
    const slot = Math.max(slotEnd - cur.startBeat, 1e-3);
    const noteProgress = Math.min(Math.max((beat - cur.startBeat) / slot, 0), 1);
    const { t, hop } = playheadGlide(noteProgress, ph);

    // Hide the LETTER on the dots ahead (NEXT + any runway ghosts) — always, the sphere's heading
    // there. The CURRENT dot's letter is hidden ONLY while the sphere is still sitting on it; the
    // moment the glide starts (t past a hair), free it so the letter reappears AS the sphere leaves,
    // not a beat later when idx finally flips. (Without this, `cur` stayed hidden the whole slot.)
    const labelWindow = ph.runwayOn > 0 ? Math.max(1, Math.round(ph.runwayCount)) : 1;
    const hidden: Array<{ string: number; fret: number }> = [];
    if (t < 0.05) hidden.push(cur); // sphere still on the current dot
    for (let k = 1; k <= labelWindow; k++) {
      const n = playheadNotes[(idx + k) % playheadNotes.length];
      if (n) hidden.push(n);
    }
    hideLabelsFor(hidden);

    const target = toPos ?? fromPos;
    sphere.position.set(
      fromPos.x + (target.x - fromPos.x) * t,
      fromPos.y + (target.y - fromPos.y) * t + hop * ph.hopHeight,
      fromPos.z + (target.z - fromPos.z) * t + ph.zOffset,
    );
    // On-beat pulse scales the sphere up then settles.
    sphere.scale.setScalar(ph.radius * playheadPulse(noteProgress, ph));
    sphere.visible = true;

    // ── LANDING RIPPLE — fire concentric rings at the dot each time the sphere lands on a
    //    NEW note (the bounce touchdown). `rippleRings` of them, STAGGERED so the inner ring
    //    leads and outer ones trail → a dartboard shockwave. A trailing SECOND ripple fires
    //    `ripple2Delay` behind in ripple2Color. All tunable via ph.ripple*.
    const ringCount = Math.min(
      Math.max(Math.round(ph.rippleRings), 1),
      MAX_RIPPLE_RINGS,
    );
    const st = rippleStateRef.current;
    // New note → retrigger both ripples at this dot, ANCHORING them to this dot's position so the
    // ripple finishes its full duration right here even after the playhead glides to the next note.
    if (idx !== st.noteIdx) {
      st.noteIdx = idx;
      st.t = 0;
      st.x = fromPos.x;
      st.y = fromPos.y;
      st.z = fromPos.z;
    }
    // Advance by REAL time so the ripple lasts rippleDurationMs regardless of frame rate. Run the
    // clock past 1 by the trailing ripple's DELAY so the delayed (2nd) ripple can also reach its
    // own end (localT = st.t − delay ≥ 1) and HIDE — otherwise it freezes at its last frame
    // (st.t capped at 1 → localT maxes at 1−delay, never completing). This is what left a ripple
    // ring stuck on screen until the next note clipped it.
    const maxDelay = ph.ripple2On > 0 ? Math.max(ph.ripple2Delay, 0) : 0;
    const clockEnd = 1 + maxDelay;
    if (st.t < clockEnd) {
      const durSec = Math.max(ph.rippleDurationMs, 1) / 1000;
      st.t = Math.min(st.t + delta / durSec, clockEnd);
    }

    // Render one ripple pool with a given color + a time delay (0 = first, ripple2Delay =
    // trailing). Each ring in the pool is staggered so they read as concentric.
    const renderRipple = (
      refs: (THREE.Mesh | null)[],
      on: boolean,
      color: string,
      delay: number,
    ) => {
      refs.forEach((ring, i) => {
        if (!ring) return;
        const localT = st.t - delay; // shift this pool's clock back by the delay
        if (!on || i >= ringCount || localT <= 0 || localT >= 1) {
          ring.visible = false;
          return;
        }
        const stagger = (i / ringCount) * 0.45;
        const e = Math.min(Math.max((localT - stagger) / (1 - stagger), 0), 1);
        if (e <= 0 || e >= 1) {
          ring.visible = false;
          return;
        }
        const scale = ph.radius * (1 + e * (ph.rippleExpand - 1));
        // Anchored at the dot it FIRED on (st.x/y/z), not the current note — so a long ripple
        // plays out in place instead of being yanked to the next note's dot.
        ring.position.set(st.x, st.y, st.z + 1);
        ring.scale.setScalar(scale);
        const rmat = ring.material as THREE.MeshBasicMaterial;
        rmat.color.set(color);
        rmat.opacity = (1 - e) * ph.rippleOpacity; // bright on impact → transparent
        ring.visible = true;
      });
    };

    renderRipple(rippleRefs.current, ph.rippleOn > 0, ph.rippleColor, 0);
    renderRipple(
      ripple2Refs.current,
      ph.rippleOn > 0 && ph.ripple2On > 0,
      ph.ripple2Color,
      ph.ripple2Delay,
    );

    // ── ANTICIPATION RUNWAY (Pass 1) — ghost spheres on the next `count` notes, fading with
    //    distance, + tracer segments connecting them (the road). Tempo-scaled: shorten at
    //    fast BPM so the screen doesn't clutter. ──
    const hideRunway = () => {
      ghostRefs.current.forEach((g) => g && (g.visible = false));
      tracerRefs.current.forEach((tr) => tr && (tr.visible = false));
    };
    if (ph.runwayOn <= 0) {
      hideRunway();
    } else {
      // Tempo scale: at/above runwayTempoCap, halve the count (floor 1); below, full count.
      const tempoScale =
        ph.runwayTempoCap > 0 && tempo >= ph.runwayTempoCap ? 0.5 : 1;
      const count = Math.min(
        Math.max(Math.round(ph.runwayCount * tempoScale), 1),
        MAX_RUNWAY,
      );
      // Chain of positions: the active dot, then the next `count` notes' dots. WRAPS around
      // the loop (idx+k mod length) so the runway keeps previewing into the next cycle's
      // start notes instead of emptying out near the end.
      const chain: ({ x: number; y: number; z: number } | null)[] = [fromPos];
      for (let k = 1; k <= count; k++) {
        const n = playheadNotes[(idx + k) % playheadNotes.length];
        chain.push(n ? dotPos(n) : null);
      }
      // GHOSTS — one per upcoming note (chain index 1..count). Shape: raised SPHERE or a
      // flat DISC lying on the fretboard (a near-zero z-scale flattens the sphere to a disc).
      const isDisc = ph.runwayShape === 'disc';
      ghostRefs.current.forEach((g, i) => {
        if (!g) return;
        const pos = i < count ? chain[i + 1] : null;
        if (!pos) {
          g.visible = false;
          return;
        }
        // Fade + shrink with distance (i=0 nearest → brightest/biggest).
        const falloff = 1 - i / count;
        const r = ph.radius * ph.runwaySize * (0.6 + 0.4 * falloff);
        // Disc sits ON the plane (no z-lift, flat); sphere is raised by zOffset.
        g.position.set(pos.x, pos.y, pos.z + (isDisc ? 0.5 : ph.zOffset));
        if (isDisc) g.scale.set(r, r, 0.06);
        else g.scale.setScalar(r);
        const gmat = g.material as THREE.MeshStandardMaterial;
        gmat.color.set(ph.runwayColor);
        gmat.emissive.set(ph.runwayColor);
        gmat.opacity = ph.runwayOpacity * falloff;
        g.visible = true;
      });
      // TRACERS — a thin box stretched between each consecutive pair in the chain. Own
      // color/thickness; `tracerCount` caps how many segments draw (≤ the gaps available).
      const tracerCap = Math.min(
        Math.max(Math.round(ph.tracerCount), 0),
        count,
      );
      tracerRefs.current.forEach((tr, i) => {
        if (!tr) return;
        const a = chain[i];
        const b = chain[i + 1];
        if (ph.runwayTracer <= 0 || i >= tracerCap || !a || !b) {
          tr.visible = false;
          return;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-3) {
          tr.visible = false;
          return;
        }
        tr.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, a.z + 1);
        tr.rotation.set(0, 0, Math.atan2(dy, dx));
        tr.scale.set(len, ph.radius * ph.tracerThickness, 1); // length × thickness
        const tmat = tr.material as THREE.MeshBasicMaterial;
        tmat.color.set(ph.tracerColor);
        const falloff = 1 - i / count;
        tmat.opacity = ph.runwayTracer * falloff;
        tr.visible = true;
      });
    }

    // ── APPROACH RING (Pass 2) — shrinks onto the NEXT dot as its beat arrives, collapsing
    //    to the dot on the downbeat ("play now"). Lead = approachLead beats. ──
    const ar = approachRingRef.current;
    if (ar) {
      // Target the SAME wrapped `next` note the sphere + runway use, so the seam is seamless: on
      // the LAST note `next` wraps to the first dot. Its effective downbeat then sits at the loop
      // end (loopBeats), not its raw startBeat (~0) — otherwise the ring math sees a huge negative
      // lead at the seam and never projects the orange ring onto the wrapped first dot.
      const nextNote = next;
      const nextPos = nextNote ? dotPos(nextNote) : null;
      const nextTargetBeat =
        onLast && loopBeats && loopBeats > cur.startBeat
          ? loopBeats
          : (nextNote?.startBeat ?? -1);
      const lead = Math.max(ph.approachLead, 1e-3);
      // a ∈ [0..1]: 0 = `lead` beats before the next note's (possibly wrapped) downbeat, 1 = ON it.
      const a = nextNote ? (beat - (nextTargetBeat - lead)) / lead : -1;
      if (ph.approachOn <= 0 || !nextPos || a <= 0 || a >= 1) {
        ar.visible = false;
      } else {
        // Shrink from approachStart× down to ~1× (the dot) as a → 1.
        const scale = ph.radius * (1 + (ph.approachStart - 1) * (1 - a));
        ar.position.set(nextPos.x, nextPos.y, nextPos.z + 1.5);
        ar.scale.setScalar(scale);
        const armat = ar.material as THREE.MeshBasicMaterial;
        armat.color.set(ph.approachColor);
        armat.opacity = ph.approachOpacity * a; // fades IN as it closes
        ar.visible = true;
      }
    }
  });

  // ── ROOT MARKER RINGS — STATIC, EXACTLY like the yellow active ring (same torus, already
  //    dot-sized; positioned at the dot + activeRingZOffset, no scaling). Only the color
  //    differs. Independent of playback (always on for the gym), so its OWN useFrame. ──
  useFrame(() => {
    // GYM: the tutorial's yellow rings are DISMISSED — force ALL of them hidden every frame
    // (active circular + rounded-rect + glows, AND the preview rings) so none can linger.
    if (showAllNotes) {
      if (activeRingRef.current) activeRingRef.current.visible = false;
      if (activeRingGlowRef.current) activeRingGlowRef.current.visible = false;
      if (activeRingRectRef.current) activeRingRectRef.current.visible = false;
      if (activeRingRectGlowRef.current)
        activeRingRectGlowRef.current.visible = false;
      if (previewRingRef.current) previewRingRef.current.visible = false;
      if (previewRingRectRef.current) previewRingRectRef.current.visible = false;
    }
    const rings = rootRingRefs.current;
    const rectRings = rootRingRectRefs.current;
    if (!showAllNotes || ph.rootRingOn <= 0 || !rootPositions) {
      rings.forEach((r) => r && (r.visible = false));
      rectRings.forEach((r) => r && (r.visible = false));
      return;
    }
    for (let i = 0; i < MAX_ROOT_RINGS; i++) {
      const torus = rings[i];
      const rect = rectRings[i];
      const root = rootPositions[i];
      // Default both off; the matching shape turns on below.
      if (torus) torus.visible = false;
      if (rect) rect.visible = false;
      if (!root) continue;

      const key = `${noteStringToVisualIndex(root.string, stringCount)},${root.fret}`;
      const mesh = dotMeshRefs.current.get(key);
      if (!mesh) continue;

      // At fret 0 (open) or 12 the dot is a rounded RECT, so use the rect ring; else the torus.
      const useRect = root.fret === 0 || root.fret === 12;
      const ring = useRect ? rect : torus;
      if (!ring) continue;

      // Identical placement to the active ring (dot center + the same Z offset, no scale).
      ring.position.set(
        mesh.position.x,
        mesh.position.y,
        mesh.position.z + activeRingZOffset,
      );
      const rmat = ring.material as THREE.MeshStandardMaterial;
      // DIM with the dots: while PLAYING, a root ring OUTSIDE the bright window darkens to match
      // its dimmed dot (by COLOR — scale the RGB down, keep it solid). Roots inside the window,
      // and all roots when stopped, stay at full color.
      const inWindow =
        !litWindowActiveRef.current || litWindowKeysRef.current.has(key);
      rmat.color.set(ph.rootRingColor);
      rmat.emissive.set(ph.rootRingColor);
      if (!inWindow) {
        rmat.color.multiplyScalar(ph.rootRingDimFactor);
        rmat.emissive.multiplyScalar(ph.rootRingDimFactor);
      }
      ring.visible = true;
    }
  });

  return (
    <group name="debug-fretboard-grid">
      {/* Background removed - transparent */}

      {/* ============================================================
          STRING LINES - Horizontal lines for each string
          Uses get3DPosition for positioning mode awareness
          Rotated to lie on the tilted plane in non-flat modes
          ============================================================ */}
      {Array.from({ length: stringCount }, (_, stringIndex) => {
        const pos2d = getDotPosition2D(stringIndex, 'open');
        // Get start and end positions for the string line
        const startPos = get3DPosition(openStringX, pos2d.y, 0);
        const endPos = get3DPosition(lastFretX, pos2d.y, 0);
        // Calculate center position for the line mesh
        const lineCenterX = (startPos.x + endPos.x) / 2;
        const lineCenterY = (startPos.y + endPos.y) / 2;
        const lineCenterZ = (startPos.z + endPos.z) / 2;
        // For string lines (horizontal), length is always along X axis
        const lineLength = lastFretX - openStringX;

        return (
          <mesh
            key={`string-line-${stringIndex}`}
            position={[lineCenterX, lineCenterY, lineCenterZ]}
            rotation={[gridRotationX, 0, 0]}
            name={`string-${stringIndex}`}
          >
            <boxGeometry
              args={[lineLength, gridLineThickness, gridLineThickness]}
            />
            <meshBasicMaterial
              color={SLATE_700}
              clippingPlanes={globalClippingPlanes}
            />
          </mesh>
        );
      })}

      {/* ============================================================
          FRET LINES - Vertical lines for each fret position
          Uses get3DPosition for positioning mode awareness
          Rotated to lie on the tilted plane in non-flat modes
          ============================================================ */}
      {/* Open string vertical line */}
      {(() => {
        const topPos = get3DPosition(openStringX, firstStringY, 0);
        const bottomPos = get3DPosition(openStringX, lastStringY, 0);
        const lineCenterX = (topPos.x + bottomPos.x) / 2;
        const lineCenterY = (topPos.y + bottomPos.y) / 2;
        const lineCenterZ = (topPos.z + bottomPos.z) / 2;
        // For fret lines (vertical), height is the distance between strings in 2D
        const lineHeight = lastStringY - firstStringY;

        // Calculate edge fade opacity
        const fadeOpacity = calculateFadeOpacity(openStringX);
        if (fadeOpacity === 0) return null;

        return (
          <mesh
            position={[lineCenterX, lineCenterY, lineCenterZ]}
            rotation={[gridRotationX, 0, 0]}
            name="fret-line-open"
          >
            <boxGeometry
              args={[gridLineThickness, lineHeight, gridLineThickness]}
            />
            <meshBasicMaterial
              color={SLATE_700}
              clippingPlanes={globalClippingPlanes}
              transparent={fadeOpacity < 1}
              opacity={fadeOpacity}
            />
          </mesh>
        );
      })()}

      {/* Fret lines 1 to maxFrets */}
      {Array.from({ length: maxFrets }, (_, fretIndex) => {
        const fret = fretIndex + 1;
        const pos2d = getDotPosition2D(0, fret);
        // Get top and bottom positions for the fret line
        const topPos = get3DPosition(pos2d.x, firstStringY, 0);
        const bottomPos = get3DPosition(pos2d.x, lastStringY, 0);
        // Calculate center position for the line mesh
        const lineCenterX = (topPos.x + bottomPos.x) / 2;
        const lineCenterY = (topPos.y + bottomPos.y) / 2;
        const lineCenterZ = (topPos.z + bottomPos.z) / 2;
        // For fret lines (vertical), height is the distance between strings in 2D
        const lineHeight = lastStringY - firstStringY;

        // Calculate edge fade opacity
        const fadeOpacity = calculateFadeOpacity(pos2d.x);
        if (fadeOpacity === 0) return null;

        return (
          <mesh
            key={`fret-line-${fret}`}
            position={[lineCenterX, lineCenterY, lineCenterZ]}
            rotation={[gridRotationX, 0, 0]}
            name={`fret-${fret}`}
          >
            <boxGeometry
              args={[gridLineThickness, lineHeight, gridLineThickness]}
            />
            <meshBasicMaterial
              color={SLATE_700}
              clippingPlanes={globalClippingPlanes}
              transparent={fadeOpacity < 1}
              opacity={fadeOpacity}
            />
          </mesh>
        );
      })}

      {/* ============================================================
          DOT MARKERS - At EVERY string/fret intersection
          These should align EXACTLY with 2D fretboard dots
          - Open string and fret 12: rounded rectangle (like 2D rounded-md)
          - All other frets: circle (like 2D rounded-full)
          - HIGHLIGHTED DOTS: Exercise notes show BLUE with gradient opacity
          - All other positions show GREY (slate-600)
          ============================================================ */}
      {allDots.map((dot) => {
        // Position key for ref storage and note lookup
        const positionKey = `${dot.stringIndex},${dot.fret === 'open' ? 0 : dot.fret}`;

        // Use rounded rectangle for open string and fret 12, circle for others
        const isRoundedRect = dot.fret === 'open' || dot.fret === 12;

        // Determine if this is a marker fret (lighter grey)
        const isMarkerFret = MARKER_FRETS.has(dot.fret);
        const initialColor = isMarkerFret
          ? DOT_COLORS.GREY_LIGHT
          : DOT_COLORS.GREY;

        // For rounded rectangles, create ShapeGeometry from rounded rect shape
        // Tailwind rounded-md = 6px border radius, scaled to match dot size
        const roundedRectShape = isRoundedRect
          ? createRoundedRectShape(dotRadius * 2, dotRadius * 2, 6)
          : null;

        // Calculate edge fade opacity based on scroll position
        const fadeOpacity = calculateFadeOpacity(dot.x2d);

        // Skip rendering if completely faded out
        if (fadeOpacity === 0) return null;

        // Callback ref to store mesh reference for useFrame updates
        const refCallback = (mesh: THREE.Mesh | null) => {
          if (mesh) {
            dotMeshRefs.current.set(positionKey, mesh);
          } else {
            dotMeshRefs.current.delete(positionKey);
          }
        };

        return (
          <mesh
            key={`dot-${dot.stringIndex}-${dot.fret}`}
            ref={refCallback}
            position={[dot.x3d, dot.y3d, dot.z3d]}
            name={`dot-s${dot.stringIndex}-f${dot.fret}`}
          >
            {isRoundedRect && roundedRectShape ? (
              <shapeGeometry args={[roundedRectShape]} />
            ) : (
              <circleGeometry args={[dotRadius, 32]} />
            )}
            {/* Initial color based on marker fret - useFrame will update to BLUE for exercise notes */}
            <meshBasicMaterial
              color={initialColor}
              side={THREE.DoubleSide}
              clippingPlanes={globalClippingPlanes}
              transparent={true}
              opacity={fadeOpacity}
            />
          </mesh>
        );
      })}

      {/* Corner reference markers removed - were large colored spheres at corners */}

      {/* ============================================================
          STRING LABELS - Text on open string and 12th fret rounded rectangles
          Displays G, D, A, E, B (or C for 6-string) on the string dot faces
          Uses canvas-based textures on planes for reliable 3D text rendering
          Text color changes: white (default) -> black (when active/preview note)
          ============================================================ */}
      {allDots
        .filter((dot) => dot.fret === 'open' || dot.fret === 12)
        .map((dot) => {
          // Get string name based on absolute string index
          const stringName = STRING_NAMES[dot.stringIndex] || '';
          const texture = stringLabelTextures.get(stringName);

          // Calculate edge fade opacity based on scroll position
          const fadeOpacity = calculateFadeOpacity(dot.x2d);

          // Skip rendering if completely faded out, no name, or no texture
          if (fadeOpacity === 0 || !stringName || !texture) return null;

          // Label size - small plane for the letter
          const labelSize = 16;

          // Position key for tracking (matches dot position key format)
          const fretNum = dot.fret === 'open' ? 0 : dot.fret;
          const posKey = `${dot.stringIndex},${fretNum}`;

          return (
            <mesh
              key={`string-label-${dot.fret}-${dot.stringIndex}`}
              ref={(mesh: THREE.Mesh | null) => {
                if (mesh) {
                  stringLabelMeshRefs.current.set(posKey, mesh);
                }
              }}
              position={[dot.x3d, dot.y3d, dot.z3d + 1]}
              rotation={[gridRotationX, 0, 0]}
              name={`string-label-${dot.fret}-${stringName}`}
            >
              <planeGeometry args={[labelSize, labelSize]} />
              <meshBasicMaterial
                map={texture}
                transparent={true}
                opacity={fadeOpacity}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          );
        })}

      {/* ============================================================
          FRET NOTE LABELS - Smaller labels for specific fret positions
          E string: fret 3 = G, fret 5 = A
          A string: fret 3 = C, fret 5 = D
          ============================================================ */}
      {FRET_NOTE_LABELS.map((labelConfig) => {
        // Find the dot for this string/fret combination
        const dot = allDots.find(
          (d) =>
            d.stringIndex === labelConfig.stringIndex &&
            d.fret === labelConfig.fret,
        );
        if (!dot) return null;

        const texture = fretNoteLabelTextures.get(labelConfig.label);
        if (!texture) return null;

        // Calculate edge fade opacity based on scroll position
        const fadeOpacity = calculateFadeOpacity(dot.x2d);
        if (fadeOpacity === 0) return null;

        // Smaller label size than open string labels
        const labelSize = 12;
        // Position key for tracking - matches format used in activeFingerPositionsRef
        const posKey = `${labelConfig.stringIndex},${labelConfig.fret}`;

        return (
          <mesh
            key={`fret-note-label-${labelConfig.stringIndex}-${labelConfig.fret}`}
            ref={(mesh) => {
              if (mesh) {
                fretNoteLabelRefs.current.set(posKey, mesh);
              }
            }}
            position={[dot.x3d, dot.y3d, dot.z3d + 1]}
            rotation={[gridRotationX, 0, 0]}
            name={`fret-note-label-${labelConfig.label}-s${labelConfig.stringIndex}-f${labelConfig.fret}`}
          >
            <planeGeometry args={[labelSize, labelSize]} />
            <meshBasicMaterial
              map={texture}
              transparent={true}
              opacity={fadeOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* ============================================================
          ACTIVE NOTE RING GLOW (CIRCULAR) - Soft outer glow behind main ring
          Larger, more transparent for a professional glow effect
          ============================================================ */}
      <mesh
        ref={activeRingGlowRef}
        visible={false}
        position={[0, 0, 4.5]} // Slightly behind main ring
        name="active-note-ring-circular-glow"
      >
        <torusGeometry
          args={[activeRingRadius, activeRingTubeRadius * 2, 16, 32]}
        />
        <meshStandardMaterial
          color={DOT_COLORS.ACTIVE_RING}
          emissive={DOT_COLORS.ACTIVE_RING}
          emissiveIntensity={0.8}
          transparent={true}
          opacity={0.15}
          depthWrite={false}
          clippingPlanes={globalClippingPlanes}
        />
      </mesh>

      {/* ============================================================
          ACTIVE NOTE RING (CIRCULAR) - Yellow ring for regular frets
          Position updated at 60fps by useFrame hook based on playback
          Ring geometry controlled by activeRingRadius and activeRingTubeRadius props
          ============================================================ */}
      <mesh
        ref={activeRingRef}
        visible={false} // Initially hidden, shown when a note is active on regular fret
        position={[0, 0, 5]} // Default position, updated by useFrame
        name="active-note-ring-circular"
      >
        <torusGeometry
          args={[activeRingRadius, activeRingTubeRadius, 16, 32]}
        />
        <meshStandardMaterial
          color={DOT_COLORS.ACTIVE_RING}
          emissive={DOT_COLORS.ACTIVE_RING}
          emissiveIntensity={0.6}
          transparent={true}
          opacity={0.8}
          depthWrite={false}
          clippingPlanes={globalClippingPlanes}
        />
      </mesh>

      {/* PLAYHEAD SPHERE (gym Scales tool) — the gliding orange marker. A UNIT sphere; its
          radius/color/opacity/emissive + position/scale are driven each frame from
          playheadConfig in the dedicated playhead useFrame. */}
      <mesh
        ref={playheadSphereRef}
        visible={false}
        position={[0, 0, 6]}
        name="playhead-sphere"
      >
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial
          color={ph.color}
          emissive={ph.color}
          emissiveIntensity={ph.emissiveIntensity}
          transparent={true}
          opacity={ph.opacity}
          depthWrite={false}
          clippingPlanes={globalClippingPlanes}
        />
      </mesh>

      {/* LANDING RIPPLE ("dartboard") — a POOL of flat ring annuli that expand + fade on the
          dot when the sphere touches down. `rippleRings` config decides how many are visible
          (density); the rest stay hidden. Each is a unit annulus; scaled/faded + staggered in
          the playhead useFrame so they read as a concentric shockwave. */}
      {Array.from({ length: MAX_RIPPLE_RINGS }).map((_, i) => (
        <mesh
          key={`ripple-${i}`}
          ref={(m: THREE.Mesh | null) => {
            rippleRefs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 4]}
          name={`playhead-landing-ripple-${i}`}
        >
          <ringGeometry args={[0.78, 1, 48]} />
          <meshBasicMaterial
            color={ph.rippleColor}
            transparent={true}
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* TRAILING SECOND RIPPLE — same shape, fires ripple2Delay behind the first in
          ripple2Color (default black) so each landing is an orange flash chased by a dark
          ring. Its own mesh pool, driven alongside the first in the playhead useFrame. */}
      {Array.from({ length: MAX_RIPPLE_RINGS }).map((_, i) => (
        <mesh
          key={`ripple2-${i}`}
          ref={(m: THREE.Mesh | null) => {
            ripple2Refs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 3.9]}
          name={`playhead-landing-ripple2-${i}`}
        >
          <ringGeometry args={[0.78, 1, 48]} />
          <meshBasicMaterial
            color={ph.ripple2Color}
            transparent={true}
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* ANTICIPATION RUNWAY (Pass 1) — ghost-ball spheres previewing the next few notes.
          Unit spheres positioned/scaled/faded each frame in the playhead useFrame (nearest
          ghost brightest+biggest, fading with distance). */}
      {Array.from({ length: MAX_RUNWAY }).map((_, i) => (
        <mesh
          key={`ghost-${i}`}
          ref={(m: THREE.Mesh | null) => {
            ghostRefs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 5.5]}
          name={`playhead-ghost-${i}`}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshStandardMaterial
            color={ph.runwayColor}
            emissive={ph.runwayColor}
            emissiveIntensity={0.5}
            transparent={true}
            opacity={0}
            depthWrite={false}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* RUNWAY TRACER — thin box segments connecting consecutive ghost dots (the "road").
          A unit box stretched + rotated to span each pair in the playhead useFrame. */}
      {Array.from({ length: MAX_RUNWAY }).map((_, i) => (
        <mesh
          key={`tracer-${i}`}
          ref={(m: THREE.Mesh | null) => {
            tracerRefs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 5]}
          name={`playhead-tracer-${i}`}
        >
          <boxGeometry args={[1, 1, 0.1]} />
          <meshBasicMaterial
            color={ph.runwayColor}
            transparent={true}
            opacity={0}
            depthWrite={false}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* APPROACH RING (Pass 2) — a unit ring that shrinks onto the NEXT dot as its beat
          arrives, collapsing to the dot on the downbeat = "play now". Positioned/scaled/faded
          in the playhead useFrame. */}
      <mesh
        ref={approachRingRef}
        visible={false}
        position={[0, 0, 5.2]}
        name="playhead-approach-ring"
      >
        <ringGeometry args={[0.82, 1, 48]} />
        <meshBasicMaterial
          color={ph.approachColor}
          transparent={true}
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          clippingPlanes={globalClippingPlanes}
        />
      </mesh>

      {/* ROOT MARKER RINGS — EXACTLY the yellow active-note ring's mesh (same torus geometry +
          material), just recolored, placed STATICALLY on each root/octave dot. The yellow ring
          is the template; we don't restyle it, only its color. One per root position. */}
      {Array.from({ length: MAX_ROOT_RINGS }).map((_, i) => (
        <mesh
          key={`root-ring-${i}`}
          ref={(m: THREE.Mesh | null) => {
            rootRingRefs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 5]}
          name={`root-marker-ring-${i}`}
        >
          <torusGeometry
            args={[activeRingRadius, activeRingTubeRadius, 16, 32]}
          />
          <meshStandardMaterial
            color={ph.rootRingColor}
            emissive={ph.rootRingColor}
            emissiveIntensity={0.6}
            transparent={true}
            opacity={0.8}
            depthWrite={false}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* ROOT MARKER RINGS (ROUNDED RECT) — the fret-0/12 variant. Same tube path the yellow
          active-ring-rect follows, recolored; the frame loop shows this instead of the torus
          when a root/octave sits on an open string or fret 12 (so the ring matches the dot). */}
      {Array.from({ length: MAX_ROOT_RINGS }).map((_, i) => (
        <mesh
          key={`root-ring-rect-${i}`}
          ref={(m: THREE.Mesh | null) => {
            rootRingRectRefs.current[i] = m;
          }}
          visible={false}
          position={[0, 0, 5]}
          name={`root-marker-ring-rect-${i}`}
        >
          <tubeGeometry
            args={[roundedRectRingCurve, 64, activeRingTubeRadius, 8, true]}
          />
          <meshStandardMaterial
            color={ph.rootRingColor}
            emissive={ph.rootRingColor}
            emissiveIntensity={0.6}
            transparent={true}
            opacity={0.8}
            depthWrite={false}
            clippingPlanes={globalClippingPlanes}
          />
        </mesh>
      ))}

      {/* ============================================================
          ACTIVE NOTE RING (ROUNDED RECTANGLE) - Yellow ring for open strings & fret 12
          Uses a tube geometry extruded along a rounded rectangle path
          Matches the rounded-md style of the dots at open string and fret 12
          ============================================================ */}
      {(() => {
        // Create the rounded rectangle path for the tube to follow
        const rectWidth = dotRadius * 2 + 2; // Slightly larger than dot
        const rectHeight = dotRadius * 2 + 2;
        const cornerRadius = 6; // Match rounded-md
        const tubeRadius = activeRingTubeRadius;
        const glowTubeRadius = activeRingTubeRadius * 2; // Larger for glow effect

        // Create a curve path that traces the rounded rectangle
        const halfW = rectWidth / 2;
        const halfH = rectHeight / 2;
        const cr = Math.min(cornerRadius, halfW, halfH);

        // Build path points for rounded rectangle (clockwise from bottom-left)
        const pathPoints: THREE.Vector3[] = [];
        const segments = 8; // segments per corner

        // Bottom-left corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              -halfW + cr + cr * Math.cos(angle),
              -halfH + cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Bottom-right corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI * 1.5 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              halfW - cr + cr * Math.cos(angle),
              -halfH + cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Top-right corner
        for (let i = 0; i <= segments; i++) {
          const angle = 0 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              halfW - cr + cr * Math.cos(angle),
              halfH - cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Top-left corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI / 2 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              -halfW + cr + cr * Math.cos(angle),
              halfH - cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Close the loop back to start
        pathPoints.push(pathPoints[0].clone());

        const curve = new THREE.CatmullRomCurve3(pathPoints, true);

        return (
          <>
            {/* Glow ring - soft outer glow behind main ring */}
            <mesh
              ref={activeRingRectGlowRef}
              visible={false}
              position={[0, 0, 4.5]} // Slightly behind main ring
              name="active-note-ring-rect-glow"
            >
              <tubeGeometry args={[curve, 64, glowTubeRadius, 8, true]} />
              <meshStandardMaterial
                color={DOT_COLORS.ACTIVE_RING}
                emissive={DOT_COLORS.ACTIVE_RING}
                emissiveIntensity={0.8}
                transparent={true}
                opacity={0.15}
                depthWrite={false}
                clippingPlanes={globalClippingPlanes}
              />
            </mesh>
            {/* Main ring */}
            <mesh
              ref={activeRingRectRef}
              visible={false} // Initially hidden, shown when note is active on open/fret 12
              position={[0, 0, 5]} // Default position, updated by useFrame
              name="active-note-ring-rect"
            >
              <tubeGeometry args={[curve, 64, tubeRadius, 8, true]} />
              <meshStandardMaterial
                color={DOT_COLORS.ACTIVE_RING}
                emissive={DOT_COLORS.ACTIVE_RING}
                emissiveIntensity={0.6}
                transparent={true}
                opacity={0.8}
                depthWrite={false}
                clippingPlanes={globalClippingPlanes}
              />
            </mesh>
          </>
        );
      })()}

      {/* ============================================================
          PREVIEW RING (CIRCULAR) - Orange pulsing ring for NEXT note
          Shows the upcoming note to help players anticipate
          ============================================================ */}
      <mesh
        ref={previewRingRef}
        visible={false}
        position={[0, 0, 5]}
        name="preview-note-ring-circular"
      >
        <torusGeometry
          args={[activeRingRadius, activeRingTubeRadius, 16, 32]}
        />
        <meshStandardMaterial
          color={DOT_COLORS.PREVIEW_RING}
          emissive={DOT_COLORS.PREVIEW_RING}
          emissiveIntensity={0.8}
          transparent={true}
          opacity={1.0}
          depthWrite={false}
          clippingPlanes={globalClippingPlanes}
        />
      </mesh>

      {/* ============================================================
          PREVIEW RING (ROUNDED RECTANGLE) - Orange pulsing ring for NEXT note
          For open string and fret 12 positions
          ============================================================ */}
      {(() => {
        // Create the rounded rectangle path for the preview ring
        const rectWidth = dotRadius * 2 + 2;
        const rectHeight = dotRadius * 2 + 2;
        const cornerRadius = 6;
        const tubeRadius = activeRingTubeRadius;

        const halfW = rectWidth / 2;
        const halfH = rectHeight / 2;
        const cr = Math.min(cornerRadius, halfW, halfH);

        const pathPoints: THREE.Vector3[] = [];
        const segments = 8;

        // Bottom-left corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              -halfW + cr + cr * Math.cos(angle),
              -halfH + cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Bottom-right corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI * 1.5 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              halfW - cr + cr * Math.cos(angle),
              -halfH + cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Top-right corner
        for (let i = 0; i <= segments; i++) {
          const angle = 0 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              halfW - cr + cr * Math.cos(angle),
              halfH - cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        // Top-left corner
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI / 2 + (i / segments) * (Math.PI / 2);
          pathPoints.push(
            new THREE.Vector3(
              -halfW + cr + cr * Math.cos(angle),
              halfH - cr + cr * Math.sin(angle),
              0,
            ),
          );
        }
        pathPoints.push(pathPoints[0].clone());

        const curve = new THREE.CatmullRomCurve3(pathPoints, true);

        return (
          <mesh
            ref={previewRingRectRef}
            visible={false}
            position={[0, 0, 5]}
            name="preview-note-ring-rect"
          >
            <tubeGeometry args={[curve, 64, tubeRadius, 8, true]} />
            <meshStandardMaterial
              color={DOT_COLORS.PREVIEW_RING}
              emissive={DOT_COLORS.PREVIEW_RING}
              emissiveIntensity={0.8}
              transparent={true}
              opacity={1.0}
              depthWrite={false}
              clippingPlanes={globalClippingPlanes}
            />
          </mesh>
        );
      })()}

      {/* ============================================================
          DYNAMIC FINGER LABEL - CURRENT NOTE
          Shows finger number (1-4, T) on the currently active note
          Only visible when finger_index is assigned to the note
          Size 18x18 - compact finger number display
          ============================================================ */}
      <mesh
        ref={currentNoteLabelRef}
        visible={false}
        position={[0, 0, 6]}
        rotation={[gridRotationX, 0, 0]}
        name="dynamic-finger-label-current"
      >
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial
          map={fingerLabelTextures.get('1') || null}
          transparent={true}
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ============================================================
          DYNAMIC FINGER LABEL - NEXT NOTE
          Shows finger number on the upcoming note during playback
          Size 18x18 - compact finger number display
          ============================================================ */}
      <mesh
        ref={nextNoteLabelRef}
        visible={false}
        position={[0, 0, 6]}
        rotation={[gridRotationX, 0, 0]}
        name="dynamic-finger-label-next"
      >
        <planeGeometry args={[18, 18]} />
        <meshBasicMaterial
          map={fingerLabelTextures.get('1') || null}
          transparent={true}
          opacity={1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ============================================================
          FLOATING TEST RING - Shows this is truly 3D
          Positioned at center of fretboard, floating above
          (Kept for calibration/debugging purposes)
          ============================================================ */}
      {/* ============================================================
          POSITIONING MODE LABEL - Shows which mode is active
          ============================================================ */}
      {/* Note: Text rendering would require drei Text component */}
    </group>
  );
}

/**
 * Ring3DOverlayCanvas renders a transparent Three.js canvas positioned
 * over the 2D fretboard. It only renders the ring meshes, allowing the
 * 2D fretboard to remain visible underneath.
 *
 * @example
 * ```tsx
 * <div style={{ position: 'relative' }}>
 *   <FretboardGrid ref={fretboardRef} ... />
 *   {showRingOverlay && (
 *     <Ring3DOverlayCanvas
 *       fretboardRef={fretboardRef}
 *       exerciseNotes={exerciseNotes}
 *       currentTime={currentTime}
 *       isPlaying={isPlaying}
 *       config={ringConfig}
 *     />
 *   )}
 * </div>
 * ```
 */
export function Ring3DOverlayCanvas({
  fretboardRef: _fretboardRef, // Reserved for future calibration use
  exerciseNotes,
  currentTime,
  isPlaying,
  config,
  stringCount = 4,
  maxFrets = 24,
  countdownBeats = 4,
  tempo = 120,
  viewportWidthOverride, // optional: widen the rendered viewport to show more frets
  // (gym equipment tools). Undefined → the default 580.
  showAllNotes = false, // gym Scales tool: light the WHOLE scale, not a lookahead window
  rootPositions, // gym Scales tool: root notes paint a darker green
  getPlaybackBeat, // gym Scales tool: live playhead clock (beats)
  playheadNotes, // gym Scales tool: the glide path (string/fret + startBeat)
  loopBeats, // gym Scales tool: loop length (beats) for seam glide
  playheadConfig, // gym Scales tool: sphere appearance + animation config
  tiltAngle = 60, // CSS tilt angle - used to position 3D camera to match 2D perspective
  debugRotation = { x: 0, y: 0, z: 0 }, // DEBUG panel rotation - applies to both 2D CSS and 3D scene
  overlay3DConfig = {
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    offsetX: 0,
    offsetY: 0,
    sceneX: 0,
    sceneY: 0,
    sceneZ: 0,
    cameraDistance: 800,
    fovOffset: 0,
    originX: 284,
    originY: 145,
    contentScale: 1.0,
    contentScaleX: 1.0,
    contentScaleY: 1.0,
    cameraY: 0,
    perspectiveMultiplier: 1.0,
    topEdgeScale: 1.0,
    bottomEdgeScale: 1.0,
    positioningMode: 'flat' as 'flat' | 'tilted-plane' | 'screen-space',
  }, // DEBUG: 3D overlay controls
  scrollLeft: _scrollLeftProp = 0, // DEPRECATED: Use scrollContainerRef instead
  scrollContainerRef, // PERFORMANCE: Read scroll directly without React re-renders
  exerciseId, // Exercise ID for detecting exercise changes (fade transitions)
  fadeOpacity = 1, // Controlled by parent for exercise transitions
  fadeDuration = 500, // Transition duration in ms
  transitionPhase = 'stable', // Transition phase for camera zoom animation
  triggerZoomOnMount = false, // When true, starts zoom animation immediately on mount
}: Ring3DOverlayCanvasProps): React.ReactNode {
  // Suppress unused variable warnings for reserved props
  void _fretboardRef;
  void _scrollLeftProp; // Keep for backwards compat but prefer scrollContainerRef

  // DEBUG: Removed mount logging - component is confirmed working

  // Ref to our own container div for accurate sizing
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // PERFORMANCE: Store scroll position in a ref that updates from scrollContainerRef
  // This allows Three.js components to read it without causing React re-renders
  const scrollLeftRef = useRef(0);

  // =============================================================================
  // EXERCISE TRANSITION FADE - Smooth fade out/in when switching exercises
  // =============================================================================
  // When exerciseNotes changes (exercise switch), the 3D overlay fades out
  // while still showing the OLD exercise, then switches to new exercise and
  // fades back in. This provides a smooth visual transition.
  //
  // Animation timeline:
  // 1. Exercise changes detected → start fade out (opacity 1 → 0, 500ms)
  //    - Keep showing OLD exercise data during fade out
  // 2. Fade out complete → switch to NEW exercise data
  // 3. Start fade in (opacity 0 → 1, 500ms)
  //
  // The transition uses CSS opacity for 60fps smoothness.
  //
  // ARCHITECTURE: Exercise transition fade is now controlled by FretboardCard (parent).
  // FretboardCard uses the "double buffer" pattern to snapshot the entire visual state
  // (notes, tempo, zoom, view preset, 3D config) and passes:
  // - Already-delayed exerciseNotes and tempo props (old data during fade-out, new after)
  // - fadeOpacity prop for CSS opacity animation
  // - fadeDuration prop for transition timing
  //
  // This ensures the visual stays stable during fade-out, then swaps to new content.
  // =============================================================================

  // =============================================================================
  // LEFT FADE ANIMATION - Smoothly animate left fade in/out based on scroll
  // =============================================================================
  // Instead of binary on/off, we animate the left fade percentage from 0 to 8%
  // using requestAnimationFrame for smooth 60fps animation.
  //
  // - When scrolled: animate leftFadePercent from 0 → 8 (ease-out)
  // - When back to start: animate leftFadePercent from 8 → 0 (ease-in)
  // - Animation duration: 300ms
  //
  // IMPORTANT: Uses refs for all animation state to avoid stale closures.
  // The leftFadePercent state is only updated for React re-renders of the mask.
  // =============================================================================
  const [leftFadePercent, setLeftFadePercent] = useState(0);
  const animationRef = useRef<number | null>(null);
  const animationStartRef = useRef<number>(0);
  const animationFromRef = useRef<number>(0);
  const animationToRef = useRef<number>(0);
  // Track current animated value in ref to avoid stale closure issues
  const currentFadePercentRef = useRef<number>(0);
  // Track last known scroll state to prevent redundant animations
  const lastScrollStateRef = useRef<'start' | 'scrolled'>('start');

  // Easing function: ease-in-out cubic
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Animation duration in ms - 300ms for snappy response when the fade APPEARS.
  const FADE_ANIMATION_DURATION = 300;
  // When the fade DISAPPEARS (scrolling firmly back to the nut), ease it out over a longer,
  // gentler window so the left edge doesn't pop off — ease-in-out over ~700ms.
  const FADE_OUT_DURATION = 700;
  // Get fade zone from props, default to 10%
  const leftFadeZoneTarget = overlay3DConfig.leftFadeZone ?? 10;
  const rightFadeZone = overlay3DConfig.rightFadeZone ?? 10;
  const SCROLL_THRESHOLD = 1; // px threshold to trigger fade (any scroll triggers it)
  // HYSTERESIS (gym): turn the left fade ON once we're meaningfully off the nut, but only OFF
  // once we're FIRMLY back at the nut. This stops the fade flickering off mid-pan when a key
  // change passes near (but not to) the nut — the fade stays on if the destination is scrolled.
  const FADE_ON_AT = 8; // px — scrolled enough → fade on
  const FADE_OFF_AT = 2; // px — back at the nut → fade off

  // Check scroll state and trigger animation
  useEffect(() => {
    if (!scrollContainerRef?.current) return;

    const scrollContainer = scrollContainerRef.current;

    // Animation function - uses refs only, no stale closures
    const animateToTarget = (targetPercent: number) => {
      // Cancel any ongoing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Skip if already at target
      if (Math.abs(currentFadePercentRef.current - targetPercent) < 0.1) {
        return;
      }

      animationStartRef.current = performance.now();
      animationFromRef.current = currentFadePercentRef.current;
      animationToRef.current = targetPercent;
      // Fading OUT (toward 0) gets the longer, gentler window; fading in stays snappy.
      const duration =
        targetPercent < currentFadePercentRef.current
          ? FADE_OUT_DURATION
          : FADE_ANIMATION_DURATION;

      const animate = (now: number) => {
        const elapsed = now - animationStartRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        const currentValue =
          animationFromRef.current +
          (animationToRef.current - animationFromRef.current) * easedProgress;

        // Update both ref (for animation continuity) and state (for React render)
        currentFadePercentRef.current = currentValue;
        setLeftFadePercent(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    const checkScrollAndAnimate = () => {
      const currentScroll = scrollContainer.scrollLeft;
      // Gym (showAllNotes) uses HYSTERESIS so a key-change pan that lands scrolled keeps the
      // fade on the whole time; the tutorial keeps its simple single-threshold behavior.
      let newScrollState: 'start' | 'scrolled';
      if (showAllNotes) {
        newScrollState =
          lastScrollStateRef.current === 'scrolled'
            ? currentScroll < FADE_OFF_AT
              ? 'start'
              : 'scrolled'
            : currentScroll >= FADE_ON_AT
              ? 'scrolled'
              : 'start';
      } else {
        newScrollState =
          currentScroll > SCROLL_THRESHOLD ? 'scrolled' : 'start';
      }

      // Only trigger animation if scroll state actually changed
      if (newScrollState !== lastScrollStateRef.current) {
        lastScrollStateRef.current = newScrollState;
        const targetPercent =
          newScrollState === 'scrolled' ? leftFadeZoneTarget : 0;
        animateToTarget(targetPercent);
      }
    };

    // Handle scroll immediately for responsive feel
    // No throttling needed since we only animate when state changes (start <-> scrolled)
    const handleScroll = () => {
      checkScrollAndAnimate();
    };

    // Initial check immediately
    checkScrollAndAnimate();

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [scrollContainerRef]);

  // =============================================================================
  // EXERCISE SWITCH CLEANUP - Reset animation state when exercise changes
  // =============================================================================
  // When switching exercises, reset all fade animation refs to prevent stale
  // animation state from the previous exercise affecting the new one.
  // =============================================================================
  useEffect(() => {
    // GYM (showAllNotes): a "key change" is an exerciseNotes change, but the board does NOT
    // reset scroll to 0 — it pans to the new center. So DON'T force the fade off here; that's
    // exactly what made it flicker off-then-on. Leave the fade alone — the scroll-gate (with
    // hysteresis) re-evaluates it from the real scroll position after the pan.
    if (showAllNotes) {
      return;
    }

    // Cancel any ongoing fade animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Reset fade animation refs to initial state
    animationStartRef.current = 0;
    animationFromRef.current = 0;
    animationToRef.current = 0;
    currentFadePercentRef.current = 0;
    lastScrollStateRef.current = 'start';

    // Reset left fade percent state
    setLeftFadePercent(0);

    // Reset scroll position ref
    scrollLeftRef.current = 0;
  }, [exerciseNotes]); // Reset when exercise notes change

  // =============================================================================
  // 2D Fretboard geometry constants - MUST MATCH FretboardGrid.tsx EXACTLY!
  // =============================================================================
  // FretboardGrid.tsx uses these constants (lines 887-900):
  //   STRING_SPACING = 32px between string centers
  //   FRET_SPACING = 36px between fret centers
  //   DOT_RADIUS = 13px
  //   CENTER_OFFSET = 15px (open string X position)
  //   FRET_OFFSET = 38px (from open string to first fret center)
  //   getStringY(index) = index * STRING_SPACING
  //   getFretX(fret) = CENTER_OFFSET + FRET_OFFSET + (fret-1) * FRET_SPACING
  // =============================================================================
  const STRING_SPACING = 32; // px between string centers
  const CENTER_OFFSET = 15; // px for open string X position
  const FRET_OFFSET = 38; // px from open string to first fret center
  const FRET_SPACING = 36; // px between fret centers
  const DOT_RADIUS = 13; // px radius of dots

  // Calculate actual fretboard content dimensions based on strings and frets
  const fretboardGeometry = useMemo(() => {
    // String positions: Y = stringIndex * STRING_SPACING (+ DOT_RADIUS for center)
    const firstStringY = 0 * STRING_SPACING + DOT_RADIUS;
    const lastStringY = (stringCount - 1) * STRING_SPACING + DOT_RADIUS;
    const pixelHeight = lastStringY - firstStringY; // Distance between first and last string centers

    // Fret positions: X = CENTER_OFFSET + FRET_OFFSET + (fret-1) * FRET_SPACING (+ DOT_RADIUS for center)
    const openStringX = CENTER_OFFSET + DOT_RADIUS;
    const lastFretX =
      CENTER_OFFSET + FRET_OFFSET + (maxFrets - 1) * FRET_SPACING + DOT_RADIUS;
    const pixelWidth = lastFretX - openStringX;

    isDebugEnabled() &&
      verboseLog('[Ring3DOverlayCanvas] 📏 FRETBOARD GEOMETRY:', {
        stringCount,
        maxFrets,
        firstStringY,
        lastStringY,
        pixelWidth,
        pixelHeight,
        aspectRatio: (pixelWidth / pixelHeight).toFixed(3),
      });

    return { pixelWidth, pixelHeight, firstStringY, lastStringY };
  }, [stringCount, maxFrets]);

  // Create fretboardRect for debug logging
  const fretboardRect = useMemo<DOMRect>(
    () =>
      ({
        width: fretboardGeometry.pixelWidth,
        height: fretboardGeometry.pixelHeight,
        top: 0,
        left: 0,
        right: fretboardGeometry.pixelWidth,
        bottom: fretboardGeometry.pixelHeight,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    [fretboardGeometry],
  );

  // Build timeline using useFretboardNoteSync
  // This shares the same timing logic as FretboardGrid
  // NOTE: exerciseNotes and tempo are already delayed by FretboardCard
  const { timeline } = useFretboardNoteSync({
    exerciseNotes,
    tempo,
    stringCount,
    maxFrets,
    isPlaying,
    isVisible: config.enabled,
    timeSignature: DEFAULT_TIME_SIGNATURE,
    countdownBeats,
  });

  // Calculate orthographic camera frustum based on fretboard dimensions
  // IMPORTANT: This must be called before any early returns to satisfy React hooks rules
  //
  // Camera is positioned at Y=15 looking straight down at XZ plane
  // with rotation [-PI/2, 0, 0]. In this orientation:
  // - Camera's left/right → World X-axis (frets direction)
  // - Camera's top/bottom → World Z-axis (strings direction)
  //
  // The DebugVisualization uses:
  // - WORLD_DEPTH = 6 (Z-axis extent, strings)
  // - worldWidth = 6 * aspectRatio (X-axis extent, frets)
  // =============================================================================
  // CANVAS DIMENSIONS - Fixed viewport size, content offset by scroll position
  // =============================================================================
  // Default 580 (matches the 2D viewport, shows ~fret 12). An override widens the
  // rendered viewport so MORE frets are visible — used by the gym equipment tools,
  // which have room to show the full neck. The tutorial passes nothing → 580.
  const VIEWPORT_WIDTH = viewportWidthOverride ?? 580;
  const VIEWPORT_HEIGHT = 290; // Fixed - matches 2D fretboard height

  // Calculate full content width for positioning calculations
  // This is the full fretboard width (all frets) - used for centering math
  const FULL_CONTENT_WIDTH =
    CENTER_OFFSET +
    FRET_OFFSET +
    (maxFrets - 1) * FRET_SPACING +
    DOT_RADIUS * 2 +
    20;

  // Canvas uses viewport size (not full content size)
  const FIXED_CANVAS_WIDTH = VIEWPORT_WIDTH;
  const FIXED_CANVAS_HEIGHT = VIEWPORT_HEIGHT;

  // Calculate world dimensions for the perspective camera
  const worldDimensions = useMemo(() => {
    const WORLD_DEPTH = 6; // Base depth for string area (Z-axis)

    // Use FIXED canvas dimensions that match FretboardCard.tsx container
    const aspectRatio = FIXED_CANVAS_WIDTH / FIXED_CANVAS_HEIGHT;
    const worldHeight = WORLD_DEPTH;
    const worldWidth = worldHeight * aspectRatio;

    isDebugEnabled() &&
      verboseLog('[Ring3DOverlayCanvas] 📷 WORLD DIMENSIONS:', {
        worldWidth,
        worldHeight,
        aspectRatio,
        fixedCanvasDimensions: {
          width: FIXED_CANVAS_WIDTH,
          height: FIXED_CANVAS_HEIGHT,
        },
      });

    return { worldWidth, worldHeight };
  }, [FIXED_CANVAS_WIDTH, FIXED_CANVAS_HEIGHT]);

  // =============================================================================
  // NOTE POSITION WRAPPER - For RingOverlayGroup
  // =============================================================================
  // This wrapper function converts (stringIndex, fret) to 3D world coordinates
  // using the EXACT SAME logic as DebugVisualization's get3DPosition function.
  //
  // IMPORTANT: Returns Position3D = [x, y, z] where:
  // - x = horizontal position (fret direction)
  // - y = height above fretboard (unused, ring Y is animated separately)
  // - z = depth position (string direction) - this is what FloatingTorusRing uses!
  //
  // FloatingTorusRing animates its own Y position and uses [0] for X and [2] for Z.
  // =============================================================================
  const getNotePosition3D = useCallback(
    (stringIndex: number, fret: number | 'open'): [number, number, number] => {
      // Extract positioning settings from overlay3DConfig
      const positioningMode = overlay3DConfig.positioningMode || 'flat';
      const tiltAxisOffset = overlay3DConfig.tiltAxisOffset ?? 0;
      const tiltAxisOffsetX = overlay3DConfig.tiltAxisOffsetX ?? 0;
      const perspectiveMultiplier =
        overlay3DConfig.perspectiveMultiplier ?? 1.0;
      const heightAbovePlane = overlay3DConfig.activeRingZOffset ?? 1;

      // CRITICAL: Apply the same visual position transformation as FretboardGrid.tsx
      // FretboardGrid uses: absoluteVisualPosition = 5 - absoluteStringIndex
      const absoluteVisualPosition = 5 - stringIndex;

      // Calculate 2D position matching the dot grid
      const y2d = absoluteVisualPosition * STRING_SPACING + DOT_RADIUS;
      let x2d;
      if (fret === 'open') {
        x2d = CENTER_OFFSET + DOT_RADIUS;
      } else {
        x2d =
          CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING + DOT_RADIUS;
      }

      // Calculate half dimensions for coordinate conversion
      const halfWidth = FULL_CONTENT_WIDTH / 2;
      const halfHeight = VIEWPORT_HEIGHT / 2;

      // Base 3D coordinates (same as DebugVisualization's to3DX/to3DY)
      // x2d → X (fret horizontal position)
      // y2d → Z (string depth position, after negation and offset)
      const baseX = x2d - halfWidth;
      const baseZ = -(y2d - halfHeight); // This becomes Z (string position), negated because 3D Z is depth

      // Apply positioning mode logic (matching DebugVisualization's get3DPosition)
      if (positioningMode === 'flat') {
        // Flat mode: Apply perspectiveMultiplier for X scaling based on string position
        let adjustedX = baseX;
        if (perspectiveMultiplier !== 1.0) {
          // Calculate Y position relative to fretboard content center
          const firstStringY2D = DOT_RADIUS;
          const lastStringY2D = (stringCount - 1) * STRING_SPACING + DOT_RADIUS;
          const fretboardCenterY = (firstStringY2D + lastStringY2D) / 2;
          const fretboardHalfHeight = (lastStringY2D - firstStringY2D) / 2;

          // Normalize Y: -1 at top string (far), +1 at bottom string (near)
          const normalizedY =
            fretboardHalfHeight > 0
              ? (y2d - fretboardCenterY) / fretboardHalfHeight
              : 0;

          // Scale factor: 1.0 at center, adjusted toward edges based on perspectiveMultiplier
          const perspectiveAdjustment = (perspectiveMultiplier - 1.0) * 0.15;
          const xScale = 1.0 + normalizedY * perspectiveAdjustment;
          adjustedX = baseX * xScale;
        }

        // Return [x, y, z] where y is height (unused), z is string position
        return [
          adjustedX + tiltAxisOffsetX,
          heightAbovePlane, // Y = height above plane (ring animates this separately)
          baseZ + tiltAxisOffset, // Z = string position (depth)
        ];
      } else {
        // tilted-plane or screen-space modes: Apply tilt axis offsets with rotation
        const tiltRad = (tiltAngle * Math.PI) / 180;
        const offsetZ = tiltAxisOffset * Math.cos(tiltRad);
        const offsetY = -tiltAxisOffset * Math.sin(tiltRad);

        return [
          baseX + tiltAxisOffsetX,
          heightAbovePlane + offsetY, // Y = height with tilt offset
          baseZ + offsetZ, // Z = string position with tilt offset
        ];
      }
    },
    [
      STRING_SPACING,
      CENTER_OFFSET,
      FRET_OFFSET,
      FRET_SPACING,
      DOT_RADIUS,
      FULL_CONTENT_WIDTH,
      VIEWPORT_HEIGHT,
      stringCount,
      tiltAngle,
      overlay3DConfig.positioningMode,
      overlay3DConfig.tiltAxisOffset,
      overlay3DConfig.tiltAxisOffsetX,
      overlay3DConfig.perspectiveMultiplier,
      overlay3DConfig.activeRingZOffset,
    ],
  );

  // DEBUG: Log render state and dimension comparison
  isDebugEnabled() &&
    verboseLog('[Ring3DOverlayCanvas] Render check:', {
      configEnabled: config.enabled,
      timelineLength: timeline?.length ?? 0,
      exerciseNotesLength: exerciseNotes?.length ?? 0,
      worldDimensions,
      fretboardRectSize: { w: fretboardRect.width, h: fretboardRect.height },
    });

  // Don't render if config is disabled
  if (!config.enabled) {
    return null;
  }

  // NOTE: Removed timeline.length check - the 3D fretboard should ALWAYS render
  // even when there are no exercises/notes. It serves as the base visualization
  // and will display rings/highlights when note data becomes available.

  // Use fixed canvas dimensions that match FretboardCard.tsx container
  const CANVAS_WIDTH = FIXED_CANVAS_WIDTH;
  const CANVAS_HEIGHT = FIXED_CANVAS_HEIGHT;

  // PERFORMANCE: Scroll sync is handled by ScrollOffsetGroup via useFrame for imperative updates
  // This eliminates React re-renders on scroll for better performance

  isDebugEnabled() &&
    verboseLog(
      '[Ring3DOverlayCanvas] ✅ RENDERING 3D CANVAS (Architect Solution)',
      {
        cssPerspective: CSS_PERSPECTIVE,
        tiltAngle,
        approach:
          'CSS-matching camera + imperative scroll sync (no re-renders)',
        maxFrets,
        canvasDimensions: {
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          fullContentWidth: FULL_CONTENT_WIDTH,
          viewportWidth: VIEWPORT_WIDTH,
        },
        scrollSync: {
          method: 'ScrollOffsetGroup updates position via useFrame',
          note: 'No React re-renders on scroll',
        },
      },
    );

  isDebugEnabled() &&
    verboseLog('[Ring3DOverlayCanvas] 📐 CANVAS DIMENSIONS:', {
      canvas: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        aspectRatio: (CANVAS_WIDTH / CANVAS_HEIGHT).toFixed(2),
      },
      fretboardGeometry: {
        pixelWidth: fretboardGeometry.pixelWidth,
        pixelHeight: fretboardGeometry.pixelHeight,
      },
    });

  // =============================================================================
  // ARCHITECT'S SOLUTION: CSS-Matching Camera
  // =============================================================================
  // The Three.js camera is configured to produce IDENTICAL projection to CSS
  // perspective. The tilt is applied via scene rotation inside Three.js.
  // NO CSS transforms on the canvas container - Three.js handles everything.
  // =============================================================================

  // =============================================================================
  // EDGE FADE MASK - Animated fade based on scroll state
  // =============================================================================
  // Creates edge fade effects with smooth animation:
  //
  // - Left fade: Animates from 0% to leftFadeZoneTarget% when scrolled (and back when returning)
  // - Right fade: Always at rightFadeZone% (from 100-rightFadeZone% to 100%)
  //
  // The leftFadePercent is animated using requestAnimationFrame with
  // ease-in-out cubic easing for smooth transitions.
  // =============================================================================
  // rightFadeZone is now read from overlay3DConfig.rightFadeZone at line ~1394

  // =============================================================================
  // PERSPECTIVE-CORRECT EDGE FADES - Using angled gradients
  // =============================================================================
  // To make the fade edges follow the perspective lines toward the vanishing point:
  // 1. Use angled linear gradients (not CSS transforms which affect the whole container)
  // 2. Left edge: gradient angled to converge toward vanishing point (e.g., 80deg)
  // 3. Right edge: gradient angled in opposite direction (e.g., 100deg)
  // 4. Combine with CSS mask-composite to layer both edges
  //
  // The fadeEdgeAngle controls how much the edges angle inward.
  // At 0°, edges are vertical. At higher values, they angle toward center.
  // =============================================================================

  // Get fade edge angle - controls perspective convergence of fade edges
  // Default to 0° for vertical edges (calibrated)
  const fadeEdgeAngle = overlay3DConfig.fadeEdgeAngle ?? 0;

  // Use animated leftFadePercent for scroll-based fade-in/fade-out effect.
  // The animation is triggered by scroll position (see useEffect above): off at the nut
  // (scrollLeft 0), fades on once scrolled. The gym Scales tool now drives a real scroll
  // container too (ScaleFretboardWindow), so this scroll-gated behavior applies there as
  // well — no special-casing needed.
  const effectiveLeftFade = leftFadePercent;

  // Calculate gradient angles for perspective effect
  // 90deg = horizontal (to right), adjust by fadeEdgeAngle for perspective
  // Left edge: angle slightly up-right (90 - angle) to converge toward vanishing point
  // Right edge: angle slightly up-left (90 + angle) to converge toward same point
  const leftGradientAngle = 90 - fadeEdgeAngle; // e.g., 80deg when fadeEdgeAngle=10
  const rightGradientAngle = 90 + fadeEdgeAngle; // e.g., 100deg when fadeEdgeAngle=10

  // Create separate masks for left and right edges with perspective angles
  // Left fade: transparent on left, fades to black
  const leftFadeMask =
    effectiveLeftFade > 0.1
      ? `linear-gradient(${leftGradientAngle}deg, transparent 0%, black ${effectiveLeftFade * 2}%)`
      : 'none';

  // Right fade: black fades to transparent on right
  const rightFadeMask =
    rightFadeZone > 0.1
      ? `linear-gradient(${rightGradientAngle}deg, black ${100 - rightFadeZone * 2}%, transparent 100%)`
      : 'none';

  // Combine masks - need both edges to be visible
  // Using mask-composite: intersect means both masks must be black for content to show
  const combinedMask =
    effectiveLeftFade > 0.1 && rightFadeZone > 0.1
      ? `${leftFadeMask}, ${rightFadeMask}`
      : effectiveLeftFade > 0.1
        ? leftFadeMask
        : rightFadeZone > 0.1
          ? rightFadeMask
          : 'none';

  // DEBUG: Log render values for fade debugging
  if (isVerboseDebugEnabled()) {
    verboseLog('[FADE-DEBUG] RENDER:', {
      exerciseId,
      fadeOpacity,
      notesCount: exerciseNotes?.length ?? 0,
      tempo,
    });
  }

  // Outer container - absolute positioning, contains the perspective context
  // Includes exercise transition fade animation for smooth switching
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    top: overlay3DConfig.offsetY,
    left: overlay3DConfig.offsetX,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    pointerEvents: 'none',
    zIndex: 30,
    overflow: 'visible',
    // Perspective for the tilted mask container (same as fretboard)
    perspective: `${overlay3DConfig.cameraDistance}px`,
    perspectiveOrigin: 'center center',
    // Exercise transition fade - controlled by parent (FretboardCard)
    opacity: fadeOpacity,
    transition: `opacity ${fadeDuration}ms ease-out`,
  };

  // Inner container - applies the perspective-correct edge fade masks
  // NO CSS transform rotation - the angled gradients handle perspective
  const maskStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    // Apply combined edge fade masks with perspective angles
    maskImage: combinedMask !== 'none' ? combinedMask : undefined,
    WebkitMaskImage: combinedMask !== 'none' ? combinedMask : undefined,
    // When using multiple masks, we need mask-composite to combine them correctly
    // 'intersect' means both masks must be opaque for content to show
    maskComposite:
      effectiveLeftFade > 0.1 && rightFadeZone > 0.1 ? 'intersect' : undefined,
    WebkitMaskComposite:
      effectiveLeftFade > 0.1 && rightFadeZone > 0.1 ? 'source-in' : undefined,
  };

  // Canvas fills its container with explicit dimensions
  const canvasStyle: React.CSSProperties = {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    pointerEvents: 'none', // Ensure canvas also passes through clicks
  };

  // Force canvas to resize after mount when CSS transforms stabilize
  // This is the same pattern used successfully in Fretboard3D
  useEffect(() => {
    const handleResize = () => {
      window.dispatchEvent(new Event('resize'));
    };
    // Delay to ensure transforms and layout have settled
    const timeout = setTimeout(handleResize, 150);
    return () => clearTimeout(timeout);
  }, []);

  // DEBUG: Log container dimensions after render
  useEffect(() => {
    if (canvasContainerRef.current) {
      const container = canvasContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);

      // Find the canvas element inside
      const canvasEl = container.querySelector('canvas');

      isDebugEnabled() &&
        verboseLog('[Ring3DOverlayCanvas] 🔍 POST-RENDER CONTAINER CHECK:', {
          containerRef: {
            offsetWidth: container.offsetWidth,
            offsetHeight: container.offsetHeight,
            clientWidth: container.clientWidth,
            clientHeight: container.clientHeight,
          },
          containerBoundingRect: {
            width: containerRect.width,
            height: containerRect.height,
          },
          containerComputedStyle: {
            width: containerStyle.width,
            height: containerStyle.height,
            position: containerStyle.position,
          },
          canvasElement: canvasEl
            ? {
                width: canvasEl.width,
                height: canvasEl.height,
                clientWidth: canvasEl.clientWidth,
                clientHeight: canvasEl.clientHeight,
                styleWidth: canvasEl.style.width,
                styleHeight: canvasEl.style.height,
              }
            : 'NOT FOUND',
          expectedDimensions: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        });
    }
  });

  isDebugEnabled() &&
    verboseLog('[Ring3DOverlayCanvas] 🎨 STYLE SETTINGS:', {
      containerStyle: {
        width: containerStyle.width,
        height: containerStyle.height,
        position: containerStyle.position,
      },
      canvasStyle: {
        width: canvasStyle.width,
        height: canvasStyle.height,
      },
      constants: { CANVAS_WIDTH, CANVAS_HEIGHT },
    });

  return (
    <div ref={canvasContainerRef} style={containerStyle}>
      {/* Inner container - applies perspective-correct edge fade masks */}
      <div style={maskStyle}>
        <Canvas
          style={canvasStyle}
          // CRITICAL: Use offsetSize to measure container's offset dimensions
          // instead of getBoundingClientRect which is affected by CSS transforms.
          // This tells react-use-measure to use offsetWidth/offsetHeight.
          resize={{ scroll: false, offsetSize: true }}
          // DPR (Device Pixel Ratio) controls rendering resolution
          // Use actual device pixel ratio for crisp rendering on high-DPI displays (Retina)
          // Capped at 3 to prevent excessive GPU load on 4K+ displays
          dpr={Math.min(window.devicePixelRatio || 2, 3)}
          gl={{
            alpha: true, // Transparent background
            // Enable antialiasing for smooth edges - essential for premium look
            antialias: true,
            powerPreference: 'high-performance',
          }}
          // NOTE: Don't use 'orthographic' prop - we provide our own CustomOrthoCamera
          // which properly manages the frustum based on fretboard dimensions
          onCreated={({ gl, size }) => {
            gl.setClearColor(0x000000, 0); // Fully transparent

            const canvasEl = gl.domElement;
            isDebugEnabled() &&
              verboseLog('[Ring3DOverlayCanvas] 🚀 CANVAS onCreated:', {
                glDomElement: {
                  width: canvasEl.width,
                  height: canvasEl.height,
                  clientWidth: canvasEl.clientWidth,
                  clientHeight: canvasEl.clientHeight,
                  styleWidth: canvasEl.style.width,
                  styleHeight: canvasEl.style.height,
                },
                r3fSizeAtCreation: size,
                parentElement: canvasEl.parentElement
                  ? {
                      offsetWidth: canvasEl.parentElement.offsetWidth,
                      offsetHeight: canvasEl.parentElement.offsetHeight,
                      tagName: canvasEl.parentElement.tagName,
                    }
                  : 'NO PARENT',
              });

            // FORCE correct size if R3F measured incorrectly
            if (size.width !== CANVAS_WIDTH || size.height !== CANVAS_HEIGHT) {
              isDebugEnabled() &&
                verboseLog('[Ring3DOverlayCanvas] ⚠️ FORCING CORRECT SIZE:', {
                  r3fMeasured: { width: size.width, height: size.height },
                  forcing: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
                });
              gl.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
            }
          }}
        >
          {/* CSS-Matching Perspective Camera (Architect's Solution)
          FOV calculated to match CSS perspective
          Camera positioned at Z = cameraDistance, looking at origin
          cameraDistance default 800 matches CSS perspective: 800px */}
          <CSSMatchingCamera
            canvasHeight={CANVAS_HEIGHT}
            cssPerspective={overlay3DConfig.cameraDistance}
            fovOffset={overlay3DConfig.fovOffset}
            cameraY={overlay3DConfig.cameraY}
            transitionPhase={transitionPhase}
            triggerZoomOnMount={triggerZoomOnMount}
          />

          {/* Clipping Planes Manager - clips 3D content to viewport width
          This is the Three.js equivalent of CSS overflow: hidden
          TEMPORARILY DISABLED - clipping math needs to account for scroll offset and transforms */}
          <ClippingPlanesManager
            viewportWidth={VIEWPORT_WIDTH}
            contentScale={overlay3DConfig.contentScale}
            sceneX={overlay3DConfig.sceneX}
            enabled={false}
          />

          {/* Scroll Sync Manager - reads scroll position without React re-renders
          Updates scrollLeftRef every frame for imperative material updates */}
          <ScrollSyncManager
            scrollContainerRef={scrollContainerRef}
            scrollLeftRef={scrollLeftRef}
          />

          {/* Lighting for 3D ring visibility */}
          <ambientLight intensity={OVERLAY_LIGHTING_CONFIG.ambient.intensity} />
          <pointLight
            position={
              OVERLAY_LIGHTING_CONFIG.point.position as [number, number, number]
            }
            intensity={OVERLAY_LIGHTING_CONFIG.point.intensity}
          />

          {/* =============================================================================
          CSS TRANSFORM MATCHING - Single rotation group approach
          =============================================================================
          CSS with transform-origin: center center applies ALL rotations around a
          single pivot point at the center of the element. The key insight is that
          CSS transforms work in a specific order and the origin is always the same
          point for all rotations.

          For CSS: transform: rotateX(x) rotateY(y) rotateZ(z)
          with transform-origin: center center (50% 50%)

          The transforms are applied RIGHT-TO-LEFT in CSS, so:
          1. First rotateZ is applied around Z axis through center
          2. Then rotateY is applied around Y axis through center
          3. Finally rotateX is applied around X axis through center

          In Three.js, we use Euler order 'ZYX' to match this application order.

          APPROACH: Place a single rotation group at the viewport center (0,0,0 in our
          coordinate system), apply the rotation, then offset the content INSIDE that
          group so it appears in the correct position. This ensures all rotations
          happen around the same pivot point - the center of the viewport.
          ============================================================================= */}

          {/* SCENE OFFSET GROUP: Applies sceneX/Y/Z for manual positioning adjustments */}
          <group
            position={[
              overlay3DConfig.sceneX,
              overlay3DConfig.sceneY,
              overlay3DConfig.sceneZ,
            ]}
          >
            {/* =============================================================================
            CSS TRANSFORM-ORIGIN SIMULATION
            =============================================================================
            CSS with transform-origin: center center works as follows:
            1. Translate element so its center is at (0,0,0)
            2. Apply rotations around (0,0,0)
            3. Translate back to original position

            Our content is positioned relative to CONTENT center (via to3DX/to3DY),
            so the "center" is already at (0,0,0). We only need adjustments if the user
            wants to move the rotation pivot via originX/Y sliders.

            Default: originX=CANVAS_WIDTH/2, originY=145 = content center
            When defaults are used: offset = 0, no adjustment needed
            When user adjusts: offset shifts the content before rotation
            ============================================================================= */}

            {/* ROTATION GROUP: Apply rotation at origin (0,0,0)
            Content is already centered via to3DX/to3DY using CONTENT center (canvasWidth/2),
            so rotation happens around content center - matching CSS transform-origin: center center

            CSS transform direction mapping:
            - CSS rotateX(positive): top tilts AWAY → Three.js needs NEGATIVE X
            - CSS rotateY(positive): right side goes back → Three.js needs SAME sign
            - CSS rotateZ(positive): clockwise from front → Three.js needs NEGATIVE Z */}
            <group
              rotation={
                new THREE.Euler(
                  // X rotation: For flat mode, apply full tilt. For other modes, only fine-tune.
                  (overlay3DConfig.positioningMode === 'flat' ||
                  !overlay3DConfig.positioningMode
                    ? -(tiltAngle * Math.PI) / 180 // NEGATED to match CSS X direction
                    : 0) +
                    (overlay3DConfig.rotationX * Math.PI) / 180,
                  // Y rotation: debugRotation.y + fine-tune (same sign as CSS)
                  (debugRotation.y * Math.PI) / 180 +
                    (overlay3DConfig.rotationY * Math.PI) / 180,
                  // Z rotation: debugRotation.z + fine-tune (NEGATED to match CSS Z direction)
                  -(debugRotation.z * Math.PI) / 180 -
                    (overlay3DConfig.rotationZ * Math.PI) / 180,
                  'ZYX', // Match CSS transform application order (Z first, then Y, then X)
                )
              }
            >
              {/* SCROLL OFFSET GROUP: Aligns 3D content with 2D viewport scroll position
                  =============================================================================
                  The 3D content is positioned relative to FULL content center (FULL_CONTENT_WIDTH/2).
                  The 3D camera views a VIEWPORT_WIDTH area centered at (0,0,0).

                  At scrollLeft=0, the 2D shows pixels 0 to VIEWPORT_WIDTH (left side of content).
                  At scrollLeft=0, the 3D shows pixels centered around FULL_CONTENT_WIDTH/2.

                  To align them:
                  - Initial offset shifts 3D so left edge (x=0) is at viewport center - VIEWPORT_WIDTH/2
                  - scrollLeft then shifts content further left

                  Total offset = (VIEWPORT_WIDTH/2 - FULL_CONTENT_WIDTH/2) - scrollLeft

                  PERFORMANCE: Uses ScrollOffsetGroup which updates position via useFrame
                  instead of React props. This eliminates scroll-triggered re-renders.
                  ============================================================================= */}
              <ScrollOffsetGroup
                scrollLeftRef={scrollLeftRef}
                viewportWidth={VIEWPORT_WIDTH}
                fullContentWidth={FULL_CONTENT_WIDTH}
              >
                {/* CONTENT SCALE GROUP: Scale for 3D/2D size matching
                    contentScale: Uniform base scale for overall size matching
                    contentScaleX: Independent X scale to correct horizontal stretch/compression
                    contentScaleY: Independent Y scale to correct vertical stretch/compression
                    Final scale = contentScale * contentScaleX/Y (so they compound) */}
                <group
                  scale={[
                    overlay3DConfig.contentScale *
                      (overlay3DConfig.contentScaleX ?? 1.0),
                    overlay3DConfig.contentScale *
                      (overlay3DConfig.contentScaleY ?? 1.0),
                    overlay3DConfig.contentScale,
                  ]}
                >
                  {/* Ring group with suspense for async loading */}
                  <Suspense fallback={null}>
                    <RingOverlayGroup
                      timeline={timeline}
                      currentTime={currentTime}
                      config={config}
                      get3DPosition={getNotePosition3D}
                      countdownBeats={countdownBeats}
                      tempo={tempo}
                    />
                  </Suspense>

                  {/* Debug visualization for calibrating 3D canvas alignment with 2D fretboard */}
                  {DEBUG_OVERLAY && (
                    <DebugVisualization
                      stringCount={stringCount}
                      maxFrets={maxFrets}
                      contentWidth={FULL_CONTENT_WIDTH}
                      contentHeight={VIEWPORT_HEIGHT}
                      tiltAngle={tiltAngle}
                      cssPerspective={overlay3DConfig.cameraDistance}
                      positioningMode={
                        overlay3DConfig.positioningMode || 'flat'
                      }
                      tiltAxisOffset={overlay3DConfig.tiltAxisOffset || 0}
                      tiltAxisOffsetX={overlay3DConfig.tiltAxisOffsetX || 0}
                      perspectiveMultiplier={
                        overlay3DConfig.perspectiveMultiplier ?? 1.0
                      }
                      topEdgeScale={overlay3DConfig.topEdgeScale ?? 1.0}
                      bottomEdgeScale={overlay3DConfig.bottomEdgeScale ?? 1.0}
                      scrollLeftRef={scrollLeftRef}
                      viewportWidth={VIEWPORT_WIDTH}
                      exerciseNotes={exerciseNotes}
                      tempo={tempo}
                      isPlaying={isPlaying}
                      showAllNotes={showAllNotes}
                      rootPositions={rootPositions}
                      getPlaybackBeat={getPlaybackBeat}
                      playheadNotes={playheadNotes}
                      loopBeats={loopBeats}
                      playheadConfig={playheadConfig}
                      countdownBeats={countdownBeats}
                      activeRingZOffset={overlay3DConfig.activeRingZOffset ?? 1}
                      activeRingRadius={overlay3DConfig.activeRingRadius ?? 15}
                      activeRingTubeRadius={
                        overlay3DConfig.activeRingTubeRadius ?? 1.5
                      }
                      activeDotColor={
                        overlay3DConfig.activeDotColor ?? '#3b82f6'
                      }
                      activeRingColor={
                        overlay3DConfig.activeRingColor ?? '#facc15'
                      }
                      fingerLabelOffsetX={
                        overlay3DConfig.fingerLabelOffsetX ?? 0
                      }
                      fingerLabelOffsetY={
                        overlay3DConfig.fingerLabelOffsetY ?? 0
                      }
                    />
                  )}
                </group>
              </ScrollOffsetGroup>
            </group>
          </group>

          {/* Post-processing effects - controlled by bloom config (disabled by default) */}
          {(overlay3DConfig.bloomEnabled ?? false) && (
            <EffectComposer>
              <Bloom
                intensity={overlay3DConfig.bloomIntensity ?? 0.0}
                luminanceThreshold={overlay3DConfig.bloomThreshold ?? 1.0}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
            </EffectComposer>
          )}
        </Canvas>
      </div>
    </div>
  );
}
