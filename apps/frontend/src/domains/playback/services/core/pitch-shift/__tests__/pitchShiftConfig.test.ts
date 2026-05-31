/**
 * Unit tests for the LAUNCH-02.5f pitch-shift A/B selector. Covers the
 * three-tier precedence: `?pitch=` URL param > NEXT_PUBLIC_PITCH_LIB env
 * > default 'soundtouch'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePitchShiftLibrary } from '../pitchShiftConfig.js';

describe('resolvePitchShiftLibrary', () => {
  const originalEnv = process.env.NEXT_PUBLIC_PITCH_LIB;
  const originalSearch = window.location.search;

  function setSearch(search: string): void {
    // jsdom: redefine location.search for the test.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search },
    });
  }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_PITCH_LIB;
    setSearch('');
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_PITCH_LIB;
    else process.env.NEXT_PUBLIC_PITCH_LIB = originalEnv;
    setSearch(originalSearch);
    vi.restoreAllMocks();
  });

  it('defaults to signalsmith when nothing is set', () => {
    expect(resolvePitchShiftLibrary()).toBe('signalsmith');
  });

  it('honours NEXT_PUBLIC_PITCH_LIB=soundtouch (override back to old engine)', () => {
    process.env.NEXT_PUBLIC_PITCH_LIB = 'soundtouch';
    expect(resolvePitchShiftLibrary()).toBe('soundtouch');
  });

  it('ignores an invalid env value and falls back to the signalsmith default', () => {
    process.env.NEXT_PUBLIC_PITCH_LIB = 'rubberband';
    expect(resolvePitchShiftLibrary()).toBe('signalsmith');
  });

  it('?pitch=soundtouch wins over the signalsmith default', () => {
    setSearch('?pitch=soundtouch');
    expect(resolvePitchShiftLibrary()).toBe('soundtouch');
  });

  it('?pitch=signalsmith wins over an env soundtouch override', () => {
    process.env.NEXT_PUBLIC_PITCH_LIB = 'soundtouch';
    setSearch('?pitch=signalsmith');
    expect(resolvePitchShiftLibrary()).toBe('signalsmith');
  });

  it('ignores an invalid ?pitch= value and falls through to env', () => {
    process.env.NEXT_PUBLIC_PITCH_LIB = 'soundtouch';
    setSearch('?pitch=bogus');
    expect(resolvePitchShiftLibrary()).toBe('soundtouch');
  });
});
