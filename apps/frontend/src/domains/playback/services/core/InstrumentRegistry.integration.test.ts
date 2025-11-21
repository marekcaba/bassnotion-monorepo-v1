import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { EventBus } from './EventBus.js';

/**
 * Integration tests for InstrumentRegistry with EventBus
 * These tests focus on the interaction between InstrumentRegistry and EventBus
 * without requiring the full CoreServices stack
 */
describe('InstrumentRegistry Integration', () => {
  let registry: InstrumentRegistry;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    registry = new InstrumentRegistry(eventBus);
  });

  describe('EventBus integration', () => {
    it('should emit events through EventBus when instruments are registered', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      // Multiple listeners on the same event
      eventBus.on('instrument:registered', listener1);
      eventBus.on('instrument:registered', listener2);

      const mockDrums = { id: 'test-drums' };
      registry.setActive('drums', mockDrums);

      // Both listeners should receive the event
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      // Verify the event payload
      const eventData = listener1.mock.calls[0][0];
      expect(eventData).toMatchObject({
        type: 'drums',
        instrument: mockDrums,
      });
    });

    it('should handle multiple instrument types through EventBus', () => {
      const events: any[] = [];
      eventBus.on('instrument:registered', (data) => events.push(data));

      // Register multiple instruments
      registry.setActive('drums', { id: 'drums' });
      registry.setActive('bass', { id: 'bass' });
      registry.setActive('harmony', { id: 'harmony' });
      registry.setActive('metronome', { id: 'metronome' });

      // Should receive 4 events
      expect(events).toHaveLength(4);

      // Verify each event
      expect(events[0]).toMatchObject({ type: 'drums' });
      expect(events[1]).toMatchObject({ type: 'bass' });
      expect(events[2]).toMatchObject({ type: 'harmony' });
      expect(events[3]).toMatchObject({ type: 'metronome' });
    });

    it('should properly emit replaced events', () => {
      const registeredEvents: any[] = [];
      const replacedEvents: any[] = [];

      eventBus.on('instrument:registered', (data) => registeredEvents.push(data));
      eventBus.on('instrument:replaced', (data) => replacedEvents.push(data));

      const instrument1 = { id: 'first' };
      const instrument2 = { id: 'second' };

      // First registration
      registry.setActive('drums', instrument1);
      expect(registeredEvents).toHaveLength(1);
      expect(replacedEvents).toHaveLength(0);

      // Replacement
      registry.setActive('drums', instrument2);
      expect(registeredEvents).toHaveLength(2);
      expect(replacedEvents).toHaveLength(1);

      // Verify replacement event
      expect(replacedEvents[0]).toMatchObject({
        type: 'drums',
        previous: instrument1,
        current: instrument2,
      });
    });

    it('should emit removed events when clearing', () => {
      const removedEvents: any[] = [];
      eventBus.on('instrument:removed', (data) => removedEvents.push(data));

      // Register some instruments
      registry.setActive('drums', { id: 'drums' });
      registry.setActive('bass', { id: 'bass' });

      // Clear all
      registry.clearAll();

      // Should receive 2 removal events
      expect(removedEvents).toHaveLength(2);
      expect(removedEvents[0]).toMatchObject({ type: 'drums' });
      expect(removedEvents[1]).toMatchObject({ type: 'bass' });
    });

    it('should unsubscribe correctly from EventBus', () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on('instrument:registered', listener);

      // Register with listener active
      registry.setActive('drums', { id: 'drums' });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Register after unsubscribe
      registry.setActive('bass', { id: 'bass' });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('Cross-component communication', () => {
    it('should allow components to discover active instruments', () => {
      // Simulate a widget registering its instrument
      const widgetInstrument = {
        id: 'wam-drums',
        play: vi.fn(),
        stop: vi.fn(),
      };

      // Widget registers
      registry.setActive('drums', widgetInstrument);

      // Another component discovers it
      const discoveredInstrument = registry.getActive('drums');
      expect(discoveredInstrument).toBe(widgetInstrument);

      // Can use the discovered instrument
      discoveredInstrument?.play();
      expect(widgetInstrument.play).toHaveBeenCalled();
    });

    it('should handle race conditions gracefully', () => {
      const events: any[] = [];
      eventBus.on('instrument:registered', (data) => events.push(data));

      // Simulate rapid concurrent registrations
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            registry.setActive('drums', { id: `drums-${i}` });
          })
        );
      }

      // Wait for all
      return Promise.all(promises).then(() => {
        // Should have received all events
        expect(events).toHaveLength(10);

        // Final state should be the last one
        const finalInstrument = registry.getActive('drums');
        expect(finalInstrument?.id).toMatch(/drums-\d/);
      });
    });

    it('should support dynamic instrument discovery pattern', () => {
      // Component A listens for instruments
      const discoveredInstruments = new Map<string, any>();
      eventBus.on('instrument:registered', (data: any) => {
        discoveredInstruments.set(data.type, data.instrument);
      });

      // Component B registers instruments
      registry.setActive('drums', { id: 'drums' });
      registry.setActive('bass', { id: 'bass' });

      // Component A should have discovered them
      expect(discoveredInstruments.has('drums')).toBe(true);
      expect(discoveredInstruments.has('bass')).toBe(true);
      expect(discoveredInstruments.get('drums')).toEqual({ id: 'drums' });
      expect(discoveredInstruments.get('bass')).toEqual({ id: 'bass' });
    });
  });

  describe('Error scenarios', () => {
    it('should not break EventBus when registering null', () => {
      const listener = vi.fn();
      eventBus.on('instrument:registered', listener);

      // Try to register null
      registry.setActive('drums', null);

      // Listener should not have been called
      expect(listener).not.toHaveBeenCalled();

      // Registry should still work
      registry.setActive('drums', { id: 'valid' });
      expect(listener).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      // Add a listener that throws
      eventBus.on('instrument:registered', () => {
        throw new Error('Listener error');
      });

      // Add a normal listener
      const goodListener = vi.fn();
      eventBus.on('instrument:registered', goodListener);

      // Should not throw
      expect(() => {
        registry.setActive('drums', { id: 'drums' });
      }).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle many instruments efficiently', () => {
      const startTime = performance.now();

      // Register 100 instruments
      for (let i = 0; i < 100; i++) {
        registry.setActive('drums', { id: `drums-${i}` });
      }

      const duration = performance.now() - startTime;

      // Should be fast (less than 100ms for 100 operations)
      expect(duration).toBeLessThan(100);

      // Final state should be correct
      expect(registry.getActive('drums')).toEqual({ id: 'drums-99' });
    });

    it('should handle many listeners efficiently', () => {
      const listeners = [];

      // Add 100 listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        eventBus.on('instrument:registered', listener);
      }

      // Register an instrument
      registry.setActive('drums', { id: 'drums' });

      // All listeners should be called
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalled();
      });
    });
  });
});