/**
 * useGrooveCardPlayback — LAUNCH-02.5d waitlist key-cap behaviour.
 *
 * Verifies the contract added in 02.5d:
 *   - mode='waitlist' caps the key range at ±4 semitones
 *   - tapping the stepper beyond the cap is SWALLOWED (state does not
 *     advance, pendingKeyShift stays as it was)
 *   - tapping beyond the cap fires the
 *     `groove_card_waitlist_cap_hit` telemetry event with the
 *     `valueAttempted` (the rounded request) and `lever: 'key'`
 *   - mode='block' (the default) still caps at ±12 and does NOT emit
 *     the cap-hit event
 *   - in-range key changes in waitlist mode update state normally
 *     and do NOT emit the cap event
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

// Mock the heavy collaborators so we can drive the hook standalone.
const mockTransport = {
  isPlaying: false,
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
};
vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportControls: () => mockTransport,
  useTransportControlsSafe: () => mockTransport,
}));

vi.mock('@/domains/playback/services/WindowRegistry', () => ({
  WindowRegistry: {
    getAudioContext: () => null,
    getPlaybackEngine: () => ({
      setAudioStemBuffers: vi.fn(),
      startAudioStems: vi.fn(),
      stopAudioStems: vi.fn(),
      unregisterTracksByPrefix: vi.fn(),
      registerTracks: vi.fn(),
      setInstrumentMuted: vi.fn(),
    }),
  },
}));

vi.mock('@/domains/playback/modules/tempo/MusicalTruthAuthority', () => ({
  musicalTruth: {
    setBPM: vi.fn(),
    getBPM: () => 104,
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/shared/utils/sentry', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/shared/utils/sentry';
import { useGrooveCardPlayback } from '../useGrooveCardPlayback';

const trackEventMock = vi.mocked(trackEvent);

function makeConfig(): GrooveCardBlockConfig {
  const placeholderStems = {
    bass: '/audio-samples/silence.ogg',
    drums: '/audio-samples/silence.ogg',
    harmony: '/audio-samples/silence.ogg',
  };
  return {
    title: 'Test',
    subtitle: 'Test',
    originalBpm: 104,
    originalKey: 'E',
    lengthBars: 4,
    keys: [
      {
        label: 'C',
        semitoneOffset: -8,
        isDefault: false,
        stems: placeholderStems,
      },
      {
        label: 'D',
        semitoneOffset: -4,
        isDefault: false,
        stems: placeholderStems,
      },
      {
        label: 'E',
        semitoneOffset: 0,
        isDefault: true,
        stems: placeholderStems,
      },
      {
        label: 'G',
        semitoneOffset: 4,
        isDefault: false,
        stems: placeholderStems,
      },
      {
        label: 'A',
        semitoneOffset: 8,
        isDefault: false,
        stems: placeholderStems,
      },
    ],
    previewCaption: '',
    stateCaptions: {},
    allowBookmark: false,
  };
}

beforeEach(() => {
  trackEventMock.mockClear();
});

describe('useGrooveCardPlayback — LAUNCH-02.5d waitlist key cap', () => {
  it('mode="waitlist" allows in-range setKey calls (±4) and updates state', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    act(() => result.current.setKey(3));
    expect(result.current.currentSemitones).toBe(3);
    expect(trackEventMock).not.toHaveBeenCalled();

    act(() => result.current.setKey(-4));
    expect(result.current.currentSemitones).toBe(-4);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('mode="waitlist" SWALLOWS setKey calls beyond ±4 (state does not advance)', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    // First land at +4 (the cap).
    act(() => result.current.setKey(4));
    expect(result.current.currentSemitones).toBe(4);

    // Now try to push beyond — state must NOT advance.
    act(() => result.current.setKey(5));
    expect(result.current.currentSemitones).toBe(4);

    act(() => result.current.setKey(12));
    expect(result.current.currentSemitones).toBe(4);
  });

  it('mode="waitlist" tap beyond +4 fires groove_card_waitlist_cap_hit with valueAttempted', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    act(() => result.current.setKey(7));
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      'groove_card_waitlist_cap_hit',
      'groove-card',
      { blockId: 'card-w', lever: 'key', valueAttempted: 7 },
    );
  });

  it('mode="waitlist" tap beyond -4 fires the event with a negative valueAttempted', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    act(() => result.current.setKey(-9));
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith(
      'groove_card_waitlist_cap_hit',
      'groove-card',
      { blockId: 'card-w', lever: 'key', valueAttempted: -9 },
    );
  });

  it('mode="waitlist" repeated beyond-cap taps each fire the event (so per-tap analytics work)', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    act(() => result.current.setKey(5));
    act(() => result.current.setKey(6));
    act(() => result.current.setKey(7));
    expect(trackEventMock).toHaveBeenCalledTimes(3);
  });

  it('mode="block" (the default) allows setKey up to ±12 with NO cap-hit event', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-b',
        mode: 'block',
      }),
    );

    act(() => result.current.setKey(7));
    expect(result.current.currentSemitones).toBe(7);
    expect(trackEventMock).not.toHaveBeenCalled();

    act(() => result.current.setKey(12));
    expect(result.current.currentSemitones).toBe(12);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('mode="block" still clamps to ±12 (>12 caps), but does NOT emit telemetry (block mode is uncapped CTA-wise)', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-b',
        mode: 'block',
      }),
    );

    // First land at the cap.
    act(() => result.current.setKey(12));
    expect(result.current.currentSemitones).toBe(12);
    trackEventMock.mockClear();

    // Push beyond — block mode silently swallows (because cap-as-CTA
    // only fires telemetry in waitlist mode per the story).
    act(() => result.current.setKey(15));
    expect(result.current.currentSemitones).toBe(12);
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
