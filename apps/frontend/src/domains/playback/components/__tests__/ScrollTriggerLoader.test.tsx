import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ScrollTriggerLoader } from '../ScrollTriggerLoader';
import { WindowRegistry } from '../../services/WindowRegistry';
import type { Exercise } from '@bassnotion/contracts';

// Create mock functions
const mockLoadEssentialSamples = vi.fn().mockResolvedValue(undefined);
const mockLoadTutorialSamples = vi.fn().mockResolvedValue(undefined);
const mockGetStats = vi.fn(() => ({ isComplete: false, isPreloading: false }));

const mockPreloaderInstance = {
  loadEssentialSamples: mockLoadEssentialSamples,
  loadTutorialSamples: mockLoadTutorialSamples,
  getStats: mockGetStats,
};

// Mock the sample preloader
vi.mock('../../services/InitialSamplePreloader.bridge', () => ({
  getSamplePreloader: vi.fn(() => mockPreloaderInstance),
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Mock lifecycle logger (production calls .checkpoint() heavily)
vi.mock('../../utils/InitializationLifecycleLogger.js', () => ({
  lifecycle: {
    checkpoint: vi.fn(),
  },
}));

// Pre-seed CoreServices in WindowRegistry. Production now WAITS for
// CoreServices (owned by AudioProvider) instead of creating its own; if
// the registry is empty, the component polls for 2s then bails. Pre-
// seeding lets every test exercise the happy path.
const seedCoreServices = () => {
  WindowRegistry.setCoreServices({
    preInitialize: vi.fn().mockResolvedValue(undefined),
  } as any);
};

describe('ScrollTriggerLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock functions
    mockLoadEssentialSamples.mockClear();
    mockLoadEssentialSamples.mockResolvedValue(undefined);
    mockLoadTutorialSamples.mockClear();
    mockLoadTutorialSamples.mockResolvedValue(undefined);
    mockGetStats.mockClear();
    mockGetStats.mockReturnValue({ isComplete: false, isPreloading: false });

    // Clear WindowRegistry state (both namespaced and legacy keys)
    WindowRegistry.setSamplesReady(false);
    WindowRegistry.setEssentialSamplesLoaded(false);
    WindowRegistry.setInitializationFailed(false);
    WindowRegistry.setCoreServices(null as any);
    delete (window as any).__samplesReady;
    delete (window as any).__essentialSamplesLoaded;
    delete (window as any).__initializationFailed;

    seedCoreServices();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render nothing (invisible component)', () => {
      const { container } = render(<ScrollTriggerLoader />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Mount-path initialization', () => {
    // Production calls triggerInitialization() inline on mount BEFORE
    // attaching gesture listeners — sample fetching doesn't need a
    // gesture, only AudioContext creation does. The previous gesture-
    // gated path left users staring at "Loading…" on first play. So
    // the mount triggering loadEssentialSamples is the new contract.
    it('should kick off essential samples on mount when no exercises', async () => {
      render(<ScrollTriggerLoader />);

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should kick off tutorial samples on mount when exercises provided', async () => {
      const mockExercises: Exercise[] = [
        { id: 'ex1', name: 'Exercise 1' } as any,
        { id: 'ex2', name: 'Exercise 2' } as any,
      ];

      render(
        <ScrollTriggerLoader
          exercises={mockExercises}
          tutorialId="tutorial-123"
        />,
      );

      await waitFor(() => {
        expect(mockLoadTutorialSamples).toHaveBeenCalledWith(
          mockExercises,
          'tutorial-123',
        );
        expect(mockLoadEssentialSamples).not.toHaveBeenCalled();
      });
    });

    it('should set samplesReady + essentialSamplesLoaded flags after load', async () => {
      render(<ScrollTriggerLoader />);

      await waitFor(() => {
        expect(WindowRegistry.getSamplesReady()).toBe(true);
        expect(WindowRegistry.getEssentialSamplesLoaded()).toBe(true);
      });
    });

    it('should only load once even if remounted with same deps', async () => {
      const { rerender } = render(<ScrollTriggerLoader />);

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });

      rerender(<ScrollTriggerLoader />);
      // hasTriggeredRef guards against re-running on rerender
      expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gesture-listener fallback', () => {
    // Production also registers passive once-listeners as a defensive
    // fallback in case the mount-path init no-ops. The listeners must
    // be attached (and torn down on unmount), even though the mount
    // path usually fires first.
    it('should attach all four gesture listeners on mount', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      render(<ScrollTriggerLoader />);

      const events = addSpy.mock.calls.map((c) => c[0]);
      expect(events).toContain('scroll');
      expect(events).toContain('touchstart');
      expect(events).toContain('click');
      expect(events).toContain('mouseenter');
    });

    it('should attach listeners with { passive: true, once: true }', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');

      render(<ScrollTriggerLoader />);

      const scrollCall = addSpy.mock.calls.find((c) => c[0] === 'scroll');
      expect(scrollCall?.[2]).toEqual({ passive: true, once: true });
    });

    it('should remove gesture listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<ScrollTriggerLoader />);
      unmount();

      const events = removeSpy.mock.calls.map((c) => c[0]);
      expect(events).toContain('scroll');
      expect(events).toContain('touchstart');
      expect(events).toContain('click');
      expect(events).toContain('mouseenter');
    });
  });

  describe('CoreServices wait', () => {
    it('should bail (not load) if CoreServices is unavailable after 2s', async () => {
      // Clear CoreServices so the inner while-loop polls and times out
      WindowRegistry.setCoreServices(null as any);

      render(<ScrollTriggerLoader />);

      // Wait past the production 2s poll window
      await new Promise((resolve) => setTimeout(resolve, 2200));

      expect(mockLoadEssentialSamples).not.toHaveBeenCalled();
      expect(mockLoadTutorialSamples).not.toHaveBeenCalled();
    }, 5000);

    it('should proceed once CoreServices is available', async () => {
      // CoreServices is pre-seeded in beforeEach, so load should succeed
      render(<ScrollTriggerLoader />);

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalled();
      });
    });
  });

  describe('Error handling', () => {
    it('should set initializationFailed flag and dispatch error event on load failure', async () => {
      const testError = new Error('Sample loading failed');
      mockLoadEssentialSamples.mockRejectedValueOnce(testError);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<ScrollTriggerLoader />);

      await waitFor(() => {
        expect(WindowRegistry.getInitializationFailed()).toBe(true);
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'initializationError' }),
        );
      });
    });
  });
});
