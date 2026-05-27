/**
 * useWaitlistPrewarm — LAUNCH-02.5d unit tests.
 *
 * Verifies:
 *   - Pre-warm fires once on first IntersectionObserver entry
 *   - Pre-warm does NOT re-run on subsequent intersections
 *     (the observer disconnects after firing)
 *   - When intersection happens, AudioContext is created + registered
 *     with WindowRegistry; PlaybackEngine.initialize is called with
 *     the new context
 *   - The countdown click is fetched + decoded and stored
 *   - resume() resumes a suspended context on user gesture
 *   - resume() before any intersection still kicks pre-warm (the
 *     "Play before scroll" race case)
 *   - hasContext / hasCountdownClick reactive state reflects progress
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRef } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEngine: {
  initialize: ReturnType<typeof vi.fn>;
} = { initialize: vi.fn(async () => undefined) };

const mockRegistry: {
  audioContext: AudioContext | null;
} = { audioContext: null };

vi.mock('@/domains/playback/services/WindowRegistry', () => ({
  WindowRegistry: {
    getPlaybackEngine: vi.fn(() => mockEngine),
    setAudioContext: vi.fn((ctx: AudioContext) => {
      mockRegistry.audioContext = ctx;
    }),
  },
}));

// Capture the IntersectionObserver callbacks so we can fire them from tests.
type IOEntry = { isIntersecting: boolean };
const observerInstances: Array<{
  callback: (entries: IOEntry[]) => void;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  trigger: (entries: IOEntry[]) => void;
}> = [];

class MockIntersectionObserver {
  callback: (entries: IOEntry[]) => void;
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
  constructor(cb: (entries: IOEntry[]) => void) {
    this.callback = cb;
    const inst = {
      callback: cb,
      disconnect: this.disconnect,
      observe: this.observe,
      trigger: (entries: IOEntry[]) => cb(entries),
    };
    observerInstances.push(inst);
  }
  takeRecords(): IOEntry[] {
    return [];
  }
}

import {
  useWaitlistPrewarm,
  _setAudioContextFactory,
} from '../useWaitlistPrewarm';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let mockContext: AudioContext;
let resumeMock: ReturnType<typeof vi.fn>;
let decodeMock: ReturnType<typeof vi.fn>;

function makeMockContext(state: AudioContextState = 'suspended'): AudioContext {
  resumeMock = vi.fn(async () => {
    (ctx as any).state = 'running';
  });
  decodeMock = vi.fn(
    async () =>
      ({
        duration: 0.04,
        length: 1764,
        sampleRate: 44100,
        numberOfChannels: 1,
      }) as AudioBuffer,
  );
  const ctx = {
    state,
    sampleRate: 44100,
    destination: {} as AudioDestinationNode,
    resume: resumeMock,
    decodeAudioData: decodeMock,
    createBufferSource: vi.fn(),
    createGain: vi.fn(),
  } as unknown as AudioContext;
  return ctx;
}

beforeEach(() => {
  observerInstances.length = 0;
  mockRegistry.audioContext = null;
  mockEngine.initialize.mockClear();
  vi.mocked(WindowRegistry.setAudioContext).mockClear();

  mockContext = makeMockContext('suspended');
  _setAudioContextFactory(() => mockContext);

  (globalThis as any).IntersectionObserver = MockIntersectionObserver;

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  );
});

afterEach(() => {
  _setAudioContextFactory(null);
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function renderPrewarm(opts?: { enabled?: boolean }) {
  return renderHook(() => {
    const ref = useRef<HTMLElement | null>(null);
    // jsdom: any non-null element satisfies the observe() call.
    ref.current = document.createElement('div');
    return {
      ref,
      prewarm: useWaitlistPrewarm({
        cardRef: ref,
        countdownClickUrl: '/storage/v1/object/public/audio-samples/click.ogg',
        enabled: opts?.enabled ?? true,
      }),
    };
  });
}

describe('useWaitlistPrewarm — LAUNCH-02.5d', () => {
  it('does NOT pre-warm before the IntersectionObserver fires', () => {
    const { result } = renderPrewarm();
    expect(result.current.prewarm.hasContext).toBe(false);
    expect(result.current.prewarm.hasCountdownClick).toBe(false);
    expect(WindowRegistry.setAudioContext).not.toHaveBeenCalled();
  });

  it('runs pre-warm on first intersection: creates AudioContext, initialises engine, decodes click', async () => {
    const { result } = renderPrewarm();

    // Fire the observer callback.
    await act(async () => {
      observerInstances[0]!.trigger([{ isIntersecting: true }]);
      // Let microtasks settle (fetch + decodeAudioData are async).
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.prewarm.hasContext).toBe(true);
      expect(result.current.prewarm.hasCountdownClick).toBe(true);
    });

    expect(WindowRegistry.setAudioContext).toHaveBeenCalledWith(mockContext);
    expect(mockEngine.initialize).toHaveBeenCalledWith(
      mockContext,
      mockContext.destination,
    );
    expect(decodeMock).toHaveBeenCalledTimes(1);
  });

  it('disconnects the observer after first intersection (pre-warm runs once)', async () => {
    renderPrewarm();
    await act(async () => {
      observerInstances[0]!.trigger([{ isIntersecting: true }]);
      await Promise.resolve();
    });
    expect(observerInstances[0]!.disconnect).toHaveBeenCalled();
  });

  it('leaves the AudioContext suspended after pre-warm (no autoplay)', async () => {
    const { result } = renderPrewarm();
    await act(async () => {
      observerInstances[0]!.trigger([{ isIntersecting: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockContext.state).toBe('suspended');
    expect(resumeMock).not.toHaveBeenCalled();
    // hasContext flips true even while the context is still suspended.
    await waitFor(() => expect(result.current.prewarm.hasContext).toBe(true));
  });

  it('resume() resumes a suspended context on user gesture', async () => {
    const { result } = renderPrewarm();
    await act(async () => {
      observerInstances[0]!.trigger([{ isIntersecting: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.prewarm.resume();
    });

    expect(resumeMock).toHaveBeenCalledTimes(1);
  });

  it('resume() before any intersection still kicks pre-warm (race-case: user taps Play before scroll)', async () => {
    const { result } = renderPrewarm();

    await act(async () => {
      await result.current.prewarm.resume();
      // Wait for the pre-warm microtask chain.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(WindowRegistry.setAudioContext).toHaveBeenCalledWith(mockContext);
    expect(resumeMock).toHaveBeenCalled();
  });

  it('getCountdownClickBuffer returns null before decode, returns the buffer after', async () => {
    const { result } = renderPrewarm();
    expect(result.current.prewarm.getCountdownClickBuffer()).toBeNull();

    await act(async () => {
      observerInstances[0]!.trigger([{ isIntersecting: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.prewarm.getCountdownClickBuffer()).not.toBeNull();
    });
  });

  it('disabled=false short-circuits — no observer, no pre-warm', () => {
    renderPrewarm({ enabled: false });
    expect(observerInstances).toHaveLength(0);
    expect(WindowRegistry.setAudioContext).not.toHaveBeenCalled();
  });
});
