/**
 * VelocityLayerSelector Tests
 *
 * Comprehensive test coverage for velocity layer selection logic
 * Tests both per-note ranges (config-driven) and instrument fallback ranges
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VelocityLayerSelector,
  type PerNoteVelocityRanges,
} from '../VelocityLayerSelector.js';

describe('VelocityLayerSelector', () => {
  // ============================================================================
  // GRAND PIANO - 7 Layers (v1-v7)
  // ============================================================================
  describe('Grand Piano (7 layers)', () => {
    let selector: VelocityLayerSelector;

    beforeEach(() => {
      selector = new VelocityLayerSelector('grandpiano');
    });

    it('should select v1 for very quiet notes (0-18)', () => {
      expect(selector.selectLayer(0, 'C4')).toBe('v1');
      expect(selector.selectLayer(10, 'C4')).toBe('v1');
      expect(selector.selectLayer(18, 'C4')).toBe('v1');
    });

    it('should select v2 for quiet notes (19-36)', () => {
      expect(selector.selectLayer(19, 'C4')).toBe('v2');
      expect(selector.selectLayer(27, 'C4')).toBe('v2');
      expect(selector.selectLayer(36, 'C4')).toBe('v2');
    });

    it('should select v3 for medium-soft notes (37-54)', () => {
      expect(selector.selectLayer(37, 'C4')).toBe('v3');
      expect(selector.selectLayer(45, 'C4')).toBe('v3');
      expect(selector.selectLayer(54, 'C4')).toBe('v3');
    });

    it('should select v4 for medium notes (55-72)', () => {
      expect(selector.selectLayer(55, 'C4')).toBe('v4');
      expect(selector.selectLayer(63, 'C4')).toBe('v4');
      expect(selector.selectLayer(72, 'C4')).toBe('v4');
    });

    it('should select v5 for medium-loud notes (73-90)', () => {
      expect(selector.selectLayer(73, 'C4')).toBe('v5');
      expect(selector.selectLayer(81, 'C4')).toBe('v5');
      expect(selector.selectLayer(90, 'C4')).toBe('v5');
    });

    it('should select v6 for loud notes (91-108)', () => {
      expect(selector.selectLayer(91, 'C4')).toBe('v6');
      expect(selector.selectLayer(99, 'C4')).toBe('v6');
      expect(selector.selectLayer(108, 'C4')).toBe('v6');
    });

    it('should select v7 for very loud notes (109-127)', () => {
      expect(selector.selectLayer(109, 'C4')).toBe('v7');
      expect(selector.selectLayer(118, 'C4')).toBe('v7');
      expect(selector.selectLayer(127, 'C4')).toBe('v7');
    });
  });

  // ============================================================================
  // WURLITZER - 5 Layers (v1-v5)
  // ============================================================================
  describe('Wurlitzer (5 layers)', () => {
    let selector: VelocityLayerSelector;

    beforeEach(() => {
      selector = new VelocityLayerSelector('wurlitzer');
    });

    it('should select v1 for very quiet notes (0-25)', () => {
      expect(selector.selectLayer(0, 'C4')).toBe('v1');
      expect(selector.selectLayer(12, 'C4')).toBe('v1');
      expect(selector.selectLayer(25, 'C4')).toBe('v1');
    });

    it('should select v2 for quiet notes (26-51)', () => {
      expect(selector.selectLayer(26, 'C4')).toBe('v2');
      expect(selector.selectLayer(38, 'C4')).toBe('v2');
      expect(selector.selectLayer(51, 'C4')).toBe('v2');
    });

    it('should select v3 for medium notes (52-76)', () => {
      expect(selector.selectLayer(52, 'C4')).toBe('v3');
      expect(selector.selectLayer(64, 'C4')).toBe('v3');
      expect(selector.selectLayer(76, 'C4')).toBe('v3');
    });

    it('should select v4 for loud notes (77-102)', () => {
      expect(selector.selectLayer(77, 'C4')).toBe('v4');
      expect(selector.selectLayer(89, 'C4')).toBe('v4');
      expect(selector.selectLayer(102, 'C4')).toBe('v4');
    });

    it('should select v5 for very loud notes (103-127)', () => {
      expect(selector.selectLayer(103, 'C4')).toBe('v5');
      expect(selector.selectLayer(115, 'C4')).toBe('v5');
      expect(selector.selectLayer(127, 'C4')).toBe('v5');
    });
  });

  // ============================================================================
  // RHODES - 4 Layers (v1-v4)
  // ============================================================================
  describe('Rhodes (4 layers)', () => {
    let selector: VelocityLayerSelector;

    beforeEach(() => {
      selector = new VelocityLayerSelector('rhodes');
    });

    it('should select v1 for quiet notes (0-31)', () => {
      expect(selector.selectLayer(0, 'C4')).toBe('v1');
      expect(selector.selectLayer(15, 'C4')).toBe('v1');
      expect(selector.selectLayer(31, 'C4')).toBe('v1');
    });

    it('should select v2 for medium-soft notes (32-63)', () => {
      expect(selector.selectLayer(32, 'C4')).toBe('v2');
      expect(selector.selectLayer(47, 'C4')).toBe('v2');
      expect(selector.selectLayer(63, 'C4')).toBe('v2');
    });

    it('should select v3 for medium-loud notes (64-95)', () => {
      expect(selector.selectLayer(64, 'C4')).toBe('v3');
      expect(selector.selectLayer(79, 'C4')).toBe('v3');
      expect(selector.selectLayer(95, 'C4')).toBe('v3');
    });

    it('should select v4 for loud notes (96-127)', () => {
      expect(selector.selectLayer(96, 'C4')).toBe('v4');
      expect(selector.selectLayer(111, 'C4')).toBe('v4');
      expect(selector.selectLayer(127, 'C4')).toBe('v4');
    });
  });

  // ============================================================================
  // NICE KEYS RHODES - Same as Rhodes (4 layers)
  // ============================================================================
  describe('Nice Keys Rhodes (4 layers)', () => {
    let selector: VelocityLayerSelector;

    beforeEach(() => {
      selector = new VelocityLayerSelector('nicekeysrhodes');
    });

    it('should use same ranges as regular Rhodes', () => {
      expect(selector.selectLayer(15, 'C4')).toBe('v1');
      expect(selector.selectLayer(47, 'C4')).toBe('v2');
      expect(selector.selectLayer(79, 'C4')).toBe('v3');
      expect(selector.selectLayer(111, 'C4')).toBe('v4');
    });
  });

  // ============================================================================
  // PER-NOTE VELOCITY RANGES (Config-Driven)
  // ============================================================================
  describe('Per-Note Velocity Ranges', () => {
    it('should use per-note ranges when available', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [
          { min: 0, max: 40, layer: 'v1' },
          { min: 41, max: 80, layer: 'v2' },
          { min: 81, max: 127, layer: 'v3' },
        ],
        D4: [
          { min: 0, max: 50, layer: 'v1' },
          { min: 51, max: 100, layer: 'v2' },
          { min: 101, max: 127, layer: 'v3' },
        ],
      };

      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // C4 has different ranges than D4
      expect(selector.selectLayer(40, 'C4')).toBe('v1');
      expect(selector.selectLayer(41, 'C4')).toBe('v2');
      expect(selector.selectLayer(50, 'D4')).toBe('v1');
      expect(selector.selectLayer(51, 'D4')).toBe('v2');
    });

    it('should handle sharp notation (Cs4)', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        Cs4: [
          { min: 0, max: 63, layer: 'v1' },
          { min: 64, max: 127, layer: 'v2' },
        ],
      };

      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);
      expect(selector.selectLayer(50, 'Cs4')).toBe('v1');
      expect(selector.selectLayer(100, 'Cs4')).toBe('v2');
    });

    it('should convert between sharp notations (Cs4 <-> C#4)', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        'C#4': [
          { min: 0, max: 63, layer: 'v1' },
          { min: 64, max: 127, layer: 'v2' },
        ],
      };

      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // Query with 's' notation should find '#' notation in config
      expect(selector.selectLayer(50, 'Cs4')).toBe('v1');
      expect(selector.selectLayer(100, 'Cs4')).toBe('v2');

      // Query with '#' notation should work directly
      expect(selector.selectLayer(50, 'C#4')).toBe('v1');
      expect(selector.selectLayer(100, 'C#4')).toBe('v2');
    });

    it('should fall back to instrument ranges when note not in config', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [
          { min: 0, max: 63, layer: 'v1' },
          { min: 64, max: 127, layer: 'v2' },
        ],
      };

      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // D4 not in config, should use Wurlitzer fallback ranges
      expect(selector.selectLayer(25, 'D4')).toBe('v1'); // Wurlitzer v1: 0-25
      expect(selector.selectLayer(51, 'D4')).toBe('v2'); // Wurlitzer v2: 26-51
    });

    it('should use highest layer when velocity exceeds ranges', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [
          { min: 0, max: 50, layer: 'v1' },
          { min: 51, max: 100, layer: 'v2' },
        ],
      };

      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // Velocity 127 exceeds max range (100), should use v2 (highest)
      expect(selector.selectLayer(127, 'C4')).toBe('v2');
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('should clamp velocity below 0', () => {
      const selector = new VelocityLayerSelector('wurlitzer');
      expect(selector.selectLayer(-10, 'C4')).toBe('v1'); // Clamped to 0
    });

    it('should clamp velocity above 127', () => {
      const selector = new VelocityLayerSelector('wurlitzer');
      expect(selector.selectLayer(200, 'C4')).toBe('v5'); // Clamped to 127
    });

    it('should handle empty per-note ranges gracefully', () => {
      const perNoteRanges: PerNoteVelocityRanges = {};
      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // Should fall back to Wurlitzer ranges
      expect(selector.selectLayer(25, 'C4')).toBe('v1');
      expect(selector.selectLayer(51, 'C4')).toBe('v2');
    });

    it('should handle note with empty range array', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [], // Empty ranges array
      };
      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      // Should fall back to Wurlitzer ranges
      expect(selector.selectLayer(25, 'C4')).toBe('v1');
      expect(selector.selectLayer(51, 'C4')).toBe('v2');
    });
  });

  // ============================================================================
  // DYNAMIC UPDATES
  // ============================================================================
  describe('Dynamic Updates', () => {
    it('should update instrument and use new ranges', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      expect(selector.selectLayer(50, 'C4')).toBe('v2'); // Wurlitzer v2: 26-51

      selector.setInstrument('grandpiano');
      expect(selector.selectLayer(50, 'C4')).toBe('v3'); // Grand Piano v3: 37-54
    });

    it('should update per-note ranges and use them', () => {
      const selector = new VelocityLayerSelector('wurlitzer');

      // Initially uses Wurlitzer fallback
      expect(selector.selectLayer(50, 'C4')).toBe('v2');

      // Load per-note ranges
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [
          { min: 0, max: 63, layer: 'v1' },
          { min: 64, max: 127, layer: 'v2' },
        ],
      };
      selector.setPerNoteRanges(perNoteRanges);

      // Now uses per-note ranges
      expect(selector.selectLayer(50, 'C4')).toBe('v1');
    });

    it('should clear per-note ranges when set to undefined', () => {
      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [
          { min: 0, max: 63, layer: 'v1' },
          { min: 64, max: 127, layer: 'v2' },
        ],
      };
      const selector = new VelocityLayerSelector('wurlitzer', perNoteRanges);

      expect(selector.selectLayer(50, 'C4')).toBe('v1'); // Per-note range

      selector.setPerNoteRanges(undefined);
      expect(selector.selectLayer(50, 'C4')).toBe('v2'); // Wurlitzer fallback
    });
  });

  // ============================================================================
  // GETTERS
  // ============================================================================
  describe('Getters', () => {
    it('should return current instrument', () => {
      const selector = new VelocityLayerSelector('grandpiano');
      expect(selector.getInstrument()).toBe('grandpiano');

      selector.setInstrument('rhodes');
      expect(selector.getInstrument()).toBe('rhodes');
    });

    it('should report if per-note ranges are available', () => {
      const selector = new VelocityLayerSelector('wurlitzer');
      expect(selector.hasPerNoteRanges()).toBe(false);

      const perNoteRanges: PerNoteVelocityRanges = {
        C4: [{ min: 0, max: 127, layer: 'v1' }],
      };
      selector.setPerNoteRanges(perNoteRanges);
      expect(selector.hasPerNoteRanges()).toBe(true);

      selector.setPerNoteRanges(undefined);
      expect(selector.hasPerNoteRanges()).toBe(false);
    });

    it('should report false for empty per-note ranges object', () => {
      const selector = new VelocityLayerSelector('wurlitzer', {});
      expect(selector.hasPerNoteRanges()).toBe(false);
    });
  });
});
