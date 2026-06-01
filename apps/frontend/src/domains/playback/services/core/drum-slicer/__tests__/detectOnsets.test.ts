/**
 * Onset detector validation with synthetic drum-like buffers — impulses at
 * KNOWN positions (incl. off-grid/shuffled), confirming we detect the real
 * hits (not a grid).
 */
import { describe, it, expect } from 'vitest';
import { detectOnsets } from '../detectOnsets.js';

const SR = 48000;

/** A fake AudioBuffer over a Float32Array (only the methods detectOnsets uses). */
function makeBuffer(data: Float32Array, sampleRate = SR): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: data.length,
    sampleRate,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

/** Render percussive hits (fast-decaying noise bursts) at the given seconds. */
function renderHits(hitSeconds: number[], totalSeconds: number): Float32Array {
  const data = new Float32Array(Math.ceil(totalSeconds * SR));
  for (const t of hitSeconds) {
    const start = Math.floor(t * SR);
    const decay = Math.floor(0.04 * SR); // 40ms decay
    for (let i = 0; i < decay && start + i < data.length; i++) {
      const env = Math.exp(-i / (0.008 * SR)); // sharp attack, fast decay
      // Broadband noise burst = a drum-ish transient (rich spectral flux).
      data[start + i] += (Math.sin(i * 0.7) + (i % 7) / 7 - 0.5) * env;
    }
  }
  return data;
}

/** Assert each expected onset has a detected onset within tolerance (s). */
function eachExpectedFound(
  detected: number[],
  expected: number[],
  tol = 0.02,
): void {
  for (const e of expected) {
    const hit = detected.some((d) => Math.abs(d - e) <= tol);
    expect(
      hit,
      `expected an onset near ${e}s; got [${detected
        .map((x) => x.toFixed(3))
        .join(', ')}]`,
    ).toBe(true);
  }
}

describe('detectOnsets', () => {
  it('detects four-on-the-floor kicks at exact beat positions', () => {
    // 120 BPM → beat = 0.5s. Kicks at 0, 0.5, 1.0, 1.5.
    const expected = [0, 0.5, 1.0, 1.5];
    const onsets = detectOnsets(makeBuffer(renderHits(expected, 2.0)));
    eachExpectedFound(onsets, expected);
  });

  it('detects SHUFFLED hits where they actually are (not on a grid)', () => {
    // Straight beats would be 0, 0.5, 1.0, 1.5. This pattern PUSHES beat 2
    // early (0.46) and PULLS the off-beat late (0.78) — real groove.
    const expected = [0, 0.46, 0.78, 1.0, 1.5];
    const onsets = detectOnsets(makeBuffer(renderHits(expected, 2.0)));
    eachExpectedFound(onsets, expected);
    // And it must NOT have invented a hit at the straight-grid 0.5 if nothing's
    // there (the real hit was at 0.46): no detected onset in (0.49, 0.55).
    const ghost = onsets.some((d) => d > 0.49 && d < 0.55);
    expect(ghost).toBe(false);
  });

  it('always includes 0 as the loop origin', () => {
    const onsets = detectOnsets(makeBuffer(renderHits([0.5, 1.0], 1.5)));
    expect(onsets[0]).toBe(0);
  });

  it('respects minOnsetGapSeconds (debounce) to merge close hits', () => {
    // Two hits 40ms apart. With a generous 120ms min gap they collapse to one
    // onset; this proves the debounce parameter governs minimum spacing.
    const onsets = detectOnsets(makeBuffer(renderHits([0.5, 0.54], 1.0)), {
      minOnsetGapSeconds: 0.12,
    });
    const near = onsets.filter((d) => d > 0.45 && d < 0.62);
    expect(near.length).toBe(1);
  });

  it('never emits two onsets closer than the min gap', () => {
    const minGap = 0.035;
    const onsets = detectOnsets(
      makeBuffer(renderHits([0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5], 2.0)),
      { minOnsetGapSeconds: minGap },
    );
    for (let i = 1; i < onsets.length; i++) {
      expect(onsets[i] - onsets[i - 1]).toBeGreaterThanOrEqual(minGap - 1e-6);
    }
  });

  it('returns [0] for a buffer shorter than one FFT frame', () => {
    const onsets = detectOnsets(makeBuffer(new Float32Array(100)));
    expect(onsets).toEqual([0]);
  });
});
