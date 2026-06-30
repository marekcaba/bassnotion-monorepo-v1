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

  // DEV tuning: the playhead sphere config (size/color/anim/easing). The PlayheadPanel
  // adjusts it live when NEXT_PUBLIC_PLAYHEAD_PANEL=true; otherwise the baked default.
  const [playheadCfg, setPlayheadCfg] = React.useState<PlayheadConfig>(
    DEFAULT_PLAYHEAD_CONFIG,
  );

  // DEV calibration: live overrides for the centering/fade params, seeded from the
  // base config. When CALIBRATION_ENABLED, the panel adjusts these live; otherwise
  // the base config is used as-is.
  const [cal, setCal] = React.useState<FretboardCalibrationValues>(() => ({
    sceneX: baseConfig.sceneX,
    offsetX: baseConfig.offsetX,
    tiltAxisOffsetX: baseConfig.tiltAxisOffsetX,
    contentScale: baseConfig.contentScale,
    contentScaleX: baseConfig.contentScaleX,
    contentScaleY: baseConfig.contentScaleY,
    rotationX: baseConfig.rotationX,
    rotationY: baseConfig.rotationY,
    rotationZ: baseConfig.rotationZ,
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

  // SCROLL/CENTERING geometry — the MEASURED scrollLeft↔fret mapping (≈45.5 px/fret at the
  // baseline contentScale 1.17 + viewportWidth 700) now lives in the pure, tested
  // computeFretboardGeometry. scaleFactor defaults to 1 here (no size tier yet) → byte-identical
  // to the old inline math; the responsive tiers will pass a real factor that scales the px-rates
  // in lockstep with contentScale so the scroll + sphere stay locked to the dots.
  const geometry = computeFretboardGeometry({ maxFrets, viewportWidth });
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

  // ── POSITIONS (clusters) — segment the path into HAND POSITIONS the camera snaps between,
  //    instead of tracking every fret. Walking the notes in beat order, a new position starts
  //    whenever the next note sits more than ~a hand-span from the current cluster's centre (or
  //    would stretch the cluster past a comfortable span). Each position holds a fret RANGE +
  //    the beat range it's active. The camera centres a WHOLE position and only moves when the
  //    run crosses into the next one → it settles in a "room" then glides to the next, rather
  //    than ratcheting fret-by-fret. Memoized; recomputed only when the path changes. ──
  const positions = React.useMemo(() => {
    const notes = playheadNotes ?? [];
    if (notes.length === 0)
      return [] as {
        centerFret: number;
        startBeat: number;
        endBeat: number;
      }[];
    const GAP = 4; // a note >4 frets from the cluster centre opens a new position
    const MAX_SPAN = 6; // a position never spans more than ~a hand (6 frets)
    const clusters: { frets: number[]; startBeat: number; endBeat: number }[] =
      [];
    for (const n of notes) {
      const cur = clusters[clusters.length - 1];
      if (cur) {
        const lo = Math.min(...cur.frets, n.fret);
        const hi = Math.max(...cur.frets, n.fret);
        const center =
          cur.frets.reduce((s, f) => s + f, 0) / cur.frets.length;
        // Same position if the note is within reach AND the cluster stays hand-sized.
        if (Math.abs(n.fret - center) <= GAP && hi - lo <= MAX_SPAN) {
          cur.frets.push(n.fret);
          cur.endBeat = n.startBeat;
          continue;
        }
      }
      clusters.push({ frets: [n.fret], startBeat: n.startBeat, endBeat: n.startBeat });
    }
    return clusters.map((c) => ({
      // Centre on the cluster's fret-SPAN midpoint (so the whole hand position is framed).
      centerFret: (Math.min(...c.frets) + Math.max(...c.frets)) / 2,
      startBeat: c.startBeat,
      endBeat: c.endBeat,
    }));
  }, [playheadNotes]);

  // ── AUTO-FOLLOW CAMERA — POSITION-BASED + ANTICIPATORY. The target is the POSITION the run is
  //    heading into (look-ahead by LEAD_BEATS), not the live note. Because positions are stable,
  //    the target is a STEP function — it only changes when the run enters a new position — so
  //    the camera holds, then glides smoothly (ease-in-out tween) to the next position and
  //    settles. Feels like a game camera moving between rooms, not chasing the player. Holds
  //    still if the whole exercise fits; reads the gym clock; pauses while dragging; stops when
  //    not playing. ──
  const isDraggingRef = React.useRef(isDragging);
  isDraggingRef.current = isDragging;
  React.useEffect(() => {
    if (!getPlaybackBeat || positions.length === 0) return;
    const notes = playheadNotes ?? [];
    // Does the WHOLE exercise fit in the view? If so, never pan — all notes always visible.
    const frets = notes.map((n) => n.fret);
    const fitsInView = fitsInViewGeom(Math.min(...frets), Math.max(...frets));

    const scrollToCenterFret = (fret: number) => scrollForFretGeom(fret);

    // Beats of anticipation — aim the camera at where the run will be, so the next position is
    // already framed by the time the playhead arrives. Generous (3 beats) so the SLOW glide
    // below has runway to complete BEFORE the notes reach the new position — the camera is
    // never seen lagging behind the playhead, it's just quietly already there.
    const LEAD_BEATS = 3;
    const loop = loopBeats && loopBeats > 0 ? loopBeats : null;

    // Which position is active at a given beat (the last one whose startBeat has passed).
    const positionIndexAt = (b: number): number => {
      let idx = 0;
      for (let i = 0; i < positions.length; i++) {
        if (positions[i]!.startBeat <= b) idx = i;
        else break;
      }
      return idx;
    };

    // The glide between positions: when the target changes we start a SLOW, gentle tween from
    // the current scroll to the new position's centre. Deliberately long + super-soft so the
    // student never consciously notices the camera move — it's an ambient drift, not a slide.
    // One tween at a time; a new target mid-glide retargets smoothly from the live position.
    let tweenFrom = 0;
    let tweenTo = scrollContainerRef.current?.scrollLeft ?? 0;
    let tweenStart = 0;
    let tweening = false;
    let lastTargetIdx = -1;
    // ~2.2s drift. Long enough to be imperceptible; the 3-beat look-ahead gives it runway to
    // finish before the notes arrive (at typical practice tempos a beat is ~0.4–0.9s).
    const TWEEN_MS = 2200;
    // SMOOTHERSTEP (6t⁵−15t⁴+10t³): zero velocity AND zero acceleration at both ends, so there's
    // no perceptible start-jerk or mid-whoosh — the gentlest standard ease for "don't notice it".
    const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const el = scrollContainerRef.current;
      const beat = getPlaybackBeat();
      if (
        !el ||
        beat === null ||
        beat < 0 ||
        isDraggingRef.current ||
        fitsInView
      )
        return;

      // The position the run is heading INTO (look-ahead, loop-wrapped).
      const leadBeat = loop ? (beat + LEAD_BEATS) % loop : beat + LEAD_BEATS;
      const targetIdx = positionIndexAt(leadBeat);

      // Target changed → start a fresh ease-in-out tween from where we are to the new room.
      if (targetIdx !== lastTargetIdx) {
        lastTargetIdx = targetIdx;
        const dest = scrollToCenterFret(positions[targetIdx]!.centerFret);
        if (Math.abs(dest - el.scrollLeft) > 1) {
          tweenFrom = el.scrollLeft;
          tweenTo = dest;
          tweenStart = now;
          tweening = true;
        }
      }

      if (tweening) {
        const p = Math.min((now - tweenStart) / TWEEN_MS, 1);
        el.scrollLeft = tweenFrom + (tweenTo - tweenFrom) * smootherstep(p);
        if (p >= 1) tweening = false;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getPlaybackBeat, playheadNotes, positions, loopBeats, viewportWidth, maxScroll]);

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
