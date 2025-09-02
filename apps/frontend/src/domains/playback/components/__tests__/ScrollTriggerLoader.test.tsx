import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ScrollTriggerLoader } from '../ScrollTriggerLoader';
import { getSamplePreloader } from '../../services/InitialSamplePreloader';
import userEvent from '@testing-library/user-event';

// Create a stable mock instance
const mockLoadEssentialSamples = vi.fn().mockResolvedValue(undefined);
const mockGetStats = vi.fn(() => ({ isComplete: false, isPreloading: false }));
const mockPreloaderInstance = {
  loadEssentialSamples: mockLoadEssentialSamples,
  getStats: mockGetStats
};

// Mock the sample preloader
vi.mock('../../services/InitialSamplePreloader', () => ({
  getSamplePreloader: vi.fn(() => mockPreloaderInstance)
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn((msg: string) => console.log(`[scroll-trigger-loader] 📝 ${msg}`, '')),
    error: vi.fn((msg: string, error: any) => console.error(`[scroll-trigger-loader] 🚨 ${msg}`, error, '')),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

describe('ScrollTriggerLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock functions
    mockLoadEssentialSamples.mockClear();
    mockLoadEssentialSamples.mockResolvedValue(undefined);
    mockGetStats.mockClear();
    mockGetStats.mockReturnValue({ isComplete: false, isPreloading: false });
    
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

      expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { 
        once: true, 
        passive: true 
      });
      expect(window.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { 
        once: true, 
        passive: true 
      });
      expect(window.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function), { 
        once: true,
        passive: true 
      });
      expect(window.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), { 
        once: true,
        passive: true 
      });
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = render(<ScrollTriggerLoader />);
      
      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('User Interaction Triggers', () => {
    it('should trigger loading on scroll', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate scroll
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      scrollHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on touch', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate touch
      const touchHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'touchstart')[1];
      
      touchHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on click', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate click
      const clickHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'click')[1];
      
      clickHandler();

      await waitFor(() => {
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should trigger loading on mouseenter', async () => {
      render(<ScrollTriggerLoader />);

      // Simulate mouseenter
      const mouseEnterHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'mouseenter')[1];
      
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
      const handlers = ['scroll', 'touchstart', 'click', 'mouseenter'].map(event => 
        (window.addEventListener as any).mock.calls
          .find((call: any) => call[0] === event)?.[1]
      ).filter(Boolean);

      // Trigger all events
      handlers.forEach(handler => handler());

      await waitFor(() => {
        // Should only call loadEssentialSamples once
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should log appropriate messages during loading', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<ScrollTriggerLoader />);

      // Trigger loading
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      scrollHandler();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[scroll-trigger-loader] 📝 🚀 First user interaction detected - loading essential samples',
          ''
        );
      });

      consoleSpy.mockRestore();
    });

    it('should check if already loading before starting', async () => {
      render(<ScrollTriggerLoader />);

      // Trigger loading twice quickly
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      // First trigger
      scrollHandler();
      // Second trigger (should be ignored)
      scrollHandler();

      await waitFor(() => {
        // Should only call loadEssentialSamples once
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle loading errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Make loadEssentialSamples throw
      mockLoadEssentialSamples.mockRejectedValue(new Error('Loading failed'));

      render(<ScrollTriggerLoader />);

      // Trigger loading
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      scrollHandler();

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[scroll-trigger-loader] 🚨 ❌ Failed to load essential samples:',
          expect.any(Error),
          ''
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Window Events', () => {
    it('should dispatch essentialSamplesLoaded event after loading', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      
      render(<ScrollTriggerLoader />);

      // Trigger loading
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      scrollHandler();

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'essentialSamplesLoaded' })
        );
      });
    });

    it('should set window.__essentialSamplesLoaded flag', async () => {
      render(<ScrollTriggerLoader />);

      // Trigger loading  
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
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
      const scrollHandler = (window.addEventListener as any).mock.calls
        .find((call: any) => call[0] === 'scroll')[1];
      
      scrollHandler();

      await waitFor(() => {
        // Phase 2 should load essential samples
        expect(mockLoadEssentialSamples).toHaveBeenCalledTimes(1);
        
        // Should set loading flag
        expect((window as any).__essentialSamplesLoaded).toBe(true);
      });
    });
  });
});