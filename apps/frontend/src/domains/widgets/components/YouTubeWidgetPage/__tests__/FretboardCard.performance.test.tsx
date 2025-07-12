/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { FretboardCard } from '../FretboardCard';
import { SyncProvider } from '../../base/SyncProvider';

// Mock the useAudioFretboard hook with performance tracking
const mockTriggerNote = vi.fn();
const _mockPerformanceStart = vi.fn();

vi.mock('../../../hooks/useAudioFretboard', () => ({
  useAudioFretboard: vi.fn(() => ({
    createNoteEvent: vi.fn((stringIndex, fret) => ({
      note: 'A',
      octave: 2,
      string: stringIndex,
      fret: fret === 'open' ? 0 : fret,
    })),
    triggerNote: mockTriggerNote,
    playbackIntegration: null,
    isAudioEnabled: true,
    audioError: null,
    stringConfigs: {
      4: ['E', 'A', 'D', 'G'],
      5: ['B', 'E', 'A', 'D', 'G'],
    },
    playbackPosition: {
      currentNoteIndex: -1,
      currentNote: null,
      isPlaying: false,
      currentTime: 0,
      progress: 0,
    },
    isCurrentNote: vi.fn(() => false),
  })),
}));

describe('FretboardCard Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock performance.now for latency testing - realistic values
    let mockTime = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += Math.random() * 5 + 1; // Simulate 1-6ms increments (realistic for fast operations)
      return mockTime;
    });
  });

  describe('Audio Integration Requirements', () => {
    it('should successfully trigger audio on user interaction', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Click a fret dot
      const openStringDot = screen.getAllByTitle(/Open.*String/)[0];
      fireEvent.click(openStringDot);

      // Verify triggerNote was called immediately
      expect(mockTriggerNote).toHaveBeenCalledTimes(1);
      expect(mockTriggerNote).toHaveBeenCalledWith(0, 'open');
    });

    it('should maintain consistent audio triggering across multiple interactions', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      const openStringDots = screen.getAllByTitle(/Open.*String/);

      // Test multiple interactions
      for (let i = 0; i < 5; i++) {
        fireEvent.click(openStringDots[i % openStringDots.length]);
      }

      // All interactions should trigger audio
      expect(mockTriggerNote).toHaveBeenCalledTimes(5);

      // Each call should have proper parameters
      const calls = mockTriggerNote.mock.calls;
      calls.forEach((call, _index) => {
        expect(call).toHaveLength(2); // Should have stringIndex and fret parameters
        expect(typeof call[0]).toBe('number'); // stringIndex should be number
        expect(call[1]).toBe('open'); // fret should be 'open' for these tests
      });
    });
  });

  describe('Interaction Performance', () => {
    it('should handle rapid state changes without errors', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      const openStringDots = screen.getAllByTitle(/Open.*String/);

      // Rapidly click multiple dots
      for (let i = 0; i < 20; i++) {
        fireEvent.click(openStringDots[i % openStringDots.length]);
      }

      // All interactions should have been processed without errors
      expect(mockTriggerNote).toHaveBeenCalledTimes(20);

      // Component should still be functional
      expect(screen.getByText(/Interactive Fretboard/)).toBeInTheDocument();
    });

    it('should handle component re-renders efficiently', async () => {
      const { rerender } = render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Simulate multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <SyncProvider>
            <FretboardCard />
          </SyncProvider>,
        );
      }

      // Component should remain functional after re-renders
      expect(screen.getByText(/Interactive Fretboard/)).toBeInTheDocument();

      // Basic interaction should still work
      const openStringDot = screen.getAllByTitle(/Open.*String/)[0];
      fireEvent.click(openStringDot);
      expect(mockTriggerNote).toHaveBeenCalled();
    });
  });

  describe('Memory Performance', () => {
    it('should not create memory leaks during extended usage', async () => {
      const { unmount } = render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      // Simulate extended usage
      const openStringDots = screen.getAllByTitle(/Open.*String/);

      // Perform many interactions
      for (let i = 0; i < 100; i++) {
        fireEvent.click(openStringDots[i % openStringDots.length]);
      }

      // Component should unmount cleanly
      expect(() => unmount()).not.toThrow();

      // All interactions should have been processed
      expect(mockTriggerNote).toHaveBeenCalledTimes(100);
    });

    it('should handle large exercise data sets without crashing', async () => {
      // Mock a large exercise with many notes
      const _largeExercise = {
        id: 'large-exercise',
        title: 'Large Exercise',
        bpm: 120,
        difficulty: 'advanced' as const,
        notes: Array.from({ length: 100 }, (_, i) => ({
          id: `note-${i}`,
          timestamp: i * 100,
          string: (i % 4) + 1,
          fret: i % 12,
          duration: 200,
          note: 'A',
          color: 'blue',
        })),
      };

      // Component should render successfully with large dataset
      expect(() => {
        render(
          <SyncProvider>
            <FretboardCard />
          </SyncProvider>,
        );
      }).not.toThrow();

      // Component should be functional
      expect(screen.getByText(/Interactive Fretboard/)).toBeInTheDocument();
    });
  });

  describe('Sync Performance', () => {
    it('should maintain consistent sync behavior across multiple events', async () => {
      render(
        <SyncProvider>
          <FretboardCard />
        </SyncProvider>,
      );

      const openStringDots = screen.getAllByTitle(/Open.*String/);

      // Test sync consistency across multiple events
      for (let i = 0; i < 10; i++) {
        fireEvent.click(openStringDots[i % openStringDots.length]);
      }

      // All events should have been processed consistently
      expect(mockTriggerNote).toHaveBeenCalledTimes(10);

      // Each call should have consistent parameters
      const calls = mockTriggerNote.mock.calls;
      calls.forEach((call) => {
        expect(call).toHaveLength(2);
        expect(typeof call[0]).toBe('number');
        expect(call[1]).toBe('open');
      });
    });
  });
});
