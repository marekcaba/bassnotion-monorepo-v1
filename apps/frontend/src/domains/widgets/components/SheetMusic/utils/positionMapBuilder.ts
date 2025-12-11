/**
 * Position Map Builder for OSMD (OpenSheetMusicDisplay)
 *
 * Extracts actual rendered X positions from OSMD's GraphicalMusicSheet
 * to enable note-level scroll precision with variable bar widths.
 */

import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

/**
 * Position data for a single beat/note within a measure
 */
export interface BeatPosition {
  /** Beat number within measure (0-indexed, e.g., 0, 1, 2, 3 for 4/4) */
  beat: number;
  /** Subdivision within beat (0-3 for sixteenths) */
  subdivision: number;
  /** Absolute X position in pixels from OSMD render */
  xPosition: number;
}

/**
 * Position data for a single measure
 */
export interface MeasurePosition {
  /** Measure index (0-indexed) */
  measureIndex: number;
  /** X position of measure start (left edge) */
  xStart: number;
  /** X position of measure end (right edge) */
  xEnd: number;
  /** Width of the measure in pixels */
  width: number;
  /** Beat positions within this measure (sorted by beat/subdivision) */
  beatPositions: BeatPosition[];
}

/**
 * Complete position map for the entire sheet music
 */
export interface NotePositionMap {
  /** All measures with their positions */
  measures: MeasurePosition[];
  /** Total content width in pixels */
  totalWidth: number;
  /** Whether the map was successfully built */
  isValid: boolean;
}

/**
 * Transport position for scroll calculation
 */
export interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  ticks: number;
}

/**
 * Build a position map from OSMD's rendered GraphicalMusicSheet
 *
 * @param osmd - The OpenSheetMusicDisplay instance (must be rendered)
 * @returns NotePositionMap with actual X positions from the rendered sheet
 */
export function buildPositionMapFromOSMD(
  osmd: OpenSheetMusicDisplay,
): NotePositionMap {
  const emptyMap: NotePositionMap = {
    measures: [],
    totalWidth: 0,
    isValid: false,
  };

  try {
    // Access the GraphicSheet (rendered graphical representation)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphic = (osmd as any).graphic;
    console.log('[SHEETMUSIC] buildPositionMapFromOSMD:', {
      hasGraphic: !!graphic,
      hasMeasureList: !!graphic?.MeasureList,
      measureListLength: graphic?.MeasureList?.length,
    });

    if (!graphic || !graphic.MeasureList) {
      console.warn('[SHEETMUSIC] OSMD graphic or MeasureList not available');
      return emptyMap;
    }

    const measureList = graphic.MeasureList;
    const measures: MeasurePosition[] = [];

    // OSMD MeasureList is [measureIndex][staffIndex]
    // We only care about staff 0 (bass clef single staff)
    const staffIndex = 0;

    for (let measureIdx = 0; measureIdx < measureList.length; measureIdx++) {
      const staffMeasures = measureList[measureIdx];
      if (!staffMeasures || !staffMeasures[staffIndex]) {
        continue;
      }

      const graphicalMeasure = staffMeasures[staffIndex];
      const bbox = graphicalMeasure.PositionAndShape;

      if (!bbox) {
        continue;
      }

      // Extract measure boundaries
      const xStart = bbox.AbsolutePosition?.x ?? 0;
      const width = bbox.Size?.width ?? 100;
      const xEnd = xStart + width;

      const measurePos: MeasurePosition = {
        measureIndex: measureIdx,
        xStart,
        xEnd,
        width,
        beatPositions: [],
      };

      // Extract beat positions from staff entries (notes/rests)
      const staffEntries = graphicalMeasure.staffEntries || [];

      for (const staffEntry of staffEntries) {
        if (!staffEntry?.PositionAndShape) {
          continue;
        }

        const entryX =
          staffEntry.PositionAndShape.AbsolutePosition?.x ?? xStart;

        // Get the timestamp (beat position) within the measure
        // OSMD uses Fraction for timestamps
        const timestamp = staffEntry.relInMeasureTimestamp;
        let beatFloat = 0;

        if (timestamp) {
          // Convert Fraction to float (numerator / denominator)
          // Then multiply by 4 to get beat position (assuming quarter note = 1 beat)
          const realValue =
            typeof timestamp.RealValue === 'number'
              ? timestamp.RealValue
              : timestamp.Numerator / timestamp.Denominator;
          beatFloat = realValue * 4; // Convert to beats (quarter notes)
        }

        const beat = Math.floor(beatFloat);
        const subdivisionFloat = (beatFloat - beat) * 4; // 4 sixteenths per beat
        const subdivision = Math.round(subdivisionFloat);

        measurePos.beatPositions.push({
          beat,
          subdivision,
          xPosition: entryX,
        });
      }

      // Sort beat positions by beat and subdivision
      measurePos.beatPositions.sort((a, b) => {
        if (a.beat !== b.beat) return a.beat - b.beat;
        return a.subdivision - b.subdivision;
      });

      measures.push(measurePos);
    }

    // Calculate total width
    const lastMeasure = measures[measures.length - 1];
    const totalWidth = lastMeasure ? lastMeasure.xEnd : 0;

    return {
      measures,
      totalWidth,
      isValid: measures.length > 0,
    };
  } catch (error) {
    console.error('[PositionMapBuilder] Error building position map:', error);
    return emptyMap;
  }
}

