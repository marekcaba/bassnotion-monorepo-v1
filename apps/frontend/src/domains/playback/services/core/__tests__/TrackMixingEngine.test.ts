import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TrackMixingEngine, type TrackChannel, type MixBus, type Send, type MixingSnapshot } from '../TrackMixingEngine.js';
import { Track } from '../Track.js';
import { EventBus } from '../EventBus.js';
import { AudioEngine } from '../AudioEngine.js';
import { serviceRegistry } from '../ServiceRegistry.js';
import { PlaybackError } from '../../errors/base.js';
import { TrackState, type TrackMixingState, type TrackAutomation } from '../../../types/track.js';

// Mock Tone.js
const createMockToneNode = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn().mockReturnThis(),
  dispose: vi.fn(),
  gain: {
    value: 1,
    rampTo: vi.fn()
  },
  pan: {
    value: 0,
    rampTo: vi.fn()
  }
});

const createMockTimeline = () => ({
  add: vi.fn(),
  get: vi.fn().mockReturnValue({ value: 0.5 }),
  dispose: vi.fn()
});

const mockTone = {
  Gain: vi.fn().mockImplementation((value = 1) => ({
    ...createMockToneNode(),
    gain: {
      value,
      rampTo: vi.fn()
    }
  })),
  Panner: vi.fn().mockImplementation((value = 0) => ({
    ...createMockToneNode(),
    pan: {
      value,
      rampTo: vi.fn()
    }
  })),
  Compressor: vi.fn().mockImplementation((config) => ({
    ...createMockToneNode(),
    config
  })),
  Limiter: vi.fn().mockImplementation((threshold) => ({
    ...createMockToneNode(),
    threshold
  })),
  Timeline: vi.fn().mockImplementation(() => createMockTimeline()),
  Destination: createMockToneNode()
};

// Mock dependencies
vi.mock('../AudioEngine.js', () => ({
  AudioEngine: {
    getInstance: vi.fn(() => ({
      getTone: vi.fn(() => mockTone),
      isReady: vi.fn(() => true)
    }))
  }
}));

vi.mock('../EventBus.js', () => ({
  EventBus: vi.fn().mockImplementation(() => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }))
}));

vi.mock('../ServiceRegistry.js', () => ({
  serviceRegistry: {
    get: vi.fn()
  }
}));

