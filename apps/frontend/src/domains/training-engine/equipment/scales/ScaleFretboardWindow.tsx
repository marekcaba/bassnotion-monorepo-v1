'use client';

/**
 * ScaleFretboardWindow — the Scales tool's main-window view: the production 3D
 * fretboard (Ring3DOverlayCanvas) showing the selected scale, lit up in time when
 * playing. Drops into the GrooveCardShell's `waveform` slot in place of the waveform.
 *
 * The active-note highlight is driven by the global AtomicPlaybackClock (proven in
 * the spike), which the groove-card transport already starts — so this just needs
 * the generated scale + isPlaying + tempo; it rides the same clock as the audio.
 */

import React from 'react';
import { Ring3DOverlayCanvas } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/Ring3DOverlayCanvas';
import { DEFAULT_RING_CONFIG } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/overlays/RingOverlayConfig';
import type { PitchClass, ScaleType, StringCount } from './scaleGenerator';
import {
  buildNoteUniverse,
  selectBox,
  OPEN_STRING_MIDI,
  rootToPc,
} from './noteUniverse';
import {
  getFretboardOverlayConfig,
  FRETBOARD_CANVAS_HEIGHT,
  FRETBOARD_WINDOW,
} from './fretboardViewConfig';
import { computeFretboardGeometry } from './fretboardGeometry';
import { useFretboardSizeTier } from './useFretboardSizeTier';
import {
  FretboardCalibrationPanel,
  CALIBRATION_ENABLED,
  type FretboardCalibrationValues,
} from './FretboardCalibrationPanel';
import { PlayheadPanel } from './PlayheadPanel';
import { AnticipationPanel } from './AnticipationPanel';
import { HighlightPanel } from './HighlightPanel';
import { DEFAULT_PLAYHEAD_CONFIG, type PlayheadConfig } from './playheadConfig';

export interface ScaleFretboardWindowProps {
  root: PitchClass;
  scaleType: ScaleType;
  stringCount: StringCount;
  maxFrets: number;
  isPlaying: boolean;
  tempo: number;
  /** What to show: a box POSITION number (1 = root box), or 'whole' for the entire
   *  scale across the neck. Default 1. */
  view?: number | 'whole';
  /** Admin-authored box shapes to preview (the editor's LIVE draft), overriding the
   *  in-code seed. Absent in the player — it uses the seed/server blueprint. */
  blueprintOverride?: {
    positions: {
      positionNumber: number;
      startFretOffset: number;
      span: number;
    }[];
  };
  /** Override the fretboard's centering/sizing config (the calibration values). The
   *  admin /admin/scales page passes this from a draggable panel to position the board
   *  for ITS layout, without touching the baked gym values. Absent → use the baked config. */
  calibrationOverride?: FretboardCalibrationValues;
  /** Light EXACTLY these (string, fret) notes, bypassing the scale/box logic. The path
   *  editor uses this to preview an explicitly-drawn note sequence. The first note is
   *  marked as the "root" (darker) so the path's start stands out. */
  litNotes?: { string: number; fret: number }[];
  /** Current playback position in beats (from the sequencer) for the gliding playhead.
   *  null when not playing. The gym doesn't run the AtomicPlaybackClock the canvas reads. */
  getPlaybackBeat?: () => number | null;
  /** The played note sequence (string/fret + startBeat) the orange playhead sphere glides
   *  along — in PLAY order, from the sequencer's `path`. */
  playheadNotes?: { string: number; fret: number; startBeat: number }[];
  /** Loop length in beats — for gliding the sphere across the loop seam (last → first). */
  loopBeats?: number;
}

