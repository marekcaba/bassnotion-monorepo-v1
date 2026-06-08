/**
 * Unit tests for the Dynamic Loop interval-naming matrix.
 */
import { describe, expect, it } from 'vitest';
import { formatIntervalLabel, formatIntervalAria } from '../intervals.js';

describe('formatIntervalLabel', () => {
  it('names each ascending magnitude', () => {
    expect(formatIntervalLabel(0)).toBe('unison');
    expect(formatIntervalLabel(1)).toBe('up m2');
    expect(formatIntervalLabel(2)).toBe('up M2');
    expect(formatIntervalLabel(3)).toBe('up m3');
    expect(formatIntervalLabel(4)).toBe('up M3');
    expect(formatIntervalLabel(5)).toBe('up P4');
    expect(formatIntervalLabel(6)).toBe('up TT');
  });

  it('names descending magnitudes with the same quality, direction down', () => {
    expect(formatIntervalLabel(-1)).toBe('down m2');
    expect(formatIntervalLabel(-3)).toBe('down m3');
    expect(formatIntervalLabel(-5)).toBe('down P4');
    expect(formatIntervalLabel(-6)).toBe('down TT');
  });

  it('rounds fractional input', () => {
    expect(formatIntervalLabel(2.4)).toBe('up M2');
    expect(formatIntervalLabel(-3.7)).toBe('down M3');
  });
});

describe('formatIntervalAria', () => {
  it('spells the full interval name with direction', () => {
    expect(formatIntervalAria(0)).toBe('no change');
    expect(formatIntervalAria(3)).toBe('up a minor 3rd');
    expect(formatIntervalAria(-5)).toBe('down a perfect 4th');
    expect(formatIntervalAria(6)).toBe('up a tritone');
  });
});
