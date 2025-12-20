/**
 * Grid Position Utilities - Unit Tests
 *
 * Tests for conversion functions between grid cell positions and musical time positions.
 */

import { describe, it, expect } from 'vitest';
import {
  gridToMusicalPosition,
  musicalToGridColumn,
  musicalToTicks,
  ticksToMusical,
  musicalToSeconds,
  secondsToTicks,
  getTotalColumns,
  getTotalTicks,
  snapToGrid,
  isBeatBoundary,
  isMeasureBoundary,
  applySwing,
  comparePositions,
  positionsEqual,
  tickToColumn,
} from '../gridPositionUtils.js';
import { PPQ } from '../../constants.js';
import type { MusicalPosition, GridResolution } from '../../types.js';

const timeSignature4_4 = { numerator: 4, denominator: 4 };
const timeSignature3_4 = { numerator: 3, denominator: 4 };

describe('gridPositionUtils', () => {
  describe('gridToMusicalPosition', () => {
    it('should convert column 0 to measure 0, beat 0, subdivision 0', () => {
      const result = gridToMusicalPosition(
        { row: 0, col: 0 },
        '1/16',
        timeSignature4_4
      );
      expect(result).toEqual({
        measure: 0,
        beat: 0,
        subdivision: 0,
        tick: 0,
      });
    });

    it('should convert column 4 to beat 1 in 1/16 resolution', () => {
      const result = gridToMusicalPosition(
        { row: 0, col: 4 },
        '1/16',
        timeSignature4_4
      );
      expect(result).toEqual({
        measure: 0,
        beat: 1,
        subdivision: 0,
        tick: 0,
      });
    });

    it('should convert column 16 to measure 1 in 4/4 with 1/16 resolution', () => {
      const result = gridToMusicalPosition(
        { row: 0, col: 16 },
        '1/16',
        timeSignature4_4
      );
      expect(result).toEqual({
        measure: 1,
        beat: 0,
        subdivision: 0,
        tick: 0,
      });
    });

    it('should correctly calculate tick values', () => {
      // Column 1 in 1/16 = 120 ticks (PPQ / 4)
      const result = gridToMusicalPosition(
        { row: 0, col: 1 },
        '1/16',
        timeSignature4_4
      );
      expect(result.tick).toBe(120);
    });

    it('should handle 1/8 resolution correctly', () => {
      // Column 2 = beat 1 in 1/8 resolution (2 cells per beat)
      const result = gridToMusicalPosition(
        { row: 0, col: 2 },
        '1/8',
        timeSignature4_4
      );
      expect(result.beat).toBe(1);
      expect(result.subdivision).toBe(0);
    });

    it('should handle 3/4 time signature', () => {
      // 3 beats per measure, 4 cells per beat = 12 cells per measure
      const result = gridToMusicalPosition(
        { row: 0, col: 12 },
        '1/16',
        timeSignature3_4
      );
      expect(result.measure).toBe(1);
      expect(result.beat).toBe(0);
    });
  });

  describe('musicalToGridColumn', () => {
    it('should convert position 0:0:0 to column 0', () => {
      const position: MusicalPosition = { measure: 0, beat: 0, subdivision: 0 };
      const result = musicalToGridColumn(position, '1/16', timeSignature4_4);
      expect(result).toBe(0);
    });

    it('should convert position 0:1:0 to column 4 in 1/16', () => {
      const position: MusicalPosition = { measure: 0, beat: 1, subdivision: 0 };
      const result = musicalToGridColumn(position, '1/16', timeSignature4_4);
      expect(result).toBe(4);
    });

    it('should convert position 1:0:0 to column 16 in 4/4 1/16', () => {
      const position: MusicalPosition = { measure: 1, beat: 0, subdivision: 0 };
      const result = musicalToGridColumn(position, '1/16', timeSignature4_4);
      expect(result).toBe(16);
    });

    it('should handle tick precision', () => {
      const position: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 120 };
      const result = musicalToGridColumn(position, '1/16', timeSignature4_4);
      expect(result).toBe(1); // 120 ticks = 1 cell in 1/16
    });

    it('should round tick values to nearest cell', () => {
      // 180 ticks is between cell 1 (120) and cell 2 (240), closer to cell 2
      const position: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 180 };
      const result = musicalToGridColumn(position, '1/16', timeSignature4_4);
      expect(result).toBe(2); // Rounded to nearest
    });
  });

  describe('musicalToTicks', () => {
    it('should convert position 0:0:0 to 0 ticks', () => {
      const position: MusicalPosition = { measure: 0, beat: 0, subdivision: 0 };
      const result = musicalToTicks(position, timeSignature4_4);
      expect(result).toBe(0);
    });

    it('should convert beat 1 to 480 ticks (1 quarter note)', () => {
      const position: MusicalPosition = { measure: 0, beat: 1, subdivision: 0 };
      const result = musicalToTicks(position, timeSignature4_4);
      expect(result).toBe(PPQ);
    });

    it('should convert measure 1 to 1920 ticks in 4/4', () => {
      const position: MusicalPosition = { measure: 1, beat: 0, subdivision: 0 };
      const result = musicalToTicks(position, timeSignature4_4);
      expect(result).toBe(4 * PPQ); // 4 beats * 480 PPQ
    });

    it('should use tick when provided', () => {
      const position: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 100 };
      const result = musicalToTicks(position, timeSignature4_4);
      expect(result).toBe(100);
    });
  });

  describe('ticksToMusical', () => {
    it('should convert 0 ticks to position 0:0:0', () => {
      const result = ticksToMusical(0, timeSignature4_4);
      expect(result.measure).toBe(0);
      expect(result.beat).toBe(0);
      expect(result.tick).toBe(0);
    });

    it('should convert 480 ticks to beat 1', () => {
      const result = ticksToMusical(480, timeSignature4_4);
      expect(result.beat).toBe(1);
      expect(result.tick).toBe(0);
    });

    it('should convert 1920 ticks to measure 1', () => {
      const result = ticksToMusical(1920, timeSignature4_4);
      expect(result.measure).toBe(1);
      expect(result.beat).toBe(0);
      expect(result.tick).toBe(0);
    });

    it('should calculate subdivisions correctly', () => {
      // 120 ticks = 1 sixteenth note
      const result = ticksToMusical(120, timeSignature4_4);
      expect(result.subdivision).toBe(1);
      expect(result.tick).toBe(120);
    });
  });

  describe('musicalToSeconds and secondsToTicks', () => {
    it('should convert 1 beat at 120 BPM to 0.5 seconds', () => {
      const position: MusicalPosition = { measure: 0, beat: 1, subdivision: 0 };
      const result = musicalToSeconds(position, 120, timeSignature4_4);
      expect(result).toBe(0.5);
    });

    it('should convert 1 measure at 60 BPM to 4 seconds', () => {
      const position: MusicalPosition = { measure: 1, beat: 0, subdivision: 0 };
      const result = musicalToSeconds(position, 60, timeSignature4_4);
      expect(result).toBe(4);
    });

    it('should convert seconds to ticks correctly', () => {
      // At 120 BPM: 0.5 seconds = 1 beat = 480 ticks
      const result = secondsToTicks(0.5, 120);
      expect(result).toBe(480);
    });

    it('should handle 60 BPM correctly', () => {
      // At 60 BPM: 1 second = 1 beat = 480 ticks
      const result = secondsToTicks(1, 60);
      expect(result).toBe(480);
    });
  });

  describe('getTotalColumns', () => {
    it('should return 32 columns for 2 bars in 4/4 at 1/16', () => {
      const result = getTotalColumns(2, '1/16', timeSignature4_4);
      expect(result).toBe(32); // 2 bars * 4 beats * 4 cells
    });

    it('should return 16 columns for 2 bars in 4/4 at 1/8', () => {
      const result = getTotalColumns(2, '1/8', timeSignature4_4);
      expect(result).toBe(16); // 2 bars * 4 beats * 2 cells
    });

    it('should return 24 columns for 2 bars in 3/4 at 1/16', () => {
      const result = getTotalColumns(2, '1/16', timeSignature3_4);
      expect(result).toBe(24); // 2 bars * 3 beats * 4 cells
    });
  });

  describe('getTotalTicks', () => {
    it('should return 3840 ticks for 2 bars in 4/4', () => {
      const result = getTotalTicks(2, timeSignature4_4);
      expect(result).toBe(3840); // 2 bars * 4 beats * 480 PPQ
    });

    it('should return 2880 ticks for 2 bars in 3/4', () => {
      const result = getTotalTicks(2, timeSignature3_4);
      expect(result).toBe(2880); // 2 bars * 3 beats * 480 PPQ
    });
  });

  describe('snapToGrid', () => {
    it('should snap tick 0 to 0', () => {
      expect(snapToGrid(0, '1/16')).toBe(0);
    });

    it('should snap tick 50 to 0 in 1/16 resolution', () => {
      expect(snapToGrid(50, '1/16')).toBe(0);
    });

    it('should snap tick 100 to 120 in 1/16 resolution', () => {
      expect(snapToGrid(100, '1/16')).toBe(120);
    });

    it('should snap tick 240 to 240 in 1/8 resolution', () => {
      expect(snapToGrid(240, '1/8')).toBe(240);
    });

    it('should snap tick 300 to 240 in 1/8 resolution', () => {
      expect(snapToGrid(300, '1/8')).toBe(240);
    });
  });

  describe('isBeatBoundary', () => {
    it('should return true for column 0', () => {
      expect(isBeatBoundary(0, '1/16')).toBe(true);
    });

    it('should return false for column 1 in 1/16', () => {
      expect(isBeatBoundary(1, '1/16')).toBe(false);
    });

    it('should return true for column 4 in 1/16', () => {
      expect(isBeatBoundary(4, '1/16')).toBe(true);
    });

    it('should return true for column 2 in 1/8', () => {
      expect(isBeatBoundary(2, '1/8')).toBe(true);
    });
  });

  describe('isMeasureBoundary', () => {
    it('should return true for column 0', () => {
      expect(isMeasureBoundary(0, '1/16', timeSignature4_4)).toBe(true);
    });

    it('should return false for column 4', () => {
      expect(isMeasureBoundary(4, '1/16', timeSignature4_4)).toBe(false);
    });

    it('should return true for column 16 in 4/4 1/16', () => {
      expect(isMeasureBoundary(16, '1/16', timeSignature4_4)).toBe(true);
    });

    it('should return true for column 12 in 3/4 1/16', () => {
      expect(isMeasureBoundary(12, '1/16', timeSignature3_4)).toBe(true);
    });
  });

  describe('applySwing', () => {
    it('should return unchanged tick when swingAmount is 0', () => {
      expect(applySwing(120, 0, '1/16')).toBe(120);
    });

    it('should not swing downbeats (even cells)', () => {
      // Cell 0 is a downbeat
      expect(applySwing(0, 50, '1/16')).toBe(0);
    });

    it('should swing offbeats (odd cells)', () => {
      // Cell 1 is at tick 120, 50% swing should push it forward
      const result = applySwing(120, 50, '1/16');
      expect(result).toBeGreaterThan(120);
    });

    it('should apply 100% swing correctly', () => {
      // Max swing is 50% of ticksPerCell (60 ticks in 1/16)
      const result = applySwing(120, 100, '1/16');
      expect(result).toBe(180); // 120 + 60
    });
  });

  describe('comparePositions', () => {
    it('should return 0 for equal positions', () => {
      const a: MusicalPosition = { measure: 0, beat: 1, subdivision: 2 };
      const b: MusicalPosition = { measure: 0, beat: 1, subdivision: 2 };
      expect(comparePositions(a, b)).toBe(0);
    });

    it('should return negative when a is before b', () => {
      const a: MusicalPosition = { measure: 0, beat: 0, subdivision: 0 };
      const b: MusicalPosition = { measure: 0, beat: 1, subdivision: 0 };
      expect(comparePositions(a, b)).toBeLessThan(0);
    });

    it('should return positive when a is after b', () => {
      const a: MusicalPosition = { measure: 1, beat: 0, subdivision: 0 };
      const b: MusicalPosition = { measure: 0, beat: 3, subdivision: 3 };
      expect(comparePositions(a, b)).toBeGreaterThan(0);
    });

    it('should compare using tick when available', () => {
      const a: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 50 };
      const b: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 100 };
      expect(comparePositions(a, b)).toBeLessThan(0);
    });
  });

  describe('positionsEqual', () => {
    it('should return true for identical positions', () => {
      const a: MusicalPosition = { measure: 0, beat: 1, subdivision: 2 };
      const b: MusicalPosition = { measure: 0, beat: 1, subdivision: 2 };
      expect(positionsEqual(a, b)).toBe(true);
    });

    it('should return false for different measures', () => {
      const a: MusicalPosition = { measure: 0, beat: 0, subdivision: 0 };
      const b: MusicalPosition = { measure: 1, beat: 0, subdivision: 0 };
      expect(positionsEqual(a, b)).toBe(false);
    });

    it('should allow tolerance for tick comparison', () => {
      const a: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 100 };
      const b: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 105 };
      expect(positionsEqual(a, b, 10)).toBe(true);
    });

    it('should fail if tick difference exceeds tolerance', () => {
      const a: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 100 };
      const b: MusicalPosition = { measure: 0, beat: 0, subdivision: 0, tick: 150 };
      expect(positionsEqual(a, b, 10)).toBe(false);
    });
  });

  describe('tickToColumn', () => {
    it('should convert tick 0 to column 0', () => {
      const result = tickToColumn(0, '1/16', timeSignature4_4);
      expect(result).toBe(0);
    });

    it('should convert tick 480 to column 4 in 1/16', () => {
      const result = tickToColumn(480, '1/16', timeSignature4_4);
      expect(result).toBe(4);
    });

    it('should convert tick 1920 to column 16 in 4/4 1/16', () => {
      const result = tickToColumn(1920, '1/16', timeSignature4_4);
      expect(result).toBe(16);
    });
  });
});
