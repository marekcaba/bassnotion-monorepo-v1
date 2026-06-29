import { describe, it, expect } from 'vitest';
import { gradeTiming } from './timingGrade';

describe('gradeTiming — human-scaled timing interpretation', () => {
  it('grades a real-take 30ms jitter as a SOLID POCKET, not "erratic"', () => {
    // The exact case BeatTimingAnalyzer mislabels: 30.6ms on a real bass take.
    const g = gradeTiming(30.6, -0.5);
    expect(g.tier).toBe('solid');
    expect(g.label).toBe('Solid pocket');
    expect(g.score).toBeGreaterThan(50); // not a failing number
  });

  it('grades studio-tight (≤12ms) as locked in', () => {
    expect(gradeTiming(8, 0).tier).toBe('locked');
    expect(gradeTiming(8, 0).score).toBeGreaterThan(85);
  });

  it('grades clearly-in-time (≤25ms) as tight', () => {
    expect(gradeTiming(20, 0).tier).toBe('tight');
  });

  it('grades loose (≤60ms) and rough (>60ms)', () => {
    expect(gradeTiming(50, 0).tier).toBe('loose');
    expect(gradeTiming(90, 0).tier).toBe('rough');
    expect(gradeTiming(90, 0).score).toBeLessThan(20);
  });

  it('score decreases monotonically with jitter', () => {
    const a = gradeTiming(10, 0).score;
    const b = gradeTiming(30, 0).score;
    const c = gradeTiming(60, 0).score;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('reads the offset lean: +late = dragging, -early = rushing, small = centered', () => {
    expect(gradeTiming(20, 30).feel).toBe('dragging');
    expect(gradeTiming(20, -30).feel).toBe('rushing');
    expect(gradeTiming(20, -0.5).feel).toBe('centered');
    expect(gradeTiming(20, 5).feel).toBe('centered'); // within the dead-band
  });

  it('clamps score to [0,100]', () => {
    expect(gradeTiming(0, 0).score).toBe(100);
    expect(gradeTiming(500, 0).score).toBe(0);
  });
});
