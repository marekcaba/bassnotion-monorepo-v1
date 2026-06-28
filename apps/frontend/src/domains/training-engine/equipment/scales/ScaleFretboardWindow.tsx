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
import {
  // FretboardCalibrationPanel,  // ← uncomment (+ the mount below) to re-calibrate
  CALIBRATION_ENABLED,
  type FretboardCalibrationValues,
} from './FretboardCalibrationPanel';
import { PlayheadPanel } from './PlayheadPanel';
import { AnticipationPanel } from './AnticipationPanel';
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

  // DEV tuning: the playhead sphere config (size/color/anim/easing). The PlayheadPanel
  // adjusts it live when NEXT_PUBLIC_PLAYHEAD_PANEL=true; otherwise the baked default.
  const [playheadCfg, setPlayheadCfg] = React.useState<PlayheadConfig>(
    DEFAULT_PLAYHEAD_CONFIG,
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
  // scroll the whole neck. Geometry MUST match Ring3DOverlayCanvas's dot placement +
  // FULL_CONTENT_WIDTH EXACTLY (it uses 36/38/15) — else the spacer is too narrow and the
  // scroll caps before the neck's end (the bug: "barely see fret 12"). NOTE: the tutorial's
  // own scrollToFret uses 38/46, but that's a looser approximation; the canvas geometry is
  // the source of truth here.
  const FRET_SPACING = 36;
  const FRET_OFFSET = 38;
  const CENTER_OFFSET = 15;

  // SCROLL RANGE — scrollLeft (DOM px) does NOT pan content 1:1: the 3D is rendered at
  // contentScale through a perspective camera, so DOM-px under-covers the scaled content.
  // MEASURED on the real board: at scroll 660 the neck reached ~fret 17 (from the default
  // center ~fret 2.5) → ≈45.5 on-screen px per fret. Scroll to put the last fret at the
  // viewport CENTER would be (lastFret − 2.5)×45.5; we want it at the RIGHT EDGE instead
  // (so the neck stops with the last fret flush right, no blank space), which is half a
  // viewport less. The spacer is exactly this wide so the browser clamps scroll there.
  const SCREEN_PX_PER_FRET = 45.5;
  const DEFAULT_CENTER_FRET = 2.5;
  // +200px of slack past the right-edge stop (eye-tuned 2026-06-28) so the last fret isn't
  // jammed flush against the edge.
  const SCROLL_SLACK = 200;
  const maxScroll = Math.max(
    0,
    (maxFrets - DEFAULT_CENTER_FRET) * SCREEN_PX_PER_FRET -
      viewportWidth / 2 +
      SCROLL_SLACK,
  );
  // Spacer is EXACTLY this scroll range wide (= maxScroll + viewportWidth), so the browser
  // natively clamps scrollLeft to [0, maxScroll] — you can reach the last fret but not scroll
  // into empty void past it.
  const fullContentWidth = maxScroll + viewportWidth;

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

  // ── AUTO-FOLLOW CAMERA — during playback, continuously + smoothly pan the neck so the
  //    ACTIVE note stays centered (cinematic slide along the fretboard). Reads the gym's own
  //    clock (getPlaybackBeat) → the active note's fret → target scrollLeft, and exponentially
  //    lerps the container's scrollLeft toward it each frame (the easing = the smooth pan).
  //    Pauses while the user is dragging; stops when not playing. The exercise-load centering
  //    above handles the rest. ──
  const isDraggingRef = React.useRef(isDragging);
  isDraggingRef.current = isDragging;
  React.useEffect(() => {
    if (!getPlaybackBeat || !playheadNotes || playheadNotes.length === 0)
      return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = scrollContainerRef.current;
      const beat = getPlaybackBeat();
      // Not playing, mid-drag, or counting in → don't fight the user / hold position.
      if (!el || beat === null || beat < 0 || isDraggingRef.current) return;
      // Active note = last note whose startBeat ≤ beat (the sphere's current note).
      let idx = 0;
      for (let i = 0; i < playheadNotes.length; i++) {
        if (playheadNotes[i]!.startBeat <= beat) idx = i;
        else break;
      }
      // Interpolate the fret toward the NEXT note across the beat so the pan tracks the
      // gliding sphere continuously (not a per-note step). Wraps at the loop seam.
      const cur = playheadNotes[idx]!;
      const next = playheadNotes[(idx + 1) % playheadNotes.length]!;
      const slotEnd =
        idx + 1 < playheadNotes.length
          ? playheadNotes[idx + 1]!.startBeat
          : cur.startBeat + 0.5;
      const frac = Math.min(
        Math.max(
          (beat - cur.startBeat) / Math.max(slotEnd - cur.startBeat, 1e-3),
          0,
        ),
        1,
      );
      const followFret = cur.fret + (next.fret - cur.fret) * frac;
      // scrollLeft that CENTERS this fret. Use the MEASURED screen-px-per-fret mapping (the
      // same calibration the scroll range uses) — NOT the content geometry — because the 3D
      // is rendered at contentScale through a perspective camera, so on-screen px/fret ≠
      // content px/fret. At scroll 0 the visual center is ~DEFAULT_CENTER_FRET.
      const target = Math.min(
        Math.max((followFret - DEFAULT_CENTER_FRET) * SCREEN_PX_PER_FRET, 0),
        maxScroll,
      );
      // Exponential ease toward the target → the cinematic continuous slide.
      el.scrollLeft += (target - el.scrollLeft) * 0.08;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getPlaybackBeat, playheadNotes, viewportWidth, maxScroll]);

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

      {/* DEV playhead tuners — draggable; render null unless NEXT_PUBLIC_PLAYHEAD_PANEL=true.
          PlayheadPanel = the sphere (size/color/anim/bezier/ripple). AnticipationPanel = the
          runway + approach ring. Both edit the same playheadCfg; bake into playheadConfig.ts. */}
      <PlayheadPanel values={playheadCfg} onChange={setPlayheadCfg} />
      <AnticipationPanel values={playheadCfg} onChange={setPlayheadCfg} />

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
