import { describe, it, expect } from 'vitest';
import {
  cubicBezier,
  playheadGlide,
  playheadPulse,
  DEFAULT_PLAYHEAD_CONFIG,
  type PlayheadConfig,
} from './playheadConfig';

const cfg = (over: Partial<PlayheadConfig> = {}): PlayheadConfig => ({
  ...DEFAULT_PLAYHEAD_CONFIG,
  ...over,
});

describe('cubicBezier', () => {
  it('pins endpoints to 0 and 1', () => {
    expect(cubicBezier(0.4, 0, 0.2, 1, 0)).toBe(0);
    expect(cubicBezier(0.4, 0, 0.2, 1, 1)).toBe(1);
  });
  it('linear curve (0,0,1,1) ≈ identity', () => {
    expect(cubicBezier(0, 0, 1, 1, 0.5)).toBeCloseTo(0.5, 2);
    expect(cubicBezier(0, 0, 1, 1, 0.25)).toBeCloseTo(0.25, 2);
  });
  it('ease curve is monotonic 0→1', () => {
    let prev = -1;
    for (let x = 0; x <= 1.0001; x += 0.1) {
      const y = cubicBezier(0.42, 0, 0.58, 1, Math.min(x, 1));
      expect(y).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = y;
    }
  });
});

describe('playheadGlide — per anim type', () => {
  it('linear: t tracks progress 1:1', () => {
    expect(playheadGlide(0.5, cfg({ anim: 'linear' })).t).toBeCloseTo(0.5, 5);
  });
  it('snap: t stays 0 until the very end, then 1', () => {
    expect(playheadGlide(0.5, cfg({ anim: 'snap' })).t).toBe(0);
    expect(playheadGlide(1, cfg({ anim: 'snap' })).t).toBe(1);
  });
  it('glide_hold: t is 0 during the hold, then climbs', () => {
    const c = cfg({ anim: 'glide_hold', holdFrac: 0.7 });
    expect(playheadGlide(0.5, c).t).toBe(0); // still holding
    expect(playheadGlide(1, c).t).toBeCloseTo(1, 2); // arrived
  });
  it('arc_hop: hop peaks mid-travel (0→1→0)', () => {
    const c = cfg({ anim: 'arc_hop' });
    expect(playheadGlide(0, c).hop).toBeCloseTo(0, 5);
    expect(playheadGlide(0.5, c).hop).toBeCloseTo(1, 5);
    expect(playheadGlide(1, c).hop).toBeCloseTo(0, 5);
  });
  it('bezier: eased glide, endpoints pinned', () => {
    const c = cfg({ anim: 'bezier', bezier: [0.4, 0, 0.2, 1] });
    expect(playheadGlide(0, c).t).toBe(0);
    expect(playheadGlide(1, c).t).toBe(1);
  });
});

describe('playheadPulse', () => {
  it('is 1 when pulseAmount is 0', () => {
    expect(playheadPulse(0, cfg({ pulseAmount: 0 }))).toBe(1);
  });
  it('peaks on the downbeat, settles by 40%', () => {
    const c = cfg({ pulseAmount: 0.4 });
    expect(playheadPulse(0, c)).toBeCloseTo(1.4, 5);
    expect(playheadPulse(0.4, c)).toBeCloseTo(1, 5);
    expect(playheadPulse(0.8, c)).toBe(1);
  });
});
