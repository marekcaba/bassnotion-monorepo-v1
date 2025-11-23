import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ScrollTriggerLoader } from '../ScrollTriggerLoader';
import { getSamplePreloader } from '../../services/InitialSamplePreloader.bridge';
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

// Mock CoreServices
const mockPreInitialize = vi.fn().mockResolvedValue(undefined);
const mockCoreServices = {
  preInitialize: mockPreInitialize,
};

// Mock the sample preloader
vi.mock('../../services/InitialSamplePreloader.bridge', () => ({
  getSamplePreloader: vi.fn(() => mockPreloaderInstance),
}));

// Mock CoreServices
vi.mock('../../services/core/CoreServices.js', () => ({
  CoreServices: vi.fn(() => mockCoreServices),
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

describe('ScrollTriggerLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock functions
    mockLoadEssentialSamples.mockClear();
    mockLoadEssentialSamples.mockResolvedValue(undefined);
    mockLoadTutorialSamples.mockClear();
    mockLoadTutorialSamples.mockResolvedValue(undefined);
    mockPreInitialize.mockClear();
    mockPreInitialize.mockResolvedValue(undefined);
    mockGetStats.mockClear();
    mockGetStats.mockReturnValue({ isComplete: false, isPreloading: false });

    // Clear window globals
    delete (window as any).__globalCoreServices;
    delete (window as any).__samplesReady;
    delete (window as any).__essentialSamplesLoaded;
    delete (window as any).__initializationFailed;

    // Reset window events
    window.removeEventListener = vi.fn();
    window.addEventListener = vi.fn();
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

  describe('Event Listener Setup', () => {
    it('should add event listeners on mount', () => {
      render(<ScrollTriggerLoader />);

      expect(window.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        {
          once: true,
          passive: true,
        },
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        {
          once: true,
          passive: true,
        },
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'mouseenter',
        expect.any(Function),
        {
          once: true,
          passive: true,
        },
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        {
          once: true,
          passive: true,
        },
      );
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = render(<ScrollTriggerLoader />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'mouseenter',
        expect.any(Function),
      );
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
      );
    });
  });

  describe('User Interaction Triggers', () => {
    it('should trigger loading on scroll', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate scroll
      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on touch', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate touch
      const touchHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'touchstart',
      )[1];

      touchHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on click', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate click
      const clickHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'click',
      )[1];

      clickHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on mouseenter', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate mouseenter
      const mouseEnterHandler = (
        window.addEventListener as any
      ).mock.calls.find((call: any) => call[0] === 'mouseenter')[1];

      mouseEnterHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading Behavior', () => {
    it('should only load once despite multiple triggers', async () => {
      render(<ScrollTriggerLoader />);

      // Get all handlers
      const handlers = ['scroll', 'touchstart', 'click', 'mouseenter']
        .map(
          (event) =>
            (window.addEventListener as any).mock.calls.find(
              (call: any) => call[0] === event,
            )?.[1],
        )
        .filter(Boolean);

      // Trigger all events
      handlers.forEach((handler) => handler());

      await waitFor(() => {
        // Should only call loadEssentialSamples once
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should check if already loading before starting', async () => {
      render(<ScrollTriggerLoader />);

      // Trigger loading twice quickly
      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      // First trigger
      scrollHandler();
      // Second trigger (should be ignored)
      scrollHandler();

      await waitFor(() => {
        // Should only call loadEssentialSamples once
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

  });

  describe('Window Events', () => {
    it('should dispatch essentialSamplesLoaded event after loading', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<ScrollTriggerLoader />);

      // Trigger loading
      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'essentialSamplesLoaded' }),
        );
      });
    });

    it('should set window.__essentialSamplesLoaded flag', async () => {
      render(<ScrollTriggerLoader />);

      // Trigger loading
      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        expect((window as any).__essentialSamplesLoaded).toBe(true);
      });
    });
  });

  describe('Progressive Loading Integration', () => {
    it('should trigger Phase 2 loading correctly', async () => {
      render(<ScrollTriggerLoader />);

      // User scrolls (first interaction)
      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Phase 2 should load essential samples
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);

        // Should set loading flag
        expect((window as any).__essentialSamplesLoaded).toBe(true);
      });
    });
  });

  // ============================================================================
  // BUG #1: RACE CONDITION FIX TESTS
  // ============================================================================
  describe('Bug #1: Race Condition Prevention', () => {
    it('should load samples when triggered', async () => {
      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Samples should load
        expect(mockLoadEssentialSamples).toHaveBeenCalled();
      });
    });

    it('should not recreate CoreServices if it already exists', async () => {
      // Pre-populate window.__globalCoreServices
      (window as any).__globalCoreServices = mockCoreServices;

      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Should NOT call preInitialize again
        expect(mockPreInitialize).not.toHaveBeenCalled();

        // But should still load samples
        expect(mockLoadEssentialSamples).toHaveBeenCalled();
      });
    });

    it('should use tutorial-level loading when exercises provided', async () => {
      const mockExercises: Exercise[] = [
        {
          id: 'ex1',
          name: 'Exercise 1',
          harmonyInstrument: 'grandpiano',
          harmonyNotes: [{ pitch: 'C4' }, { pitch: 'E4' }],
        } as any,
        {
          id: 'ex2',
          name: 'Exercise 2',
          harmonyInstrument: 'wurlitzer',
          harmonyNotes: [{ pitch: 'D4' }, { pitch: 'F4' }],
        } as any,
      ];

      render(
        <ScrollTriggerLoader
          exercises={mockExercises}
          tutorialId="tutorial-123"
        />,
      );

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Should call loadTutorialSamples instead of loadEssentialSamples
        expect(mockLoadTutorialSamples).toHaveBeenCalledWith(
          mockExercises,
          'tutorial-123',
        );
        expect(mockLoadEssentialSamples).not.toHaveBeenCalled();
      });
    });

    it('should fall back to essential samples when no exercises provided', async () => {
      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Should call loadEssentialSamples
        expect(mockLoadEssentialSamples).toHaveBeenCalled();
        expect(mockLoadTutorialSamples).not.toHaveBeenCalled();
      });
    });

    it('should emit both samplesReady and essentialSamplesLoaded events', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Should dispatch both events for backward compatibility
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'samplesReady' }),
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'essentialSamplesLoaded' }),
        );
      });
    });

    it('should set both __samplesReady and __essentialSamplesLoaded flags', async () => {
      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        expect((window as any).__samplesReady).toBe(true);
        expect((window as any).__essentialSamplesLoaded).toBe(true);
      });
    });

    it('should handle sample loading errors gracefully', async () => {
      const testError = new Error('Sample loading failed');
      mockLoadEssentialSamples.mockRejectedValueOnce(testError);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      render(<ScrollTriggerLoader />);

      const scrollHandler = (window.addEventListener as any).mock.calls.find(
        (call: any) => call[0] === 'scroll',
      )[1];

      scrollHandler();

      await waitFor(() => {
        // Should set failure flag
        expect((window as any).__initializationFailed).toBe(true);

        // Should dispatch error event
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'initializationError',
          }),
        );
      });
    });
  });
});
