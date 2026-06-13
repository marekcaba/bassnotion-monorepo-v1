'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import { exerciseToMusicXML } from '../../utils/exerciseToMusicXML.js';
import {
  buildPositionMapFromOSMD,
  type TransportPosition,
} from './utils/positionMapBuilder.js';

// Duration of the eased page-flip (ms). A slow, smooth page turn. The playhead
// drifts right during this ease, so the flip aims AHEAD by that drift (see the
// flip-lookahead) to still land the playhead flush-left.
const FLIP_DURATION_MS = 1000;

interface SheetMusicDisplayProps {
  notes: ExerciseNote[];
  bpm: number;
  timeSignature: TimeSignature;
  title?: string;
  currentNoteIndex?: number; // For playback highlighting (legacy)
  isPlaying?: boolean; // Whether playback is active - controls cursor visibility
  currentBar?: number; // Current bar/measure number (0-indexed) for cursor position (legacy)
  currentPosition?: TransportPosition; // Full transport position with beat-level precision
  onReady?: () => void;
  width?: number; // Parent container width - will be used to calculate optimal size
  height?: number; // Base height per system
  maxMeasuresPerSystem?: number; // Maximum measures per line (default: 2)
  totalBars?: number; // Total number of measures/bars in the exercise
}

/**
 * SheetMusicDisplay Component
 *
 * Renders professional music notation using OpenSheetMusicDisplay (OSMD)
 *
 * Features:
 * - Automatic professional notation rendering (beaming, stem directions, etc.)
 * - Bass clef with proper octave transposition
 * - Playback cursor support
 * - Responsive sizing
 */
