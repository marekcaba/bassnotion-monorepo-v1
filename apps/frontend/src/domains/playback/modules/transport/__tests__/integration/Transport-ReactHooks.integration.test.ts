/**
 * Phase 3.3: Transport ↔ React Hooks Integration Tests
 *
 * Tests integration between TransportController and React hooks that
 * widgets use to subscribe to transport updates:
 *
 * Integration Points:
 * 1. useTransportPosition - Direct EventBus subscription for position updates
 * 2. useTransportSync - WidgetSyncManager integration for widget synchronization
 * 3. Event propagation from TransportController → EventBus → React hooks
 * 4. Cleanup and memory leak prevention on unmount
 * 5. Multiple hook instances (multiple widgets)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransportPosition } from '../../../../../widgets/hooks/useTransportPosition.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { TransportPosition } from '../../../../../widgets/hooks/useTransportPosition.js';

// Mock WidgetSyncManager for useTransportSync tests
vi.mock('../../../../modules/transport/sync/WidgetSyncManager.js', () => ({
  WidgetSyncManager: {
    getInstance: vi.fn(() => ({
      registerClient: vi.fn(),
      unregisterClient: vi.fn(),
      acknowledgeHeartbeat: vi.fn(),
      forceSync: vi.fn(),
      getMetrics: vi.fn(() => ({})),
      on: vi.fn(() => vi.fn()),
      off: vi.fn(),
    })),
  },
}));

// Simple EventBus mock implementation
class MockEventBus implements EventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}

describe('Phase 3.3: Transport ↔ React Hooks Integration', () => {
  let eventBus: MockEventBus;

  beforeEach(() => {
    eventBus = new MockEventBus();

    // Mock window.__coreServices to provide EventBus
    (window as any).__coreServices = {
      getEventBus: () => eventBus,
    };
  });

  afterEach(() => {
    // Cleanup
    delete (window as any).__coreServices;
    eventBus.removeAllListeners();
  });

  describe('Integration 1: useTransportPosition Hook', () => {
    it('should subscribe to transport:position-updated events', () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: true,
        }),
      );

      // Verify subscription
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);
    });

    it('should receive position updates from EventBus', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: true,
        }),
      );

      // Emit position update
      const position: TransportPosition = {
        bars: 1,
        beats: 2,
        sixteenths: 3,
        ticks: 0,
        seconds: 1.5,
      };

      eventBus.emit('transport:position-updated', { position });

      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalledWith(position);
      });
    });

    it('should handle position data wrapped in position property', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: true,
        }),
      );

      // Emit with wrapped position
      const position: TransportPosition = {
        bars: 2,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
        seconds: 2.0,
      };

      eventBus.emit('transport:position-updated', { position });

      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalledWith(position);
      });
    });

    it('should unsubscribe on unmount', () => {
      const onPositionUpdate = vi.fn();

      const { unmount } = renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: true,
        }),
      );

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);

      unmount();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should not subscribe when enabled=false', () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: false,
        }),
      );

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should handle rapid position updates without missing any', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({
          onPositionUpdate,
          enabled: true,
        }),
      );

      // Emit multiple rapid updates
      const positions: TransportPosition[] = [
        { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 1.0 },
        { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 1.5 },
        { bars: 1, beats: 2, sixteenths: 0, ticks: 0, seconds: 2.0 },
      ];

      positions.forEach((position) => {
        eventBus.emit('transport:position-updated', { position });
      });

      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalledTimes(3);
      });
    });

    it('should update callback ref without resubscribing', async () => {
      const onPositionUpdate1 = vi.fn();
      const onPositionUpdate2 = vi.fn();

      const { rerender } = renderHook(
        ({ callback }) =>
          useTransportPosition({
            onPositionUpdate: callback,
            enabled: true,
          }),
        {
          initialProps: { callback: onPositionUpdate1 },
        },
      );

      // Emit with first callback
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 1.0 },
      });

      await waitFor(() => {
        expect(onPositionUpdate1).toHaveBeenCalled();
      });

      // Update callback
      rerender({ callback: onPositionUpdate2 });

      // Emit with second callback
      eventBus.emit('transport:position-updated', {
        position: { bars: 2, beats: 0, sixteenths: 0, ticks: 0, seconds: 2.0 },
      });

      await waitFor(() => {
        expect(onPositionUpdate2).toHaveBeenCalled();
      });

      // Should still have only one subscription
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);
    });
  });

  describe('Integration 2: Multiple Hook Instances', () => {
    it('should support multiple useTransportPosition hooks simultaneously', async () => {
      const onPositionUpdate1 = vi.fn();
      const onPositionUpdate2 = vi.fn();
      const onPositionUpdate3 = vi.fn();

      // Render 3 hooks (simulating 3 widgets)
      renderHook(() =>
        useTransportPosition({ onPositionUpdate: onPositionUpdate1 }),
      );
      renderHook(() =>
        useTransportPosition({ onPositionUpdate: onPositionUpdate2 }),
      );
      renderHook(() =>
        useTransportPosition({ onPositionUpdate: onPositionUpdate3 }),
      );

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(3);

      // Emit position update
      const position: TransportPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
        seconds: 1.0,
      };

      eventBus.emit('transport:position-updated', { position });

      await waitFor(() => {
        expect(onPositionUpdate1).toHaveBeenCalledWith(position);
        expect(onPositionUpdate2).toHaveBeenCalledWith(position);
        expect(onPositionUpdate3).toHaveBeenCalledWith(position);
      });
    });

    it('should handle partial unmounting without affecting other hooks', async () => {
      const onPositionUpdate1 = vi.fn();
      const onPositionUpdate2 = vi.fn();

      const hook1 = renderHook(() =>
        useTransportPosition({ onPositionUpdate: onPositionUpdate1 }),
      );
      renderHook(() =>
        useTransportPosition({ onPositionUpdate: onPositionUpdate2 }),
      );

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(2);

      // Unmount first hook
      hook1.unmount();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);

      // Second hook should still receive updates
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 1.0 },
      });

      await waitFor(() => {
        expect(onPositionUpdate1).not.toHaveBeenCalled();
        expect(onPositionUpdate2).toHaveBeenCalled();
      });
    });
  });

  describe('Integration 3: Event Propagation Flow', () => {
    it('should propagate events: Transport → EventBus → Hook', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({ onPositionUpdate, enabled: true }),
      );

      // Simulate TransportController emitting event
      const transportPosition: TransportPosition = {
        bars: 2,
        beats: 3,
        sixteenths: 1,
        ticks: 0,
        seconds: 2.5,
      };

      // Transport emits to EventBus
      eventBus.emit('transport:position-updated', {
        position: transportPosition,
      });

      // Hook should receive update
      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalledWith(transportPosition);
      });
    });

    it('should handle high-frequency updates (50ms interval simulation)', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({ onPositionUpdate, enabled: true }),
      );

      // Simulate 10 position updates at 50ms interval
      const updateCount = 10;
      for (let i = 0; i < updateCount; i++) {
        eventBus.emit('transport:position-updated', {
          position: {
            bars: 1,
            beats: 0,
            sixteenths: i,
            ticks: 0,
            seconds: i * 0.05,
          },
        });
      }

      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalledTimes(updateCount);
      });
    });
  });

  describe('Integration 4: Error Handling', () => {
    it('should handle missing CoreServices gracefully', () => {
      delete (window as any).__coreServices;

      const onPositionUpdate = vi.fn();

      // Should not throw
      expect(() => {
        renderHook(() =>
          useTransportPosition({ onPositionUpdate, enabled: true }),
        );
      }).not.toThrow();

      // Should not subscribe
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should handle malformed position data gracefully', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({ onPositionUpdate, enabled: true }),
      );

      // Emit malformed data (missing bars property)
      eventBus.emit('transport:position-updated', {
        position: { beats: 1 },
      });

      // Should not call callback with invalid data
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onPositionUpdate).not.toHaveBeenCalled();
    });

    it('should handle null/undefined position data', async () => {
      const onPositionUpdate = vi.fn();

      renderHook(() =>
        useTransportPosition({ onPositionUpdate, enabled: true }),
      );

      eventBus.emit('transport:position-updated', null);
      eventBus.emit('transport:position-updated', undefined);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onPositionUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Integration 5: Memory Leak Prevention', () => {
    it('should not leak listeners after multiple mount/unmount cycles', () => {
      const onPositionUpdate = vi.fn();

      // Mount and unmount 10 times
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() =>
          useTransportPosition({ onPositionUpdate }),
        );
        unmount();
      }

      // Should have no listeners
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should clean up when enabled toggles false', () => {
      const onPositionUpdate = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) => useTransportPosition({ onPositionUpdate, enabled }),
        { initialProps: { enabled: true } },
      );

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);

      // Disable hook
      rerender({ enabled: false });

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should resubscribe when enabled toggles back to true', async () => {
      const onPositionUpdate = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) => useTransportPosition({ onPositionUpdate, enabled }),
        { initialProps: { enabled: true } },
      );

      // Disable
      rerender({ enabled: false });
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);

      // Re-enable
      rerender({ enabled: true });
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);

      // Should receive updates again
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 1.0 },
      });

      await waitFor(() => {
        expect(onPositionUpdate).toHaveBeenCalled();
      });
    });
  });
});
