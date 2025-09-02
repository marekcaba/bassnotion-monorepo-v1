import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrumKit } from '../DrumKit.js';
import type { DrumKitInstrumentConfig, DrumEvent } from '../../../types/index.js';

// Mock the DrumInstrumentProcessor
vi.mock('../../../../../services/plugins/DrumInstrumentProcessor.js', () => {
  return {
    DrumInstrumentProcessor: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      triggerDrum: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
      setMasterVolume: vi.fn(),
      setGrooveStyle: vi.fn(),
      setSwingAmount: vi.fn(),
      setDrumVolume: vi.fn(),
    })),
  };
});

// Mock correlation hook
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/shared/hooks/useCorrelation', () => ({
  useCorrelation: vi.fn(() => ({
    correlationId: 'test-correlation-id',
    logger: mockLogger,
  })),
}));

global.logger = mockLogger;

describe('DrumKit', () => {
  let drumKit: DrumKit;
  let config: DrumKitInstrumentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    config = {
      id: 'test-drums',
      name: 'Test DrumKit',
      type: 'drums',
      kit: {
        name: 'Standard Kit',
        samples: {
          kick: ['kick1.wav', 'kick2.wav'],
          snare: ['snare1.wav', 'snare2.wav'],
          hihat: ['hihat1.wav'],
          openHihat: ['openhat1.wav'],
          crash: ['crash1.wav'],
          ride: ['ride1.wav'],
          tom1: ['tom1.wav'],
          tom2: ['tom2.wav'],
          tom3: ['tom3.wav'],
          rimshot: ['rimshot1.wav'],
          clap: ['clap1.wav'],
          cowbell: ['cowbell1.wav'],
          tambourine: ['tambourine1.wav'],
          shaker: ['shaker1.wav'],
        },
      },
      grooveStyle: 'straight',
      swingAmount: 0,
      humanization: 0.1,
      velocityLayers: 4,
      roundRobin: true,
    };

    drumKit = new DrumKit(config);
  });

  describe('Construction', () => {
    it('should create drum kit with provided configuration', () => {
      expect(drumKit.id).toBe('test-drums');
      expect(drumKit.name).toBe('Test DrumKit');
      expect(drumKit.type).toBe('drums');
      expect(drumKit.state.isInitialized).toBe(false);
    });

    it('should set default values for optional parameters', () => {
      const minimalConfig: DrumKitInstrumentConfig = {
        id: 'minimal-drums',
        name: 'Minimal DrumKit',
        type: 'drums',
      };

      const minimalDrumKit = new DrumKit(minimalConfig);
      expect(minimalDrumKit.id).toBe('minimal-drums');
    });
  });

  describe('Initialization', () => {
    it('should initialize drum kit successfully', async () => {
      await drumKit.initialize();
      
      expect(drumKit.state.isInitialized).toBe(true);
      expect(drumKit.state.isLoading).toBe(false);
      expect(drumKit.state.error).toBeNull();
    });

    it('should not reinitialize if already initialized', async () => {
      await drumKit.initialize();
      await drumKit.initialize(); // Second call should be ignored
      
      expect(drumKit.state.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      // Mock initialization failure
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(drumKit.initialize()).rejects.toThrow('Init failed');
      expect(drumKit.state.isInitialized).toBe(false);
      expect(drumKit.state.isLoading).toBe(false);
      expect(drumKit.state.error).toContain('Failed to initialize drum kit');
    });
  });

  describe('Trigger Events', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should trigger drum events', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: {
          drum: 'kick',
        } as DrumEvent,
      };

      drumKit.trigger(event);

      const mockProcessor = (drumKit as any).processor;
      expect(mockProcessor.triggerDrum).toHaveBeenCalledWith({
        drum: 'kick',
        velocity: 0.8,
        time: 0.5,
        duration: '16n',
      });
      expect(drumKit.state.isPlaying).toBe(true);
    });

    it('should handle trigger with default drum', () => {
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: {},
      };

      drumKit.trigger(event);

      const mockProcessor = (drumKit as any).processor;
      expect(mockProcessor.triggerDrum).toHaveBeenCalledWith({
        drum: 'kick', // Default drum
        velocity: 0.8,
        time: 0.5,
        duration: '16n',
      });
    });

    it('should not trigger when not initialized', () => {
      const uninitializedDrumKit = new DrumKit(config);
      const event = {
        audioTime: 0.5,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { drum: 'kick' },
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      uninitializedDrumKit.trigger(event);
      
      expect(consoleSpy).toHaveBeenCalledWith('DrumKit Test DrumKit not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Direct Drum Triggering', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should trigger specific drum piece', () => {
      drumKit.triggerDrum('snare', 0.9);

      const mockProcessor = (drumKit as any).processor;
      expect(mockProcessor.triggerDrum).toHaveBeenCalledWith({
        drum: 'snare',
        velocity: 0.9,
        time: expect.any(Number),
        duration: '16n',
      });
    });

    it('should trigger with default velocity', () => {
      drumKit.triggerDrum('hihat');

      const mockProcessor = (drumKit as any).processor;
      expect(mockProcessor.triggerDrum).toHaveBeenCalledWith({
        drum: 'hihat',
        velocity: 0.8, // Default velocity
        time: expect.any(Number),
        duration: '16n',
      });
    });

    it('should not trigger when not initialized', () => {
      const uninitializedDrumKit = new DrumKit(config);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      uninitializedDrumKit.triggerDrum('kick');
      
      expect(consoleSpy).toHaveBeenCalledWith('DrumKit not initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('Groove and Swing Controls', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should set groove style', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.setGrooveStyle = vi.fn();

      drumKit.setGrooveStyle('shuffle');

      expect(mockProcessor.setGrooveStyle).toHaveBeenCalledWith('shuffle');
    });

    it('should set swing amount within valid range', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.setSwingAmount = vi.fn();

      drumKit.setSwingAmount(50);
      expect(mockProcessor.setSwingAmount).toHaveBeenCalledWith(50);

      // Test clamping
      drumKit.setSwingAmount(150);
      expect(mockProcessor.setSwingAmount).toHaveBeenCalledWith(100);

      drumKit.setSwingAmount(-10);
      expect(mockProcessor.setSwingAmount).toHaveBeenCalledWith(0);
    });

    it('should set individual drum volumes', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.setDrumVolume = vi.fn();

      drumKit.setDrumVolume('kick', 0.9);

      expect(mockProcessor.setDrumVolume).toHaveBeenCalledWith('kick', 0.9);
    });
  });

  describe('Kit Information', () => {
    it('should return kit information', () => {
      const kitInfo = drumKit.getKitInfo();

      expect(kitInfo.name).toBe('Test DrumKit');
      expect(kitInfo.totalSamples).toBe(18); // Sum of all sample arrays
      expect(kitInfo.loadedDrums).toContain('kick');
      expect(kitInfo.loadedDrums).toContain('snare');
    });

    it('should return available drums', () => {
      const availableDrums = drumKit.getAvailableDrums();

      expect(availableDrums).toContain('kick');
      expect(availableDrums).toContain('snare');
      expect(availableDrums).toContain('hihat');
    });
  });

  describe('Kit Loading', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should load new kit configuration', async () => {
      const newKitConfig = {
        name: 'New Kit',
        samples: {
          kick: ['newkick.wav'],
          snare: ['newsnare.wav'],
          hihat: ['newhihat.wav'],
          openHihat: ['newopenhat.wav'],
          crash: ['newcrash.wav'],
          ride: ['newride.wav'],
          tom1: ['newtom1.wav'],
          tom2: ['newtom2.wav'],
          tom3: ['newtom3.wav'],
          rimshot: ['newrimshot.wav'],
          clap: ['newclap.wav'],
          cowbell: ['newcowbell.wav'],
          tambourine: ['newtambourine.wav'],
          shaker: ['newshaker.wav'],
        },
      };

      await drumKit.loadKit(newKitConfig);

      const kitInfo = drumKit.getKitInfo();
      expect(kitInfo.totalSamples).toBe(14); // New sample count
    });
  });

  describe('Parameter Updates', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should update parameters', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.setGrooveStyle = vi.fn();
      mockProcessor.setSwingAmount = vi.fn();

      drumKit.updateParams({
        grooveStyle: 'latin',
        swingAmount: 30,
        kit: {
          name: 'Updated Kit',
          samples: {
            kick: ['newkick.wav'],
            snare: ['newsnare.wav'],
            hihat: ['newhihat.wav'],
            openHihat: ['newopenhat.wav'],
            crash: ['newcrash.wav'],
            ride: ['newride.wav'],
            tom1: ['newtom1.wav'],
            tom2: ['newtom2.wav'],
            tom3: ['newtom3.wav'],
            rimshot: ['newrimshot.wav'],
            clap: ['newclap.wav'],
            cowbell: ['newcowbell.wav'],
            tambourine: ['newtambourine.wav'],
            shaker: ['newshaker.wav'],
          },
        },
      });

      expect(mockProcessor.setGrooveStyle).toHaveBeenCalledWith('latin');
      expect(mockProcessor.setSwingAmount).toHaveBeenCalledWith(30);
    });
  });

  describe('Audio Controls', () => {
    beforeEach(async () => {
      await drumKit.initialize();
    });

    it('should apply volume changes', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.setMasterVolume = vi.fn();

      drumKit.setVolume(0.7);

      expect(mockProcessor.setMasterVolume).toHaveBeenCalledWith(0.7);
    });

    it('should apply mute', () => {
      const mockProcessor = (drumKit as any).processor;
      mockProcessor.stop = vi.fn();

      drumKit.setMuted(true);
      // Simulate playing state
      (drumKit as any)._state.isPlaying = true;
      (drumKit as any).applyMute();

      expect(mockProcessor.stop).toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should return drum-specific metrics', () => {
      const metrics = drumKit.getMetrics();

      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('voiceCount');
      expect(metrics).toHaveProperty('latency');
      expect(metrics.latency).toBe(10);
    });

    it('should return higher CPU usage when playing', () => {
      const restingMetrics = drumKit.getMetrics();
      expect(restingMetrics.cpuUsage).toBe(0);

      // Simulate playing state
      (drumKit as any)._state.isPlaying = true;
      const playingMetrics = drumKit.getMetrics();
      expect(playingMetrics.cpuUsage).toBe(5);
    });
  });

  describe('Lifecycle', () => {
    it('should dispose properly', async () => {
      await drumKit.initialize();
      const mockProcessor = (drumKit as any).processor;

      await drumKit.dispose();

      expect(mockProcessor.dispose).toHaveBeenCalled();
      expect(drumKit.state.isInitialized).toBe(false);
      expect(drumKit.state.isPlaying).toBe(false);
    });

    it('should connect and disconnect audio routing', () => {
      const destination = { connect: vi.fn() };

      drumKit.connect(destination);
      expect((drumKit as any)._destination).toBe(destination);

      drumKit.disconnect();
      expect((drumKit as any)._destination).toBeNull();
    });
  });
});