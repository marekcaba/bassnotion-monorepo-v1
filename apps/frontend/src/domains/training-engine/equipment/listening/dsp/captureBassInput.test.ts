import { describe, it, expect } from 'vitest';
import { toMono } from './captureBassInput';

// captureBassInput is browser/mic-dependent (getUserMedia + MediaRecorder +
// AudioContext lifecycle) and is verified live in-app, NOT unit-tested. Only the
// pure decode helper (toMono) is covered here.

/** Minimal duck-typed AudioBuffer for the channels toMono reads. */
function fakeBuffer(channels: number[][]): AudioBuffer {
  const len = channels[0]!.length;
  return {
    numberOfChannels: channels.length,
    length: len,
    sampleRate: 48000,
    duration: len / 48000,
    getChannelData: (c: number) => Float32Array.from(channels[c]!),
  } as unknown as AudioBuffer;
}

describe('toMono', () => {
  it('returns a copy of channel 0 for mono input (not the original ref)', () => {
    const buf = fakeBuffer([[0.1, -0.2, 0.3]]);
    const mono = toMono(buf);
    expect(Array.from(mono)).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(-0.2, 6),
      expect.closeTo(0.3, 6),
    ]);
  });

  it('averages stereo channels', () => {
    const buf = fakeBuffer([
      [1.0, 0.0, -1.0],
      [0.0, 1.0, -1.0],
    ]);
    const mono = toMono(buf);
    expect(mono[0]).toBeCloseTo(0.5, 6); // (1+0)/2
    expect(mono[1]).toBeCloseTo(0.5, 6); // (0+1)/2
    expect(mono[2]).toBeCloseTo(-1.0, 6); // (-1+-1)/2
  });

  it('produces the right length', () => {
    const buf = fakeBuffer([[0, 0, 0, 0, 0]]);
    expect(toMono(buf).length).toBe(5);
  });
});
