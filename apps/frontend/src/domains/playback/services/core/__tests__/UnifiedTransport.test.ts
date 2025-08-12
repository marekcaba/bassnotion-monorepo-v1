import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UnifiedTransport, TransportError } from '../index.js';
import { AudioEngine } from '../AudioEngine.js';
import { EventBus } from '../EventBus.js';

// Mock dependencies
vi.mock('../MusicalTimeEngine.js', () => ({
  MusicalTimeEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      setTempo: vi.fn(),
      setTimeSignature: vi.fn(),
      seekTo: vi.fn(),
      subscribeWidget: vi.fn(),
      unsubscribeWidget: vi.fn(),
      getCurrentPosition: vi.fn(() => ({
        measure: 1,
        beat: 1,
        subdivision: 0,
      })),
      getCurrentTick: vi.fn(() => 0),
      positionToMilliseconds: vi.fn((pos) => pos.measure * 2000 + pos.beat * 500),
    })),
  },
}));

vi.mock('../PrecisionSynchronizationEngine.js', () => ({
  PrecisionSynchronizationEngine: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      startSynchronizedPlayback: vi.fn().mockResolvedValue(undefined),
      getNextSyncPoint: vi.fn(() => 1.0),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    })),
  },
}));

// Mock Tone.js Transport
const mockTransport = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  schedule: vi.fn(),
  scheduleRepeat: vi.fn(() => 123), // Return mock ID
  clear: vi.fn(),
  position: '0:0:0',
  seconds: 0,
  bpm: { value: 120 },
  timeSignature: [4, 4],
};

// Mock AudioContext
class MockAudioContext {
  currentTime = 0;
  state = 'running';
}

