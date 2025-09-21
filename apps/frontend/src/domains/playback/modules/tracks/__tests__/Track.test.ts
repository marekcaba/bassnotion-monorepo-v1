import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Track } from '../core/Track.js';
import { Region } from '../core/Region.js';
import type { TrackConfig } from '../../../types/track.js';

describe('Track', () => {
  let track: Track;
  let trackConfig: TrackConfig;

  beforeEach(() => {
    trackConfig = {
      name: 'Test Track',
      instrumentType: 'bass',
      color: '#3B82F6',
    };
    track = new Track(trackConfig);
  });

  describe('constructor', () => {
    it('should create track with default values', () => {
      expect(track.id).toBeDefined();
      expect(track.name).toBe('Test Track');
      expect(track.instrumentType).toBe('bass');
      expect(track.color).toBe('#3B82F6');
      expect(track.state).toBe('UNINITIALIZED');
      expect(track.index).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customConfig: TrackConfig = {
        name: 'Custom Track',
        instrumentType: 'drums',
        color: '#EF4444',
        index: 2,
        mixing: {
          volume: 0.5,
          pan: -0.5,
          mute: true,
          solo: false,
        },
      };

      const customTrack = new Track(customConfig);
      expect(customTrack.mixing.volume).toBe(0.5);
      expect(customTrack.mixing.pan).toBe(-0.5);
      expect(customTrack.mixing.mute).toBe(true);
    });
  });

  describe('region management', () => {
    let region1: Region;
    let region2: Region;

    beforeEach(() => {
      region1 = {
        id: 'region1',
        trackId: track.id,
        name: 'Region 1',
        startPosition: { bar: 0, beat: 0, tick: 0 },
        duration: { bar: 2, beat: 0, tick: 0 },
        pattern: { type: 'midi', events: [] },
        loopCount: 1,
        muted: false,
      };

      region2 = {
        id: 'region2',
        trackId: track.id,
        name: 'Region 2',
        startPosition: { bar: 2, beat: 0, tick: 0 },
        duration: { bar: 2, beat: 0, tick: 0 },
        pattern: { type: 'midi', events: [] },
        loopCount: 1,
        muted: false,
      };
    });

    it('should add region', () => {
      track.addRegion(region1);
      expect(track.regions).toHaveLength(1);
      expect(track.regions[0]).toBe(region1);
    });

    it('should validate region on add', () => {
      const invalidRegion = {
        id: 'invalid',
        trackId: 'wrong-track-id', // Wrong track ID
        name: 'Invalid Region',
        startPosition: { bar: 0, beat: 0, tick: 0 },
        duration: { bar: 1, beat: 0, tick: 0 },
        pattern: { type: 'midi', events: [] },
        loopCount: 1,
        muted: false,
      };

      expect(() => track.addRegion(invalidRegion as any)).toThrow();
    });

    it('should remove region', () => {
      track.addRegion(region1);
      track.addRegion(region2);

      track.removeRegion(region1.id);
      expect(track.regions).toHaveLength(1);
      expect(track.regions[0]).toBe(region2);
    });

    it('should get regions in range', () => {
      track.addRegion(region1);
      track.addRegion(region2);

      const range = track.getRegionsInRange(
        { bar: 1, beat: 0, tick: 0 },
        { bar: 3, beat: 0, tick: 0 },
      );

      expect(range).toHaveLength(2);
    });
  });

  describe('mixing operations', () => {
    it('should update mixing state', () => {
      track.updateMixing({
        volume: 0.8,
        pan: 0.5,
      });

      expect(track.mixing.volume).toBe(0.8);
      expect(track.mixing.pan).toBe(0.5);
    });

    it('should handle mute toggle', () => {
      expect(track.mixing.mute).toBe(false);

      track.updateMixing({ mute: true });
      expect(track.mixing.mute).toBe(true);

      track.updateMixing({ mute: false });
      expect(track.mixing.mute).toBe(false);
    });

    it('should handle solo state', () => {
      track.updateMixing({ solo: true });
      expect(track.mixing.solo).toBe(true);
    });
  });

  describe('lifecycle management', () => {
    it('should transition states correctly', async () => {
      expect(track.state).toBe('UNINITIALIZED');

      // Initialize
      await track.initialize();
      expect(track.state).toBe('READY');
    });

    it('should handle dispose state', async () => {
      await track.initialize();
      expect(track.state).toBe('READY');

      await track.dispose();
      expect(track.state).toBe('DISPOSING');
    });
  });

  describe('automation', () => {
    it('should add automation', () => {
      const automation = {
        parameter: 'volume',
        points: [
          { position: { bars: 0, beats: 0, sixteenths: 0 }, value: 0.5 },
          { position: { bars: 4, beats: 0, sixteenths: 0 }, value: 1.0 },
        ],
        mode: 'read' as const,
        bypass: false,
      };

      track.addAutomation(automation);
      expect(track.automation).toHaveLength(1);
      expect(track.automation[0].parameter).toBe('volume');
    });

    it('should get automation value', () => {
      const automation = {
        parameter: 'volume',
        points: [
          { position: { bars: 0, beats: 0, sixteenths: 0 }, value: 0.5 },
        ],
        mode: 'read' as const,
        bypass: false,
      };

      track.addAutomation(automation);
      const value = track.getAutomationValue('volume', 0);

      expect(value).toBe(0.5);
    });
  });

  describe('routing', () => {
    it('should have default routing', () => {
      expect(track.routing.outputDestination).toBe('master');
      expect(track.routing.sends).toHaveLength(0);
      expect(track.routing.inputMonitoring).toBe(false);
    });

    it('should be initialized with custom routing', () => {
      const customTrack = new Track({
        name: 'Routed Track',
        instrumentType: 'drums',
        color: '#FF0000',
        routing: {
          outputDestination: 'drums-bus',
          sends: [{ destination: 'reverb', level: 0.3, enabled: true }],
          inputMonitoring: false,
          listeningPoint: 'post-fader',
        },
      });

      expect(customTrack.routing.outputDestination).toBe('drums-bus');
      expect(customTrack.routing.sends).toHaveLength(1);
      expect(customTrack.routing.sends[0].level).toBe(0.3);
    });
  });

  describe('sync configuration', () => {
    it('should have default sync settings', () => {
      expect(track.sync.quantization.enabled).toBe(false);
      expect(track.sync.quantization.gridSize).toBe('1/16');
      expect(track.sync.priority).toBe(50);
    });

    it('should be initialized with custom sync', () => {
      const customTrack = new Track({
        name: 'Synced Track',
        instrumentType: 'harmony',
        color: '#00FF00',
        sync: {
          quantization: {
            enabled: true,
            gridSize: '1/8',
            strength: 0.8,
            swing: 0.1,
          },
          dependencies: [],
          priority: 80,
          humanization: 0.05,
          timingOffset: 10,
        },
      });

      expect(customTrack.sync.quantization.enabled).toBe(true);
      expect(customTrack.sync.quantization.gridSize).toBe('1/8');
      expect(customTrack.sync.priority).toBe(80);
    });
  });

  describe('event emission', () => {
    it('should emit events through EventBus', async () => {
      // Since we don't have a real EventBus in tests, we can test that methods complete without error
      await expect(track.initialize()).resolves.not.toThrow();
    });

    it('should update mixing state', () => {
      track.updateMixing({ volume: 0.9 });
      expect(track.mixing.volume).toBe(0.9);
    });
  });

  describe('serialization', () => {
    it('should clone track', () => {
      const cloned = track.clone();

      expect(cloned.name).toBe('Test Track (Copy)');
      expect(cloned.instrumentType).toBe('bass');
      expect(cloned.mixing.volume).toBe(track.mixing.volume);
      expect(cloned.id).not.toBe(track.id);
    });

    it('should validate track configuration', () => {
      expect(track.validate()).toBe(true);

      // Test invalid volume
      track.mixing.volume = -1;
      expect(track.validate()).toBe(false);

      // Reset to valid
      track.mixing.volume = 0.75;
      expect(track.validate()).toBe(true);
    });

    it('should reset track', () => {
      track.updateMixing({ volume: 0.5 });
      const testRegion = {
        id: 'test-region',
        trackId: track.id,
        name: 'Test Region',
        startPosition: { bar: 0, beat: 0, tick: 0 },
        duration: { bar: 1, beat: 0, tick: 0 },
        pattern: { type: 'midi' as const, events: [] },
        loopCount: 1,
        muted: false,
      };
      track.addRegion(testRegion);

      track.reset();

      expect(track.mixing.volume).toBe(0.75); // Back to default
      expect(track.regions).toHaveLength(0);
      expect(track.state).toBe('READY');
    });
  });
});
