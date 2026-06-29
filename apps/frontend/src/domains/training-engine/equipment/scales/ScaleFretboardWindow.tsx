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
  // This gives, for free: drag-to-move AND the scroll-gated LEFT FADE. The inner spacer is
  // wider than the window so there's room to scroll the whole neck. Positioning + the scroll
  // range use the MEASURED screen-px-per-fret mapping (SCREEN_PX_PER_FRET) below, since the
  // 3D renders at contentScale through a perspective camera (on-screen px/fret ≠ content).

  // SCROLL RANGE — scrollLeft (DOM px) does NOT pan content 1:1: the 3D is rendered at
  // contentScale through a perspective camera, so DOM-px under-covers the scaled content.
  // MEASURED on the real board: at scroll 660 the neck reached ~fret 17 (from the default
  // center ~fret 2.5) → ≈45.5 on-screen px per fret. Scroll to put the last fret at the
  // viewport CENTER would be (lastFret − 2.5)×45.5; we want it at the RIGHT EDGE instead
  // (so the neck stops with the last fret flush right, no blank space), which is half a
  // viewport less. The spacer is exactly this wide so the browser clamps scroll there.
  const SCREEN_PX_PER_FRET = 45.5;
  const DEFAULT_CENTER_FRET = 2.5;
  // CENTERING calibration — what scrollLeft puts a given fret at the VISUAL CENTER.
  // CENTER_FRET_AT_0 = the fret centered at scrollLeft 0; CENTER_PX_PER_FRET = scroll px per
  // fret of pan (same rate as the scroll range, 45.5). MEASURED 2026-06-28: scrollLeft 56
  // centered fret-mid 6.0 → anchor = 6.0 − 56/45.5 ≈ 4.77.
  const CENTER_FRET_AT_0 = 4.77;
  const CENTER_PX_PER_FRET = 45.5;
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

  // Center a fret in the viewport with an EASE-IN-OUT tween (own rAF, not the browser's
  // default smooth scroll — that easing reads abrupt on key changes). fret can be fractional.
  // The scrollLeft→fret mapping is the MEASURED screen relationship: at scroll 0 the visual
  // center is CENTER_FRET_AT_0; each fret of pan needs CENTER_PX_PER_FRET of scroll.
  const centerTweenRef = React.useRef<number | null>(null);
  const scrollToFret = React.useCallback(
    (fret: number, durationMs = 650) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const target = Math.min(
        Math.max((fret - CENTER_FRET_AT_0) * CENTER_PX_PER_FRET, 0),
        maxScroll,
      );
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
    [maxScroll],
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
    const viewFrets = viewportWidth / SCREEN_PX_PER_FRET;
    const fitsInView = hi - lo <= viewFrets - 1.5;
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

  // ── AUTO-FOLLOW CAMERA — during playback, SLOWLY pan the neck to keep the active note in
  //    view — but ONLY WHEN NEEDED. If the whole exercise's fret span already fits in the
  //    window, the camera holds still (no sliding). When it doesn't fit, the view only nudges
  //    (gently, slowly) as the active note nears the left/right edge, then settles. Reads the
  //    gym's own clock (getPlaybackBeat). Pauses while dragging; stops when not playing. ──
  const isDraggingRef = React.useRef(isDragging);
  isDraggingRef.current = isDragging;
  React.useEffect(() => {
    if (!getPlaybackBeat || !playheadNotes || playheadNotes.length === 0)
      return;
    // Does the WHOLE exercise fit in the view? View width in frets = viewport / px-per-fret.
    // If the exercise span fits (with a margin), never pan — all notes are always visible.
    const frets = playheadNotes.map((n) => n.fret);
    const span = Math.max(...frets) - Math.min(...frets);
    const viewFrets = viewportWidth / SCREEN_PX_PER_FRET;
    const fitsInView = span <= viewFrets - 1.5; // 1.5-fret margin so edges aren't jammed

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = scrollContainerRef.current;
      const beat = getPlaybackBeat();
      // Not playing, mid-drag, counting in, or the exercise fits → hold position, no pan.
      if (
        !el ||
        beat === null ||
        beat < 0 ||
        isDraggingRef.current ||
        fitsInView
      )
        return;

      // Active note's fret (the sphere's current note).
      let idx = 0;
      for (let i = 0; i < playheadNotes.length; i++) {
        if (playheadNotes[i]!.startBeat <= beat) idx = i;
        else break;
      }
      const followFret = playheadNotes[idx]!.fret;

      // Where the active note currently sits on screen (px from the left edge).
      const fretScreenX =
        (followFret - DEFAULT_CENTER_FRET) * SCREEN_PX_PER_FRET - el.scrollLeft;
      // EDGE BUFFER — only pan when the note drifts into the outer ~25% on either side; while
      // it's comfortably in frame, the camera holds completely still.
      const buffer = viewportWidth * 0.25;
      let target = el.scrollLeft;
      if (fretScreenX < buffer) {
        // Drifting off the LEFT → pan left so the note returns to the buffer line.
        target = el.scrollLeft + (fretScreenX - buffer);
      } else if (fretScreenX > viewportWidth - buffer) {
        // Drifting off the RIGHT → pan right.
        target = el.scrollLeft + (fretScreenX - (viewportWidth - buffer));
      } else {
        return; // comfortably centered → no movement at all
      }
      target = Math.min(Math.max(target, 0), maxScroll);
      // VERY SLOW ease toward the target — a calm drift, not a chase.
      el.scrollLeft += (target - el.scrollLeft) * 0.02;
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
