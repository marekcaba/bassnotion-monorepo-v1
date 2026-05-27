/**
 * WaitlistAudioBootstrap — LAUNCH-02.5d unit tests.
 *
 * Verifies:
 *   - On mount, constructs an EventBus + PlaybackEngine and registers
 *     both with WindowRegistry
 *   - If WindowRegistry.getPlaybackEngine() already returns an engine
 *     (e.g. /app's CoreServices already initialised), the bootstrap is
 *     a no-op — does NOT overwrite the existing engine
 *   - Renders children
 *
 * The PlaybackEngine constructor and EventBus are mocked so the test
 * doesn't pull in the full audio stack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

// vi.hoisted makes these arrays available to the hoisted vi.mock factories.
// Without this, vi.mock factories run BEFORE module-top consts are
// initialised, so their closures captured `undefined`.
const { mockEngineInstances, mockEventBusInstances, mockRegistry } = vi.hoisted(
  () => ({
    mockEngineInstances: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
    mockEventBusInstances: [] as Array<Record<string, unknown>>,
    mockRegistry: { engine: null as unknown, eventBus: null as unknown },
  }),
);

vi.mock('@/domains/playback/services/core/EventBus', () => ({
  EventBus: class MockEventBus {
    constructor() {
      mockEventBusInstances.push(this as unknown as Record<string, unknown>);
    }
  },
}));

vi.mock('@/domains/playback/services/core/PlaybackEngine', () => ({
  PlaybackEngine: class MockPlaybackEngine {
    dispose = vi.fn();
    constructor() {
      mockEngineInstances.push(
        this as unknown as { dispose: ReturnType<typeof vi.fn> },
      );
    }
  },
}));

vi.mock('@/domains/playback/services/WindowRegistry', () => ({
  WindowRegistry: {
    getPlaybackEngine: vi.fn(() => mockRegistry.engine),
    setPlaybackEngine: vi.fn((e: unknown) => {
      mockRegistry.engine = e;
    }),
    setEventBus: vi.fn((b: unknown) => {
      mockRegistry.eventBus = b;
    }),
  },
}));

import { WaitlistAudioBootstrap } from '../WaitlistAudioBootstrap';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

beforeEach(() => {
  mockEngineInstances.length = 0;
  mockEventBusInstances.length = 0;
  mockRegistry.engine = null;
  mockRegistry.eventBus = null;
  vi.mocked(WindowRegistry.setPlaybackEngine).mockClear();
  vi.mocked(WindowRegistry.setEventBus).mockClear();
});

describe('WaitlistAudioBootstrap — LAUNCH-02.5d', () => {
  it('constructs a fresh EventBus + PlaybackEngine on mount and registers both', async () => {
    render(
      <WaitlistAudioBootstrap>
        <div data-testid="child">hi</div>
      </WaitlistAudioBootstrap>,
    );

    // useEffect fires after the initial paint; wait for it.
    await waitFor(() => {
      expect(mockEngineInstances).toHaveLength(1);
    });
    expect(mockEventBusInstances).toHaveLength(1);
    expect(WindowRegistry.setEventBus).toHaveBeenCalledTimes(1);
    expect(WindowRegistry.setPlaybackEngine).toHaveBeenCalledTimes(1);
  });

  it('renders children', () => {
    const { getByTestId } = render(
      <WaitlistAudioBootstrap>
        <div data-testid="child">visible</div>
      </WaitlistAudioBootstrap>,
    );
    expect(getByTestId('child').textContent).toBe('visible');
  });

  it('is a no-op when the WindowRegistry already has an engine (e.g. /app already initialised)', () => {
    mockRegistry.engine = { __isPlaybackEngine: true, dispose: vi.fn() };

    render(
      <WaitlistAudioBootstrap>
        <div />
      </WaitlistAudioBootstrap>,
    );

    expect(mockEngineInstances).toHaveLength(0);
    expect(WindowRegistry.setPlaybackEngine).not.toHaveBeenCalled();
  });

  it('disposes the engine it constructed on unmount', async () => {
    const { unmount } = render(
      <WaitlistAudioBootstrap>
        <div />
      </WaitlistAudioBootstrap>,
    );
    await waitFor(() => expect(mockEngineInstances).toHaveLength(1));
    const engine = mockEngineInstances[0]!;
    act(() => unmount());
    expect(engine.dispose).toHaveBeenCalled();
  });
});