/**
 * Get the X position for a given transport position
 *
 * Uses linear interpolation between known beat positions for smooth scrolling
 *
 * @param map - The position map from buildPositionMapFromOSMD
 * @param position - Current transport position (bars, beats, sixteenths, ticks)
 * @param beatsPerMeasure - Number of beats per measure (default: 4 for 4/4 time)
 * @returns X position in pixels, or null if position is out of range
 */
export function getXForPosition(
  map: NotePositionMap,
  position: TransportPosition,
  beatsPerMeasure: number = 4,
): number | null {
  if (!map.isValid || map.measures.length === 0) {
    return null;
  }

  const measureIdx = position.bars;

  // Handle position beyond the end
  if (measureIdx >= map.measures.length) {
    const lastMeasure = map.measures[map.measures.length - 1]!;
    return lastMeasure.xEnd;
  }

  // Handle negative position
  if (measureIdx < 0) {
    return map.measures[0]!.xStart;
  }

  const measure = map.measures[measureIdx]!;

  // Calculate beat position as float
  //
  // CRITICAL: The transport position format is:
  // - bars: measure number (1-indexed from transport, converted to 0-indexed by caller)
  // - beats: beat within measure (1-indexed: 1,2,3,4 for 4/4)
  // - sixteenths: sixteenth subdivision (0-3) - DISPLAY HINT ONLY
  // - ticks: total ticks within the BEAT (0-959 for 480 PPQ, can exceed beat boundary)
  //
  // The `sixteenths` field is a DISPLAY HINT derived from ticks, NOT an independent value.
  // We should calculate position from beats + ticks/PPQ only, ignoring sixteenths.
  //
  // Example: position 1:1:3:720 means bar 1, beat 1, with 720 ticks into that beat
  // 720 ticks / 960 ticks per beat = 0.75 beats = sixteenth 3 (which matches the display hint)

  const TICKS_PER_BEAT = 960; // Tone.js uses 480 PPQ, but position reports ticks spanning full beat

  // Step 1: Convert 1-indexed beats to 0-indexed
  const zeroIndexedBeat = position.beats - 1;

  // Step 2: Calculate beat position from ticks only (ignore sixteenths - it's derived)
  // The ticks value represents progress within the beat
  const tickFraction = position.ticks / TICKS_PER_BEAT;

  // Step 3: Calculate total beat position
  const rawBeatFloat = zeroIndexedBeat + tickFraction;

  // Step 4: Clamp to measure bounds (0 to beatsPerMeasure) as safety net
  const beatFloat = Math.max(
    0,
    Math.min(rawBeatFloat, beatsPerMeasure - 0.001),
  );

  // DEBUG: Log position conversion
  console.log('[POSITION CALC]', {
    input: `${position.bars}:${position.beats}:${position.sixteenths}:${position.ticks}`,
    zeroIndexedBeat,
    tickFraction: tickFraction.toFixed(3),
    beatFloat: beatFloat.toFixed(3),
  });

  // If no beat positions in this measure, interpolate linearly across measure
  if (measure.beatPositions.length === 0) {
    const progress = beatFloat / beatsPerMeasure;
    const result = measure.xStart + progress * measure.width;
    console.log('[SHEETMUSIC] getX: LINEAR (no beats)', {
      bar: measureIdx,
      beatFloat: beatFloat.toFixed(3),
      result: result.toFixed(2),
    });
    return result;
  }

  // Find surrounding beat positions for interpolation
  let before: BeatPosition | null = null;
  let after: BeatPosition | null = null;

  for (const pos of measure.beatPositions) {
    const posBeatFloat = pos.beat + pos.subdivision / 4;

    if (posBeatFloat <= beatFloat) {
      before = pos;
    } else if (after === null) {
      after = pos;
      break; // Found the first position after current, stop searching
    }
  }

  // Interpolate between surrounding positions
  if (before && after) {
    const beforeBeat = before.beat + before.subdivision / 4;
    const afterBeat = after.beat + after.subdivision / 4;
    const progress = (beatFloat - beforeBeat) / (afterBeat - beforeBeat);
    const result =
      before.xPosition + progress * (after.xPosition - before.xPosition);
    console.log('[SHEETMUSIC] getX: BETWEEN', {
      bar: measureIdx,
      beatFloat: beatFloat.toFixed(3),
      beforeBeat: beforeBeat.toFixed(2),
      afterBeat: afterBeat.toFixed(2),
      beforeX: before.xPosition.toFixed(2),
      afterX: after.xPosition.toFixed(2),
      progress: progress.toFixed(3),
      result: result.toFixed(2),
    });
    return result;
  }

  // Edge case: only have position before (at end of measure)
  if (before) {
    // Interpolate from before to measure end
    const beforeBeat = before.beat + before.subdivision / 4;
    const progress = (beatFloat - beforeBeat) / (beatsPerMeasure - beforeBeat);
    const remainingWidth = measure.xEnd - before.xPosition;
    const result = before.xPosition + progress * remainingWidth;
    console.log('[SHEETMUSIC] getX: AFTER-LAST', {
      bar: measureIdx,
      beatFloat: beatFloat.toFixed(3),
      beforeBeat: beforeBeat.toFixed(2),
      beforeX: before.xPosition.toFixed(2),
      measureEnd: measure.xEnd.toFixed(2),
      progress: progress.toFixed(3),
      result: result.toFixed(2),
    });
    return result;
  }

  // Edge case: only have position after (at start of measure)
  if (after) {
    // Interpolate from measure start to after
    const afterBeat = after.beat + after.subdivision / 4;
    const progress = beatFloat / afterBeat;
    const result =
      measure.xStart + progress * (after.xPosition - measure.xStart);
    console.log('[SHEETMUSIC] getX: BEFORE-FIRST', {
      bar: measureIdx,
      beatFloat: beatFloat.toFixed(3),
      afterBeat: afterBeat.toFixed(2),
      afterX: after.xPosition.toFixed(2),
      measureStart: measure.xStart.toFixed(2),
      progress: progress.toFixed(3),
      result: result.toFixed(2),
    });
    return result;
  }

  // Fallback: linear interpolation across measure
  const progress = beatFloat / beatsPerMeasure;
  const result = measure.xStart + progress * measure.width;
  console.log('[SHEETMUSIC] getX: FALLBACK', {
    bar: measureIdx,
    beatFloat: beatFloat.toFixed(3),
    result: result.toFixed(2),
  });
  return result;
}

/**
 * Get the X position for a specific measure (measure-level precision)
 *
 * @param map - The position map
 * @param measureIndex - Measure index (0-indexed)
 * @returns X position of measure start, or null if out of range
 */
export function getXForMeasure(
  map: NotePositionMap,
  measureIndex: number,
): number | null {
  if (!map.isValid || measureIndex < 0 || measureIndex >= map.measures.length) {
    return null;
  }

  return map.measures[measureIndex]!.xStart;
}

/**
 * Debug utility: log position map summary
 */
export function logPositionMapSummary(map: NotePositionMap): void {
  console.log('[PositionMapBuilder] Position map summary:', {
    isValid: map.isValid,
    totalMeasures: map.measures.length,
    totalWidth: map.totalWidth,
    measures: map.measures.map((m) => ({
      idx: m.measureIndex,
      x: `${Math.round(m.xStart)}-${Math.round(m.xEnd)}`,
      width: Math.round(m.width),
      beats: m.beatPositions.length,
    })),
  });
}