export function SheetMusicDisplay({
  notes,
  bpm,
  timeSignature,
  title,
  currentNoteIndex,
  isPlaying = false,
  currentBar: _currentBar,
  currentPosition,
  onReady,
  width,
  height = 150,
  maxMeasuresPerSystem = 2,
  totalBars,
}: SheetMusicDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // actualWidth setter is called in the parent-resize effect to trigger
  // a re-render after measuring; the value isn't read here (OSMD reads
  // its own container width directly).
  const [_actualWidth, setActualWidth] = useState(width || 700);

  // RIBBON LOOP. To loop "on and on" like the chord strip — bar 1 flowing in from
  // the right after the last bar, the playhead never visually rewinding — we render
  // the score REPEATED several times into one long staff. The playhead glides
  // forward through the copies; at the seam we silently reset scroll back by one
  // loop-width (invisible, the copies are identical). RIBBON_COPIES = how many loop
  // lengths are rendered; 3 gives plenty of runway on either side of the seam.
  const RIBBON_COPIES = 3;
  const loopBars = Math.max(1, totalBars || 1);

  // Build the repeated note list: copy the notes RIBBON_COPIES times, shifting each
  // copy's measure by loopBars. measure is 1-based (MusicalPosition), so copy k's
  // notes live in measures [k*loopBars+1 .. (k+1)*loopBars].
  const ribbonNotes = useMemo(() => {
    if (!notes || notes.length === 0) return notes;
    const out: ExerciseNote[] = [];
    for (let k = 0; k < RIBBON_COPIES; k++) {
      const shift = k * loopBars;
      for (const n of notes) {
        out.push({
          ...n,
          id: `${n.id}-r${k}`,
          position: {
            ...n.position,
            measure: (n.position?.measure ?? 1) + shift,
          },
        });
      }
    }
    return out;
  }, [notes, loopBars]);
  const ribbonTotalBars = loopBars * RIBBON_COPIES;

  // Memoize notes key for OSMD re-render detection (over the RIBBON notes).
  const notesKey = useMemo(() => JSON.stringify(ribbonNotes), [ribbonNotes]);

  // REST INTERVALS (for the rest-opportunistic page-flip). A rest is a stretch of
  // loop time where nothing is playing — we use that quiet time to flip the page
  // early so the upcoming phrase is already in view when it sounds. Computed from
  // the input notes: each note spans [startBeat, startBeat+durationBeats); the
  // GAPS between consecutive notes (and before the first / after the last) that
  // are at least MIN_REST_BEATS long are rests, in CONTINUOUS loop-beats.
  const restIntervals = useMemo(() => {
    const MIN_REST_BEATS = 1; // only flip on rests ≥ 1 beat (avoid twitchy flips)
    const beatsPerMeasure = timeSignature?.numerator || 4;
    const loopBeats = loopBars * beatsPerMeasure;
    if (!notes || notes.length === 0) return [] as { start: number }[];

    // Duration string → beats (in quarter-note beats, 4/4 assumption for value→beat).
    const DUR: Record<string, number> = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
      'thirty-second': 0.125,
      'sixty-fourth': 0.0625,
      'dotted-whole': 6,
      'dotted-half': 3,
      'dotted-quarter': 1.5,
      'dotted-eighth': 0.75,
      'dotted-sixteenth': 0.375,
      'triplet-whole': 8 / 3,
      'triplet-half': 4 / 3,
      'triplet-quarter': 2 / 3,
      'triplet-eighth': 1 / 3,
      'triplet-sixteenth': 1 / 6,
    };
    // Each note's continuous loop-beat span. position.beat is 0-indexed; tick is
    // 0-479 at 480 PPQ (a beat). measure is 1-based.
    const spans = notes
      .map((n) => {
        const p = n.position;
        const start =
          ((p?.measure ?? 1) - 1) * beatsPerMeasure +
          (p?.beat ?? 0) +
          (p?.tick ?? 0) / 480;
        const dur =
          DUR[(n as { duration?: string }).duration ?? 'quarter'] ?? 1;
        return { start, end: start + dur };
      })
      .sort((a, b) => a.start - b.start);

    // Gaps between consecutive notes → rests.
    const rests: { start: number }[] = [];
    let cursor = 0; // running "covered up to" beat
    for (const s of spans) {
      if (s.start - cursor >= MIN_REST_BEATS) rests.push({ start: cursor });
      cursor = Math.max(cursor, s.end);
    }
    // Trailing rest from the last note's end to the loop end.
    if (loopBeats - cursor >= MIN_REST_BEATS) rests.push({ start: cursor });
    return rests;
  }, [notes, loopBars, timeSignature?.numerator]);

  // CONTINUOUS GLIDE PLAYHEAD. We DON'T use OSMD's native cursor as the visible
  // playhead — it snaps note-to-note (a cursor, not a smooth playhead). Instead we
  // render our OWN thin overlay div (playheadRef) and position it every frame by
  // mapping the continuous transport position to a pixel x, gliding linearly
  // across each measure's [start,end] pixel span (constant speed within a bar,
  // continuous across barlines — exactly like the groove card's chord strip).
  //
  // barsRef holds the harvested per-measure pixel geometry (built from OSMD's
  // rendered layout after each render): each entry { startPx, endPx, firstNotePx }.
  // staffRef holds the staff vertical span so the playhead matches the staff height.
  const playheadRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<
    { startPx: number; endPx: number; firstNotePx: number }[]
  >([]);
  const staffRef = useRef<{ top: number; height: number }>({
    top: 0,
    height: 0,
  });

  // RIBBON LOOP tracking. `ribbonBeatRef` is a MONOTONIC absolute beat that keeps
  // climbing across loop wraps (like the chord strip's absBarPos) — it's what we
  // map onto the repeated ribbon so the playhead never visually rewinds. We
  // accumulate it from the per-frame delta of the consumer's loop position,
  // adding a full loop when the loop position wraps backward. `lastLoopBeatRef`
  // is the previous frame's loop position (to compute that delta).
  const ribbonBeatRef = useRef(-1);
  const lastLoopBeatRef = useRef(0);
  // Playhead pixel velocity in px/ms (time-based ⇒ tempo-independent), smoothed.
  // The slow page-flip ease lets the playhead drift right while it turns; the flip
  // aims ahead by this velocity × the ease duration so it still lands flush-left.
  const playheadVelocityRef = useRef(0);
  const lastPlayheadXRef = useRef(0);
  const lastPlayheadTimeRef = useRef(0);
  // Latest playhead content-x, mirrored so the page-flip RAF (which runs between
  // glide-effect frames) can clamp the eased scroll so the playhead never dips off
  // the left edge mid-tween.
  const playheadContentXRef = useRef(0);
  // REST-FLIP. restIntervals (loop-relative rest start beats) in a ref for the
  // glide effect, plus the absolute ribbon-beat of the last rest we already
  // flipped for — so a rest triggers an early page-flip exactly ONCE (not every
  // frame the playhead sits inside it).
  const restIntervalsRef = useRef(restIntervals);
  restIntervalsRef.current = restIntervals;
  const lastRestFlipBeatRef = useRef(-1);
  // GENUINE-STOP debounce. The consumer's `isPlaying` flickers false for a frame
  // during count-in / restart (dual source in useGrooveCardPlayback). We must NOT
  // destroy the monotonic ribbon position on a transient drop — that snaps the
  // playhead to the start ("never progresses"). Instead: on `!isPlaying` we just
  // HIDE the playhead and hold position; a separate debounced effect only resets
  // the ribbon after isPlaying has stayed false long enough to be a real stop.
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PAGE-FLIP scroll. flipTargetRef = the scrollLeft the page should turn to (set
  // by the glide effect when the playhead nears the right edge). A dedicated RAF
  // (flip-animation effect) runs a slow ease-in-out tween of the real scrollLeft
  // toward it, so the notation stays still within a page then SMOOTHLY (gentle
  // accelerate → gentle decelerate) turns to the next. The tween refs hold the
  // active animation: from/to scroll, start timestamp, and duration.
  const flipTargetRef = useRef(0);
  const flipRafRef = useRef<number | null>(null);
  const tweenFromRef = useRef(0);
  const tweenToRef = useRef(0);
  const tweenStartRef = useRef(0);


  // Single system - all measures on one horizontal line
  const calculatedHeight = height;

  // Measure parent container width if width is not provided
  useEffect(() => {
    if (!width && parentRef.current) {
      const parentWidth = parentRef.current.offsetWidth;
      setActualWidth(parentWidth);
    }
  }, [width]);

  // Initialize OSMD and render sheet music
  // Use stringified keys to prevent re-renders from reference changes
  const timeSignatureKey = useMemo(
    () => JSON.stringify(timeSignature),
    [timeSignature],
  );

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // Track if this effect is still active (for cleanup)
    let isActive = true;

    const initializeOSMD = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // CRITICAL: Clear previous content BEFORE creating new OSMD instance
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // If effect was canceled during async operation, abort
        if (!isActive) {
          return;
        }

        // Convert exercise notes to MusicXML — RIBBON notes (score repeated
        // RIBBON_COPIES times) so the loop can flow on continuously.
        const musicXML = exerciseToMusicXML({
          notes: ribbonNotes,
          bpm,
          timeSignature,
          title,
          maxMeasuresPerSystem,
          totalBars: ribbonTotalBars,
        });

        // MusicXML generated

        // Create new OSMD instance
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          // Backend: Use SVG for better quality and interactivity
          backend: 'svg',

          // Render options
          drawTitle: false, // We'll handle title in React if needed
          drawComposer: false,
          drawCredits: false,

          // Layout options
          autoResize: false, // We'll handle sizing manually for consistency

          // Performance options
          drawPartNames: false,
          drawMeasureNumbers: false,

          // OSMD's own cursor is disabled — we render our own CONTINUOUS glide
          // playhead overlay (see barsRef / playheadRef). OSMD's native cursor
          // only snaps note-to-note; we want a smooth playhead.
          disableCursor: true,

          // Quality options
          // renderSingleHorizontalStaffline: true, // DISABLED - testing if this causes duplication
        });

        // Disable OSMD auto-beaming - we use manual beam tags in MusicXML for precise control
        osmd.EngravingRules.AutoBeamNotes = false;

        // Minimize page margins to reduce internal padding
        osmd.EngravingRules.PageLeftMargin = 0.1; // Near-zero left margin
        osmd.EngravingRules.PageRightMargin = 0.1;
        osmd.EngravingRules.PageTopMargin = 0.5;
        osmd.EngravingRules.PageBottomMargin = 0.5;

        // Force single horizontal line - no line breaks
        // This ensures all measures render on ONE system with horizontal scrolling
        osmd.EngravingRules.NewSystemAtXMLNewSystemAttribute = false; // Ignore system breaks in MusicXML
        osmd.EngravingRules.NewPageAtXMLNewPageAttribute = false; // Ignore page breaks in MusicXML

        // ========== MEASURE WIDTH & SPACING CONFIGURATION ==========
        //
        // STRATEGY: MINIMUM measure width via FixedMeasureWidth + a fixed value.
        // Without it, sparse bars collapse very narrow (the sparse bar measured
        // ~9.9 units / ~89px) which reads cramped. Note OSMD's FixedMeasureWidth is
        // NOT a true "min only" floor — with a fixed value it makes bars roughly
        // EQUAL (≈24 units / ~220px here); wider bars shrink toward it too. That's
        // acceptable: an even grid where no bar is ever cramped. The glide playhead
        // handles equal or variable widths identically (it maps per-bar [start,end]).
        //
        // OSMD units: 1 unit ≈ 10 pixels (at zoom 1.0).
        osmd.EngravingRules.FixedMeasureWidth = true;
        osmd.EngravingRules.FixedMeasureWidthFixedValue = 16;

        // MARGINS: These control measure container width, NOT internal note positioning
        // Note: MeasureLeftMargin doesn't push the first note further from the barline
        // VexFlow's formatter controls internal note positions
        osmd.EngravingRules.MeasureLeftMargin = 1.5;
        osmd.EngravingRules.MeasureRightMargin = 1.5;

        // VOICE SPACING: How notes are distributed WITHIN the measure
        osmd.EngravingRules.VoiceSpacingMultiplierVexflow = 0.85;
        osmd.EngravingRules.VoiceSpacingAddendVexflow = 2;

        // NOTE DISTANCE: Minimum space between adjacent notes
        osmd.EngravingRules.MinNoteDistance = 4;

        // SOFTMAX: VexFlow's spacing algorithm factor
        // Lower = more compact/uniform, Higher = more proportional to duration
        osmd.EngravingRules.SoftmaxFactorVexFlow = 5; // OSMD default for compact layout

        // Don't stretch - we want compact measures
        osmd.EngravingRules.StretchLastSystemLine = false;

        // Keep single horizontal line (no system breaks)
        osmd.EngravingRules.RenderSingleHorizontalStaffline = true;

        osmdRef.current = osmd;

        // Load the MusicXML string
        await osmd.load(musicXML);

        // Set zoom level to make notation more compact
        // Adjust this value to fit the container width (536px)
        osmd.zoom = 0.9;

        // Render the score
        osmd.render();

        // HARVEST the per-measure pixel geometry for our continuous glide
        // playhead. Must run after every render() (render recreates the graphical
        // sheet). The position map gives OSMD-unit x positions; we convert to
        // pixels via pxPerUnit = renderedSvgWidth / map.totalWidth.
        {
          const map = buildPositionMapFromOSMD(osmd);
          const svg = containerRef.current?.querySelector('svg');
          const svgW = svg ? svg.getBoundingClientRect().width : 0;
          if (map.isValid && map.totalWidth > 0 && svgW > 0) {
            const ppu = svgW / map.totalWidth;
            barsRef.current = map.measures.map((m) => ({
              startPx: m.xStart * ppu,
              endPx: m.xEnd * ppu,
              // First note onset x (used only for measure 0, where xStart sits
              // BEFORE the clef + time signature; later bars start at the barline).
              firstNotePx:
                m.beatPositions.length > 0
                  ? m.beatPositions[0]!.xPosition * ppu
                  : m.xStart * ppu,
            }));
            // Reset the monotonic ribbon position for the fresh render.
            ribbonBeatRef.current = -1;
            // Staff vertical span (the playhead matches the staff height). The
            // authoritative source is OSMD's graphic geometry (in OSMD units):
            //   staffTopInSvg  = (system.y + staffLine.relY) * unitPx
            //   staffHeight    = staffLine.StaffHeight * unitPx     (unitPx = 10*zoom)
            // The SVG itself is vertically centred in the scroll container (flex
            // alignItems:center), so add the SVG's DOM offset within the container.
            const parentBox = parentRef.current?.getBoundingClientRect();
            const svgBox = svg?.getBoundingClientRect();
            const unitPx = 10 * (osmd.zoom || 1);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const graphic = (osmd as any).graphic;
            const firstMeasure = graphic?.MeasureList?.[0]?.[0];
            const system = firstMeasure?.ParentMusicSystem;
            const staffLine = system?.StaffLines?.[0];
            if (
              parentBox &&
              svgBox &&
              system?.PositionAndShape?.AbsolutePosition &&
              staffLine
            ) {
              const sysY = system.PositionAndShape.AbsolutePosition.y as number;
              const relY = (staffLine.PositionAndShape?.RelativePosition?.y ??
                0) as number;
              const staffHeightUnits = (staffLine.StaffHeight ?? 4) as number;
              const svgTopInParent = svgBox.y - parentBox.y;
              staffRef.current = {
                top: Math.round(svgTopInParent + (sysY + relY) * unitPx),
                height: Math.round(staffHeightUnits * unitPx),
              };
            }
          } else {
            barsRef.current = [];
          }
        }

        // Check if effect is still active after async render
        if (!isActive) {
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
          return;
        }

        setIsLoading(false);
        onReady?.();
      } catch (err) {
        console.error('[SheetMusic] Error rendering:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to render sheet music',
        );
        setIsLoading(false);
      }
    };

    initializeOSMD();

    // Cleanup function
    return () => {
      isActive = false;

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      if (osmdRef.current) {
        osmdRef.current = null;
      }
    };
    // Use stringified keys to detect actual content changes, not reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesKey, bpm, timeSignatureKey, title, maxMeasuresPerSystem, totalBars]);

  // CONTINUOUS GLIDE PLAYHEAD — position our own overlay div from the live
  // transport position by mapping the continuous beat to a pixel x. Within each
  // measure the playhead glides linearly across that measure's [start, end] pixel
  // span; measures are contiguous (each bar's start == previous bar's end), so the
  // motion is smooth and gap-free across the whole loop (constant speed within a
  // bar; the rate changes only at barlines — imperceptible, like the chord strip).
  // State-driven: the consumer pushes a fresh `currentPosition` every RAF frame.
  useEffect(() => {
    const playhead = playheadRef.current;
    if (!playhead) return;
    const bars = barsRef.current;

    // Not playing / no geometry / no position → just HIDE the playhead and HOLD
    // the monotonic position. Do NOT reset ribbonBeatRef here: the consumer's
    // `isPlaying` flickers false for a frame during count-in/restart, and nuking
    // the position on that transient was the "never progresses" bug. A genuine
    // stop is handled by the debounced reset effect below.
    if (!isPlaying || isLoading || bars.length === 0 || !currentPosition) {
      playhead.style.opacity = '0';
      return;
    }

    const beatsPerMeasure = timeSignature.numerator || 4;
    const totalBars = bars.length;
    const loopBeats = loopBars * beatsPerMeasure; // beats in ONE loop copy

    // The consumer's loop position (wraps 0→loopBeats→0 each loop).
    const pos = currentPosition;
    const loopBeat =
      pos.bars * beatsPerMeasure + (pos.beats - 1) + pos.ticks / 960;

    // MONOTONIC ribbon beat: accumulate the forward delta, adding a full loop when
    // the loop position wraps backward — so it climbs forever and the playhead
    // never visually rewinds (chord-strip technique).
    if (ribbonBeatRef.current < 0) {
      // Seed in COPY 0 (bars 1..loopBars) so the very first loop starts on bar 1
      // WITH its clef — like real sheet music. The playhead then climbs into copy
      // 1, and the seam (which fires at 2 loops) lands it back in copy 1 — a
      // clef-free zone where every copy is pixel-identical, so the seam stays
      // invisible. Copy 0's clef offset is handled by `firstNotePx` in
      // contentXForBeat, so bar 1 starts on the first note (after the clef).
      ribbonBeatRef.current = loopBeat;
    } else {
      let delta = loopBeat - lastLoopBeatRef.current;
      if (delta < -loopBeats * 0.5) delta += loopBeats; // wrapped backward
      if (delta < 0) delta = 0; // tiny backward jitter — never rewind
      ribbonBeatRef.current += delta;
    }
    lastLoopBeatRef.current = loopBeat;

    // Pure function: ribbon-beat → playhead content-x (px, includes paddingLeft).
    const PADDING_LEFT = 30;
    const contentXForBeat = (beat: number) => {
      const idx = Math.max(
        0,
        Math.min(totalBars - 1, Math.floor(beat / beatsPerMeasure)),
      );
      const f = Math.max(
        0,
        Math.min(1, (beat - idx * beatsPerMeasure) / beatsPerMeasure),
      );
      const bb = bars[idx]!;
      const l = idx === 0 ? bb.firstNotePx : bb.startPx;
      return l + f * (bb.endPx - l) + PADDING_LEFT;
    };

    // SEAM RESET (screen-preserving). Once the playhead climbs into copy 2
    // (ribbonBeat ≥ 2 loops), pull it back one loop to copy 1 — which is identical.
    // To make the jump INVISIBLE regardless of tiny geometry differences, capture
    // the playhead's exact on-screen x BEFORE the reset, then after shifting the
    // beat, set scrollLeft so the playhead lands at the SAME screen x. (Subtracting
    // a fixed loopWidthPx left a ~44px residual; this is exact.)
    while (ribbonBeatRef.current >= 2 * loopBeats) {
      const sc = parentRef.current;
      const beforeX = contentXForBeat(ribbonBeatRef.current);
      const screenXNow = sc ? beforeX - sc.scrollLeft : beforeX;
      ribbonBeatRef.current -= loopBeats;
      const afterX = contentXForBeat(ribbonBeatRef.current);
      const newScroll = Math.max(0, afterX - screenXNow);
      if (sc) {
        const shift = sc.scrollLeft - newScroll; // how far we pulled scroll back
        sc.scrollLeft = newScroll;
        flipTargetRef.current = Math.max(0, flipTargetRef.current - shift);
        tweenFromRef.current = Math.max(0, tweenFromRef.current - shift);
        tweenToRef.current = Math.max(0, tweenToRef.current - shift);
      }
    }

    const globalBeat = ribbonBeatRef.current;
    const playheadContentX = contentXForBeat(globalBeat);
    playheadContentXRef.current = playheadContentX; // mirror for the flip RAF clamp

    // Track the playhead's pixel velocity in px/MS (time-based ⇒ tempo-independent),
    // smoothed — used to aim the page-flip ahead by the drift over the ease so it
    // lands flush-left despite the slow 1s turn.
    {
      const now = performance.now();
      const dx = playheadContentX - lastPlayheadXRef.current;
      const dt = now - lastPlayheadTimeRef.current;
      lastPlayheadXRef.current = playheadContentX;
      lastPlayheadTimeRef.current = now;
      // Ignore the seam-reset backward jump and absurd frame gaps (tab blur, etc.).
      if (dx >= 0 && dx < 50 && dt > 1 && dt < 200) {
        const vPxPerMs = dx / dt;
        playheadVelocityRef.current =
          playheadVelocityRef.current * 0.85 + vPxPerMs * 0.15;
      }
    }

    const staff = staffRef.current;
    playhead.style.transform = `translateX(${playheadContentX}px)`;
    if (staff.height > 4) {
      // Extend a little ABOVE and BELOW the staff (overhang) — a tight edge-to-edge
      // line reads as cramped; real playheads poke past the staff a touch. Scale
      // the overhang to the staff height so it looks right at any zoom.
      const OVERHANG = Math.round(staff.height * 0.35);
      playhead.style.top = `${staff.top - OVERHANG}px`;
      playhead.style.height = `${staff.height + OVERHANG * 2}px`;
    }
    playhead.style.opacity = '1';

    // PAGE-FLIP scroll. Keep the notation STILL while the playhead travels across
    // the visible page; when it reaches ~80% of the viewport, set a new scroll
    // TARGET that lands the playhead near the left (~12%), giving a fresh full page
    // of still notation to read. We only set the target here — a separate eased RAF
    // (the flip-animation effect below) glides scrollLeft toward it. Crucially the
    // target is derived from the playhead's ABSOLUTE content-x, recomputed every
    // frame, so it self-corrects and can never "fall behind" (the bug in the first
    // attempt, which blocked re-triggering during the animation).
    const scrollContainer = parentRef.current;
    if (scrollContainer) {
      const viewportW = scrollContainer.clientWidth;
      const maxScroll = Math.max(0, scrollContainer.scrollWidth - viewportW);
      const FLIP_AT = 0.8; // flip when the playhead crosses 80% of the page
      const LAND = 0.0; // aim the playhead at the very left edge of the new page
      const HARD_EDGE = 0.95; // never let it pass 95% — snap the page if it does
      // LOOKAHEAD: the slow 1s ease lets the playhead drift right while the page
      // turns. Aim the page AHEAD by that drift (velocity px/ms × ease ms) so the
      // playhead still settles flush-left instead of ~25% in. The drift is the real
      // distance the playhead covers in the ease window, so it's tempo-independent.
      // SAFETY: cap the lookahead so the playhead can never settle LEFT of the edge
      // — even if the velocity estimate is high, the page can't advance more than
      // (playhead-to-left-edge minus a small margin) without pushing it off-screen.
      // Aim ahead by the drift over the ease. The factor (<1) accounts for the
      // ease curve: the page is already part-way to the target when the playhead
      // crosses the landing zone, so it needs less than the full velocity×duration
      // to settle flush-left. Tuned so the playhead lands near the left edge across
      // tempos; the off-screen guards keep it safe if it ever over/under-aims.
      const LOOKAHEAD_FACTOR = 0.45;
      const driftPx =
        Math.max(0, playheadVelocityRef.current) *
        FLIP_DURATION_MS *
        LOOKAHEAD_FACTOR;
      const lookahead = Math.min(driftPx, viewportW * 0.7);

      // Measure the playhead's screen position against the page target we're EASING
      // toward (where the notation will settle), NOT a lagging value. flipTargetRef
      // is the committed page; the eased tween chases it. The flip aims the playhead
      // at LAND + lookahead so it settles near the LEFT edge after the ease —
      // maximum upcoming notes in view, no already-played notes wasted on the left.
      const targetFor = (land: number) =>
        Math.max(
          0,
          Math.min(playheadContentX + lookahead - viewportW * land, maxScroll),
        );
      const screenXVsTarget = playheadContentX - flipTargetRef.current;

      if (screenXVsTarget < -viewportW * 0.1) {
        // Loop wrap / seek back → re-anchor the page so the start is visible.
        flipTargetRef.current = targetFor(LAND);
      } else if (screenXVsTarget > viewportW * FLIP_AT) {
        // Normal page turn: commit a new page (the tween eases toward it).
        const target = targetFor(LAND);
        if (target > flipTargetRef.current + 1) flipTargetRef.current = target;
      }

      // REST-OPPORTUNISTIC FLIP. When the playhead enters a REST (a quiet stretch
      // with nothing playing, ≥ 1 beat), turn the page EARLY using that quiet time
      // — but do EXACTLY what the normal 80% flip does (land the playhead at the
      // usual LAND spot), just sooner. Landing the playhead at LAND (not flush at
      // the far edge) keeps a FULL page of unplayed notes ahead, so the next normal
      // flip happens a full page later, never prematurely double-flipping. The eye
      // isn't tracking a note during a rest, so this early turn is unobtrusive.
      // Fires once per rest occurrence.
      const rests = restIntervalsRef.current;
      if (rests.length > 0) {
        const loopRel = ((globalBeat % loopBeats) + loopBeats) % loopBeats;
        // Which rest (if any) is the playhead currently inside? A rest is "active"
        // from its start until the next rest's start (i.e. through the notes after
        // it, conservatively — we only care that we're at/just past a rest onset).
        let activeRestStart: number | null = null;
        for (let i = 0; i < rests.length; i++) {
          const start = rests[i]!.start;
          const nextStart = i + 1 < rests.length ? rests[i + 1]!.start : Infinity;
          if (loopRel >= start && loopRel < nextStart) {
            activeRestStart = start;
            break;
          }
        }
        if (activeRestStart != null) {
          // The rest's ABSOLUTE ribbon beat (same cycle as the playhead).
          const restAbsBeat = globalBeat - loopRel + activeRestStart;
          // Flip ONCE per rest occurrence (keyed by its absolute beat).
          if (Math.abs(restAbsBeat - lastRestFlipBeatRef.current) > 0.001) {
            // Only flip if the playhead is ALREADY a meaningful way across the
            // COMMITTED page — i.e. there's real page to gain. Measure against
            // flipTargetRef (where the page is HEADING), NOT the lagging real
            // scrollLeft: right after a default flip, flipTargetRef has already
            // advanced (playhead will be near LAND), so a rest one beat later sees
            // a small offset and is correctly skipped — no premature double-flip.
            // The playhead must be past REST_MIN_TRAVEL of the page to earn a turn.
            const REST_MIN_TRAVEL = 0.5; // past 50% of the committed page
            const screenXVsCommitted = playheadContentX - flipTargetRef.current;
            if (screenXVsCommitted > viewportW * REST_MIN_TRAVEL) {
              const target = targetFor(LAND); // same landing as a normal flip
              if (target > flipTargetRef.current + 1) flipTargetRef.current = target;
            }
            // Mark this rest handled regardless (so we don't retry every frame).
            lastRestFlipBeatRef.current = restAbsBeat;
          }
        }
      }

      // BUG-1 HARD CLAMP: regardless of the eased tween, the playhead must never
      // leave the viewport. Measure against the REAL scrollLeft (where the page
      // actually is this frame, not where it's heading). If the playhead would
      // exceed HARD_EDGE, snap scrollLeft (and the tween) so it lands at LAND —
      // an instant catch-up that the 1000ms ease could never do at fast tempo.
      const screenXReal = playheadContentX - scrollContainer.scrollLeft;
      if (screenXReal > viewportW * HARD_EDGE) {
        const snap = targetFor(LAND);
        scrollContainer.scrollLeft = snap;
        flipTargetRef.current = snap;
        tweenFromRef.current = snap;
        tweenToRef.current = snap;
      }
      // SAFETY (left edge): the lookahead aims the target AHEAD of the playhead on
      // purpose, so `flipTargetRef > playheadContentX` is normal and expected (the
      // playhead drifts into it during the ease). But if the eased page ever moves
      // faster than the playhead and pulls it toward / past the LEFT edge, clamp:
      // keep a small left margin so the playhead never touches the edge. (At
      // realistic tempos the lookahead lands it ~8% in and this never fires; it's a
      // backstop for fast tempos / velocity over-estimation.)
      const LEFT_MARGIN = viewportW * 0.04;
      if (screenXReal < LEFT_MARGIN) {
        const snap = Math.max(0, playheadContentX - LEFT_MARGIN);
        scrollContainer.scrollLeft = snap;
        flipTargetRef.current = snap;
        tweenFromRef.current = snap;
        tweenToRef.current = snap;
      }
    }
  }, [
    currentPosition,
    isPlaying,
    isLoading,
    timeSignature.numerator,
  ]);

  // DEBOUNCED GENUINE-STOP reset. `isPlaying` flickers false for a frame during
  // count-in/restart (dual source in the consumer), so we must distinguish that
  // transient from a real stop. Arm a timer when isPlaying goes false; only if it
  // STAYS false past the debounce do we reset the ribbon to the start (and snap
  // the page home). A quick false→true flicker cancels the timer → the monotonic
  // position survives and the playhead resumes exactly where it was.
  useEffect(() => {
    const STOP_DEBOUNCE_MS = 400;
    if (isPlaying) {
      // Resumed (or never stopped) → cancel any pending reset.
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      return;
    }
    // Went not-playing → arm the genuine-stop reset.
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      ribbonBeatRef.current = -1;
      lastLoopBeatRef.current = 0;
      flipTargetRef.current = 0;
      tweenFromRef.current = 0;
      tweenToRef.current = 0;
      const sc = parentRef.current;
      if (sc) sc.scrollLeft = 0;
      stopTimerRef.current = null;
    }, STOP_DEBOUNCE_MS);
    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  // PAGE-FLIP animation loop. Runs a slow EASE-IN-OUT tween of scrollLeft toward
  // flipTargetRef. When the target moves forward (a new page), it (re)starts a
  // fresh tween FROM the current scroll TO the new target over FLIP_DURATION ms —
  // ease-in-out cubic gives a gentle start and a gentle stop (no abrupt lurch).
  // A backward target (loop wrap) snaps instantly (easing backward across the
  // whole sheet would read as a fast rewind).
  useEffect(() => {
    if (!isPlaying) return;
    const FLIP_DURATION = FLIP_DURATION_MS; // slow, smooth page turn
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = () => {
      const sc = parentRef.current;
      if (sc) {
        const target = flipTargetRef.current;
        const cur = sc.scrollLeft;

        if (target < cur - 8) {
          // Backward (loop wrap / seek back) → snap, and clear any active tween.
          sc.scrollLeft = target;
          tweenFromRef.current = target;
          tweenToRef.current = target;
        } else if (target > tweenToRef.current + 1) {
          // A NEW page target appeared → start a fresh ease-in-out tween from here.
          tweenFromRef.current = cur;
          tweenToRef.current = target;
          tweenStartRef.current = performance.now();
        }

        // Advance the active tween (if any distance remains).
        if (Math.abs(tweenToRef.current - tweenFromRef.current) > 0.5) {
          const elapsed = performance.now() - tweenStartRef.current;
          const t = Math.min(elapsed / FLIP_DURATION, 1);
          sc.scrollLeft =
            tweenFromRef.current +
            (tweenToRef.current - tweenFromRef.current) * easeInOutCubic(t);
          if (t >= 1) tweenFromRef.current = tweenToRef.current; // tween done
        }

        // LEFT-EDGE CLAMP (mid-tween): if the eased page ever moves so far that the
        // playhead would dip off the left edge, hold the scroll back so it stays a
        // hair inside. Catches fast-tempo / lookahead-overshoot during the ease,
        // which the glide effect (only running on position changes) could miss.
        const phX = playheadContentXRef.current;
        const leftMargin = sc.clientWidth * 0.04;
        const maxScrollForPlayhead = Math.max(0, phX - leftMargin);
        if (sc.scrollLeft > maxScrollForPlayhead) {
          sc.scrollLeft = maxScrollForPlayhead;
        }
      }
      flipRafRef.current = requestAnimationFrame(animate);
    };
    flipRafRef.current = requestAnimationFrame(animate);
    return () => {
      if (flipRafRef.current !== null) {
        cancelAnimationFrame(flipRafRef.current);
        flipRafRef.current = null;
      }
    };
  }, [isPlaying]);

  return (
    <div
      ref={parentRef}
      className="sheet-music-container scrollbar-hide"
      style={{
        width: width ? `${width}px` : '100%',
        height: `${calculatedHeight}px`,
        position: 'relative',
        overflow: 'auto', // Allow horizontal scrolling but hide scrollbar
        // GPU acceleration for smooth scrolling
        willChange: 'scroll-position',
        transform: 'translateZ(0)',
        // Prevent browser smooth scrolling from interfering with our JS animation
        scrollBehavior: 'auto',
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="text-sm text-gray-600">Loading sheet music...</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">Error: {error}</div>
        </div>
      )}

      <div
        ref={containerRef}
        className="osmd-container"
        style={{
          width: 'fit-content', // Let OSMD determine its natural width
          minWidth: '100%', // But at least full parent width
          height: '100%',
          display: 'flex',
          justifyContent: 'flex-start', // Left-align to show bass clef first
          alignItems: 'center',
          paddingLeft: '30px',
          paddingRight: '30px',
        }}
      />

      {/* CONTINUOUS GLIDE PLAYHEAD — our own thin vertical line, positioned every
          frame by the glide effect (translateX in content coords). It's an absolute
          child of the scroll container, so the browser scrolls it together with the
          score. Driven imperatively (no per-frame re-render). */}
      <div
        ref={playheadRef}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '0px',
          width: '2.5px',
          background: '#2563eb', // blue-600
          borderRadius: '2px',
          boxShadow: '0 0 6px rgba(37, 99, 235, 0.6)',
          pointerEvents: 'none',
          opacity: 0,
          transform: 'translateX(0px)',
          willChange: 'transform',
          zIndex: 5,
        }}
      />
    </div>
  );
}
