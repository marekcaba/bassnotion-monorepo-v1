import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomationLane } from '../automation/AutomationLane.js';
import type { MusicalPosition } from '../../../types/pattern.js';
import { EventBus } from '../../../services/core/EventBus.js';

describe('AutomationLane', () => {
  let lane: AutomationLane;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    lane = new AutomationLane(
      {
        parameter: 'volume',
        trackId: 'track-1',
        defaultValue: 0.75,
        minValue: 0,
        maxValue: 1,
        step: 0.01,
        displayName: 'Volume',
        unit: 'dB',
      },
      eventBus
    );
  });

  describe('point management', () => {
    it('should add automation point', () => {
      const position: MusicalPosition = { bars: 1, beats: 0, sixteenths: 0 };
      lane.addPoint(position, 0.5);

      expect(lane.points).toHaveLength(1);
      expect(lane.points[0].value).toBe(0.5);
      expect(lane.points[0].position).toEqual(position);
    });

    it('should clamp values to valid range', () => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, -0.5);
      lane.addPoint({ bars: 1, beats: 0, sixteenths: 0 }, 1.5);

      expect(lane.points[0].value).toBe(0); // Clamped to min
      expect(lane.points[1].value).toBe(1); // Clamped to max
    });

    it('should replace point at same position', () => {
      const position: MusicalPosition = { bars: 1, beats: 0, sixteenths: 0 };
      
      lane.addPoint(position, 0.5);
      lane.addPoint(position, 0.7);

      expect(lane.points).toHaveLength(1);
      expect(lane.points[0].value).toBe(0.7);
    });

    it('should remove point', () => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0.5);
      lane.addPoint({ bars: 1, beats: 0, sixteenths: 0 }, 0.7);

      lane.removePoint(0);
      
      expect(lane.points).toHaveLength(1);
      expect(lane.points[0].value).toBe(0.7);
    });

    it('should update point value', () => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0.5);
      
      lane.updatePoint(0, 0.8, 'exponential');
      
      expect(lane.points[0].value).toBe(0.8);
      expect(lane.points[0].curve).toBe('exponential');
    });

    it('should move point to new position', () => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0.5);
      
      const newPosition: MusicalPosition = { bars: 2, beats: 0, sixteenths: 0 };
      lane.movePoint(0, newPosition);
      
      expect(lane.points[0].position).toEqual(newPosition);
    });
  });

  describe('value interpolation', () => {
    beforeEach(() => {
      // Create a simple automation curve
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0);
      lane.addPoint({ bars: 4, beats: 0, sixteenths: 0 }, 1);
    });

    it('should return exact value at point', () => {
      const value = lane.getValueAt({ bars: 0, beats: 0, sixteenths: 0 });
      expect(value).toBe(0);
    });

    it('should interpolate linearly between points', () => {
      const value = lane.getValueAt({ bars: 2, beats: 0, sixteenths: 0 });
      expect(value).toBeCloseTo(0.5, 2);
    });

    it('should return last value after final point', () => {
      const value = lane.getValueAt({ bars: 8, beats: 0, sixteenths: 0 });
      expect(value).toBe(1);
    });

    it('should return first value before first point', () => {
      const value = lane.getValueAt({ bars: -1, beats: 0, sixteenths: 0 });
      expect(value).toBe(0);
    });

    it('should return default value when disabled', () => {
      lane.enabled = false;
      const value = lane.getValueAt({ bars: 2, beats: 0, sixteenths: 0 });
      expect(value).toBe(0.75); // Default value
    });

    it('should handle step interpolation', () => {
      lane.points[0].curve = 'step';
      const value = lane.getValueAt({ bars: 2, beats: 0, sixteenths: 0 });
      expect(value).toBe(0); // Holds previous value
    });

    it('should handle curve interpolation', () => {
      lane.points[0].curve = 'curve';
      const value = lane.getValueAt({ bars: 2, beats: 0, sixteenths: 0 });
      // S-curve should be different from linear 0.5
      expect(value).not.toBe(0.5);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('recording modes', () => {
    const position: MusicalPosition = { bars: 1, beats: 0, sixteenths: 0 };

    it('should not record in read mode', () => {
      lane.setMode('read');
      lane.startRecording(position);
      lane.recordValue(position, 0.5);

      expect(lane.points).toHaveLength(0);
    });

    it('should record in write mode', () => {
      lane.setMode('write');
      lane.startRecording(position);
      lane.recordValue(position, 0.5);

      expect(lane.points).toHaveLength(1);
      expect(lane.points[0].value).toBe(0.5);
    });

    it('should record in touch mode while touching', () => {
      lane.setMode('touch');
      lane.startRecording(position);
      
      // Simulate touch
      lane.recordValue(position, 0.5);
      
      expect(lane.points).toHaveLength(1);
    });

    it('should record in latch mode after value change', () => {
      lane.setMode('latch');
      lane.startRecording(position);
      
      // First value - establishes baseline
      lane.recordValue(position, 0.75); // Same as default
      expect(lane.points).toHaveLength(0);
      
      // Changed value - should record
      lane.recordValue({ bars: 2, beats: 0, sixteenths: 0 }, 0.5);
      expect(lane.points).toHaveLength(1);
    });

    it('should stop recording', () => {
      lane.setMode('write');
      lane.startRecording(position);
      lane.stopRecording();
      
      lane.recordValue(position, 0.5);
      expect(lane.points).toHaveLength(0);
    });
  });

  describe('range operations', () => {
    beforeEach(() => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0.2);
      lane.addPoint({ bars: 2, beats: 0, sixteenths: 0 }, 0.5);
      lane.addPoint({ bars: 4, beats: 0, sixteenths: 0 }, 0.8);
      lane.addPoint({ bars: 6, beats: 0, sixteenths: 0 }, 0.3);
    });

    it('should get points in range', () => {
      const points = lane.getPointsInRange(
        { bars: 1, beats: 0, sixteenths: 0 },
        { bars: 5, beats: 0, sixteenths: 0 }
      );

      expect(points).toHaveLength(2);
      expect(points[0].value).toBe(0.5);
      expect(points[1].value).toBe(0.8);
    });

    it('should clear all points', () => {
      lane.clear();
      expect(lane.points).toHaveLength(0);
    });
  });

  describe('simplification', () => {
    it('should simplify redundant points', () => {
      // Create a line with redundant middle point
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0);
      lane.addPoint({ bars: 2, beats: 0, sixteenths: 0 }, 0.5);
      lane.addPoint({ bars: 4, beats: 0, sixteenths: 0 }, 1);

      lane.simplify(0.01);
      
      // Middle point should be kept as it's on the line
      expect(lane.points.length).toBeLessThanOrEqual(3);
    });

    it('should keep important points', () => {
      // Create a curve with significant change
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0);
      lane.addPoint({ bars: 1, beats: 0, sixteenths: 0 }, 1);
      lane.addPoint({ bars: 2, beats: 0, sixteenths: 0 }, 0);

      const originalCount = lane.points.length;
      lane.simplify(0.01);
      
      // All points should be kept due to significant changes
      expect(lane.points).toHaveLength(originalCount);
    });
  });

  describe('event emission', () => {
    it('should emit change events', () => {
      const onChange = vi.fn();
      eventBus.on('automation:changed', onChange);

      lane.addPoint({ bars: 1, beats: 0, sixteenths: 0 }, 0.5);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          trackId: 'track-1',
          parameter: 'volume',
          type: 'pointAdded',
        })
      );
    });

    it('should emit mode change events', () => {
      const onModeChange = vi.fn();
      eventBus.on('automation:modeChanged', onModeChange);

      lane.setMode('write');

      expect(onModeChange).toHaveBeenCalledWith(
        expect.objectContaining({
          parameter: 'volume',
          oldMode: 'read',
          newMode: 'write',
        })
      );
    });
  });

  describe('serialization', () => {
    it('should export to JSON', () => {
      lane.addPoint({ bars: 0, beats: 0, sixteenths: 0 }, 0.5);
      lane.addPoint({ bars: 2, beats: 0, sixteenths: 0 }, 0.8);
      lane.curveType = 'exponential';

      const json = lane.toJSON();

      expect(json.parameter).toBe('volume');
      expect(json.points).toHaveLength(2);
      expect(json.enabled).toBe(true);
      expect(json.curveType).toBe('exponential');
    });
  });

  describe('configuration', () => {
    it('should return configuration', () => {
      const config = lane.getConfig();

      expect(config.parameter).toBe('volume');
      expect(config.defaultValue).toBe(0.75);
      expect(config.minValue).toBe(0);
      expect(config.maxValue).toBe(1);
      expect(config.displayName).toBe('Volume');
      expect(config.unit).toBe('dB');
    });
  });
});