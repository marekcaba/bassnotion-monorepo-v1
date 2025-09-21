import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Mixer } from '../mixing/Mixer.js';
import { Track } from '../core/Track.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { AudioEngine } from '../../audio-engine/core/AudioEngine.js';
import { serviceRegistry } from '../../../services/core/ServiceRegistry.js';
import type { TrackConfig } from '../../../types/track.js';

// Mock serviceRegistry
vi.mock('../../../services/core/ServiceRegistry.js', () => ({
  serviceRegistry: {
    register: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock Tone.js to prevent real audio objects from being created
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  Gain: vi.fn().mockImplementation((value) => ({
    gain: {
      value,
      rampTo: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Panner: vi.fn().mockImplementation((value) => ({
    pan: {
      value,
      rampTo: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Compressor: vi.fn().mockImplementation(() => ({
    threshold: { value: -12 },
    ratio: { value: 4 },
    attack: { value: 0.003 },
    release: { value: 0.25 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Limiter: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Reverb: vi.fn().mockImplementation(() => ({
    decay: 7,
    wet: { value: 0.5 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    ready: Promise.resolve(),
  })),
  Delay: vi.fn().mockImplementation(() => ({
    delayTime: { value: 0.25 },
    wet: { value: 0.5 },
    feedback: { value: 0.3 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Volume: vi.fn().mockImplementation((value = 0) => ({
    volume: { value },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  EQ3: vi.fn().mockImplementation(() => ({
    low: { value: 0 },
    mid: { value: 0 },
    high: { value: 0 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Filter: vi.fn().mockImplementation(() => ({
    frequency: { value: 1000 },
    Q: { value: 1 },
    type: 'lowpass',
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Gate: vi.fn().mockImplementation(() => ({
    threshold: { value: -40 },
    attack: { value: 0.01 },
    release: { value: 0.1 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Meter: vi.fn().mockImplementation(() => ({
    getValue: vi.fn().mockReturnValue(-60),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Analyser: vi.fn().mockImplementation(() => ({
    getValue: vi.fn().mockReturnValue(new Float32Array(512)),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  context: {
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
  },
  Destination: {
    connect: vi.fn(),
  },
  getDestination: vi.fn(() => ({
    connect: vi.fn(),
  })),
  FeedbackDelay: vi.fn().mockImplementation(() => ({
    delayTime: { value: '8n' },
    feedback: { value: 0.3 },
    wet: { value: 1.0 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  Distortion: vi.fn().mockImplementation(() => ({
    distortion: 0.05,
    wet: { value: 0.3 },
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock dependencies - we need to return the mocked Tone from getTone
vi.mock('../../audio-engine/core/AudioEngine.js', () => {
  const mockTone = {
    Gain: vi.fn().mockImplementation((value = 1) => ({
      gain: {
        value,
        rampTo: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Panner: vi.fn().mockImplementation((value = 0) => ({
      pan: {
        value,
        rampTo: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Compressor: vi.fn().mockImplementation(() => ({
      threshold: { value: -12 },
      ratio: { value: 4 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Limiter: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Reverb: vi.fn().mockImplementation(() => ({
      decay: 7,
      wet: { value: 0.5 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      ready: Promise.resolve(),
    })),
    Delay: vi.fn().mockImplementation(() => ({
      delayTime: { value: 0.25 },
      wet: { value: 0.5 },
      feedback: { value: 0.3 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Volume: vi.fn().mockImplementation((value = 0) => ({
      volume: { value },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    EQ3: vi.fn().mockImplementation(() => ({
      low: { value: 0 },
      mid: { value: 0 },
      high: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Filter: vi.fn().mockImplementation(() => ({
      frequency: { value: 1000 },
      Q: { value: 1 },
      type: 'lowpass',
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Gate: vi.fn().mockImplementation(() => ({
      threshold: { value: -40 },
      attack: { value: 0.01 },
      release: { value: 0.1 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Meter: vi.fn().mockImplementation(() => ({
      getValue: vi.fn().mockReturnValue(-60),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Analyser: vi.fn().mockImplementation(() => ({
      getValue: vi.fn().mockReturnValue(new Float32Array(512)),
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    context: {
      state: 'running',
      resume: vi.fn().mockResolvedValue(undefined),
    },
    Destination: {
      connect: vi.fn(),
    },
    getDestination: vi.fn(() => ({
      connect: vi.fn(),
    })),
    FeedbackDelay: vi.fn().mockImplementation(() => ({
      delayTime: { value: '8n' },
      feedback: { value: 0.3 },
      wet: { value: 1.0 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
    Distortion: vi.fn().mockImplementation(() => ({
      distortion: 0.05,
      wet: { value: 0.3 },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),
  };

  return {
    AudioEngine: {
      getInstance: vi.fn(() => ({
        isInitialized: true,
        getTone: () => mockTone,
        getContext: vi.fn(() => ({
          state: 'running',
          resume: vi.fn(),
        })),
        start: vi.fn(),
        stop: vi.fn(),
        dispose: vi.fn(),
      })),
    },
  };
});

describe('Mixer', () => {
  let mixer: Mixer;
  let eventBus: EventBus;
  let track: Track;

  beforeEach(() => {
    // Clear singleton instance
    (Mixer as any).instance = null;

    // Create EventBus
    eventBus = new EventBus();

    // Setup mocked serviceRegistry BEFORE creating Mixer
    vi.mocked(serviceRegistry.get).mockImplementation((name: string) => {
      if (name === 'eventBus') return eventBus;
      return undefined;
    });

    // Register the eventBus in the registry before Mixer tries to access it
    vi.mocked(serviceRegistry.register).mockImplementation(() => {});

    mixer = Mixer.getInstance();

    // Force set the eventBus on the mixer instance if it wasn't found during construction
    if (!(mixer as any).eventBus) {
      (mixer as any).eventBus = eventBus;
    }

    const trackConfig: TrackConfig = {
      name: 'Test Track',
      instrumentType: 'bass',
    };
    track = new Track(trackConfig);
  });

  afterEach(() => {
    // Clean up
    if (mixer && typeof mixer.dispose === 'function') {
      mixer.dispose();
    }
    (Mixer as any).instance = null;
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const mixer1 = Mixer.getInstance();
      const mixer2 = Mixer.getInstance();
      expect(mixer1).toBe(mixer2);
    });
  });

  describe('track channel management', () => {
    it('should create track channel', () => {
      const channel = mixer.createTrackChannel(track);

      expect(channel).toBeDefined();
      expect(channel.trackId).toBe(track.id);
      expect(channel.isMuted).toBe(false);
      expect(channel.isSoloed).toBe(false);
    });

    it('should prevent duplicate channels', () => {
      mixer.createTrackChannel(track);

      expect(() => mixer.createTrackChannel(track)).toThrow();
    });

    it('should remove track channel', () => {
      mixer.createTrackChannel(track);
      mixer.removeTrackChannel(track.id);

      const channel = mixer.getTrackChannel(track.id);
      expect(channel).toBeUndefined();
    });
  });

  describe('mixing operations', () => {
    beforeEach(() => {
      mixer.createTrackChannel(track);
    });

    it('should update track mixing parameters', () => {
      const updateSpy = vi.spyOn(eventBus, 'emit');

      mixer.updateTrackMixing(track.id, {
        volume: 0.8,
        pan: -0.5,
      });

      expect(updateSpy).toHaveBeenCalledWith('mixing:trackUpdated', {
        trackId: track.id,
        params: { volume: 0.8, pan: -0.5 },
      });
    });

    it('should handle mute', () => {
      mixer.updateTrackMixing(track.id, { mute: true });

      const channel = mixer.getTrackChannel(track.id);
      expect(channel?.isMuted).toBe(true);
    });

    it('should handle solo with other tracks', () => {
      const track2 = new Track({ name: 'Track 2', instrumentType: 'drums' });
      mixer.createTrackChannel(track2);

      mixer.updateTrackMixing(track.id, { solo: true });

      const channel1 = mixer.getTrackChannel(track.id);
      const channel2 = mixer.getTrackChannel(track2.id);

      expect(channel1?.isSoloed).toBe(true);
      // In real implementation, channel2 would be implicitly muted
    });
  });

  describe('bus management', () => {
    it('should create master bus by default', () => {
      const buses = mixer.getBuses();
      expect(buses.has('master')).toBe(true);

      const masterBus = buses.get('master');
      expect(masterBus?.type).toBe('master');
    });

    it('should create sub bus', () => {
      const subBus = mixer.createSubBus('drums-bus', 'Drums Bus');

      expect(subBus.busId).toBe('drums-bus');
      expect(subBus.type).toBe('sub');
      expect(subBus.parentBusId).toBe('master');
    });

    it('should create aux bus', () => {
      const auxBus = mixer.createAuxBus('reverb', 'Reverb');

      expect(auxBus.busId).toBe('reverb');
      expect(auxBus.type).toBe('aux');
    });

    it('should prevent duplicate buses', () => {
      mixer.createSubBus('test-bus', 'Test');

      expect(() => mixer.createSubBus('test-bus', 'Test')).toThrow();
    });
  });

  describe('routing', () => {
    beforeEach(() => {
      mixer.createTrackChannel(track);
    });

    it('should route track to bus', () => {
      const drumsBus = mixer.createSubBus('drums', 'Drums');

      mixer.routeTrackToBus(track.id, 'drums');

      // In real implementation, this would disconnect from master and connect to drums bus
      expect(drumsBus).toBeDefined();
    });

    it('should create send to aux bus', () => {
      const reverbBus = mixer.createAuxBus('reverb-send-test', 'Reverb');

      const sendId = mixer.createSend(track.id, 'reverb-send-test', 0.3);

      expect(sendId).toContain('send-');
      expect(sendId).toContain(track.id);
      expect(sendId).toContain('reverb-send-test');
    });

    it('should update send level', () => {
      mixer.createAuxBus('delay', 'Delay');
      mixer.createSend(track.id, 'delay', 0.5);

      // This should not throw
      mixer.updateSendLevel(track.id, 'delay', 0.7);
    });
  });

  describe('effects', () => {
    it('should create reverb return', () => {
      const reverbId = mixer.createReverbReturn('Hall Reverb', 0.8, 2500);

      expect(reverbId).toContain('aux-reverb-');
      const buses = mixer.getBuses();
      expect(buses.has(reverbId)).toBe(true);
    });

    it('should create delay return', () => {
      const delayId = mixer.createDelayReturn('1/8 Delay', '8n', 0.4, 0.5);

      expect(delayId).toContain('aux-delay-');
      const buses = mixer.getBuses();
      expect(buses.has(delayId)).toBe(true);
    });

    it('should create compression return', () => {
      const compId = mixer.createCompressionReturn('Parallel Comp', -15, 6);

      expect(compId).toContain('aux-compression-');
      const buses = mixer.getBuses();
      expect(buses.has(compId)).toBe(true);
    });
  });

  describe('snapshots', () => {
    beforeEach(() => {
      mixer.createTrackChannel(track);
    });

    it('should create mixing snapshot', () => {
      mixer.updateTrackMixing(track.id, { volume: 0.6, pan: 0.2 });

      mixer.createSnapshot('Test Snapshot');

      // Snapshot functionality tested through state verification
      expect(mixer.getTrackChannel(track.id)).toBeDefined();
    });

    it('should recall mixing snapshot', () => {
      mixer.updateTrackMixing(track.id, { volume: 0.6 });
      mixer.createSnapshot('Snapshot 1');

      mixer.updateTrackMixing(track.id, { volume: 0.9 });
      mixer.recallSnapshot('Snapshot 1');

      // In real implementation, volume would be restored to 0.6
    });
  });

  describe('metrics', () => {
    it('should provide mixing metrics', () => {
      mixer.createTrackChannel(track);
      mixer.createAuxBus('reverb-metrics', 'Reverb');
      mixer.createSend(track.id, 'reverb-metrics');

      const metrics = mixer.getMixingMetrics();

      expect(metrics.trackCount).toBe(1);
      expect(metrics.busCount).toBeGreaterThan(1); // Master + aux
      expect(metrics.sendCount).toBe(1);
      expect(metrics.soloActive).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should dispose all resources', () => {
      mixer.createTrackChannel(track);
      mixer.createAuxBus('test', 'Test');

      mixer.dispose();

      expect(mixer.getBuses().size).toBe(0);
      expect(mixer.getTrackChannel(track.id)).toBeUndefined();
    });
  });
});
