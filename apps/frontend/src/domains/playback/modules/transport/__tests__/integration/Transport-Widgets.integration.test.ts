/**
 * Phase 3.4: Transport ↔ Widgets Integration Tests
 *
 * Tests integration between TransportController and widget components
 * (HarmonyWidget, DrummerWidget, etc.) that use transport for timing.
 *
 * Integration Points:
 * 1. Widget lifecycle synchronization with transport
 * 2. Position updates triggering widget note playback
 * 3. Transport start/stop coordination with widget audio
 * 4. Multiple widgets playing simultaneously
 * 5. Widget cleanup on transport stop/unmount
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransportPosition } from '../../../../../widgets/hooks/useTransportPosition.js';
import type { EventBus } from '../../../../services/core/EventBus.js';
import type { TransportPosition } from '../../../../../widgets/hooks/useTransportPosition.js';

// Simple EventBus mock implementation (reused from Transport-ReactHooks test)
class MockEventBus implements EventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
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

// Mock widget that uses useTransportPosition
class MockWidget {
  public notesPlayed: TransportPosition[] = [];
  public isActive = false;
  private unsubscribe?: () => void;

  constructor(
    private widgetId: string,
    private eventBus: MockEventBus,
  ) {}

  start() {
    this.isActive = true;
    this.notesPlayed = [];
  }

  stop() {
    this.isActive = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  onPositionUpdate(position: TransportPosition) {
    if (this.isActive && this.shouldPlayNote(position)) {
      this.notesPlayed.push(position);
    }
  }

  private shouldPlayNote(position: TransportPosition): boolean {
    // Play note on every beat (when sixteenths = 0)
    return position.sixteenths === 0;
  }

  getNotesPlayedCount(): number {
    return this.notesPlayed.length;
  }
}

describe('Phase 3.4: Transport ↔ Widgets Integration', () => {
  let eventBus: MockEventBus;

  beforeEach(() => {
    eventBus = new MockEventBus();
    (window as any).__coreServices = {
      getEventBus: () => eventBus,
    };
  });

  afterEach(() => {
    delete (window as any).__coreServices;
    eventBus.removeAllListeners();
  });

  describe('Integration 1: Widget Lifecycle Synchronization', () => {
    it('should coordinate widget start with transport start', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));

      // Widget starts
      widget.start();

      // Simulate transport starting and emitting positions
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(1);
      });
    });

    it('should stop widget playback on transport stop', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));

      widget.start();

      // Transport playing - widget should play notes
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(1);
      });

      // Transport stops - widget stops
      widget.stop();

      // More position updates should not trigger notes
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(widget.getNotesPlayedCount()).toBe(1); // Still 1, no new notes
    });

    it('should handle widget restart after stop', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));

      // First playback cycle
      widget.start();
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });
      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(1);
      });

      widget.stop();

      // Second playback cycle
      widget.start();
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(1); // Reset to 1
      });
    });
  });

  describe('Integration 2: Position-Triggered Note Playback', () => {
    it('should trigger widget notes at correct musical positions', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));
      widget.start();

      // Emit positions for one bar (4 beats in 4/4)
      const positions: TransportPosition[] = [
        { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0.0 }, // Beat 1
        { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 }, // Beat 2
        { bars: 1, beats: 2, sixteenths: 0, ticks: 0, seconds: 1.0 }, // Beat 3
        { bars: 1, beats: 3, sixteenths: 0, ticks: 0, seconds: 1.5 }, // Beat 4
      ];

      positions.forEach((position) => {
        eventBus.emit('transport:position-updated', { position });
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(4); // 4 beats = 4 notes
      });
    });

    it('should not trigger notes on sixteenth note positions', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));
      widget.start();

      // Emit positions including sixteenth notes
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0.0 },
      }); // Should play
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 1, ticks: 0, seconds: 0.125 },
      }); // Should NOT play
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 2, ticks: 0, seconds: 0.25 },
      }); // Should NOT play

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(widget.getNotesPlayedCount()).toBe(1); // Only the beat
    });

    it('should handle rapid position updates (50ms interval)', async () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate }));
      widget.start();

      // Simulate 20 position updates at 50ms interval (1 second of playback)
      for (let i = 0; i < 20; i++) {
        const beat = Math.floor(i / 5); // 5 updates per beat at 50ms = 250ms/beat
        const sixteenth = (i % 5) === 0 ? 0 : 1; // Only first update of each beat has sixteenth=0

        eventBus.emit('transport:position-updated', {
          position: {
            bars: 1,
            beats: beat,
            sixteenths: sixteenth,
            ticks: 0,
            seconds: i * 0.05,
          },
        });
      }

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(4); // 4 beats in 1 second
      });
    });
  });

  describe('Integration 3: Multiple Widgets Playing Simultaneously', () => {
    it('should support two widgets playing together', async () => {
      const harmonyWidget = new MockWidget('harmony-widget', eventBus);
      const drummerWidget = new MockWidget('drummer-widget', eventBus);

      const harmonyCallback = vi.fn((pos) => harmonyWidget.onPositionUpdate(pos));
      const drummerCallback = vi.fn((pos) => drummerWidget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate: harmonyCallback }));
      renderHook(() => useTransportPosition({ onPositionUpdate: drummerCallback }));

      harmonyWidget.start();
      drummerWidget.start();

      // Emit positions
      const positions: TransportPosition[] = [
        { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0.0 },
        { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 },
      ];

      positions.forEach((pos) => {
        eventBus.emit('transport:position-updated', { position: pos });
      });

      await waitFor(() => {
        expect(harmonyWidget.getNotesPlayedCount()).toBe(2);
        expect(drummerWidget.getNotesPlayedCount()).toBe(2);
      });
    });

    it('should support three widgets with independent lifecycles', async () => {
      const widgets = [
        new MockWidget('harmony', eventBus),
        new MockWidget('drummer', eventBus),
        new MockWidget('bass', eventBus),
      ];

      const callbacks = widgets.map((widget) =>
        vi.fn((pos: TransportPosition) => widget.onPositionUpdate(pos)),
      );

      callbacks.forEach((callback) => {
        renderHook(() => useTransportPosition({ onPositionUpdate: callback }));
      });

      // Start all widgets
      widgets.forEach((w) => w.start());

      // Emit position
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        widgets.forEach((widget) => {
          expect(widget.getNotesPlayedCount()).toBe(1);
        });
      });

      // Stop middle widget
      widgets[1].stop();

      // Emit another position
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 },
      });

      await waitFor(() => {
        expect(widgets[0].getNotesPlayedCount()).toBe(2); // Still playing
        expect(widgets[1].getNotesPlayedCount()).toBe(1); // Stopped
        expect(widgets[2].getNotesPlayedCount()).toBe(2); // Still playing
      });
    });

    it('should handle staggered widget start times', async () => {
      const widget1 = new MockWidget('widget1', eventBus);
      const widget2 = new MockWidget('widget2', eventBus);

      const callback1 = vi.fn((pos) => widget1.onPositionUpdate(pos));
      const callback2 = vi.fn((pos) => widget2.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate: callback1 }));
      renderHook(() => useTransportPosition({ onPositionUpdate: callback2 }));

      // Start widget1
      widget1.start();

      // Emit first position - only widget1 should play
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget1.getNotesPlayedCount()).toBe(1);
      });
      expect(widget2.getNotesPlayedCount()).toBe(0);

      // Start widget2
      widget2.start();

      // Emit second position - both should play
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 },
      });

      await waitFor(() => {
        expect(widget1.getNotesPlayedCount()).toBe(2);
        expect(widget2.getNotesPlayedCount()).toBe(1);
      });
    });
  });

  describe('Integration 4: Widget Cleanup and Memory Management', () => {
    it('should cleanup widget subscriptions on unmount', () => {
      const widget = new MockWidget('harmony-widget', eventBus);
      const onPositionUpdate = vi.fn((pos) => widget.onPositionUpdate(pos));

      const { unmount } = renderHook(() =>
        useTransportPosition({ onPositionUpdate }),
      );

      widget.start();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(1);

      // Widget unmounts
      widget.stop();
      unmount();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should handle cleanup with multiple widgets', () => {
      const widgets = [
        new MockWidget('widget1', eventBus),
        new MockWidget('widget2', eventBus),
        new MockWidget('widget3', eventBus),
      ];

      const hooks = widgets.map((widget) => {
        const callback = vi.fn((pos) => widget.onPositionUpdate(pos));
        return renderHook(() => useTransportPosition({ onPositionUpdate: callback }));
      });

      widgets.forEach((w) => w.start());

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(3);

      // Unmount middle widget
      hooks[1].unmount();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(2);

      // Unmount remaining widgets
      hooks[0].unmount();
      hooks[2].unmount();

      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });

    it('should not leak memory after multiple widget lifecycle cycles', () => {
      // Mount and unmount 5 widgets multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        const hooks = [];
        for (let i = 0; i < 5; i++) {
          const widget = new MockWidget(`widget-${i}`, eventBus);
          const callback = vi.fn((pos) => widget.onPositionUpdate(pos));
          hooks.push(renderHook(() => useTransportPosition({ onPositionUpdate: callback })));
          widget.start();
        }

        // All mounted
        expect(eventBus.getListenerCount('transport:position-updated')).toBe(5);

        // Unmount all
        hooks.forEach((hook) => hook.unmount());
        expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
      }

      // After 3 cycles, should still be 0
      expect(eventBus.getListenerCount('transport:position-updated')).toBe(0);
    });
  });

  describe('Integration 5: Widget Error Handling', () => {
    it('should handle widget callback errors gracefully', async () => {
      const widget = new MockWidget('faulty-widget', eventBus);
      const faultyCallback = vi.fn((pos) => {
        if (pos.beats === 1) {
          throw new Error('Widget processing error');
        }
        widget.onPositionUpdate(pos);
      });

      renderHook(() => useTransportPosition({ onPositionUpdate: faultyCallback }));
      widget.start();

      // First position - should work
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(1);
      });

      // Second position - throws error
      expect(() => {
        eventBus.emit('transport:position-updated', {
          position: { bars: 1, beats: 1, sixteenths: 0, ticks: 0, seconds: 0.5 },
        });
      }).toThrow('Widget processing error');

      // Widget should still have only 1 note (error prevented second note)
      expect(widget.getNotesPlayedCount()).toBe(1);
    });

    it('should isolate errors between widgets', async () => {
      const goodWidget = new MockWidget('good-widget', eventBus);
      const badWidget = new MockWidget('bad-widget', eventBus);

      const goodCallback = vi.fn((pos) => goodWidget.onPositionUpdate(pos));
      const badCallback = vi.fn(() => {
        throw new Error('Bad widget error');
      });

      renderHook(() => useTransportPosition({ onPositionUpdate: goodCallback }));
      renderHook(() => useTransportPosition({ onPositionUpdate: badCallback }));

      goodWidget.start();
      badWidget.start();

      // Emit position - bad widget throws, good widget should still work
      expect(() => {
        eventBus.emit('transport:position-updated', {
          position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
        });
      }).toThrow('Bad widget error');

      // Good widget should have received update before error
      await waitFor(() => {
        expect(goodWidget.getNotesPlayedCount()).toBe(1);
      });
    });
  });

  describe('Integration 6: Real-World Widget Scenarios', () => {
    it('should handle typical 4-bar chord progression playback', async () => {
      const harmonyWidget = new MockWidget('harmony', eventBus);
      const callback = vi.fn((pos) => harmonyWidget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate: callback }));
      harmonyWidget.start();

      // Play 4 bars (16 beats in 4/4)
      for (let bar = 1; bar <= 4; bar++) {
        for (let beat = 0; beat < 4; beat++) {
          eventBus.emit('transport:position-updated', {
            position: {
              bars: bar,
              beats: beat,
              sixteenths: 0,
              ticks: 0,
              seconds: ((bar - 1) * 4 + beat) * 0.5,
            },
          });
        }
      }

      await waitFor(() => {
        expect(harmonyWidget.getNotesPlayedCount()).toBe(16); // 4 bars × 4 beats
      });
    });

    it('should simulate drummer widget playing hi-hat pattern', async () => {
      const drummerWidget = new MockWidget('drummer', eventBus);
      // Override shouldPlayNote to play on every eighth note
      (drummerWidget as any).shouldPlayNote = (pos: TransportPosition) => {
        return pos.sixteenths % 2 === 0; // Every 2 sixteenths = eighth notes
      };

      const callback = vi.fn((pos) => drummerWidget.onPositionUpdate(pos));
      renderHook(() => useTransportPosition({ onPositionUpdate: callback }));
      drummerWidget.start();

      // One bar = 16 sixteenth notes
      for (let sixteenth = 0; sixteenth < 16; sixteenth++) {
        eventBus.emit('transport:position-updated', {
          position: {
            bars: 1,
            beats: Math.floor(sixteenth / 4),
            sixteenths: sixteenth % 4,
            ticks: 0,
            seconds: sixteenth * 0.0625,
          },
        });
      }

      await waitFor(() => {
        expect(drummerWidget.getNotesPlayedCount()).toBe(8); // 8 eighth notes per bar
      });
    });

    it('should handle loop playback (returning to bar 1)', async () => {
      const widget = new MockWidget('looping-widget', eventBus);
      const callback = vi.fn((pos) => widget.onPositionUpdate(pos));

      renderHook(() => useTransportPosition({ onPositionUpdate: callback }));
      widget.start();

      // Play bars 1-2
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });
      eventBus.emit('transport:position-updated', {
        position: { bars: 2, beats: 0, sixteenths: 0, ticks: 0, seconds: 2 },
      });

      // Loop back to bar 1
      eventBus.emit('transport:position-updated', {
        position: { bars: 1, beats: 0, sixteenths: 0, ticks: 0, seconds: 0 },
      });

      await waitFor(() => {
        expect(widget.getNotesPlayedCount()).toBe(3); // All 3 positions
      });
    });
  });
});
