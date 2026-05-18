/**
 * Grid Position Utilities
 *
 * Conversion functions between grid cell positions and musical time positions.
 * Uses 480 PPQ (Pulses Per Quarter note) for MIDI-compatible precision.
 */

import type {
  MusicalPosition,
  GridResolution,
  GridPosition,
} from '../types.js';
import {
  PPQ,
  RESOLUTION_TO_TICKS,
  RESOLUTION_TO_CELLS_PER_BEAT,
} from '../constants.js';

/**
 * Convert a grid cell position to a musical position
 */
export function gridToMusicalPosition(
  gridPos: GridPosition,
  resolution: GridResolution,
  timeSignature: { numerator: number; denominator: number },
): MusicalPosition {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const beatsPerMeasure = timeSignature.numerator;
  const cellsPerMeasure = beatsPerMeasure * cellsPerBeat;

  const measure = Math.floor(gridPos.col / cellsPerMeasure);
  const cellInMeasure = gridPos.col % cellsPerMeasure;
  const beat = Math.floor(cellInMeasure / cellsPerBeat);
  const subdivision = cellInMeasure % cellsPerBeat;

  // Calculate tick within the beat
  const ticksPerCell = RESOLUTION_TO_TICKS[resolution];
  const tick = subdivision * ticksPerCell;

  return {
    measure,
    beat,
    subdivision,
    tick,
  };
}

/**
 * Convert a musical position to a grid cell column
 */
export function musicalToGridColumn(
  position: MusicalPosition,
  resolution: GridResolution,
  timeSignature: { numerator: number; denominator: number },
): number {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const beatsPerMeasure = timeSignature.numerator;
  const cellsPerMeasure = beatsPerMeasure * cellsPerBeat;

  // If we have tick precision, calculate the nearest cell
  if (position.tick !== undefined) {
    const ticksPerCell = RESOLUTION_TO_TICKS[resolution];
    const cellInBeat = Math.round(position.tick / ticksPerCell);
    return (
      position.measure * cellsPerMeasure +
      position.beat * cellsPerBeat +
      cellInBeat
    );
  }

  // Otherwise use subdivision
  return (
    position.measure * cellsPerMeasure +
    position.beat * cellsPerBeat +
    position.subdivision
  );
}

/**
 * Convert a musical position to absolute ticks from start
 */
export function musicalToTicks(
  position: MusicalPosition,
  timeSignature: { numerator: number; denominator: number },
): number {
  const ticksPerBeat = PPQ;
  const beatsPerMeasure = timeSignature.numerator;

  return (
    position.measure * beatsPerMeasure * ticksPerBeat +
    position.beat * ticksPerBeat +
    (position.tick ?? position.subdivision * (ticksPerBeat / 4))
  );
}

/**
 * Convert absolute ticks to a musical position
 */
export function ticksToMusical(
  ticks: number,
  timeSignature: { numerator: number; denominator: number },
): MusicalPosition {
  const ticksPerBeat = PPQ;
  const beatsPerMeasure = timeSignature.numerator;
  const ticksPerMeasure = beatsPerMeasure * ticksPerBeat;

  const measure = Math.floor(ticks / ticksPerMeasure);
  const ticksInMeasure = ticks % ticksPerMeasure;
  const beat = Math.floor(ticksInMeasure / ticksPerBeat);
  const tick = ticksInMeasure % ticksPerBeat;
  const subdivision = Math.floor(tick / (ticksPerBeat / 4));

  return {
    measure,
    beat,
    subdivision,
    tick,
  };
}

/**
 * Convert musical position to seconds based on tempo
 */
export function musicalToSeconds(
  position: MusicalPosition,
  tempo: number,
  timeSignature: { numerator: number; denominator: number },
): number {
  const ticks = musicalToTicks(position, timeSignature);
  const ticksPerSecond = (PPQ * tempo) / 60;
  return ticks / ticksPerSecond;
}

/**
 * Convert seconds to ticks based on tempo
 */
export function secondsToTicks(seconds: number, tempo: number): number {
  const ticksPerSecond = (PPQ * tempo) / 60;
  return Math.round(seconds * ticksPerSecond);
}

/**
 * Get total number of columns for the grid
 */
export function getTotalColumns(
  bars: number,
  resolution: GridResolution,
  timeSignature: { numerator: number; denominator: number },
): number {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const beatsPerMeasure = timeSignature.numerator;
  return bars * beatsPerMeasure * cellsPerBeat;
}

/**
 * Get total ticks for the pattern
 */
export function getTotalTicks(
  bars: number,
  timeSignature: { numerator: number; denominator: number },
): number {
  const beatsPerMeasure = timeSignature.numerator;
  return bars * beatsPerMeasure * PPQ;
}

/**
 * Snap a tick value to the nearest grid position
 */
export function snapToGrid(tick: number, resolution: GridResolution): number {
  const ticksPerCell = RESOLUTION_TO_TICKS[resolution];
  return Math.round(tick / ticksPerCell) * ticksPerCell;
}

/**
 * Check if a position is on a beat boundary
 */
export function isBeatBoundary(
  col: number,
  resolution: GridResolution,
): boolean {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  return col % cellsPerBeat === 0;
}

/**
 * Check if a position is on a measure boundary
 */
export function isMeasureBoundary(
  col: number,
  resolution: GridResolution,
  timeSignature: { numerator: number; denominator: number },
): boolean {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const beatsPerMeasure = timeSignature.numerator;
  const cellsPerMeasure = beatsPerMeasure * cellsPerBeat;
  return col % cellsPerMeasure === 0;
}

/**
 * Apply swing to a tick position
 * Swing affects even-numbered divisions (2nd, 4th, etc. in a beat)
 */
export function applySwing(
  tick: number,
  swingAmount: number, // 0-100
  resolution: GridResolution,
): number {
  if (swingAmount === 0) return tick;

  const ticksPerCell = RESOLUTION_TO_TICKS[resolution];
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const cellIndex = Math.floor(tick / ticksPerCell) % cellsPerBeat;

  // Only affect even cells (swing the offbeats)
  if (cellIndex % 2 === 1) {
    const maxSwing = ticksPerCell * 0.5; // Max 50% swing
    const swingOffset = (swingAmount / 100) * maxSwing;
    return tick + swingOffset;
  }

  return tick;
}

/**
 * Compare two musical positions
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function comparePositions(
  a: MusicalPosition,
  b: MusicalPosition,
): number {
  if (a.measure !== b.measure) return a.measure - b.measure;
  if (a.beat !== b.beat) return a.beat - b.beat;

  // Compare ticks if available, otherwise subdivisions
  const aTick = a.tick ?? a.subdivision * (PPQ / 4);
  const bTick = b.tick ?? b.subdivision * (PPQ / 4);

  return aTick - bTick;
}

/**
 * Check if two positions are equal (within tick tolerance)
 */
export function positionsEqual(
  a: MusicalPosition,
  b: MusicalPosition,
  tolerance = 0,
): boolean {
  if (a.measure !== b.measure || a.beat !== b.beat) return false;

  const aTick = a.tick ?? a.subdivision * (PPQ / 4);
  const bTick = b.tick ?? b.subdivision * (PPQ / 4);

  return Math.abs(aTick - bTick) <= tolerance;
}

/**
 * Get the column for the current playhead based on tick position
 */
export function tickToColumn(
  tick: number,
  resolution: GridResolution,
  timeSignature: { numerator: number; denominator: number },
): number {
  const position = ticksToMusical(tick, timeSignature);
  return musicalToGridColumn(position, resolution, timeSignature);
}
