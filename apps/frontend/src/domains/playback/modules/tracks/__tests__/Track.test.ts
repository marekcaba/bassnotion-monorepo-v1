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
      expect(track.state).toBe('stopped');
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
      region1 = new Region({
        type: 'midi',
        position: { bar: 0, beat: 0, tick: 0 },
        length: { bar: 2, beat: 0, tick: 0 },
        content: { type: 'pattern', patternId: 'pattern1' },
      });

      region2 = new Region({
        type: 'midi',
        position: { bar: 2, beat: 0, tick: 0 },
        length: { bar: 2, beat: 0, tick: 0 },
        content: { type: 'pattern', patternId: 'pattern2' },
      });
    });

    it('should add region', () => {
      track.addRegion(region1);
      expect(track.regions).toHaveLength(1);
      expect(track.regions[0]).toBe(region1);
    });

    it('should validate region on add', () => {
      const invalidRegion = new Region({
        type: 'audio', // Wrong type for MIDI track
        position: { bar: 0, beat: 0, tick: 0 },
        length: { bar: 1, beat: 0, tick: 0 },
        content: { 
          type: 'audio', 
          clipId: 'clip1',
          url: 'test.wav',
          duration: 1000,
        },
      });

      expect(() => track.addRegion(invalidRegion)).toThrow();
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
        { bar: 3, beat: 0, tick: 0 }
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
      expect(track.state).toBe('stopped');
      
      // Initialize
      await track.initialize();
      expect(['loading', 'ready']).toContain(track.state);
      
      // Play
      track.play();
      expect(track.state).toBe('playing');
      
      // Stop
      track.stop();
      expect(track.state).toBe('stopped');
    });

    it('should handle record state', () => {
      track.state = 'ready';
      track.record();
      expect(track.state).toBe('recording');
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
        enabled: true,
        curveType: 'linear' as const,
      };

      track.addAutomation(automation);
      expect(track.automation).toHaveLength(1);
      expect(track.automation[0].parameter).toBe('volume');
    });

    it('should remove automation', () => {
      const automation = {
        parameter: 'pan',
        points: [],
        enabled: true,
        curveType: 'linear' as const,
      };

      track.addAutomation(automation);
      track.removeAutomation('pan');
      
      expect(track.automation).toHaveLength(0);
    });
  });

  describe('routing', () => {
    it('should update routing', () => {
      track.updateRouting({
        outputBus: 'drums-bus',
        sends: [
          { busId: 'reverb', level: 0.3, enabled: true },
        ],
      });

      expect(track.routing.outputBus).toBe('drums-bus');
      expect(track.routing.sends).toHaveLength(1);
      expect(track.routing.sends[0].level).toBe(0.3);
    });
  });

  describe('sync configuration', () => {
    it('should update sync settings', () => {
      track.updateSync({
        followTransport: false,
        quantization: {
          enabled: true,
          value: '1/8',
          strength: 0.8,
        },
      });

      expect(track.sync.followTransport).toBe(false);
      expect(track.sync.quantization.value).toBe('1/8');
    });
  });

  describe('event emission', () => {
    it('should emit lifecycle events', async () => {
      const onStateChange = vi.fn();
      track.on('stateChanged', onStateChange);

      await track.initialize();
      track.play();
      
      expect(onStateChange).toHaveBeenCalled();
    });

    it('should emit mixing events', () => {
      const onMixingUpdate = vi.fn();
      track.on('mixingUpdated', onMixingUpdate);

      track.updateMixing({ volume: 0.9 });
      
      expect(onMixingUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          trackId: track.id,
          newMixing: expect.objectContaining({ volume: 0.9 }),
        })
      );
    });
  });

  describe('serialization', () => {
    it('should export track configuration', () => {
      const exported = track.export();
      
      expect(exported).toMatchObject({
        id: track.id,
        name: 'Test Track',
        instrumentType: 'bass',
        regions: [],
        automation: [],
      });
    });

    it('should create from export', () => {
      track.addRegion(new Region({
        type: 'midi',
        position: { bar: 0, beat: 0, tick: 0 },
        length: { bar: 1, beat: 0, tick: 0 },
        content: { type: 'pattern', patternId: 'test' },
      }));

      const exported = track.export();
      const imported = Track.fromExport(exported);
      
      expect(imported.name).toBe(track.name);
      expect(imported.regions).toHaveLength(1);
    });
  });
});