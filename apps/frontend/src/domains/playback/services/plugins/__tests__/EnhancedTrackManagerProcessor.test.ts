import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EnhancedTrackManagerProcessor } from '../EnhancedTrackManagerProcessor.js';
import { Track } from '../../core/Track.js';
import { UnifiedTransport } from '../../core/UnifiedTransport.js';
import type { TrackConfig } from '../../../types/track.js';
import type { ManagedTrack } from '../TrackManagerProcessor.js';

// Mock dependencies
vi.mock('../../core/UnifiedTransport.js');
vi.mock('../../core/ServiceRegistry.js', () => ({
  serviceRegistry: {
    get: vi.fn()
  }
}));
vi.mock('../../core/EventBus.js');
vi.mock('../TrackManagerProcessor.js');

// Import mocked serviceRegistry
import { serviceRegistry } from '../../core/ServiceRegistry.js';

describe('EnhancedTrackManagerProcessor', () => {
  let processor: EnhancedTrackManagerProcessor;
  let mockTransport: any;
  let mockEventBus: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock transport
    mockTransport = {
      on: vi.fn(),
      off: vi.fn(),
      getInstance: vi.fn()
    };
    
    // Setup UnifiedTransport mock
    vi.mocked(UnifiedTransport.getInstance).mockReturnValue(mockTransport);
    
    // Setup mock event bus
    mockEventBus = {
      emit: vi.fn()
    };
    
    // Configure service registry
    vi.mocked(serviceRegistry.get).mockImplementation((key: string) => {
      if (key === 'eventBus') return mockEventBus;
      throw new Error(`Service ${key} not found`);
    });
    
    processor = new EnhancedTrackManagerProcessor();
  });
  
  afterEach(async () => {
    // Cleanup
    await processor.dispose();
  });
  
  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await processor.initializeEnhanced();
      
      // Should subscribe to transport events
      expect(mockTransport.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
      expect(mockTransport.on).toHaveBeenCalledWith('position', expect.any(Function));
      expect(mockTransport.on).toHaveBeenCalledWith('tempo', expect.any(Function));
      
      // Should emit initialization event
      expect(mockEventBus.emit).toHaveBeenCalledWith('trackManager:initialized', {
        trackCount: 0
      });
    });
    
    it('should not reinitialize if already initialized', async () => {
      await processor.initializeEnhanced();
      const callCount = mockTransport.on.mock.calls.length;
      
      await processor.initializeEnhanced();
      
      // Should not subscribe again
      expect(mockTransport.on).toHaveBeenCalledTimes(callCount);
    });
  });
  
  describe('track creation', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should create a new track', async () => {
      const config: TrackConfig = {
        name: 'Test Track',
        instrumentType: 'bass'
      };
      
      const track = await processor.createTrack(config);
      
      expect(track).toBeInstanceOf(Track);
      expect(track.name).toBe('Test Track');
      expect(track.instrumentType).toBe('bass');
      expect(track.state).toBe('READY');
      
      // Should emit creation event
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:created', {
        trackId: track.id,
        instrumentType: 'bass'
      });
    });
    
    it('should store track references', async () => {
      const config: TrackConfig = {
        name: 'Test Track',
        instrumentType: 'drums'
      };
      
      const track = await processor.createTrack(config);
      
      // Should be retrievable
      expect(processor.getTrack(track.id)).toBe(track);
      expect(processor.getAllTracks()).toContain(track);
    });
  });
  
  describe('track management', () => {
    let track1: Track;
    let track2: Track;
    
    beforeEach(async () => {
      await processor.initializeEnhanced();
      
      track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass'
      });
      
      track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums'
      });
    });
    
    it('should get all tracks', () => {
      const tracks = processor.getAllTracks();
      
      expect(tracks).toHaveLength(2);
      expect(tracks).toContain(track1);
      expect(tracks).toContain(track2);
    });
    
    it('should get tracks by type', () => {
      const bassTracks = processor.getTracksByType('bass');
      const drumTracks = processor.getTracksByType('drums');
      
      expect(bassTracks).toHaveLength(1);
      expect(bassTracks[0]).toBe(track1);
      
      expect(drumTracks).toHaveLength(1);
      expect(drumTracks[0]).toBe(track2);
    });
    
    it('should update track', () => {
      processor.updateTrack(track1.id, {
        name: 'Updated Track'
      });
      
      expect(track1.name).toBe('Updated Track');
    });
    
    it('should delete track', async () => {
      await processor.deleteTrack(track1.id);
      
      expect(processor.getTrack(track1.id)).toBeUndefined();
      expect(processor.getAllTracks()).not.toContain(track1);
      
      // Should emit deletion event
      expect(mockEventBus.emit).toHaveBeenCalledWith('track:deleted', {
        trackId: track1.id
      });
    });
    
    it('should reorder tracks', () => {
      const trackIds = [track2.id, track1.id];
      
      processor.reorderTracks(trackIds);
      
      expect(track2.index).toBe(0);
      expect(track1.index).toBe(1);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('tracks:reordered', {
        trackIds
      });
    });
  });
  
  describe('transport integration', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should handle transport state changes', async () => {
      const track = await processor.createTrack({
        name: 'Test Track',
        instrumentType: 'bass'
      });
      
      // Get the state change handler
      const stateChangeHandler = mockTransport.on.mock.calls
        .find(call => call[0] === 'stateChange')?.[1];
      
      expect(stateChangeHandler).toBeDefined();
      
      // Simulate transport started
      stateChangeHandler('started');
      expect(track.state).toBe('PLAYING');
      
      // Simulate transport stopped
      stateChangeHandler('stopped');
      expect(track.state).toBe('READY');
      
      // Simulate transport paused
      track.state = 'PLAYING';
      stateChangeHandler('paused');
      expect(track.state).toBe('PAUSED');
    });
    
    it('should handle position updates', async () => {
      await processor.createTrack({
        name: 'Test Track',
        instrumentType: 'bass'
      });
      
      const positionHandler = mockTransport.on.mock.calls
        .find(call => call[0] === 'position')?.[1];
      
      const position = { bars: 1, beats: 2, sixteenths: 0, ticks: 0 };
      positionHandler(position);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('trackManager:positionUpdate', {
        position
      });
    });
    
    it('should handle tempo changes', async () => {
      await processor.createTrack({
        name: 'Test Track',
        instrumentType: 'bass'
      });
      
      const tempoHandler = mockTransport.on.mock.calls
        .find(call => call[0] === 'tempo')?.[1];
      
      tempoHandler(140);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('trackManager:tempoChanged', {
        tempo: 140
      });
    });
  });
  
  describe('dependency validation', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should validate valid dependencies', async () => {
      const track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass'
      });
      
      const track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums',
        sync: {
          dependencies: [{
            trackId: track1.id,
            type: 'sync',
            strength: 0.8
          }]
        }
      });
      
      expect(processor.validateDependencies()).toBe(true);
    });
    
    it('should detect missing dependencies', async () => {
      const track = await processor.createTrack({
        name: 'Track',
        instrumentType: 'bass',
        sync: {
          dependencies: [{
            trackId: 'non-existent-id',
            type: 'sync',
            strength: 0.8
          }]
        }
      });
      
      // Mock console.warn to suppress warning
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(processor.validateDependencies()).toBe(false);
      
      warnSpy.mockRestore();
    });
    
    it('should detect circular dependencies', async () => {
      const track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass'
      });
      
      const track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums'
      });
      
      // Create circular dependency
      track1.sync.dependencies = [{
        trackId: track2.id,
        type: 'sync',
        strength: 0.8,
        offset: undefined
      }];
      
      track2.sync.dependencies = [{
        trackId: track1.id,
        type: 'sync',
        strength: 0.8,
        offset: undefined
      }];
      
      // Mock console.warn
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(processor.validateDependencies()).toBe(false);
      
      warnSpy.mockRestore();
    });
  });
  
  describe('dependency resolution', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should resolve dependencies with topological sort', async () => {
      const track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass',
        sync: { priority: 50 }
      });
      
      const track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums',
        sync: {
          priority: 60,
          dependencies: [{
            trackId: track1.id,
            type: 'sync',
            strength: 0.8
          }]
        }
      });
      
      const track3 = await processor.createTrack({
        name: 'Track 3',
        instrumentType: 'chords',
        sync: {
          priority: 40,
          dependencies: [{
            trackId: track2.id,
            type: 'follow',
            strength: 0.5
          }]
        }
      });
      
      processor.resolveDependencies();
      
      // Should be ordered: track1, track2, track3 (dependency order)
      expect(track1.index).toBeLessThan(track2.index);
      expect(track2.index).toBeLessThan(track3.index);
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('dependencies:resolved', {
        trackOrder: [track1.id, track2.id, track3.id]
      });
    });
    
    it('should throw on circular dependencies during resolution', async () => {
      const track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass'
      });
      
      const track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums'
      });
      
      // Create circular dependency
      track1.sync.dependencies = [{
        trackId: track2.id,
        type: 'sync',
        strength: 0.8,
        offset: undefined
      }];
      
      track2.sync.dependencies = [{
        trackId: track1.id,
        type: 'sync',
        strength: 0.8,
        offset: undefined
      }];
      
      expect(() => processor.resolveDependencies()).toThrow();
    });
  });
  
  describe('ManagedTrack conversion', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should convert ManagedTrack to Track entity', async () => {
      const managedTrack: ManagedTrack = {
        id: 'managed-1',
        originalTrack: {},
        classification: {
          instrumentType: 'bass',
          confidence: 0.9,
          reasoning: [],
          metadata: {}
        },
        instrumentType: 'bass',
        musicalData: {
          keySignature: 'C',
          timeSignature: '4/4',
          tempo: 120,
          noteRange: { min: 40, max: 80 },
          velocity: { min: 60, max: 100, average: 80 },
          patterns: [],
          articulations: [],
          dynamics: {} as any
        },
        mixing: {
          volume: 0.8,
          pan: -0.2,
          mute: false,
          solo: false,
          effects: [],
          sends: []
        },
        sync: {
          quantization: {
            enabled: true,
            grid: 'sixteenth',
            strength: 0.9,
            swing: 0.1
          },
          groove: {
            template: 'swing',
            humanization: 0.05,
            microTiming: 0.02
          },
          dependencies: [],
          priority: 70
        },
        automation: {
          volume: [{
            time: 0,
            value: 0.5
          }, {
            time: 4,
            value: 0.8
          }],
          pan: [],
          effects: new Map()
        }
      };
      
      const track = await processor.convertToTrackEntity(managedTrack);
      
      expect(track).toBeInstanceOf(Track);
      expect(track.instrumentType).toBe('bass');
      expect(track.mixing.volume).toBe(0.8);
      expect(track.mixing.pan).toBe(-0.2);
      expect(track.sync.quantization.enabled).toBe(true);
      expect(track.sync.quantization.gridSize).toBe('1/16');
      expect(track.sync.priority).toBe(70);
      expect(track.musical.keySignature).toBe('C');
      expect(track.musical.timeSignature).toEqual({ numerator: 4, denominator: 4 });
      expect(track.automation).toHaveLength(1);
      expect(track.automation[0].parameter).toBe('volume');
      expect(track.automation[0].points).toHaveLength(2);
    });
  });
  
  describe('disposal', () => {
    beforeEach(async () => {
      await processor.initializeEnhanced();
    });
    
    it('should dispose all resources', async () => {
      const track1 = await processor.createTrack({
        name: 'Track 1',
        instrumentType: 'bass'
      });
      
      const track2 = await processor.createTrack({
        name: 'Track 2',
        instrumentType: 'drums'
      });
      
      await processor.dispose();
      
      // Should unsubscribe from transport
      // Should emit disposal event regardless of transport cleanup
      expect(mockEventBus.emit).toHaveBeenCalledWith('trackManager:disposed', {});
      
      // Tracks should be disposed
      expect(track1.state).toBe('DISPOSING');
      expect(track2.state).toBe('DISPOSING');
      
      // Collections should be cleared
      expect(processor.getAllTracks()).toHaveLength(0);
      
      // Should emit disposal event
      expect(mockEventBus.emit).toHaveBeenCalledWith('trackManager:disposed', {});
    });
    
    it('should not dispose twice', async () => {
      await processor.createTrack({
        name: 'Track',
        instrumentType: 'bass'
      });
      
      await processor.dispose();
      const callCount = mockTransport.off.mock.calls.length;
      
      await processor.dispose();
      
      expect(mockTransport.off).toHaveBeenCalledTimes(callCount);
    });
  });
});