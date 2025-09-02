/**
 * InstrumentAdapter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstrumentAdapter, createInstrumentAdapter } from '../base/InstrumentAdapter.js';
import type { LegacyProcessor } from '../base/InstrumentAdapter.js';
import type { InstrumentConfig, InstrumentEvent } from '../types/index.js';

// Mock legacy processor
class MockBassProcessor implements LegacyProcessor {
  initialized = false;
  disposed = false;
  lastTriggeredNote: any = null;
  volume = 1;
  pan = 0;
  muted = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  triggerNote(event: any): void {
    this.lastTriggeredNote = event;
  }

  stopNote(note: string): void {
    // Mock implementation
  }

  dispose(): void {
    this.disposed = true;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  setPan(pan: number): void {
    this.pan = pan;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }
}

describe('InstrumentAdapter', () => {
  let mockProcessor: MockBassProcessor;
  let adapter: InstrumentAdapter;
  let config: InstrumentConfig;

  beforeEach(() => {
    mockProcessor = new MockBassProcessor();
    config = {
      type: 'bass',
      name: 'Test Bass',
      volume: 0.8,
      pan: -0.5,
    };
    adapter = new InstrumentAdapter(config, mockProcessor, 'triggerNote');
  });

  describe('initialization', () => {
    it('should initialize the processor', async () => {
      expect(adapter.state.isInitialized).toBe(false);
      expect(mockProcessor.initialized).toBe(false);

      await adapter.initialize();

      expect(adapter.state.isInitialized).toBe(true);
      expect(mockProcessor.initialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const errorProcessor = {
        initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
      };
      const errorAdapter = new InstrumentAdapter(config, errorProcessor, 'trigger');

      await expect(errorAdapter.initialize()).rejects.toThrow('Init failed');
      expect(errorAdapter.state.error).toContain('Init failed');
    });

    it('should not initialize twice', async () => {
      await adapter.initialize();
      const spy = vi.spyOn(mockProcessor, 'initialize');
      
      await adapter.initialize();
      
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('triggering', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should trigger events on the processor', () => {
      const event: InstrumentEvent = {
        audioTime: 1.5,
        timestamp: Date.now(),
        velocity: 0.7,
        duration: '4n',
        data: { note: 'C3' },
      };

      adapter.trigger(event);

      expect(mockProcessor.lastTriggeredNote).toEqual({
        time: 1.5,
        velocity: 0.7,
        duration: '4n',
        timestamp: event.timestamp,
        note: 'C3',
      });
      expect(adapter.state.isPlaying).toBe(true);
    });

    it('should not trigger if not initialized', () => {
      const uninitializedAdapter = new InstrumentAdapter(config, mockProcessor, 'triggerNote');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      uninitializedAdapter.trigger({
        audioTime: 1.0,
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Instrument Test Bass not initialized');
      expect(mockProcessor.lastTriggeredNote).toBeNull();
      
      consoleSpy.mockRestore();
    });

    it('should handle missing trigger method', async () => {
      const badAdapter = new InstrumentAdapter(config, mockProcessor, 'nonExistentMethod');
      await badAdapter.initialize();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      badAdapter.trigger({
        audioTime: 1.0,
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalledWith('Trigger method nonExistentMethod not found on processor');
      
      consoleSpy.mockRestore();
    });
  });

  describe('parameter updates', () => {
    it('should update volume', () => {
      adapter.setVolume(0.5);
      expect(mockProcessor.volume).toBe(0.5);
    });

    it('should clamp volume values', () => {
      adapter.setVolume(1.5);
      expect(mockProcessor.volume).toBe(1);

      adapter.setVolume(-0.5);
      expect(mockProcessor.volume).toBe(0);
    });

    it('should update pan', () => {
      adapter.setPan(0.75);
      expect(mockProcessor.pan).toBe(0.75);
    });

    it('should update mute state', () => {
      adapter.setMuted(true);
      expect(mockProcessor.muted).toBe(true);

      adapter.setMuted(false);
      expect(mockProcessor.muted).toBe(false);
    });

    it('should update multiple params', () => {
      adapter.updateParams({
        name: 'Updated Bass',
        volume: 0.6,
        pan: 0.2,
        muted: true,
      });

      expect(adapter.name).toBe('Updated Bass');
      expect(mockProcessor.volume).toBe(0.6);
      expect(mockProcessor.pan).toBe(0.2);
      expect(mockProcessor.muted).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose the processor', async () => {
      await adapter.initialize();
      expect(adapter.state.isInitialized).toBe(true);

      await adapter.dispose();

      expect(mockProcessor.disposed).toBe(true);
      expect(adapter.state.isInitialized).toBe(false);
      expect(adapter.state.isPlaying).toBe(false);
    });
  });

  describe('factory function', () => {
    it('should create adapters with correct trigger methods', () => {
      const bassAdapter = createInstrumentAdapter('bass', mockProcessor);
      const drumProcessor = { triggerDrum: vi.fn() };
      const drumAdapter = createInstrumentAdapter('drums', drumProcessor);
      const metronomeProcessor = { triggerClick: vi.fn() };
      const metronomeAdapter = createInstrumentAdapter('metronome', metronomeProcessor);

      expect(bassAdapter).toBeInstanceOf(InstrumentAdapter);
      expect(bassAdapter.type).toBe('bass');
      expect(bassAdapter.name).toBe('bass');

      expect(drumAdapter.type).toBe('drums');
      expect(metronomeAdapter.type).toBe('metronome');
    });

    it('should apply custom config', () => {
      const customAdapter = createInstrumentAdapter('bass', mockProcessor, {
        name: 'Custom Bass',
        volume: 0.9,
        customConfig: { preset: 'funky' },
      });

      expect(customAdapter.name).toBe('Custom Bass');
    });
  });

  describe('processor access', () => {
    it('should provide access to underlying processor', () => {
      const processor = adapter.getProcessor();
      expect(processor).toBe(mockProcessor);
    });
  });
});