export function ScaleFretboardWindow({
  root,
  scaleType,
  stringCount,
  maxFrets,
  isPlaying,
  tempo,
  view = 1,
  blueprintOverride,
  calibrationOverride,
  litNotes,
  getPlaybackBeat,
  playheadNotes,
  loopBeats,
}: ScaleFretboardWindowProps) {
  // Build the full note universe for the user's neck, then show either ONE box position
  // (a real fingering across the strings) or the WHOLE scale. Each note → one beat (the
  // play-along sequence steps through it).
  const { exerciseNotes, rootPositions } = React.useMemo(() => {
    // EXPLICIT note list (path editor): light exactly these. ROOT = every note whose pitch
    // class equals the scale root's — so EVERY octave root is dark green, not just the first.
    if (litNotes) {
      const open = OPEN_STRING_MIDI[stringCount];
      const rootPc = rootToPc(root);
      const isRoot = (n: { string: number; fret: number }) => {
        const openMidi = open?.[n.string];
        if (openMidi === undefined) return false;
        return (openMidi + n.fret) % 12 === rootPc;
      };
      return {
        exerciseNotes: litNotes.map((n, i) => ({
          string: n.string as 1 | 2 | 3 | 4 | 5 | 6,
          fret: n.fret,
          duration: '4n',
          position: { measure: Math.floor(i / 4) + 1, beat: (i % 4) + 1 },
        })),
        rootPositions: litNotes.filter(isRoot),
      };
    }
    const fretboard = { stringCount, maxFrets };
    const universe = buildNoteUniverse(fretboard, root, scaleType);
    const shown =
      view === 'whole'
        ? universe
        : selectBox(
            universe,
            fretboard,
            root,
            scaleType,
            view,
            blueprintOverride,
          );
    return {
      exerciseNotes: shown.map((n, i) => ({
        string: n.string,
        fret: n.fret,
        duration: '4n',
        position: { measure: Math.floor(i / 4) + 1, beat: (i % 4) + 1 },
      })),
      // Root notes (string+fret) so the canvas can paint them a DARKER green — the scale's
      // home note stands out from the rest of the shape.
      rootPositions: shown
        .filter((n) => n.isRoot)
        .map((n) => ({ string: n.string, fret: n.fret })),
    };
  }, [
    root,
    scaleType,
    stringCount,
    maxFrets,
    view,
    blueprintOverride,
    litNotes,
  ]);

  // Enable the ring overlay (DEFAULT has enabled:false) so the active-note highlight
  // shows; the dots themselves come from exerciseNotes.
  const ringConfig = React.useMemo(
    () => ({ ...DEFAULT_RING_CONFIG, enabled: true }),
    [],
  );

  // Same calibrated scene config + sizing as the tutorial fretboard, so the
  // proportions match (string-count-dependent sceneX included).
  const baseConfig = React.useMemo(
    () => getFretboardOverlayConfig(stringCount),
    [stringCount],
  );

  // RESPONSIVE SIZE TIER — measure the card container's own width and pick a tier. Enabled: the
  // board scales to its tier (mobile/tablet/desktop/large on the 640/1024/1536 thresholds). Tablet
  // is the 1.0 baseline (today's calibration). `sizeRef` attaches to the root div, which is
  // width:100% so it reflects the space the card/page grants the fretboard.
  const {
    ref: sizeRef,
    scaleFactor: tierScaleFactor,
    viewportWidth: tierViewportWidth,
  } = useFretboardSizeTier({ enabled: true });

  // DEV tuning: the playhead sphere config (size/color/anim/easing). The PlayheadPanel
  // adjusts it live when NEXT_PUBLIC_PLAYHEAD_PANEL=true; otherwise the baked default.
  const [playheadCfg, setPlayheadCfg] = React.useState<PlayheadConfig>(
    DEFAULT_PLAYHEAD_CONFIG,
  );

  // DEV calibration: live overrides for the centering/fade params. SEEDED FROM THE TIER-SCALED
  // values (not the raw baseline) so opening the panel doesn't snap the board back to the tablet
  // proportions — it matches what's currently on screen, and you tune FROM there. The seed applies
  // the SAME contentScale×f + sceneX re-anchor + viewportWidth as the live (non-panel) path below.
  const [cal, setCal] = React.useState<FretboardCalibrationValues>(() => ({
    sceneX:
      baseConfig.sceneX -
      (tierViewportWidth - FRETBOARD_WINDOW.viewportWidth) / 2,
    offsetX: baseConfig.offsetX,
    tiltAxisOffsetX: baseConfig.tiltAxisOffsetX,
    contentScale: baseConfig.contentScale * tierScaleFactor,
    contentScaleX: baseConfig.contentScaleX,
    contentScaleY: baseConfig.contentScaleY,
    rotationX: baseConfig.rotationX,
    rotationY: baseConfig.rotationY,
    rotationZ: baseConfig.rotationZ,
    leftFadeZone: baseConfig.leftFadeZone,
    rightFadeZone: baseConfig.rightFadeZone,
    viewportWidth: tierViewportWidth,
    windowHeight: FRETBOARD_CANVAS_HEIGHT * tierScaleFactor,
    // The scroll↔fret px rate, seeded from the geometry's baseline × the tier factor so the panel
    // starts matching the live board; drag the slider to tune scroll reach + sphere tracking.
    screenPxPerFret: computeFretboardGeometry({
      maxFrets,
      viewportWidth: tierViewportWidth,
      scaleFactor: tierScaleFactor,
    }).screenPxPerFret,
  }));

  // RE-SEED the panel when the resolved tier changes. useState's initializer runs ONCE on first
  // render — before the ResizeObserver has measured, so it captures the tablet fallback (factor
  // 1.0 / viewport 700). Once the real tier resolves (and on any resize), refresh `cal` to the
  // tier-scaled values so the panel matches the live board instead of snapping it to baseline.
  // Only when the panel is enabled (it's the only consumer of `cal`); a no-op otherwise.
  React.useEffect(() => {
    if (!CALIBRATION_ENABLED) return;
    setCal((prev) => ({
      ...prev,
      sceneX:
        baseConfig.sceneX -
        (tierViewportWidth - FRETBOARD_WINDOW.viewportWidth) / 2,
      contentScale: baseConfig.contentScale * tierScaleFactor,
      viewportWidth: tierViewportWidth,
      windowHeight: FRETBOARD_CANVAS_HEIGHT * tierScaleFactor,
      screenPxPerFret: computeFretboardGeometry({
        maxFrets,
        viewportWidth: tierViewportWidth,
        scaleFactor: tierScaleFactor,
      }).screenPxPerFret,
    }));
  }, [tierScaleFactor, tierViewportWidth, baseConfig, maxFrets]);

  // The active calibration: an explicit override (the admin panel) wins; else the live
  // `cal` when the env-gated dev panel is on; else nothing (use the baked base config).
  const activeCal = calibrationOverride ?? (CALIBRATION_ENABLED ? cal : null);

  // Scene config (inside the canvas): base, with calibration overrides when present.
  const overlay3DConfig = React.useMemo(() => {
    if (!activeCal) return baseConfig;
    // Only the scene fields go to the overlay (window fields are applied to the div).
    const {
      sceneX,
      offsetX,
      tiltAxisOffsetX,
      contentScale,
      contentScaleX,
      contentScaleY,
      rotationX,
      rotationY,
      rotationZ,
      leftFadeZone,
      rightFadeZone,
    } = activeCal;
    return {
      ...baseConfig,
      sceneX,
      offsetX,
      tiltAxisOffsetX,
      contentScale,
      contentScaleX,
      contentScaleY,
      rotationX,
      rotationY,
      rotationZ,
      leftFadeZone,
      rightFadeZone,
    };
  }, [baseConfig, activeCal]);

  // PRIMARY WINDOW WIDTH = the inner canvas width (the thing whose right edge hard-cuts
  // the fretboard). Widening it moves the right cut RIGHT → more frets visible. The
  // content is centered on viewportWidth, so widening alone shifts it right; we cancel
  // that by pulling sceneX left by half the extra width → LEFT EDGE STAYS ANCHORED,
  // right edge extends. The outer box grows to fit so the wider canvas isn't clipped.
  // viewportWidth precedence: the dev calibration panel (when active) wins; else the responsive
  // tier's width. With the tier disabled (step 4) tierViewportWidth === FRETBOARD_WINDOW.viewport
  // (700), so this is identical to the old `activeCal ? … : FRETBOARD_WINDOW.viewportWidth`.
  const viewportWidth = activeCal ? activeCal.viewportWidth : tierViewportWidth;
  // Height scales with the tier too, so the board's vertical proportion grows with its width.
  const height = activeCal
    ? activeCal.windowHeight
    : FRETBOARD_CANVAS_HEIGHT * tierScaleFactor;

  // RESPONSIVE SIZE — scale the 3D scene to the tier. `contentScale` is the TRUE uniform size
  // lever (one Three.js group scale over dots/neck/rings/sphere — see [[fretboard-scale-lever]]),
  // so the whole board zooms by the factor. Because the content is centered on `viewportWidth`,
  // the wider canvas would shift the neck RIGHT; we cancel that by pulling `sceneX` left by half
  // the extra width, keeping the LEFT EDGE anchored while the right edge extends. The dev
  // calibration panel sets these by hand, so we DON'T re-scale when it's active (no double-scale).
  const anchoredConfig = React.useMemo(() => {
    if (activeCal || tierScaleFactor === 1) return overlay3DConfig;
    const extraWidth = viewportWidth - FRETBOARD_WINDOW.viewportWidth;
    return {
      ...overlay3DConfig,
      contentScale: overlay3DConfig.contentScale * tierScaleFactor,
      sceneX: overlay3DConfig.sceneX - extraWidth / 2,
    };
  }, [activeCal, overlay3DConfig, tierScaleFactor, viewportWidth]);

  // ── MOVEMENT: the tutorial's model (the working reference) ─────────────────────────
  // A native horizontal scroll container drives the pan: the canvas reads its scrollLeft
  // every frame (ScrollSyncManager) and translates the 3D content (ScrollOffsetGroup).
  // This gives, for free: drag-to-move AND the scroll-gated LEFT FADE. The inner spacer is
  // wider than the window so there's room to scroll the whole neck. Positioning + the scroll
  // range use the MEASURED screen-px-per-fret mapping (SCREEN_PX_PER_FRET) below, since the
  // 3D renders at contentScale through a perspective camera (on-screen px/fret ≠ content).

  // SCROLL/CENTERING geometry — the MEASURED scrollLeft↔fret mapping (≈45.5 px/fret at the
  // baseline contentScale 1.17 + viewportWidth 700) now lives in the pure, tested
  // computeFretboardGeometry. scaleFactor defaults to 1 here (no size tier yet) → byte-identical
  // to the old inline math; the responsive tiers will pass a real factor that scales the px-rates
  // in lockstep with contentScale so the scroll + sphere stay locked to the dots.
  // scaleFactor is 1.0 while the tier is disabled → byte-identical geometry. When the size step
  // enables it, the px-rates scale in lockstep with contentScale (see [[fretboard-scale-lever]]).
  // Memoized so the scrollForFret/fitsInView helpers keep a STABLE identity across renders —
  // the idle-drift camera effect depends on them, and a fresh geometry each render would restart
  // its rAF loop every frame (killing the smooth continuous drift).
  const calPxPerFret = activeCal ? activeCal.screenPxPerFret : undefined;
  const geometry = React.useMemo(
    () =>
      computeFretboardGeometry({
        maxFrets,
        viewportWidth,
        scaleFactor: tierScaleFactor,
        // When the dev calibration panel is active, its px/fret slider drives the scroll mapping
        // (absolute value); otherwise the baked baseline × tier factor is used.
        screenPxPerFretOverride: calPxPerFret,
      }),
    [maxFrets, viewportWidth, tierScaleFactor, calPxPerFret],
  );
  const {
    maxScroll,
    fullContentWidth,
    scrollForFret: scrollForFretGeom,
    fitsInView: fitsInViewGeom,
  } = geometry;

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({ x: 0, scrollLeft: 0 });

  // Center a fret in the viewport with an EASE-IN-OUT tween (own rAF, not the browser's
  // default smooth scroll — that easing reads abrupt on key changes). fret can be fractional.
  // The scrollLeft→fret mapping is the MEASURED screen relationship: at scroll 0 the visual
  // center is CENTER_FRET_AT_0; each fret of pan needs CENTER_PX_PER_FRET of scroll.
  const centerTweenRef = React.useRef<number | null>(null);
  const scrollToFret = React.useCallback(
    (fret: number, durationMs = 650) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const target = scrollForFretGeom(fret);
      const from = el.scrollLeft;
      if (Math.abs(target - from) < 1) {
        el.scrollLeft = target;
        return;
      }
      if (centerTweenRef.current !== null)
        cancelAnimationFrame(centerTweenRef.current);
      const start = performance.now();
      const easeInOut = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const step = (now: number) => {
        const p = Math.min((now - start) / durationMs, 1);
        el.scrollLeft = from + (target - from) * easeInOut(p);
        if (p < 1) centerTweenRef.current = requestAnimationFrame(step);
        else centerTweenRef.current = null;
      };
      centerTweenRef.current = requestAnimationFrame(step);
    },
    // scrollForFretGeom closes over the geometry, which is a function of these inputs.
    [maxFrets, viewportWidth],
  );
  React.useEffect(
    () => () => {
      if (centerTweenRef.current !== null)
        cancelAnimationFrame(centerTweenRef.current);
    },
    [],
  );

  // On exercise change, present it centered — for BOTH authored paths AND generated Auto
  // scales (use exerciseNotes, the dots actually shown). If the WHOLE exercise FITS in the
  // view → center on the fret-SPAN's middle (the lit dots sit balanced in the middle, not
  // pushed to one side). If it's WIDER than the view → center on the FIRST note (the run
  // starts left-ish, the camera then follows). Matches the auto-follow's "fits" rule.
  React.useEffect(() => {
    // ALL lit frets, including open strings (fret 0 is a real note in the span).
    const shownFrets = exerciseNotes.map((n) =>
      typeof n.fret === 'number' ? n.fret : 0,
    );
    if (shownFrets.length === 0) {
      scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    const lo = Math.min(...shownFrets);
    const hi = Math.max(...shownFrets);
    const fitsInView = fitsInViewGeom(lo, hi);
    // Fits → center the whole fret SPAN's midpoint; doesn't fit → center the first lit fret.
    const firstFret =
      typeof exerciseNotes[0]?.fret === 'number'
        ? (exerciseNotes[0]!.fret as number)
        : lo;
    const centerFret = fitsInView ? (lo + hi) / 2 : firstFret;
    // rAF so the container has laid out before we scroll.
    const id = requestAnimationFrame(() => scrollToFret(centerFret));
    return () => cancelAnimationFrame(id);
  }, [exerciseNotes, scrollToFret, viewportWidth]);

  // Drag-to-pan (mouse), mirroring the tutorial: 2× walk for responsiveness.
  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.pageX,
      scrollLeft: scrollContainerRef.current.scrollLeft,
    };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const walk = (e.pageX - dragStartRef.current.x) * 2;
    scrollContainerRef.current.scrollLeft =
      dragStartRef.current.scrollLeft - walk;
  };
  const endDrag = () => setIsDragging(false);

  // ── IDLE-DRIFT CAMERA. The neck now shows ~12 frets at once, so there's no room-to-room
  //    jumping — the camera stays STILL by default and only drifts when the ACTIVE NOTE reaches
  //    the trigger zone (~fret 9, i.e. it's wandering toward the right edge of what's visible).
  //    Then it drifts VERY SLOWLY and CONTINUOUSLY toward keeping the active note comfortably in
  //    frame — an exponential (critically-damped) approach so there's no start/stop, just an
  //    almost-imperceptible glide. Holds if the whole exercise fits; pauses on drag; stops when
  //    not playing. No note clustering, no look-ahead, no fixed-duration tween. ──
  const isDraggingRef = React.useRef(isDragging);
  isDraggingRef.current = isDragging;
  React.useEffect(() => {
    if (!getPlaybackBeat) return;
    const notes = playheadNotes ?? [];
    if (notes.length === 0) return;

    // Whole exercise already visible? Then never move — everything's in sight.
    const allFrets = notes.map((n) => n.fret);
    const fitsInView = fitsInViewGeom(Math.min(...allFrets), Math.max(...allFrets));

    const loop = loopBeats && loopBeats > 0 ? loopBeats : null;

    // The active note's fret at a beat = the last note whose startBeat has passed (loop-wrapped).
    const activeFretAt = (b: number): number => {
      const wrapped = loop ? ((b % loop) + loop) % loop : b;
      let fret = notes[0]!.fret;
      for (const n of notes) {
        if (n.startBeat <= wrapped) fret = n.fret;
        else break;
      }
      return fret;
    };

    // ── DRIFT TUNING ──────────────────────────────────────────────────────────
    // The camera drifts only once the active note is at/above this fret (it's heading toward the
    // right edge of the visible window). Below it, the camera holds dead still.
    const TRIGGER_FRET = 9;
    // Where we try to keep the active note once drifting — a hair left of centre so there's
    // runway ahead of it. Expressed as a fret offset the scroll aims to put at viewport centre.
    const FRAME_FRET_LEAD = 2; // aim the scroll ~2 frets AHEAD of the active note
    // Critically-damped approach: each frame move a small FRACTION of the remaining distance,
    // capped to a MAX pixels/second so even a big jump stays idle-slow. Tiny fraction + hard cap
    // = "almost like idle, but very very smooth".
    const APPROACH_PER_SEC = 0.6; // 60% of the gap closes per second (very gentle)
    const MAX_DRIFT_PX_PER_SEC = 55; // hard speed ceiling — the "idle" feel
    const SNAP_EPSILON = 0.5; // px; stop fidgeting when essentially there

    let raf = 0;
    let lastNow = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const el = scrollContainerRef.current;
      const beat = getPlaybackBeat();
      if (!el || beat === null || beat < 0 || isDraggingRef.current || fitsInView) {
        lastNow = now;
        return;
      }
      const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0; // clamp big gaps
      lastNow = now;

      const activeFret = activeFretAt(beat);
      // SYMMETRIC target: above the trigger, keep the active note (a touch ahead) framed → drift
      // UP as the run climbs. At/below the trigger, target HOME (scroll 0) → drift back DOWN the
      // same continuous way as the run descends. So ascending and descending mirror each other;
      // the camera returns exactly as it left, and rests at home when the run is in the low zone.
      const target =
        activeFret >= TRIGGER_FRET
          ? scrollForFretGeom(activeFret + FRAME_FRET_LEAD)
          : 0;
      const gap = target - el.scrollLeft;
      if (Math.abs(gap) < SNAP_EPSILON) return;

      // Exponential approach, speed-capped → continuous, ultra-smooth, never a jerk.
      const ease = 1 - Math.exp(-APPROACH_PER_SEC * dt); // fraction of gap to close this frame
      let stepPx = gap * ease;
      const maxStep = MAX_DRIFT_PX_PER_SEC * dt;
      if (Math.abs(stepPx) > maxStep) stepPx = Math.sign(stepPx) * maxStep;
      el.scrollLeft += stepPx;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getPlaybackBeat, playheadNotes, loopBeats, fitsInViewGeom, scrollForFretGeom]);

  return (
    <div
      // sizeRef measures THIS container's width (= the space the card grants the fretboard) to
      // pick the responsive tier. It's width:100%, so it reflects the card/page constraints.
      ref={sizeRef}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'transparent',
        overflow: 'visible',
      }}
    >
      {/* DEV calibration panel — draggable; renders null unless
          NEXT_PUBLIC_FRETBOARD_CALIBRATION=true. Edits the scene centering/fade/window params
          live; copy the printed values into fretboardViewConfig.ts when they look right. */}
      <FretboardCalibrationPanel values={cal} onChange={setCal} />

      {/* DEV playhead tuners — draggable; render null unless NEXT_PUBLIC_PLAYHEAD_PANEL=true.
          PlayheadPanel = the sphere (size/color/anim/bezier/ripple). AnticipationPanel = the
          runway + approach ring. HighlightPanel = the rolling dim↔bright dot highlight (window
          size, fade speed, greens). All edit the same playheadCfg; bake into playheadConfig.ts. */}
      <PlayheadPanel values={playheadCfg} onChange={setPlayheadCfg} />
      <AnticipationPanel values={playheadCfg} onChange={setPlayheadCfg} />
      <HighlightPanel values={playheadCfg} onChange={setPlayheadCfg} />

      {/* MOVEMENT — mirrors the tutorial's layering EXACTLY:
          (1) a scroll container holding ONLY a wide spacer → provides native scroll RANGE
              (drag/scroll moves scrollLeft), but renders nothing visible;
          (2) the canvas as an ABSOLUTE SIBLING outside the scroll container, pinned to the
              viewport (viewportWidth wide, fixed). It reads scrollLeft each frame and pans
              the 3D content via ScrollOffsetGroup.
          Putting the canvas INSIDE the scroll container double-moved it (physical DOM scroll
          + 3D translate) and shrank it against the fixed clip planes — the bug we just hit. */}
      <div
        ref={scrollContainerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        className="h-full overflow-x-auto overflow-y-hidden"
        style={{
          // The scroll WINDOW must be exactly viewportWidth (the visible canvas window), centered
          // in the card — NOT w-full. The spacer below is fullContentWidth (= maxScroll +
          // viewportWidth), so it overflows this window by exactly maxScroll → drag range exists
          // at every tier. When the card was widened (responsive tiers), a w-full container grew
          // wider than the spacer and ate the whole scroll range → drag stopped working.
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: viewportWidth,
          cursor: isDragging ? 'grabbing' : 'grab',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {/* Invisible spacer — its width is the full neck so there's scroll range. */}
        <div style={{ width: fullContentWidth, height: 1 }} />
      </div>

      {/* The 3D canvas — pinned to the viewport (NOT inside the scroll container), CENTERED
          in the card. It reads scrollContainerRef.scrollLeft and translates the 3D content
          itself. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: viewportWidth,
          height,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <Ring3DOverlayCanvas
          exerciseNotes={exerciseNotes}
          currentTime={0}
          isPlaying={isPlaying}
          config={ringConfig}
          stringCount={stringCount}
          maxFrets={maxFrets}
          tempo={tempo}
          overlay3DConfig={anchoredConfig}
          viewportWidthOverride={viewportWidth}
          // The canvas reads this each frame to pan the 3D content + gate the left fade.
          // Cast: React 19 types useRef(null) as RefObject<T | null>; the canvas prop is
          // RefObject<T> (it null-guards .current internally).
          scrollContainerRef={
            scrollContainerRef as React.RefObject<HTMLDivElement>
          }
          // Light the WHOLE scale at once (the scale shape), not a moving lookahead
          // window — the active note still emphasizes as the sequence plays.
          showAllNotes
          // Root notes paint a DARKER green so the scale's home note stands out.
          rootPositions={rootPositions}
          // Gliding orange playhead: the sequencer's real clock + the played note sequence.
          getPlaybackBeat={getPlaybackBeat}
          playheadNotes={playheadNotes}
          loopBeats={loopBeats}
          playheadConfig={playheadCfg}
        />
      </div>
    </div>
  );
}
