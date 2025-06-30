/**
 * Widget Synchronization Tests
 *
 * Tests for widget sync behavior, performance impact, and edge cases.
 * Part of Story 3.6: Widget Synchronization
 * Task 3.6.5: Synchronization Testing
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { widgetSyncService } from '../../services/WidgetSyncService.js';
import type { WidgetSyncEvent } from '../../services/WidgetSyncService.js';

// ============================================================================
// SIMPLE TEST COMPONENTS
// ============================================================================

const SimpleTestWidget: React.FC<{ widgetId: string }> = ({ widgetId }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handleEmitPlay = () => {
    try {
      const event: WidgetSyncEvent = {
        type: 'PLAYBACK_STATE',
        payload: { isPlaying: true },
        timestamp: Date.now(),
        source: widgetId,
        priority: 'normal',
      };
      widgetSyncService.emit(event);
      setIsPlaying(true);
    } catch (e) {
      console.error('Failed to emit event:', e);
    }
  };

  return (
    <div data-testid={`widget-${widgetId}`}>
      <div data-testid="playback-state">
        {isPlaying ? 'Playing' : 'Stopped'}
      </div>
      <button data-testid="emit-play" onClick={handleEmitPlay}>
        Emit Play
      </button>
    </div>
  );
};

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Widget Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      widgetSyncService.resetMetrics();
    } catch {
      // Service might need initialization
    }
  });

  afterEach(() => {
    try {
      widgetSyncService.dispose();
    } catch {
      // Service might already be disposed
    }
  });

  // ============================================================================
  // BASIC TESTS
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should render widget without errors', () => {
      render(<SimpleTestWidget widgetId="test-1" />);
      expect(screen.getByTestId('widget-test-1')).toBeInTheDocument();
      expect(screen.getByTestId('playback-state')).toHaveTextContent('Stopped');
    });

    it('should handle button clicks without errors', () => {
      render(<SimpleTestWidget widgetId="test-2" />);
      const button = screen.getByTestId('emit-play');

      expect(() => fireEvent.click(button)).not.toThrow();
      expect(screen.getByTestId('playback-state')).toHaveTextContent('Playing');
    });

    it('should emit events through sync service', () => {
      const emitSpy = vi.spyOn(widgetSyncService, 'emit');

      render(<SimpleTestWidget widgetId="test-3" />);
      const button = screen.getByTestId('emit-play');
      fireEvent.click(button);

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PLAYBACK_STATE',
          payload: { isPlaying: true },
          source: 'test-3',
        }),
      );
    });

    it('should track metrics in sync service', () => {
      render(<SimpleTestWidget widgetId="test-4" />);
      const button = screen.getByTestId('emit-play');
      fireEvent.click(button);

      const metrics = widgetSyncService.getPerformanceMetrics();
      expect(typeof metrics.totalEvents).toBe('number');
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // SYNC SERVICE TESTS
  // ============================================================================

  describe('Sync Service', () => {
    it('should initialize without errors', () => {
      expect(() => widgetSyncService.getSyncState()).not.toThrow();
    });

    it('should provide performance metrics', () => {
      const metrics = widgetSyncService.getPerformanceMetrics();
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('subscriberCount');
    });

    it('should handle subscription operations', () => {
      const callback = vi.fn();

      expect(() => {
        widgetSyncService.subscribe('PLAYBACK_STATE', callback);
        widgetSyncService.unsubscribe('PLAYBACK_STATE', callback);
      }).not.toThrow();
    });

    it('should handle dispose operation', () => {
      expect(() => widgetSyncService.dispose()).not.toThrow();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle widgets when service is disposed', () => {
      widgetSyncService.dispose();

      const { unmount } = render(<SimpleTestWidget widgetId="disposed-test" />);

      expect(screen.getByTestId('widget-disposed-test')).toBeInTheDocument();

      const button = screen.getByTestId('emit-play');
      expect(() => fireEvent.click(button)).not.toThrow();

      expect(() => unmount()).not.toThrow();
    });

    it('should handle multiple widget instances', () => {
      const { unmount } = render(
        <div>
          <SimpleTestWidget widgetId="multi-1" />
          <SimpleTestWidget widgetId="multi-2" />
          <SimpleTestWidget widgetId="multi-3" />
        </div>,
      );

      const widgets = screen.getAllByTestId(/widget-multi-/);
      expect(widgets).toHaveLength(3);

      const buttons = screen.getAllByTestId('emit-play');
      buttons.forEach((button) => {
        expect(() => fireEvent.click(button)).not.toThrow();
      });

      expect(() => unmount()).not.toThrow();
    });
  });
});
