/**
 * useFretboardSizeTier — tests for the pure width→tier mapping. The ResizeObserver wiring is a
 * thin DOM shell tested by eye in the browser; the mapping (the logic that matters) is pure.
 */
import { describe, it, expect } from 'vitest';
import { tierForWidth } from './useFretboardSizeTier';

describe('tierForWidth — existing Tailwind 640/1024/1536 thresholds', () => {
  it('below 640 is mobile', () => {
    expect(tierForWidth(0)).toBe('mobile');
    expect(tierForWidth(320)).toBe('mobile');
    expect(tierForWidth(639)).toBe('mobile');
  });

  it('640–1023 is tablet (the baseline / scaleFactor 1.0)', () => {
    expect(tierForWidth(640)).toBe('tablet');
    expect(tierForWidth(800)).toBe('tablet');
    expect(tierForWidth(1023)).toBe('tablet');
  });

  it('1024–1535 is desktop', () => {
    expect(tierForWidth(1024)).toBe('desktop');
    expect(tierForWidth(1280)).toBe('desktop');
    expect(tierForWidth(1535)).toBe('desktop');
  });

  it('1536 and up is large', () => {
    expect(tierForWidth(1536)).toBe('large');
    expect(tierForWidth(1920)).toBe('large');
    expect(tierForWidth(3000)).toBe('large');
  });

  it('thresholds are inclusive lower bounds (no off-by-one gaps)', () => {
    // Every boundary belongs to the HIGHER tier.
    expect(tierForWidth(640)).not.toBe('mobile');
    expect(tierForWidth(1024)).not.toBe('tablet');
    expect(tierForWidth(1536)).not.toBe('desktop');
  });
});
