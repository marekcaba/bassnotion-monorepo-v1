/**
 * useStringCountHandlers.test.ts
 *
 * Tests for the useStringCountHandlers hook, specifically:
 * - Warning message timeout management
 * - Cleanup on unmount to prevent memory leaks
 * - Timeout cancellation when clearing warning manually
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStringCountHandlers } from '../useStringCountHandlers';
import type { StringCount, SelectedDotsMap } from '../../types/fretboardTypes';

// Mock the validation utilities
vi.mock('../../utils/stringCountValidation', () => ({
  hasDotsOnHiddenStrings: vi.fn(),
  getStringCountWarningMessage: vi.fn(),
  getStringCountTooltipMessage: vi.fn(),
}));

import {
  hasDotsOnHiddenStrings,
  getStringCountWarningMessage,
} from '../../utils/stringCountValidation';

describe('useStringCountHandlers', () => {
  const mockSetStringCount = vi.fn();

  const defaultProps = {
    currentStringCount: 4 as StringCount,
    selectedDots: new Map() as SelectedDotsMap,
    setStringCount: mockSetStringCount,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // TEST SUITE: Warning Message Timeout Management
  // ==========================================================================
  describe('Warning Message Timeout Management', () => {
    it('should set warning message when trying to hide strings with dots', () => {
      // Mock that there are dots on hidden strings
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage).mockReturnValue(
        'Cannot hide strings with dots',
      );

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });

      expect(result.current.warningMessage).toBe(
        'Cannot hide strings with dots',
      );
      expect(mockSetStringCount).not.toHaveBeenCalled();
    });

    it('should auto-hide warning after 5 seconds', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage).mockReturnValue(
        'Warning message',
      );

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });

      expect(result.current.warningMessage).toBe('Warning message');

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.warningMessage).toBeNull();
    });

    it('should cancel previous timeout when setting new warning', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage)
        .mockReturnValueOnce('First warning')
        .mockReturnValueOnce('Second warning');

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      // First warning
      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });
      expect(result.current.warningMessage).toBe('First warning');

      // Advance 3 seconds (not enough to clear first warning)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Second warning (should cancel first timeout)
      act(() => {
        result.current.handleStringCountChangeWithValidation(6);
      });
      expect(result.current.warningMessage).toBe('Second warning');

      // Advance 3 more seconds (6 total from first, but only 3 from second)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Warning should still be visible (second timeout hasn't expired)
      expect(result.current.warningMessage).toBe('Second warning');

      // Advance 2 more seconds (5 total from second warning)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Now warning should be cleared
      expect(result.current.warningMessage).toBeNull();
    });
  });

  // ==========================================================================
  // TEST SUITE: Cleanup on Unmount
  // ==========================================================================
  describe('Cleanup on Unmount', () => {
    it('should cancel timeout when component unmounts', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage).mockReturnValue(
        'Warning message',
      );

      const { result, unmount } = renderHook(() =>
        useStringCountHandlers(defaultProps),
      );

      // Trigger warning with timeout
      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });

      expect(result.current.warningMessage).toBe('Warning message');

      // Unmount before timeout expires
      unmount();

      // Advance time past the timeout
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // No errors should occur - timeout was cleaned up
      // (If timeout wasn't cleaned, it would try to update state on unmounted component)
    });

    it('should not leak timers across multiple mounts/unmounts', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage).mockReturnValue('Warning');

      // First mount
      const { result: result1, unmount: unmount1 } = renderHook(() =>
        useStringCountHandlers(defaultProps),
      );

      act(() => {
        result1.current.handleStringCountChangeWithValidation(5);
      });

      unmount1();

      // Second mount
      const { result: result2, unmount: unmount2 } = renderHook(() =>
        useStringCountHandlers(defaultProps),
      );

      act(() => {
        result2.current.handleStringCountChangeWithValidation(5);
      });

      // Advance time - only second hook's timeout should fire
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result2.current.warningMessage).toBeNull();

      unmount2();
    });
  });

  // ==========================================================================
  // TEST SUITE: Manual Warning Clearing
  // ==========================================================================
  describe('Manual Warning Clearing', () => {
    it('should clear warning and cancel timeout when clearWarningMessage is called', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(true);
      vi.mocked(getStringCountWarningMessage).mockReturnValue(
        'Warning message',
      );

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      // Trigger warning
      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });

      expect(result.current.warningMessage).toBe('Warning message');

      // Manually clear warning
      act(() => {
        result.current.clearWarningMessage();
      });

      expect(result.current.warningMessage).toBeNull();

      // Advance time past original timeout
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Warning should still be null (timeout was cancelled)
      expect(result.current.warningMessage).toBeNull();
    });

    it('should handle clearWarningMessage when no warning is active', () => {
      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      // Clear when no warning is set
      act(() => {
        result.current.clearWarningMessage();
      });

      expect(result.current.warningMessage).toBeNull();
    });
  });

  // ==========================================================================
  // TEST SUITE: Valid String Count Changes
  // ==========================================================================
  describe('Valid String Count Changes', () => {
    it('should update string count when no dots would be hidden', () => {
      vi.mocked(hasDotsOnHiddenStrings).mockReturnValue(false);

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });

      expect(mockSetStringCount).toHaveBeenCalledWith(5);
      expect(result.current.warningMessage).toBeNull();
    });

    it('should clear existing warning when valid change is made', () => {
      // First call returns true (would hide dots)
      // Second call returns false (safe to change)
      vi.mocked(hasDotsOnHiddenStrings)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      vi.mocked(getStringCountWarningMessage).mockReturnValue('Warning');

      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      // First attempt - blocked with warning
      act(() => {
        result.current.handleStringCountChangeWithValidation(5);
      });
      expect(result.current.warningMessage).toBe('Warning');

      // Second attempt - allowed
      act(() => {
        result.current.handleStringCountChangeWithValidation(6);
      });
      expect(result.current.warningMessage).toBeNull();
      expect(mockSetStringCount).toHaveBeenCalledWith(6);
    });

    it('should not do anything when string count is unchanged', () => {
      const { result } = renderHook(() => useStringCountHandlers(defaultProps));

      act(() => {
        result.current.handleStringCountChangeWithValidation(4); // Same as current
      });

      expect(hasDotsOnHiddenStrings).not.toHaveBeenCalled();
      expect(mockSetStringCount).not.toHaveBeenCalled();
    });
  });
});