describe('UnifiedTransport', () => {
  let transportController: UnifiedTransport;
  let audioEngine: AudioEngine;
  let eventBus: EventBus;
  let mockContext: MockAudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up mocks
    mockContext = new MockAudioContext();
    eventBus = new EventBus();
    
    // Mock AudioEngine
    audioEngine = {
      getTone: vi.fn(() => ({ Transport: mockTransport })),
      getContext: vi.fn(() => mockContext),
      getCurrentTime: vi.fn(() => mockContext.currentTime),
    } as any;

    transportController = new UnifiedTransport(audioEngine, eventBus);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.initialize();

      expect(emitSpy).toHaveBeenCalledWith('transport:initialized', {
        tempo: 120,
        timeSignature: { numerator: 4, denominator: 4 },
      });
    });

    it('should initialize with custom config', async () => {
      const customTransport = new UnifiedTransport(audioEngine, eventBus, {
        tempo: 140,
        timeSignature: { numerator: 3, denominator: 4 },
        enableHighPrecisionTiming: false,
      });

      await customTransport.initialize();

      expect(customTransport.getTempo()).toBe(140);
      expect(customTransport.getTimeSignature()).toEqual({ numerator: 3, denominator: 4 });
    });

    it('should not initialize twice', async () => {
      await transportController.initialize();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.initialize();

      expect(emitSpy).not.toHaveBeenCalledWith('transport:initialized', expect.any(Object));
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      audioEngine.getContext = vi.fn(() => {
        throw error;
      });

      await expect(transportController.initialize()).rejects.toThrow(TransportError);
    });
  });

  describe('transport control', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should start transport', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.start();

      expect(mockTransport.start).toHaveBeenCalledWith(1.0); // Next sync point
      expect(transportController.getState()).toBe('playing');
      expect(emitSpy).toHaveBeenCalledWith('transport:started', expect.objectContaining({
        time: 1.0,
        position: expect.any(Object),
      }));
    });

    it('should not start if already playing', async () => {
      await transportController.start();
      vi.clearAllMocks();

      await transportController.start();

      expect(mockTransport.start).not.toHaveBeenCalled();
    });

    it('should stop transport', async () => {
      await transportController.start();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.stop();

      expect(mockTransport.stop).toHaveBeenCalled();
      expect(transportController.getState()).toBe('stopped');
      expect(emitSpy).toHaveBeenCalledWith('transport:stopped', expect.objectContaining({
        position: expect.any(Object),
      }));
    });

    it('should not stop if already stopped', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.stop();

      expect(mockTransport.stop).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalledWith('transport:stopped', expect.any(Object));
    });

    it('should pause transport', async () => {
      await transportController.start();
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.pause();

      expect(mockTransport.pause).toHaveBeenCalled();
      expect(transportController.getState()).toBe('paused');
      expect(emitSpy).toHaveBeenCalledWith('transport:paused', expect.objectContaining({
        position: expect.any(Object),
      }));
    });

    it('should not pause if not playing', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.pause();

      expect(mockTransport.pause).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalledWith('transport:paused', expect.any(Object));
    });
  });

  describe('tempo and time signature', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should set tempo', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      transportController.setTempo(140);

      expect(mockTransport.bpm.value).toBe(140);
      expect(transportController.getTempo()).toBe(140);
      expect(emitSpy).toHaveBeenCalledWith('transport:tempo-changed', expect.objectContaining({
        tempo: 140,
      }));
    });

    it('should clamp tempo to valid range', () => {
      transportController.setTempo(10);
      expect(transportController.getTempo()).toBe(20);

      transportController.setTempo(400);
      expect(transportController.getTempo()).toBe(300);
    });

    it('should set time signature', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const timeSignature = { numerator: 3, denominator: 4 };

      transportController.setTimeSignature(timeSignature);

      expect(mockTransport.timeSignature).toEqual([3, 4]);
      expect(transportController.getTimeSignature()).toEqual(timeSignature);
      expect(emitSpy).toHaveBeenCalledWith('transport:time-signature-changed', expect.objectContaining({
        timeSignature,
      }));
    });
  });

  describe('seeking', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should seek to seconds', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      transportController.seekTo(5.5);

      expect(mockTransport.seconds).toBe(5.5);
      expect(emitSpy).toHaveBeenCalledWith('transport:seeked', expect.objectContaining({
        position: expect.any(Object),
      }));
    });

    it('should seek to musical position', () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');
      const position = { measure: 2, beat: 3, subdivision: 0 };

      transportController.seekTo(position);

      // 2 * 2000 + 3 * 500 = 5500ms = 5.5s
      expect(mockTransport.seconds).toBe(5.5);
      expect(emitSpy).toHaveBeenCalledWith('transport:seeked', expect.objectContaining({
        position: expect.any(Object),
      }));
    });
  });

  describe('position tracking', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should get current position', () => {
      mockTransport.position = '2:3:1';
      mockTransport.seconds = 5.5;

      const position = transportController.getCurrentPosition();

      expect(position).toEqual({
        bars: 1, // From musicalTimeEngine mock
        beats: 1,
        sixteenths: 0,
        ticks: 0,
        seconds: 5.5,
      });
    });

    it('should calculate next beat time', () => {
      const nextBeat = transportController.getNextBeatTime();
      // Next beat would be measure 1, beat 2 = 1 * 2000 + 2 * 500 = 3000ms = 3s
      expect(nextBeat).toBe(3);
    });

    it('should calculate next bar time', () => {
      const nextBar = transportController.getNextBarTime();
      // Next bar would be measure 2, beat 1 = 2 * 2000 + 1 * 500 = 4500ms = 4.5s
      expect(nextBar).toBe(4.5);
    });
  });

  describe('scheduling', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should schedule a callback', () => {
      const callback = vi.fn();

      transportController.schedule(callback, 2.0);

      expect(mockTransport.schedule).toHaveBeenCalledWith(callback, 2.0);
    });

    it('should schedule a repeating callback', () => {
      const callback = vi.fn();

      const id = transportController.scheduleRepeat(callback, '4n');

      expect(mockTransport.scheduleRepeat).toHaveBeenCalledWith(callback, '4n');
      expect(id).toBe(123);
    });

    it('should clear a scheduled event', () => {
      transportController.clear(123);

      expect(mockTransport.clear).toHaveBeenCalledWith(123);
    });
  });

  describe('high precision timing', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await transportController.initialize();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start scheduling loop when playing', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.start();

      // Advance timer to trigger scheduling
      vi.advanceTimersByTime(25);

      expect(emitSpy).toHaveBeenCalledWith('transport:schedule-ahead', expect.objectContaining({
        currentTime: 0,
        scheduleTime: 0.1,
        lookAheadTime: 0.1,
      }));
    });

    it('should stop scheduling loop when stopping', async () => {
      await transportController.start();
      vi.clearAllMocks();

      await transportController.stop();

      // Advance timer - should not trigger scheduling
      vi.advanceTimersByTime(50);

      expect(eventBus.emit).not.toHaveBeenCalledWith('transport:schedule-ahead', expect.any(Object));
    });
  });

  describe('disposal', () => {
    it('should dispose properly', async () => {
      await transportController.initialize();
      await transportController.start();

      const emitSpy = vi.spyOn(eventBus, 'emit');

      await transportController.dispose();

      expect(transportController.getState()).toBe('stopped');
      expect(emitSpy).toHaveBeenCalledWith('transport:disposed', {});
    });

    it('should handle disposal without initialization', async () => {
      await expect(transportController.dispose()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when using methods before initialization', () => {
      expect(() => transportController.start()).rejects.toThrow(TransportError);
      expect(() => transportController.setTempo(120)).toThrow(TransportError);
      expect(() => transportController.seekTo(0)).toThrow(TransportError);
      expect(() => transportController.schedule(vi.fn(), 1)).toThrow(TransportError);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await transportController.initialize();
    });

    it('should emit transport events', async () => {
      const eventHandler = vi.fn();
      eventBus.on('transport:event', eventHandler);

      await transportController.start();

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'start',
          state: 'playing',
          timestamp: expect.any(Number),
        }),
        expect.any(Object)
      );
    });

    it('should forward musical time events', async () => {
      const musicalTimeEngine = (await import('../MusicalTimeEngine.js')).MusicalTimeEngine.getInstance();
      const subscribeCall = (musicalTimeEngine.subscribeWidget as any).mock.calls[0];
      const handler = subscribeCall[2];

      const emitSpy = vi.spyOn(eventBus, 'emit');

      // Simulate bar change event
      handler({
        type: 'BAR_CHANGE',
        position: { measure: 2, beat: 1, subdivision: 0 },
        timestamp: Date.now(),
      });

      expect(emitSpy).toHaveBeenCalledWith('transport:bar-change', expect.any(Object));
    });
  });
});