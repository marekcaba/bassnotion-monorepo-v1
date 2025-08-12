import { describe, it, expect } from 'vitest';
import {
  createRegion,
  validateRegion,
  addMusicalTime,
  subtractMusicalTime,
  compareMusicalPositions,
  isPositionInRange,
  getRegionEndPosition,
  doRegionsOverlap,
  secondsToMusicalPosition,
  musicalPositionToSeconds,
  quantizePosition,
  sortRegionsByPosition,
  findRegionsInRange
} from '../regionUtils';
import type { Region, QuantizationSettings } from '../../types/region';

describe('regionUtils', () => {
  describe('createRegion', () => {
    it('should create a region with default values', () => {
      const region = createRegion({
        trackId: 'test-track',
        name: 'Test Region'
      });

      expect(region).toMatchObject({
        trackId: 'test-track',
        name: 'Test Region',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 0,
        muted: false,
        laneIndex: 0
      });
      expect(region.id).toBeDefined();
      expect(region.color).toBeDefined();
    });

    it('should override defaults with provided values', () => {
      const region = createRegion({
        trackId: 'test-track',
        name: 'Custom Region',
        startPosition: '4:0:0',
        duration: '2:0:0'
      });

      expect(region.startPosition).toBe('4:0:0');
      expect(region.duration).toBe('2:0:0');
    });
  });

  describe('validateRegion', () => {
    it('should validate a valid region', () => {
      const region: Region = {
        id: 'region-1',
        trackId: 'track-1',
        name: 'Valid Region',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 1,
        muted: false,
        pattern: { id: 'pattern-1', events: [], loopLength: 1 } as any
      };

      const result = validateRegion(region);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid region properties', () => {
      const region: Region = {
        id: '',
        trackId: '',
        name: '',
        startPosition: 'invalid',
        duration: '1:0:0',
        loopCount: -1,
        muted: false
      };

      const result = validateRegion(region);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Region must have an ID');
      expect(result.errors).toContain('Region must have a track ID');
      expect(result.errors).toContain('Region must have a name');
      expect(result.errors).toContain('Invalid start position format');
      expect(result.errors).toContain('Loop count must be non-negative');
    });
  });

  describe('musical time arithmetic', () => {
    describe('addMusicalTime', () => {
      it('should add musical positions correctly', () => {
        expect(addMusicalTime('0:0:0', '1:0:0')).toBe('1:0:0');
        expect(addMusicalTime('1:2:3', '0:1:1')).toBe('2:0:0');
        expect(addMusicalTime('0:3:3', '0:0:1')).toBe('1:0:0');
        expect(addMusicalTime('1:3:3', '2:2:2')).toBe('4:2:1');
      });
    });

    describe('subtractMusicalTime', () => {
      it('should subtract musical positions correctly', () => {
        expect(subtractMusicalTime('1:0:0', '1:0:0')).toBe('0:0:0');
        expect(subtractMusicalTime('2:0:0', '1:0:0')).toBe('1:0:0');
        expect(subtractMusicalTime('1:0:0', '0:2:0')).toBe('0:2:0');
        expect(subtractMusicalTime('0:0:0', '1:0:0')).toBe('0:0:0'); // No negative time
      });
    });

    describe('compareMusicalPositions', () => {
      it('should compare positions correctly', () => {
        expect(compareMusicalPositions('0:0:0', '1:0:0')).toBeLessThan(0);
        expect(compareMusicalPositions('1:0:0', '0:0:0')).toBeGreaterThan(0);
        expect(compareMusicalPositions('1:0:0', '1:0:0')).toBe(0);
        expect(compareMusicalPositions('1:2:3', '1:3:0')).toBeLessThan(0);
      });
    });
  });

  describe('position range checks', () => {
    it('should check if position is in range', () => {
      expect(isPositionInRange('1:0:0', '0:0:0', '2:0:0')).toBe(true);
      expect(isPositionInRange('0:0:0', '0:0:0', '2:0:0')).toBe(true);
      expect(isPositionInRange('2:0:0', '0:0:0', '2:0:0')).toBe(false);
      expect(isPositionInRange('3:0:0', '0:0:0', '2:0:0')).toBe(false);
    });
  });

  describe('region operations', () => {
    it('should calculate region end position', () => {
      const region: Region = {
        id: 'r1',
        trackId: 't1',
        name: 'Test',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 3,
        muted: false
      };

      expect(getRegionEndPosition(region)).toBe('3:0:0');
    });

    it('should handle infinite loop regions', () => {
      const region: Region = {
        id: 'r1',
        trackId: 't1',
        name: 'Test',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 0,
        muted: false
      };

      expect(getRegionEndPosition(region)).toBe('9999:0:0');
    });

    it('should detect overlapping regions', () => {
      const region1: Region = {
        id: 'r1',
        trackId: 't1',
        name: 'Test 1',
        startPosition: '0:0:0',
        duration: '2:0:0',
        loopCount: 1,
        muted: false
      };

      const region2: Region = {
        id: 'r2',
        trackId: 't1',
        name: 'Test 2',
        startPosition: '1:0:0',
        duration: '2:0:0',
        loopCount: 1,
        muted: false
      };

      const region3: Region = {
        id: 'r3',
        trackId: 't1',
        name: 'Test 3',
        startPosition: '4:0:0',
        duration: '1:0:0',
        loopCount: 1,
        muted: false
      };

      expect(doRegionsOverlap(region1, region2)).toBe(true);
      expect(doRegionsOverlap(region1, region3)).toBe(false);
    });
  });

  describe('time conversion', () => {
    it('should convert seconds to musical position', () => {
      // At 120 BPM, 1 beat = 0.5 seconds
      expect(secondsToMusicalPosition(0, 120)).toBe('0:0:0');
      expect(secondsToMusicalPosition(2, 120)).toBe('1:0:0'); // 4 beats = 1 bar
      expect(secondsToMusicalPosition(1, 120)).toBe('0:2:0'); // 2 beats
      expect(secondsToMusicalPosition(0.125, 120)).toBe('0:0:1'); // 1 sixteenth
    });

    it('should convert musical position to seconds', () => {
      expect(musicalPositionToSeconds('0:0:0', 120)).toBe(0);
      expect(musicalPositionToSeconds('1:0:0', 120)).toBe(2); // 4 beats at 120 BPM
      expect(musicalPositionToSeconds('0:1:0', 120)).toBe(0.5); // 1 beat
      expect(musicalPositionToSeconds('0:0:1', 120)).toBe(0.125); // 1 sixteenth
    });
  });

  describe('quantization', () => {
    it('should quantize position to grid', () => {
      const settings: QuantizationSettings = {
        enabled: true,
        gridSize: '1/4',
        strength: 1.0,
        swing: 0
      };

      expect(quantizePosition('0:0:2', settings)).toBe('0:1:0');
      expect(quantizePosition('0:1:1', settings)).toBe('0:1:0');
      expect(quantizePosition('0:1:3', settings)).toBe('0:2:0');
    });

    it('should apply partial quantization strength', () => {
      const settings: QuantizationSettings = {
        enabled: true,
        gridSize: '1/4',
        strength: 0.5,
        swing: 0
      };

      // With 50% strength, position should move halfway to grid
      const result = quantizePosition('0:0:3', settings);
      // Should be between '0:0:3' and '0:1:0'
      // Halfway from 3 to 4 sixteenths is 3.5, rounded to 4
      expect(result).toBe('0:1:0'); // Rounded to nearest sixteenth
    });

    it('should not quantize when disabled', () => {
      const settings: QuantizationSettings = {
        enabled: false,
        gridSize: '1/4',
        strength: 1.0,
        swing: 0
      };

      expect(quantizePosition('0:0:3', settings)).toBe('0:0:3');
    });
  });

  describe('region collections', () => {
    const regions: Region[] = [
      {
        id: 'r1',
        trackId: 't1',
        name: 'Region 1',
        startPosition: '2:0:0',
        duration: '1:0:0',
        loopCount: 1,
        muted: false
      },
      {
        id: 'r2',
        trackId: 't1',
        name: 'Region 2',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 1,
        muted: false
      },
      {
        id: 'r3',
        trackId: 't1',
        name: 'Region 3',
        startPosition: '4:0:0',
        duration: '2:0:0',
        loopCount: 1,
        muted: false
      }
    ];

    it('should sort regions by position', () => {
      const sorted = sortRegionsByPosition(regions);
      expect(sorted[0].id).toBe('r2');
      expect(sorted[1].id).toBe('r1');
      expect(sorted[2].id).toBe('r3');
    });

    it('should find regions in range', () => {
      const inRange = findRegionsInRange(regions, '1:0:0', '3:0:0');
      expect(inRange).toHaveLength(2);
      expect(inRange.map(r => r.id)).toContain('r1');
      expect(inRange.map(r => r.id)).toContain('r2');
    });
  });
});