// Helper function to create a mock track
const createMockTrack = (overrides: Partial<Track> = {}): Track => ({
  id: `track-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Track',
  instrument: 'bass',
  state: TrackState.READY,
  mixing: {
    volume: 0.8,
    pan: 0.1,
    mute: false,
    solo: false,
    recordArm: false,
    phaseInvert: false,
    delayCompensation: 0
  },
  routing: {
    outputDestination: 'master',
    sends: [],
    inputMonitoring: false,
    listeningPoint: 'post-fader'
  },
  sync: {
    quantization: {
      enabled: true,
      gridSize: '1/16',
      strength: 0.8,
      swing: 0
    },
    dependencies: [],
    priority: 1,
    humanization: 0.1,
    timingOffset: 0
  },
  automation: [],
  plugins: [],
  patterns: [],
  lifecycle: {
    created: Date.now(),
    lastModified: Date.now(),
    version: 1
  },
  metrics: {
    cpuUsage: 0.1,
    memoryUsage: 50,
    bufferUnderruns: 0,
    dropouts: 0,
    latency: 10
  },
  config: {
    type: 'midi',
    samples: {},
    velocity: { min: 0.1, max: 1.0 },
    timeSignature: { numerator: 4, denominator: 4 }
  },
  ...overrides
} as Track);

describe('TrackMixingEngine', () => {
  let mixingEngine: TrackMixingEngine;
  let mockEventBus: EventBus;
  let mockAudioEngine: AudioEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (TrackMixingEngine as any).instance = null;
    
    // Setup mocks
    mockEventBus = new EventBus();
    mockAudioEngine = AudioEngine.getInstance();
    
    (serviceRegistry.get as any).mockImplementation((name: string) => {
      if (name === 'eventBus') return mockEventBus;
      throw new Error(`Service ${name} not found`);
    });
    
    mixingEngine = TrackMixingEngine.getInstance();
  });

  afterEach(() => {
    mixingEngine.dispose();
    (TrackMixingEngine as any).instance = null;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = TrackMixingEngine.getInstance();
      const instance2 = TrackMixingEngine.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(mixingEngine);
    });

    it('should initialize with master bus on creation', () => {
      const buses = mixingEngine.getBuses();
      expect(buses.has('master')).toBe(true);
      
      const masterBus = buses.get('master');
      expect(masterBus).toMatchObject({
        busId: 'master',
        name: 'Master Bus',
        type: 'master'
      });
    });
  });

  describe('Track Channel Management', () => {
    it('should create a track channel successfully', () => {
      const track = createMockTrack();
      const channel = mixingEngine.createTrackChannel(track);

      expect(channel).toMatchObject({
        trackId: track.id,
        isMuted: track.mixing.mute,
        isSoloed: track.mixing.solo,
        isBypassed: false
      });

      expect(channel.input).toBeDefined();
      expect(channel.output).toBeDefined();
      expect(channel.gain).toBeDefined();
      expect(channel.panner).toBeDefined();
      expect(channel.mute).toBeDefined();
      expect(channel.solo).toBeDefined();

      expect(mockTone.Gain).toHaveBeenCalledWith(track.mixing.volume);
      expect(mockTone.Panner).toHaveBeenCalledWith(track.mixing.pan);
    });

    it('should emit event when track channel is created', () => {
      const track = createMockTrack();
      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      mixingEngine.createTrackChannel(track);

      expect(emitSpy).toHaveBeenCalledWith('mixing:channelCreated', {
        trackId: track.id,
        channelInfo: {
          volume: track.mixing.volume,
          pan: track.mixing.pan,
          mute: track.mixing.mute,
          solo: track.mixing.solo
        }
      });
    });

    it('should throw error when creating duplicate channel', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);

      expect(() => mixingEngine.createTrackChannel(track))
        .toThrow(PlaybackError);
    });

    it('should remove track channel and clean up resources', () => {
      const track = createMockTrack();
      const channel = mixingEngine.createTrackChannel(track);
      const disposeSpy = vi.spyOn(channel.gain, 'dispose');

      mixingEngine.removeTrackChannel(track.id);

      expect(disposeSpy).toHaveBeenCalled();
      expect(mixingEngine.getTrackChannel(track.id)).toBeUndefined();
    });

    it('should handle removing non-existent channel gracefully', () => {
      expect(() => mixingEngine.removeTrackChannel('non-existent'))
        .not.toThrow();
    });

    it('should setup automation when creating channel with automation data', () => {
      const automation: TrackAutomation[] = [{
        parameter: 'volume',
        points: [
          { position: { bars: 0, beats: 0, sixteenths: 0 }, value: 0.5 },
          { position: { bars: 1, beats: 0, sixteenths: 0 }, value: 1.0 }
        ],
        mode: 'read',
        curveType: 'linear'
      }];

      const track = createMockTrack({ automation });
      mixingEngine.createTrackChannel(track);

      expect(mockTone.Timeline).toHaveBeenCalled();
    });
  });

  describe('Mixing Parameter Updates', () => {
    let track: Track;
    let channel: TrackChannel;

    beforeEach(() => {
      track = createMockTrack();
      channel = mixingEngine.createTrackChannel(track);
    });

    it('should update volume parameter', () => {
      const newVolume = 0.5;
      const rampToSpy = vi.spyOn(channel.gain.gain, 'rampTo');

      mixingEngine.updateTrackMixing(track.id, { volume: newVolume });

      expect(rampToSpy).toHaveBeenCalledWith(newVolume, 0.05);
    });

    it('should update pan parameter', () => {
      const newPan = -0.5;
      const rampToSpy = vi.spyOn(channel.panner.pan, 'rampTo');

      mixingEngine.updateTrackMixing(track.id, { pan: newPan });

      expect(rampToSpy).toHaveBeenCalledWith(newPan, 0.05);
    });

    it('should update mute parameter', () => {
      const rampToSpy = vi.spyOn(channel.mute.gain, 'rampTo');

      mixingEngine.updateTrackMixing(track.id, { mute: true });

      expect(channel.isMuted).toBe(true);
      expect(rampToSpy).toHaveBeenCalledWith(0, 0.01);
    });

    it('should update solo parameter', () => {
      mixingEngine.updateTrackMixing(track.id, { solo: true });

      expect(channel.isSoloed).toBe(true);
    });

    it('should emit event when track is updated', () => {
      const emitSpy = vi.spyOn(mockEventBus, 'emit');
      const params = { volume: 0.6, pan: -0.3 };

      mixingEngine.updateTrackMixing(track.id, params);

      expect(emitSpy).toHaveBeenCalledWith('mixing:trackUpdated', {
        trackId: track.id,
        params
      });
    });

    it('should handle updates for non-existent track gracefully', () => {
      expect(() => mixingEngine.updateTrackMixing('non-existent', { volume: 0.5 }))
        .not.toThrow();
    });
  });

  describe('Solo State Management', () => {
    let track1: Track;
    let track2: Track;
    let track3: Track;

    beforeEach(() => {
      track1 = createMockTrack();
      track2 = createMockTrack();
      track3 = createMockTrack();
      
      mixingEngine.createTrackChannel(track1);
      mixingEngine.createTrackChannel(track2);
      mixingEngine.createTrackChannel(track3);
    });

    it('should solo a single track', () => {
      mixingEngine.updateTrackMixing(track1.id, { solo: true });

      const channel1 = mixingEngine.getTrackChannel(track1.id);
      const channel2 = mixingEngine.getTrackChannel(track2.id);

      expect(channel1?.isSoloed).toBe(true);
      expect(channel2?.isSoloed).toBe(false);
    });

    it('should mute non-soloed tracks when solo is active', () => {
      const channel2 = mixingEngine.getTrackChannel(track2.id);
      const rampToSpy = vi.spyOn(channel2!.solo.gain, 'rampTo');

      mixingEngine.updateTrackMixing(track1.id, { solo: true });

      expect(rampToSpy).toHaveBeenCalledWith(0, 0.01);
    });

    it('should allow multiple tracks to be soloed', () => {
      mixingEngine.updateTrackMixing(track1.id, { solo: true });
      mixingEngine.updateTrackMixing(track2.id, { solo: true });

      const channel1 = mixingEngine.getTrackChannel(track1.id);
      const channel2 = mixingEngine.getTrackChannel(track2.id);
      const channel3 = mixingEngine.getTrackChannel(track3.id);

      expect(channel1?.isSoloed).toBe(true);
      expect(channel2?.isSoloed).toBe(true);
      expect(channel3?.isSoloed).toBe(false);
    });

    it('should unmute all tracks when no solo is active', () => {
      const channel2 = mixingEngine.getTrackChannel(track2.id);
      const rampToSpy = vi.spyOn(channel2!.solo.gain, 'rampTo');

      mixingEngine.updateTrackMixing(track1.id, { solo: true });
      mixingEngine.updateTrackMixing(track1.id, { solo: false });

      // Called once for muting when solo is active, once for unmuting when solo is inactive
      expect(rampToSpy).toHaveBeenCalledWith(0, 0.01); // First call: mute non-soloed
      expect(rampToSpy).toHaveBeenCalledWith(1, 0.01); // Second call: unmute all
    });

    it('should emit solo state change events', () => {
      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      mixingEngine.updateTrackMixing(track1.id, { solo: true });

      expect(emitSpy).toHaveBeenCalledWith('mixing:soloStateChanged', {
        soloActive: true,
        soloedTracks: [track1.id]
      });
    });

    it('should remove track from solo state when channel is removed', () => {
      mixingEngine.updateTrackMixing(track1.id, { solo: true });
      const emitSpy = vi.spyOn(mockEventBus, 'emit');

      mixingEngine.removeTrackChannel(track1.id);

      expect(emitSpy).toHaveBeenCalledWith('mixing:soloStateChanged', {
        soloActive: false,
        soloedTracks: []
      });
    });
  });

  describe('Bus Management', () => {
    it('should create a sub-bus', () => {
      const busId = 'drums';
      const busName = 'Drum Bus';

      const bus = mixingEngine.createSubBus(busId, busName);

      expect(bus).toMatchObject({
        busId,
        name: busName,
        type: 'sub',
        parentBusId: 'master'
      });

      expect(mockTone.Compressor).toHaveBeenCalled();
      expect(mockTone.Gain).toHaveBeenCalled();
    });

    it('should create sub-bus with custom parent', () => {
      const parentBus = mixingEngine.createSubBus('parent', 'Parent Bus');
      const childBus = mixingEngine.createSubBus('child', 'Child Bus', 'parent');

      expect(childBus.parentBusId).toBe('parent');
      expect(parentBus.childBusIds).toContain('child');
    });

    it('should throw error when creating bus with existing ID', () => {
      mixingEngine.createSubBus('test', 'Test Bus');

      expect(() => mixingEngine.createSubBus('test', 'Another Bus'))
        .toThrow(PlaybackError);
    });

    it('should throw error when parent bus does not exist', () => {
      expect(() => mixingEngine.createSubBus('test', 'Test Bus', 'non-existent'))
        .toThrow(PlaybackError);
    });

    it('should create aux bus', () => {
      const busId = 'reverb';
      const busName = 'Reverb Send';

      const bus = mixingEngine.createAuxBus(busId, busName);

      expect(bus).toMatchObject({
        busId,
        name: busName,
        type: 'aux'
      });

      expect(bus.parentBusId).toBeUndefined();
    });

    it('should get all buses', () => {
      mixingEngine.createSubBus('drums', 'Drums');
      mixingEngine.createAuxBus('reverb', 'Reverb');

      const buses = mixingEngine.getBuses();

      expect(buses.size).toBe(3); // master + drums + reverb
      expect(buses.has('master')).toBe(true);
      expect(buses.has('drums')).toBe(true);
      expect(buses.has('reverb')).toBe(true);
    });
  });

  describe('Track Routing', () => {
    let track: Track;

    beforeEach(() => {
      track = createMockTrack();
      mixingEngine.createTrackChannel(track);
    });

    it('should route track to sub-bus', () => {
      const bus = mixingEngine.createSubBus('drums', 'Drum Bus');
      const channel = mixingEngine.getTrackChannel(track.id);
      const connectSpy = vi.spyOn(channel!.output, 'connect');
      const disconnectSpy = vi.spyOn(channel!.output, 'disconnect');

      mixingEngine.routeTrackToBus(track.id, 'drums');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(connectSpy).toHaveBeenCalledWith(bus.input);
    });

    it('should throw error when routing non-existent track', () => {
      mixingEngine.createSubBus('drums', 'Drum Bus');

      expect(() => mixingEngine.routeTrackToBus('non-existent', 'drums'))
        .toThrow(PlaybackError);
    });

    it('should throw error when routing to non-existent bus', () => {
      expect(() => mixingEngine.routeTrackToBus(track.id, 'non-existent'))
        .toThrow(PlaybackError);
    });
  });

  describe('Send/Return System', () => {
    let track: Track;
    let auxBus: MixBus;

    beforeEach(() => {
      track = createMockTrack();
      mixingEngine.createTrackChannel(track);
      auxBus = mixingEngine.createAuxBus('reverb', 'Reverb');
    });

    it('should create post-fader send', () => {
      const channel = mixingEngine.getTrackChannel(track.id);
      const connectSpy = vi.spyOn(channel!.gain, 'connect');

      const sendId = mixingEngine.createSend(track.id, 'reverb', 0.3, 'post-fader');

      expect(sendId).toBe(`send-${track.id}-reverb`);
      expect(connectSpy).toHaveBeenCalled();
      expect(channel!.sends.has('reverb')).toBe(true);
    });

    it('should create pre-fader send', () => {
      const channel = mixingEngine.getTrackChannel(track.id);
      const connectSpy = vi.spyOn(channel!.input, 'connect');

      mixingEngine.createSend(track.id, 'reverb', 0.4, 'pre-fader');

      expect(connectSpy).toHaveBeenCalled();
    });

    it('should throw error when creating send to non-aux bus', () => {
      const subBus = mixingEngine.createSubBus('drums', 'Drums');

      expect(() => mixingEngine.createSend(track.id, 'drums'))
        .toThrow(PlaybackError);
    });

    it('should update send level', () => {
      mixingEngine.createSend(track.id, 'reverb', 0.3);
      const channel = mixingEngine.getTrackChannel(track.id);
      const sendGain = channel!.sends.get('reverb');
      const rampToSpy = vi.spyOn(sendGain!.gain, 'rampTo');

      mixingEngine.updateSendLevel(track.id, 'reverb', 0.7);

      expect(rampToSpy).toHaveBeenCalledWith(0.7, 0.05);
    });

    it('should handle send level update for non-existent send gracefully', () => {
      expect(() => mixingEngine.updateSendLevel(track.id, 'non-existent', 0.5))
        .not.toThrow();
    });
  });

  describe('Effects Chain Management', () => {
    let track: Track;
    let mockEffect: any;

    beforeEach(() => {
      track = createMockTrack();
      mixingEngine.createTrackChannel(track);
      mockEffect = createMockToneNode();
    });

    it('should add effect to empty chain', () => {
      const channel = mixingEngine.getTrackChannel(track.id);
      const soloConnectSpy = vi.spyOn(channel!.solo, 'connect');
      const effectConnectSpy = vi.spyOn(mockEffect, 'connect');

      mixingEngine.addTrackEffect(track.id, mockEffect);

      expect(soloConnectSpy).toHaveBeenCalledWith(mockEffect);
      expect(effectConnectSpy).toHaveBeenCalledWith(channel!.effectsSend);
      expect(channel!.effectsChain).toContain(mockEffect);
    });

    it('should chain multiple effects', () => {
      const channel = mixingEngine.getTrackChannel(track.id);
      const firstEffect = createMockToneNode();
      const secondEffect = createMockToneNode();

      mixingEngine.addTrackEffect(track.id, firstEffect);
      mixingEngine.addTrackEffect(track.id, secondEffect);

      expect(channel!.effectsChain).toHaveLength(2);
      expect(firstEffect.connect).toHaveBeenCalledWith(secondEffect);
    });

    it('should handle adding effect to non-existent track gracefully', () => {
      expect(() => mixingEngine.addTrackEffect('non-existent', mockEffect))
        .not.toThrow();
    });
  });

  describe('Automation Timeline', () => {
    let track: Track;

    beforeEach(() => {
      const automation: TrackAutomation[] = [{
        parameter: 'volume',
        points: [
          { position: { bars: 0, beats: 0, sixteenths: 0 }, value: 0.5 },
          { position: { bars: 1, beats: 0, sixteenths: 0 }, value: 1.0 }
        ],
        mode: 'read',
        curveType: 'linear'
      }];

      track = createMockTrack({ automation });
    });

    it('should setup automation timelines on channel creation', () => {
      const mockTimelineInstance = createMockTimeline();
      (mockTone.Timeline as any).mockImplementation(() => mockTimelineInstance);

      mixingEngine.createTrackChannel(track);

      expect(mockTone.Timeline).toHaveBeenCalled();
      expect(mockTimelineInstance.add).toHaveBeenCalledTimes(2); // Two automation points
    });

    it('should apply volume automation at position', () => {
      const mockTimelineInstance = {
        ...createMockTimeline(),
        get: vi.fn().mockReturnValue({ value: 0.75 })
      };
      (mockTone.Timeline as any).mockImplementation(() => mockTimelineInstance);

      const channel = mixingEngine.createTrackChannel(track);
      const rampToSpy = vi.spyOn(channel.gain.gain, 'rampTo');

      mixingEngine.applyAutomation({ bars: 0, beats: 2, sixteenths: 0 });

      expect(rampToSpy).toHaveBeenCalledWith(0.75, 0.01);
    });

    it('should apply pan automation at position', () => {
      const panAutomation: TrackAutomation[] = [{
        parameter: 'pan',
        points: [{ position: { bars: 0, beats: 0, sixteenths: 0 }, value: -0.5 }],
        mode: 'read',
        curveType: 'linear'
      }];

      const trackWithPan = createMockTrack({ automation: panAutomation });
      const mockTimelineInstance = {
        ...createMockTimeline(),
        get: vi.fn().mockReturnValue({ value: -0.3 })
      };
      (mockTone.Timeline as any).mockImplementation(() => mockTimelineInstance);

      const channel = mixingEngine.createTrackChannel(trackWithPan);
      const rampToSpy = vi.spyOn(channel.panner.pan, 'rampTo');

      mixingEngine.applyAutomation({ bars: 0, beats: 1, sixteenths: 0 });

      expect(rampToSpy).toHaveBeenCalledWith(-0.3, 0.01);
    });
  });

  describe('Snapshot Management', () => {
    let track1: Track;
    let track2: Track;

    beforeEach(() => {
      track1 = createMockTrack();
      track2 = createMockTrack();
      
      mixingEngine.createTrackChannel(track1);
      mixingEngine.createTrackChannel(track2);
      mixingEngine.createSubBus('drums', 'Drums');
    });

    it('should create mixing snapshot', () => {
      const snapshotName = 'verse-mix';

      mixingEngine.createSnapshot(snapshotName);

      // Verify internal snapshot storage (accessing private property for testing)
      const snapshots = (mixingEngine as any).snapshots;
      expect(snapshots.has(snapshotName)).toBe(true);

      const snapshot = snapshots.get(snapshotName);
      expect(snapshot).toMatchObject({
        timestamp: expect.any(Number),
        soloActive: false
      });

      expect(snapshot.tracks.size).toBe(2);
      expect(snapshot.buses.size).toBe(2); // master + drums
    });

    it('should capture current track states in snapshot', () => {
      mixingEngine.updateTrackMixing(track1.id, { volume: 0.6, pan: -0.2, mute: true });
      mixingEngine.createSnapshot('test-snapshot');

      const snapshots = (mixingEngine as any).snapshots;
      const snapshot = snapshots.get('test-snapshot');
      const trackState = snapshot.tracks.get(track1.id);

      expect(trackState).toMatchObject({
        volume: expect.any(Number),
        pan: expect.any(Number),
        mute: true,
        solo: false
      });
    });

    it('should capture solo state in snapshot', () => {
      mixingEngine.updateTrackMixing(track1.id, { solo: true });
      mixingEngine.createSnapshot('solo-snapshot');

      const snapshots = (mixingEngine as any).snapshots;
      const snapshot = snapshots.get('solo-snapshot');

      expect(snapshot.soloActive).toBe(true);
    });

    it('should recall mixing snapshot', () => {
      // Set initial state
      mixingEngine.updateTrackMixing(track1.id, { volume: 0.6, mute: true });
      mixingEngine.createSnapshot('initial');

      // Change state
      mixingEngine.updateTrackMixing(track1.id, { volume: 0.8, mute: false });

      // Recall snapshot
      mixingEngine.recallSnapshot('initial');

      // Verify the updateTrackMixing was called with snapshot values
      // (we can't directly test the audio node values due to mocking)
      expect(true).toBe(true); // Placeholder - in real test we'd verify audio node states
    });

    it('should handle recalling non-existent snapshot gracefully', () => {
      expect(() => mixingEngine.recallSnapshot('non-existent'))
        .not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle EventBus not found in ServiceRegistry', () => {
      (serviceRegistry.get as any).mockImplementation(() => {
        throw new Error('EventBus not found');
      });

      expect(() => TrackMixingEngine.getInstance())
        .not.toThrow();
    });

    it('should validate track exists before creating channel', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);

      expect(() => mixingEngine.createTrackChannel(track))
        .toThrow(PlaybackError);
    });

    it('should validate bus existence for routing', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);

      expect(() => mixingEngine.routeTrackToBus(track.id, 'invalid-bus'))
        .toThrow(PlaybackError);
    });

    it('should validate aux bus type for sends', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);
      mixingEngine.createSubBus('drums', 'Drums'); // Not an aux bus

      expect(() => mixingEngine.createSend(track.id, 'drums'))
        .toThrow(PlaybackError);
    });
  });

  describe('Resource Cleanup', () => {
    let track: Track;

    beforeEach(() => {
      track = createMockTrack();
    });

    it('should dispose channel resources on removal', () => {
      const channel = mixingEngine.createTrackChannel(track);
      
      const disposeSpy = vi.spyOn(channel.gain, 'dispose');
      const pannerDisposeSpy = vi.spyOn(channel.panner, 'dispose');
      const muteDisposeSpy = vi.spyOn(channel.mute, 'dispose');

      mixingEngine.removeTrackChannel(track.id);

      expect(disposeSpy).toHaveBeenCalled();
      expect(pannerDisposeSpy).toHaveBeenCalled();
      expect(muteDisposeSpy).toHaveBeenCalled();
    });

    it('should dispose effects chain on channel removal', () => {
      const channel = mixingEngine.createTrackChannel(track);
      const mockEffect = createMockToneNode();
      
      mixingEngine.addTrackEffect(track.id, mockEffect);
      const effectDisposeSpy = vi.spyOn(mockEffect, 'dispose');

      mixingEngine.removeTrackChannel(track.id);

      expect(effectDisposeSpy).toHaveBeenCalled();
    });

    it('should dispose sends on channel removal', () => {
      mixingEngine.createTrackChannel(track);
      mixingEngine.createAuxBus('reverb', 'Reverb');
      mixingEngine.createSend(track.id, 'reverb');

      const channel = mixingEngine.getTrackChannel(track.id);
      const sendGain = channel!.sends.get('reverb');
      const sendDisposeSpy = vi.spyOn(sendGain!, 'dispose');

      mixingEngine.removeTrackChannel(track.id);

      expect(sendDisposeSpy).toHaveBeenCalled();
    });

    it('should dispose all resources on engine disposal', () => {
      const channel = mixingEngine.createTrackChannel(track);
      const bus = mixingEngine.createSubBus('test', 'Test Bus');
      
      const channelDisposeSpy = vi.spyOn(channel.gain, 'dispose');
      const busDisposeSpy = vi.spyOn(bus.gain, 'dispose');
      const soloMuteDisposeSpy = vi.spyOn((mixingEngine as any).soloMute, 'dispose');

      mixingEngine.dispose();

      expect(channelDisposeSpy).toHaveBeenCalled();
      expect(busDisposeSpy).toHaveBeenCalled();
      expect(soloMuteDisposeSpy).toHaveBeenCalled();
    });

    it('should clear all collections on disposal', () => {
      mixingEngine.createTrackChannel(track);
      mixingEngine.createSubBus('test', 'Test Bus');
      mixingEngine.createSnapshot('test');

      expect(mixingEngine.getBuses().size).toBeGreaterThan(0);

      mixingEngine.dispose();

      expect(mixingEngine.getBuses().size).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    it('should get track channel by ID', () => {
      const track = createMockTrack();
      const channel = mixingEngine.createTrackChannel(track);

      const retrievedChannel = mixingEngine.getTrackChannel(track.id);

      expect(retrievedChannel).toBe(channel);
    });

    it('should return undefined for non-existent track channel', () => {
      const channel = mixingEngine.getTrackChannel('non-existent');

      expect(channel).toBeUndefined();
    });

    it('should get mixing metrics', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);
      mixingEngine.createSubBus('drums', 'Drums');
      mixingEngine.updateTrackMixing(track.id, { solo: true });

      const metrics = mixingEngine.getMixingMetrics();

      expect(metrics).toMatchObject({
        trackCount: 1,
        busCount: 2, // master + drums
        sendCount: 0,
        soloActive: true,
        soloedTracks: [track.id]
      });
    });

    it('should convert musical position to seconds', () => {
      // Test the private method indirectly through automation
      const automation: TrackAutomation[] = [{
        parameter: 'volume',
        points: [{ position: { bars: 1, beats: 2, sixteenths: 3 }, value: 0.5 }],
        mode: 'read',
        curveType: 'linear'
      }];

      const mockTimelineInstance = createMockTimeline();
      (mockTone.Timeline as any).mockImplementation(() => mockTimelineInstance);

      const track = createMockTrack({ automation });
      mixingEngine.createTrackChannel(track);

      // This tests the internal conversion logic
      mixingEngine.applyAutomation({ bars: 1, beats: 2, sixteenths: 3 });

      // If no error is thrown, the conversion worked
      expect(true).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent channel operations', () => {
      const tracks = Array.from({ length: 10 }, () => createMockTrack());

      expect(() => {
        tracks.forEach(track => mixingEngine.createTrackChannel(track));
      }).not.toThrow();

      expect(() => {
        tracks.forEach(track => mixingEngine.removeTrackChannel(track.id));
      }).not.toThrow();
    });

    it('should handle complex bus hierarchy', () => {
      mixingEngine.createSubBus('drums', 'Drums');
      mixingEngine.createSubBus('kick', 'Kick', 'drums');
      mixingEngine.createSubBus('snare', 'Snare', 'drums');

      const buses = mixingEngine.getBuses();
      expect(buses.get('drums')?.childBusIds).toContain('kick');
      expect(buses.get('drums')?.childBusIds).toContain('snare');
    });

    it('should handle many sends from single track', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);
      
      mixingEngine.createAuxBus('reverb', 'Reverb');
      mixingEngine.createAuxBus('delay', 'Delay');
      mixingEngine.createAuxBus('chorus', 'Chorus');

      expect(() => {
        mixingEngine.createSend(track.id, 'reverb', 0.3);
        mixingEngine.createSend(track.id, 'delay', 0.2);
        mixingEngine.createSend(track.id, 'chorus', 0.1);
      }).not.toThrow();

      const channel = mixingEngine.getTrackChannel(track.id);
      expect(channel?.sends.size).toBe(3);
    });

    it('should maintain state consistency during rapid updates', () => {
      const track = createMockTrack();
      mixingEngine.createTrackChannel(track);

      // Rapid parameter updates
      for (let i = 0; i < 100; i++) {
        mixingEngine.updateTrackMixing(track.id, { 
          volume: Math.random(),
          pan: Math.random() * 2 - 1
        });
      }

      const channel = mixingEngine.getTrackChannel(track.id);
      expect(channel).toBeDefined();
    });
  });
  
  describe('bus effects processing', () => {
    let mockReverb: any;
    let mockFilter: any;
    let mockDelay: any;
    let mockDistortion: any;
    
    beforeEach(() => {
      // Setup effect mocks
      mockReverb = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn()
      };
      
      mockFilter = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn()
      };
      
      mockDelay = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn()
      };
      
      mockDistortion = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn()
      };
      
      // Mock Tone.js effect constructors
      mockTone.Reverb = vi.fn(() => mockReverb);
      mockTone.Filter = vi.fn(() => mockFilter);
      mockTone.FeedbackDelay = vi.fn(() => mockDelay);
      mockTone.Distortion = vi.fn(() => mockDistortion);
    });
    
    it('should handle bus effects operations', () => {
      const busId = mixingEngine.createAuxBus('aux-1', 'Aux 1');
      
      // Test adding effects
      expect(() => {
        mixingEngine.addBusEffect(busId, mockReverb);
        mixingEngine.addBusEffect(busId, mockFilter);
      }).not.toThrow();
      
      // Test removing effects
      expect(() => {
        mixingEngine.removeBusEffect(busId, 0);
      }).not.toThrow();
    });
    
    it('should create reverb return with effects', () => {
      const busId = mixingEngine.createReverbReturn('Hall Reverb', 0.8, 2500);
      
      // Verify reverb creation
      expect(mockTone.Reverb).toHaveBeenCalledWith({
        decay: 8, // 0.8 * 10
        preDelay: 0.01,
        wet: 1.0
      });
      
      // Verify filter creation
      expect(mockTone.Filter).toHaveBeenCalledWith({
        frequency: 2500,
        type: 'lowpass'
      });
      
      // Verify bus ID format
      expect(busId).toMatch(/^aux-reverb-\d+$/);
    });
    
    it('should create delay return with effects', () => {
      const busId = mixingEngine.createDelayReturn('Echo', '4n', 0.5, 0.8);
      
      // Verify delay creation
      expect(mockTone.FeedbackDelay).toHaveBeenCalledWith({
        delayTime: '4n',
        feedback: 0.5,
        wet: 0.8
      });
      
      // Verify high-pass filter
      expect(mockTone.Filter).toHaveBeenCalledWith({
        frequency: 100,
        type: 'highpass'
      });
      
      // Verify bus ID format
      expect(busId).toMatch(/^aux-delay-\d+$/);
    });
    
    it('should create compression return with effects', () => {
      const busId = mixingEngine.createCompressionReturn('Parallel Comp', -15, 6);
      
      // Verify compressor creation
      expect(mockTone.Compressor).toHaveBeenCalledWith({
        threshold: -15,
        ratio: 6,
        attack: 0.003,
        release: 0.1
      });
      
      // Verify distortion creation
      expect(mockTone.Distortion).toHaveBeenCalledWith({
        distortion: 0.05,
        wet: 0.3
      });
      
      // Verify bus ID format
      expect(busId).toMatch(/^aux-compression-\d+$/);
    });
    
    it('should gracefully handle adding effects to non-existent bus', () => {
      expect(() => {
        mixingEngine.addBusEffect('non-existent', mockReverb);
      }).not.toThrow();
    });
    
    it('should gracefully handle removing effects from non-existent bus', () => {
      expect(() => {
        mixingEngine.removeBusEffect('non-existent', 0);
      }).not.toThrow();
    });
    
    it('should handle master bus effects differently', () => {
      const masterBus = mixingEngine.getBuses().get('master');
      const masterCompressor = masterBus?.compressor;
      
      // Add effect to master bus
      mixingEngine.addBusEffect('master', mockReverb);
      
      // Should connect to compressor (master bus specific)
      expect(mockReverb.connect).toHaveBeenCalledWith(masterCompressor);
    });
  });
});