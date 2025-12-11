import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstrumentRegistry } from './InstrumentRegistry.js';
import { EventBus } from './EventBus.js';

describe('InstrumentRegistry', () => {
  let registry: InstrumentRegistry;
  let eventBus: EventBus;
  let mockInstrument: any;

  beforeEach(() => {
    eventBus = new EventBus();
    registry = new InstrumentRegistry(eventBus);
    mockInstrument = {
      play: vi.fn(),
      stop: vi.fn(),
      setVolume: vi.fn(),
    };
  });

  describe('setActive', () => {
    it('should register an instrument for a type', () => {
      registry.setActive('drums', mockInstrument);

      expect(registry.hasActive('drums')).toBe(true);
      expect(registry.getActive('drums')).toBe(mockInstrument);
    });

    it('should emit instrument:registered event when registering', () => {
      const listener = vi.fn();
      eventBus.on('instrument:registered', listener);

      registry.setActive('bass', mockInstrument);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bass',
          instrument: mockInstrument,
        }),
        expect.any(Object), // EventBus metadata
      );
    });

    it('should emit instrument:replaced event when replacing an existing instrument', () => {
      const oldInstrument = { id: 'old' };
      const newInstrument = { id: 'new' };
      const listener = vi.fn();

      registry.setActive('harmony', oldInstrument);
      eventBus.on('instrument:replaced', listener);

      registry.setActive('harmony', newInstrument);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'harmony',
          previous: oldInstrument,
          current: newInstrument,
        }),
        expect.any(Object), // EventBus metadata
      );
    });

    it('should not register null instruments', () => {
      registry.setActive('drums', null);

      expect(registry.hasActive('drums')).toBe(false);
      // The warning is logged through the logger, not directly to console
      // We just verify the instrument wasn't registered
    });

    it('should handle all instrument types', () => {
      const drumKit = { type: 'drums' };
      const bassInstrument = { type: 'bass' };
      const harmonyInstrument = { type: 'harmony' };
      const metronome = { type: 'metronome' };

      registry.setActive('drums', drumKit);
      registry.setActive('bass', bassInstrument);
      registry.setActive('harmony', harmonyInstrument);
      registry.setActive('metronome', metronome);

      expect(registry.getActive('drums')).toBe(drumKit);
      expect(registry.getActive('bass')).toBe(bassInstrument);
      expect(registry.getActive('harmony')).toBe(harmonyInstrument);
      expect(registry.getActive('metronome')).toBe(metronome);
    });
  });

  describe('getActive', () => {
    it('should return undefined for unregistered instruments', () => {
      expect(registry.getActive('drums')).toBeUndefined();
    });

    it('should return the registered instrument', () => {
      registry.setActive('bass', mockInstrument);
      expect(registry.getActive('bass')).toBe(mockInstrument);
    });
  });

  describe('hasActive', () => {
    it('should return false for unregistered instruments', () => {
      expect(registry.hasActive('harmony')).toBe(false);
    });

    it('should return true for registered instruments', () => {
      registry.setActive('harmony', mockInstrument);
      expect(registry.hasActive('harmony')).toBe(true);
    });
  });

  describe('removeActive', () => {
    it('should remove a registered instrument', () => {
      registry.setActive('drums', mockInstrument);
      expect(registry.hasActive('drums')).toBe(true);

      registry.removeActive('drums');

      expect(registry.hasActive('drums')).toBe(false);
    });

    it('should emit instrument:removed event when removing', () => {
      const listener = vi.fn();
      eventBus.on('instrument:removed', listener);

      registry.setActive('metronome', mockInstrument);
      registry.removeActive('metronome');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'metronome',
          instrument: mockInstrument,
        }),
        expect.any(Object), // EventBus metadata
      );
    });

    it('should not emit event when removing non-existent instrument', () => {
      const listener = vi.fn();
      eventBus.on('instrument:removed', listener);

      registry.removeActive('drums');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getRegisteredTypes', () => {
    it('should return empty array when no instruments registered', () => {
      expect(registry.getRegisteredTypes()).toEqual([]);
    });

    it('should return array of registered instrument types', () => {
      registry.setActive('drums', { id: 1 });
      registry.setActive('bass', { id: 2 });
      registry.setActive('harmony', { id: 3 });

      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain('drums');
      expect(types).toContain('bass');
      expect(types).toContain('harmony');
    });
  });

  describe('clearAll', () => {
    it('should remove all registered instruments', () => {
      registry.setActive('drums', { id: 1 });
      registry.setActive('bass', { id: 2 });
      registry.setActive('harmony', { id: 3 });
      registry.setActive('metronome', { id: 4 });

      registry.clearAll();

      expect(registry.getRegisteredTypes()).toEqual([]);
      expect(registry.hasActive('drums')).toBe(false);
      expect(registry.hasActive('bass')).toBe(false);
      expect(registry.hasActive('harmony')).toBe(false);
      expect(registry.hasActive('metronome')).toBe(false);
    });

    it('should emit instrument:removed for each cleared instrument', () => {
      const listener = vi.fn();
      eventBus.on('instrument:removed', listener);

      registry.setActive('drums', { id: 1 });
      registry.setActive('bass', { id: 2 });

      registry.clearAll();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'drums',
          instrument: { id: 1 },
        }),
        expect.any(Object), // EventBus metadata
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bass',
          instrument: { id: 2 },
        }),
        expect.any(Object), // EventBus metadata
      );
    });
  });

  describe('getSummary', () => {
    it('should return object with all instrument types as false when empty', () => {
      const summary = registry.getSummary();

      expect(summary).toEqual({
        drums: false,
        bass: false,
        harmony: false,
        metronome: false,
      });
    });

    it('should return correct status for each instrument type', () => {
      registry.setActive('drums', { id: 1 });
      registry.setActive('harmony', { id: 2 });

      const summary = registry.getSummary();

      expect(summary).toEqual({
        drums: true,
        bass: false,
        harmony: true,
        metronome: false,
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle rapid instrument switching', () => {
      const instrument1 = { id: 1 };
      const instrument2 = { id: 2 };
      const instrument3 = { id: 3 };

      registry.setActive('drums', instrument1);
      registry.setActive('drums', instrument2);
      registry.setActive('drums', instrument3);

      expect(registry.getActive('drums')).toBe(instrument3);
    });

    it('should handle multiple instruments being registered simultaneously', () => {
      const drums = { type: 'drums' };
      const bass = { type: 'bass' };
      const harmony = { type: 'harmony' };

      // Simulate concurrent registrations
      Promise.all([
        Promise.resolve(registry.setActive('drums', drums)),
        Promise.resolve(registry.setActive('bass', bass)),
        Promise.resolve(registry.setActive('harmony', harmony)),
      ]);

      expect(registry.getRegisteredTypes()).toHaveLength(3);
    });
  });
});
