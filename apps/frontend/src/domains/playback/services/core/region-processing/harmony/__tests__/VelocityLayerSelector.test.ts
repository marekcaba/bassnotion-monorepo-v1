/**
 * VelocityLayerSelector Tests
 *
 * Tests velocity layer mapping for different harmony instruments
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VelocityLayerSelector } from '../VelocityLayerSelector.js';

describe('VelocityLayerSelector', () => {
  let selector: VelocityLayerSelector;

  beforeEach(() => {
    selector = new VelocityLayerSelector('test-instance');
  });

  // ============================================================================
  // GRAND PIANO VELOCITY LAYER TESTS (7 layers)
  // ============================================================================

  describe('Grand Piano velocity layers', () => {
    beforeEach(() => {
      selector.setInstrument('grandpiano');
    });

    it('should map velocity 10 to v1 (lowest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 10)).toBe('v1');
    });

    it('should map velocity 18 to v1 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 18)).toBe('v1');
    });

    it('should map velocity 19 to v2', () => {
      expect(selector.getLayerForNoteVelocity('C4', 19)).toBe('v2');
    });

    it('should map velocity 36 to v2 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 36)).toBe('v2');
    });

    it('should map velocity 54 to v3 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 54)).toBe('v3');
    });

    it('should map velocity 72 to v4 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 72)).toBe('v4');
    });

    it('should map velocity 90 to v5 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 90)).toBe('v5');
    });

    it('should map velocity 108 to v6 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 108)).toBe('v6');
    });

    it('should map velocity 127 to v7 (highest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v7');
    });
  });

  // ============================================================================
  // WURLITZER VELOCITY LAYER TESTS (5 layers)
  // ============================================================================

  describe('Wurlitzer velocity layers', () => {
    beforeEach(() => {
      selector.setInstrument('wurlitzer');
    });

    it('should map velocity 10 to v1 (lowest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 10)).toBe('v1');
    });

    it('should map velocity 25 to v1 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 25)).toBe('v1');
    });

    it('should map velocity 26 to v2', () => {
      expect(selector.getLayerForNoteVelocity('C4', 26)).toBe('v2');
    });

    it('should map velocity 51 to v2 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 51)).toBe('v2');
    });

    it('should map velocity 76 to v3 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 76)).toBe('v3');
    });

    it('should map velocity 102 to v4 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 102)).toBe('v4');
    });

    it('should map velocity 127 to v5 (highest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v5');
    });
  });

  // ============================================================================
  // RHODES VELOCITY LAYER TESTS (4 layers)
  // ============================================================================

  describe('Rhodes velocity layers', () => {
    beforeEach(() => {
      selector.setInstrument('rhodes');
    });

    it('should map velocity 10 to v1 (lowest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 10)).toBe('v1');
    });

    it('should map velocity 31 to v1 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 31)).toBe('v1');
    });

    it('should map velocity 63 to v2 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 63)).toBe('v2');
    });

    it('should map velocity 95 to v3 (boundary)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 95)).toBe('v3');
    });

    it('should map velocity 127 to v4 (highest)', () => {
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v4');
    });
  });

  // ============================================================================
  // PER-NOTE VELOCITY RANGE TESTS
  // ============================================================================

  describe('Per-note velocity ranges', () => {
    it('should use per-note ranges when available', () => {
      selector.setVelocityRanges({
        'C4': [
          { min: 1, max: 50, layer: 'v1' },
          { min: 51, max: 100, layer: 'v2' },
          { min: 101, max: 127, layer: 'v3' },
        ],
      });

      expect(selector.getLayerForNoteVelocity('C4', 25)).toBe('v1');
      expect(selector.getLayerForNoteVelocity('C4', 75)).toBe('v2');
      expect(selector.getLayerForNoteVelocity('C4', 120)).toBe('v3');
    });

    it('should fallback to instrument ranges when note not in config', () => {
      selector.setInstrument('wurlitzer');
      selector.setVelocityRanges({
        'C4': [{ min: 1, max: 127, layer: 'v1' }],
      });

      // C4 has custom range, D4 does not
      expect(selector.getLayerForNoteVelocity('C4', 80)).toBe('v1');
      expect(selector.getLayerForNoteVelocity('D4', 80)).toBe('v4'); // Wurlitzer v4 (77-102)
    });

    it('should handle sharp notation conversion (Cs vs C#)', () => {
      selector.setVelocityRanges({
        'C#4': [{ min: 1, max: 127, layer: 'v1' }],
      });

      // Try with 's' notation, should convert to '#'
      expect(selector.getLayerForNoteVelocity('Cs4', 80)).toBe('v1');
    });

    it('should use highest layer when velocity exceeds range', () => {
      selector.setVelocityRanges({
        'C4': [
          { min: 1, max: 50, layer: 'v1' },
          { min: 51, max: 100, layer: 'v2' },
        ],
      });

      // Velocity 127 exceeds max of 100, should use v2 (last layer)
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v2');
    });
  });

  // ============================================================================
  // SPARSE SAMPLING DETECTION TESTS
  // ============================================================================

  describe('Sparse sampling detection', () => {
    it('should detect sparse sampling (Grand Piano)', () => {
      // Grand Piano: A, C, D#, F# notes only (sparse)
      const sparseBuffers = new Map([
        [
          'v3',
          new Map([
            ['A3', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Ds4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Fs4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
          ]),
        ],
      ]);

      selector.setHarmonyBuffers(sparseBuffers);
      expect(selector.detectSparseSampling()).toBe(true);
    });

    it('should detect full chromatic (Wurlitzer)', () => {
      // Wurlitzer: All 12 chromatic notes in octave 4
      const chromaticBuffers = new Map([
        [
          'v3',
          new Map([
            ['C4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Cs4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['D4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Ds4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['E4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['F4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Fs4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['G4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['Gs4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['A4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['As4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
            ['B4', new AudioBuffer({ length: 1, sampleRate: 48000 })],
          ]),
        ],
      ]);

      selector.setHarmonyBuffers(chromaticBuffers);
      expect(selector.detectSparseSampling()).toBe(false);
    });

    it('should handle empty buffer map', () => {
      selector.setHarmonyBuffers(new Map());
      expect(selector.detectSparseSampling()).toBe(false);
    });

    it('should handle null harmony buffers', () => {
      expect(selector.detectSparseSampling()).toBe(false);
    });
  });

  // ============================================================================
  // DEFAULT INSTRUMENT TESTS
  // ============================================================================

  describe('Default instrument behavior', () => {
    it('should default to Wurlitzer ranges when instrument not set', () => {
      // Don't set instrument
      expect(selector.getLayerForNoteVelocity('C4', 10)).toBe('v1');
      expect(selector.getLayerForNoteVelocity('C4', 50)).toBe('v2');
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v5');
    });

    it('should default to Wurlitzer for unknown instruments', () => {
      selector.setInstrument('unknown-piano');
      expect(selector.getLayerForNoteVelocity('C4', 10)).toBe('v1');
      expect(selector.getLayerForNoteVelocity('C4', 50)).toBe('v2');
      expect(selector.getLayerForNoteVelocity('C4', 127)).toBe('v5');
    });
  });
});
