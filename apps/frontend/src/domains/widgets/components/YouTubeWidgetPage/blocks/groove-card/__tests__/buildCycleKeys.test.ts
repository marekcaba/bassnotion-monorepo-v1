/**
 * Unit tests for buildCycleKeys — the ping-pong vs travel key sequence.
 *
 * Travel mode walks the chromatic ladder: start at home, add the interval each
 * step, WRAPPING the offset into the ±max range (+6 = tritone, then −5, −4 …),
 * until it laps back to home after a full octave. Because +6 and −6 are the
 * same pitch class, the wrap keeps pitch continuous in the interval's direction.
 */
import { describe, expect, it } from 'vitest';
import { buildCycleKeys } from '../useDynamicLoop.js';

const MAX = 6;

describe('buildCycleKeys — ping-pong', () => {
  it('is just [home, home+interval]', () => {
    expect(
      buildCycleKeys(
        { intervalSemitones: 3, everyN: 1, mode: 'ping-pong' },
        0,
        MAX,
      ),
    ).toEqual([0, 3]);
  });

  it('applies the interval relative to a non-zero home, clamped', () => {
    // home +4, interval +5 → 4+5 = 9 → clamped to +6.
    expect(
      buildCycleKeys(
        { intervalSemitones: 5, everyN: 1, mode: 'ping-pong' },
        4,
        MAX,
      ),
    ).toEqual([4, 6]);
  });

  it('defaults to ping-pong when mode is omitted', () => {
    expect(buildCycleKeys({ intervalSemitones: 2, everyN: 1 }, 0, MAX)).toEqual(
      [0, 2],
    );
  });
});

describe('buildCycleKeys — travel', () => {
  it('m3 up from home 0: E→G→B♭→D♭→(home) = [0,3,6,-3]', () => {
    // 0 → 3 → 6 → (9 wraps to −3) → (−3+3 = 0 = home, stop).
    expect(
      buildCycleKeys(
        { intervalSemitones: 3, everyN: 1, mode: 'travel' },
        0,
        MAX,
      ),
    ).toEqual([0, 3, 6, -3]);
  });

  it('M3 up (interval 4): 3 distinct keys [0,4,-4] (gcd(12,4)=4 → 3 keys)', () => {
    // 0 → 4 → (8 wraps to −4) → (−4+4 = 0 = home, stop).
    expect(
      buildCycleKeys(
        { intervalSemitones: 4, everyN: 1, mode: 'travel' },
        0,
        MAX,
      ),
    ).toEqual([0, 4, -4]);
  });

  it('tritone (interval 6): 2 keys [0,6] then laps home', () => {
    // 0 → 6 → (12 wraps to 0 = home, stop).
    expect(
      buildCycleKeys(
        { intervalSemitones: 6, everyN: 1, mode: 'travel' },
        0,
        MAX,
      ),
    ).toEqual([0, 6]);
  });

  it('m2 up (interval 1): all 12 keys before lapping home', () => {
    const keys = buildCycleKeys(
      { intervalSemitones: 1, everyN: 1, mode: 'travel' },
      0,
      MAX,
    );
    // 0,1,2,3,4,5,6, then 7→−5, 8→−4, 9→−3, 10→−2, 11→−1, 12→home(stop).
    expect(keys).toEqual([0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]);
    expect(keys).toHaveLength(12);
  });

  it('travels DOWN when the interval is negative (m3 down)', () => {
    // 0 → −3 → −6 → (−9 wraps to +3) → (+3−3 = 0 home, stop).
    expect(
      buildCycleKeys(
        { intervalSemitones: -3, everyN: 1, mode: 'travel' },
        0,
        MAX,
      ),
    ).toEqual([0, -3, -6, 3]);
  });

  it('starts the ladder from a non-zero home key', () => {
    // home +2, interval +3: 2 → 5 → (8 wraps −4) → (−1) → (2 = home, stop).
    // 2,5,8→−4, −4+3=−1, −1+3=2=home.
    expect(
      buildCycleKeys(
        { intervalSemitones: 3, everyN: 1, mode: 'travel' },
        2,
        MAX,
      ),
    ).toEqual([2, 5, -4, -1]);
  });

  it('interval 0 collapses to a single home key (no movement)', () => {
    expect(
      buildCycleKeys(
        { intervalSemitones: 0, everyN: 1, mode: 'travel' },
        0,
        MAX,
      ),
    ).toEqual([0]);
  });

  it('every travel key is within the ±max range', () => {
    for (let interval = -6; interval <= 6; interval++) {
      const keys = buildCycleKeys(
        { intervalSemitones: interval, everyN: 1, mode: 'travel' },
        0,
        MAX,
      );
      for (const k of keys) {
        expect(k).toBeGreaterThanOrEqual(-MAX);
        expect(k).toBeLessThanOrEqual(MAX);
      }
    }
  });
});
