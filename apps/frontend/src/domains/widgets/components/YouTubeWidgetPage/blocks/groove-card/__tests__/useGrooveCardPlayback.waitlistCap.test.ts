/**
 * useGrooveCardPlayback — LAUNCH-02.5d waitlist key-cap behaviour.
 *
 * Verifies the contract added in 02.5d, updated in 02.5e (single-key-set
 * + PitchShift). Both modes share the universal ±6 cap (one octave of
 * range total, ±6 semitones from default); only the cap-hit telemetry
 * is mode-specific:
 *   - mode='waitlist' caps the key range at ±6 semitones
 *   - tapping the stepper beyond the cap is SWALLOWED (state does not
 *     advance, pendingKeyShift stays as it was)
 *   - tapping beyond the cap fires the
 *     `groove_card_waitlist_cap_hit` telemetry event with the
 *     `valueAttempted` (the rounded request) and `lever: 'key'`
 *   - mode='block' caps at ±6 too but does NOT emit the cap-hit event
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
  return {
    title: 'Test',
    subtitle: 'Test',
    originalBpm: 104,
    originalKey: 'E',
    lengthBars: 4,
    stems: {
      bass: '/audio-samples/silence.ogg',
      drums: '/audio-samples/silence.ogg',
      harmony: '/audio-samples/silence.ogg',
    },
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

  it('mode="waitlist" SWALLOWS setKey calls beyond ±6 (state does not advance)', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-w',
        mode: 'waitlist',
      }),
    );

    // First land at +6 (the cap).
    act(() => result.current.setKey(6));
    expect(result.current.currentSemitones).toBe(6);

    // Now try to push beyond — state must NOT advance.
    act(() => result.current.setKey(7));
    expect(result.current.currentSemitones).toBe(6);

    act(() => result.current.setKey(12));
    expect(result.current.currentSemitones).toBe(6);
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

    act(() => result.current.setKey(7));
    act(() => result.current.setKey(8));
    act(() => result.current.setKey(9));
    expect(trackEventMock).toHaveBeenCalledTimes(3);
  });

  it('mode="block" allows setKey up to ±6 with NO cap-hit event', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-b',
        mode: 'block',
      }),
    );

    act(() => result.current.setKey(5));
    expect(result.current.currentSemitones).toBe(5);
    expect(trackEventMock).not.toHaveBeenCalled();

    act(() => result.current.setKey(6));
    expect(result.current.currentSemitones).toBe(6);
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('mode="block" still clamps to ±6 (>6 caps), but does NOT emit telemetry (block mode is uncapped CTA-wise)', () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({
        block: makeConfig(),
        cardId: 'card-b',
        mode: 'block',
      }),
    );

    // First land at the cap.
    act(() => result.current.setKey(6));
    expect(result.current.currentSemitones).toBe(6);
    trackEventMock.mockClear();

    // Push beyond — block mode silently swallows (because cap-as-CTA
    // only fires telemetry in waitlist mode per the story).
    act(() => result.current.setKey(12));
    expect(result.current.currentSemitones).toBe(6);
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});
