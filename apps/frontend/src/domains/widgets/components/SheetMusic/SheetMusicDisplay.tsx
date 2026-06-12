'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { verboseLog } from '@/config/debug';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import { exerciseToMusicXML } from '../../utils/exerciseToMusicXML.js';
import {
  buildPositionMapFromOSMD,
  type TransportPosition,
} from './utils/positionMapBuilder.js';

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

        // DEBUG: Log ALL EngravingRules to see what's available
        verboseLog(
          '[SheetMusicDisplay] ALL EngravingRules keys:',
          Object.keys(osmd.EngravingRules),
        );

        // DEBUG: Log OSMD configuration BEFORE render
        verboseLog('[SheetMusicDisplay] OSMD EngravingRules APPLIED:', {
          // Measure width settings
          FixedMeasureWidth: osmd.EngravingRules.FixedMeasureWidth,
          FixedMeasureWidthFixedValue:
            osmd.EngravingRules.FixedMeasureWidthFixedValue,
          // Measure margins (space from barline to notes)
          MeasureLeftMargin: osmd.EngravingRules.MeasureLeftMargin,
          MeasureRightMargin: osmd.EngravingRules.MeasureRightMargin,
          // Voice/note spacing
          VoiceSpacingMultiplierVexflow:
            osmd.EngravingRules.VoiceSpacingMultiplierVexflow,
          VoiceSpacingAddendVexflow:
            osmd.EngravingRules.VoiceSpacingAddendVexflow,
          MinNoteDistance: osmd.EngravingRules.MinNoteDistance,
          // Softmax factor for proportional spacing
          SoftmaxFactorVexFlow: osmd.EngravingRules.SoftmaxFactorVexFlow,
        });

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

        // DEBUG: Inspect rendered measure positions AFTER render
        verboseLog('[SheetMusicDisplay] POST-RENDER inspection:');

        // Access the graphic sheet to inspect actual measure positions
        if (osmd.GraphicSheet && osmd.GraphicSheet.MeasureList) {
          const measureList = osmd.GraphicSheet.MeasureList;
          verboseLog('[SheetMusicDisplay] Total measures:', measureList.length);

          measureList.forEach(
            (measureArray: unknown[], measureIndex: number) => {
              if (measureArray && measureArray.length > 0) {
                const measure = measureArray[0] as {
                  PositionAndShape?: {
                    AbsolutePosition?: { x: number; y: number };
                    Size?: { width: number; height: number };
                    BorderLeft?: number;
                    BorderRight?: number;
                  };
                  staffEntries?: Array<{
                    PositionAndShape?: {
                      AbsolutePosition?: { x: number };
                    };
                  }>;
                };
                if (measure && measure.PositionAndShape) {
                  const pos = measure.PositionAndShape;
                  verboseLog(`[SheetMusicDisplay] Measure ${measureIndex}:`, {
                    absoluteX: pos.AbsolutePosition?.x,
                    absoluteY: pos.AbsolutePosition?.y,
                    width: pos.Size?.width,
                    height: pos.Size?.height,
                    borderLeft: pos.BorderLeft,
                    borderRight: pos.BorderRight,
                  });

                  // Log first and last staff entry positions within measure
                  if (measure.staffEntries && measure.staffEntries.length > 0) {
                    const firstEntry = measure.staffEntries[0];
                    const lastEntry =
                      measure.staffEntries[measure.staffEntries.length - 1];
                    const firstX =
                      firstEntry?.PositionAndShape?.AbsolutePosition?.x || 0;
                    const lastX =
                      lastEntry?.PositionAndShape?.AbsolutePosition?.x || 0;
                    const measureStart = pos.AbsolutePosition?.x || 0;
                    const measureEnd = measureStart + (pos.Size?.width || 0);

                    // Calculate ACTUAL margins (distance from barline to notes)
                    const actualLeftMargin = firstX - measureStart;
                    const actualRightMargin = measureEnd - lastX;

                    verboseLog(
                      `[SheetMusicDisplay] Measure ${measureIndex} MARGINS:`,
                      {
                        entryCount: measure.staffEntries.length,
                        measureStart: measureStart.toFixed(2),
                        measureEnd: measureEnd.toFixed(2),
                        firstNoteX: firstX.toFixed(2),
                        lastNoteX: lastX.toFixed(2),
                        LEFT_MARGIN: actualLeftMargin.toFixed(2),
                        RIGHT_MARGIN: actualRightMargin.toFixed(2),
                        DIFFERENCE: (
                          actualRightMargin - actualLeftMargin
                        ).toFixed(2),
                      },
                    );
                  }
                }
              }
            },
          );
        }

        // Also log the ACTUAL EngravingRules after render to verify they were used
        verboseLog('[SheetMusicDisplay] EngravingRules AFTER render:', {
          FixedMeasureWidth: osmd.EngravingRules.FixedMeasureWidth,
          FixedMeasureWidthFixedValue:
            osmd.EngravingRules.FixedMeasureWidthFixedValue,
          MeasureLeftMargin: osmd.EngravingRules.MeasureLeftMargin,
          MeasureRightMargin: osmd.EngravingRules.MeasureRightMargin,
          // Check if there are additional margin settings
          DistanceBetweenLastInstructionAndRepetitionBarline:
            osmd.EngravingRules
              .DistanceBetweenLastInstructionAndRepetitionBarline,
          RepetitionEndInstructionXShift:
            osmd.EngravingRules.RepetitionEndInstructionXShift,
        });

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
      const LAND = 0.12; // ...and re-land it at 12% from the left
      const HARD_EDGE = 0.95; // never let it pass 95% — snap the page if it does

      // BUG-1 FIX: measure the playhead's screen position against the page target
      // we're EASING toward (where the notation will settle), NOT a lagging value.
      // flipTargetRef is the committed page; the eased tween chases it.
      const targetFor = (land: number) =>
        Math.max(0, Math.min(playheadContentX - viewportW * land, maxScroll));
      const screenXVsTarget = playheadContentX - flipTargetRef.current;

      if (screenXVsTarget < -viewportW * 0.1) {
        // Loop wrap / seek back → re-anchor the page so the start is visible.
        flipTargetRef.current = targetFor(LAND);
      } else if (screenXVsTarget > viewportW * FLIP_AT) {
        // Normal page turn: commit a new page (the tween eases toward it).
        const target = targetFor(LAND);
        if (target > flipTargetRef.current + 1) flipTargetRef.current = target;
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
    const FLIP_DURATION = 1000; // ms — slow, smooth page turn
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
