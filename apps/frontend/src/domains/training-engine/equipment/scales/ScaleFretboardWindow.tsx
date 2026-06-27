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
import { buildNoteUniverse, selectBox } from './noteUniverse';
import {
  getFretboardOverlayConfig,
  FRETBOARD_CANVAS_HEIGHT,
  FRETBOARD_WINDOW,
} from './fretboardViewConfig';
import {
  // FretboardCalibrationPanel,  // ← uncomment (+ the mount below) to re-calibrate
  CALIBRATION_ENABLED,
  type FretboardCalibrationValues,
} from './FretboardCalibrationPanel';

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
}: ScaleFretboardWindowProps) {
  // Build the full note universe for the user's neck, then show either ONE box position
  // (a real fingering across the strings) or the WHOLE scale. Each note → one beat (the
  // play-along sequence steps through it).
  const { exerciseNotes, rootPositions } = React.useMemo(() => {
    // EXPLICIT note list (path editor): light exactly these, first = the path start (root).
    if (litNotes) {
      return {
        exerciseNotes: litNotes.map((n, i) => ({
          string: n.string as 1 | 2 | 3 | 4 | 5 | 6,
          fret: n.fret,
          duration: '4n',
          position: { measure: Math.floor(i / 4) + 1, beat: (i % 4) + 1 },
        })),
        rootPositions: litNotes.length > 0 ? [litNotes[0]!] : [],
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

  // DEV calibration: live overrides for the centering/fade params, seeded from the
  // base config. When CALIBRATION_ENABLED, the panel adjusts these live; otherwise
  // the base config is used as-is.
  // `setCal` unused while the panel is commented out; restore on re-calibration.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cal, setCal] = React.useState<FretboardCalibrationValues>(() => ({
    sceneX: baseConfig.sceneX,
    offsetX: baseConfig.offsetX,
    tiltAxisOffsetX: baseConfig.tiltAxisOffsetX,
    contentScale: baseConfig.contentScale,
    contentScaleX: baseConfig.contentScaleX,
    leftFadeZone: baseConfig.leftFadeZone,
    rightFadeZone: baseConfig.rightFadeZone,
    viewportWidth: FRETBOARD_WINDOW.viewportWidth,
    windowHeight: FRETBOARD_CANVAS_HEIGHT,
  }));

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
      leftFadeZone,
      rightFadeZone,
    };
  }, [baseConfig, activeCal]);

  // PRIMARY WINDOW WIDTH = the inner canvas width (the thing whose right edge hard-cuts
  // the fretboard). Widening it moves the right cut RIGHT → more frets visible. The
  // content is centered on viewportWidth, so widening alone shifts it right; we cancel
  // that by pulling sceneX left by half the extra width → LEFT EDGE STAYS ANCHORED,
  // right edge extends. The outer box grows to fit so the wider canvas isn't clipped.
  const viewportWidth = activeCal
    ? activeCal.viewportWidth
    : FRETBOARD_WINDOW.viewportWidth;
  const height = activeCal ? activeCal.windowHeight : FRETBOARD_CANVAS_HEIGHT;
  const anchoredConfig = overlay3DConfig;

  // ── MOVEMENT: the tutorial's model (the working reference) ─────────────────────────
  // A native horizontal scroll container drives the pan: the canvas reads its scrollLeft
  // every frame (ScrollSyncManager) and translates the 3D content (ScrollOffsetGroup).
  // This is what gives us, for free: drag-to-move AND the scroll-gated LEFT FADE (off at
  // the nut, on once moved). The inner spacer is wider than the window so there's room to
  // scroll the whole neck. Geometry mirrors Ring3DOverlayCanvas exactly.
  const FRET_SPACING = 38;
  const FRET_OFFSET = 46;
  const CENTER_OFFSET = 15;
  const DOT_RADIUS = 13;
  const fullContentWidth =
    CENTER_OFFSET +
    FRET_OFFSET +
    (maxFrets - 1) * FRET_SPACING +
    DOT_RADIUS * 2 +
    20;

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef({ x: 0, scrollLeft: 0 });

  // Center a fret in the viewport (tutorial's scrollToFret, smooth). fret can be fractional.
  const scrollToFret = React.useCallback(
    (fret: number, behavior: ScrollBehavior = 'smooth') => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const fretX = CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING;
      const target = fretX - viewportWidth / 2;
      el.scrollTo({ left: Math.max(0, target), behavior });
    },
    [viewportWidth],
  );

  // On exercise change (litNotes), auto-center on the exercise's middle fret so it's
  // presented in front of the student. A manual drag afterwards is free to move it; the
  // next exercise re-centers.
  React.useEffect(() => {
    if (!litNotes || litNotes.length === 0) {
      scrollContainerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    const frets = litNotes.map((n) => n.fret);
    const centerFret = (Math.min(...frets) + Math.max(...frets)) / 2;
    // rAF so the container has laid out before we scroll.
    const id = requestAnimationFrame(() => scrollToFret(centerFret));
    return () => cancelAnimationFrame(id);
  }, [litNotes, scrollToFret]);

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

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'transparent',
        overflow: 'visible',
      }}
    >
      {/* DEV calibration panel — commented out (values baked into fretboardViewConfig.ts).
          To re-calibrate: uncomment this + the import above, and set
          NEXT_PUBLIC_FRETBOARD_CALIBRATION=true in .env.local. (Panel is draggable.) */}
      {/* <FretboardCalibrationPanel values={cal} onChange={setCal} /> */}

      {/* Scroll container (the tutorial's movement mechanism). overflow-x-auto + a wide
          inner spacer = native scroll; the canvas reads scrollLeft each frame. Scrollbar
          hidden; drag-to-pan on top of native scroll. */}
      <div
        ref={scrollContainerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        className="h-full w-full overflow-x-auto overflow-y-hidden"
        style={{
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
        {/* Wide spacer so there's room to scroll the whole neck. The canvas overlays it. */}
        <div style={{ position: 'relative', width: fullContentWidth, height }}>
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
          />
        </div>
      </div>
    </div>
  );
}
