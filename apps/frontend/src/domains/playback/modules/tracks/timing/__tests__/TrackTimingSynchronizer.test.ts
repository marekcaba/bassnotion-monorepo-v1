import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrackTimingSynchronizer } from '../TrackTimingSynchronizer';
import { Transport } from '../../../../transport/core/Transport';
import { EventBus } from '../../../../../services/core/EventBus';
import type { MusicalPosition } from '../../../../transport/types';

describe('TrackTimingSynchronizer', () => {
  let synchronizer: TrackTimingSynchronizer;
  let mockTransport: Transport;
  let mockEventBus: EventBus;
  
  beforeEach(() => {
    // Clear singleton
    (TrackTimingSynchronizer as any).instance = null;
    
    // Create mocks
    mockTransport = {
      getTempo: vi.fn().mockReturnValue(120),
      getMetrics: vi.fn().mockReturnValue({
        currentTime: 0,
        drift: 0,
        latency: 0,
        lookahead: 100,
        updateInterval: 25,
      }),
    } as any;
    
    mockEventBus = new EventBus();
    
    synchronizer = TrackTimingSynchronizer.getInstance();
  });
  
  afterEach(() => {
    synchronizer.dispose();
    vi.clearAllMocks();
  });
  
  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TrackTimingSynchronizer.getInstance();
      const instance2 = TrackTimingSynchronizer.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('Initialization', () => {
    it('should initialize with transport and event bus', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      // Should start monitoring
      const report = synchronizer.getSyncReport();
      expect(report).toBeDefined();
    });
  });
  
  describe('Track Registration', () => {
    it('should register a track with default priority', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      const trackRegisteredSpy = vi.fn();
      mockEventBus.on('timing:trackRegistered', trackRegisteredSpy);
      
      synchronizer.registerTrack('track-1');
      
      expect(trackRegisteredSpy).toHaveBeenCalledWith({
        trackId: 'track-1',
        priority: 50,
      });
      
      const state = synchronizer.getTrackTimingState('track-1');
      expect(state).toBeDefined();
      expect(state?.priority).toBe(50);
      expect(state?.isActive).toBe(true);
    });
    
    it('should register a track with custom priority', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      synchronizer.registerTrack('track-2', { priority: 80 });
      
      const state = synchronizer.getTrackTimingState('track-2');
      expect(state?.priority).toBe(80);
    });
    
    it('should unregister a track', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      synchronizer.registerTrack('track-3');
      synchronizer.unregisterTrack('track-3');
      
      const state = synchronizer.getTrackTimingState('track-3');
      expect(state).toBeUndefined();
    });
  });
  
  describe('Event Scheduling', () => {
    it('should schedule an event for a registered track', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-4');
      
      const callback = vi.fn();
      const position: MusicalPosition = {
        bars: 1,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };
      
      const eventId = synchronizer.scheduleTrackEvent('track-4', callback, position);
      
      expect(eventId).toBeDefined();
      expect(eventId).toContain('track-4');
    });
    
    it('should throw error for unregistered track', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      const callback = vi.fn();
      const position: MusicalPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };
      
      expect(() => {
        synchronizer.scheduleTrackEvent('unknown-track', callback, position);
      }).toThrow('Track unknown-track not registered for timing sync');
    });
    
    it('should cancel a scheduled event', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-5');
      
      const callback = vi.fn();
      const position: MusicalPosition = {
        bars: 0,
        beats: 1,
        sixteenths: 0,
        ticks: 0,
      };
      
      const eventId = synchronizer.scheduleTrackEvent('track-5', callback, position);
      synchronizer.cancelTrackEvent(eventId);
      
      // Event should be removed
      expect((synchronizer as any).scheduledEvents.has(eventId)).toBe(false);
    });
  });
  
  describe('Drift Compensation', () => {
    it('should track drift history', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-6');
      
      const state = synchronizer.getTrackTimingState('track-6');
      expect(state?.driftHistory).toEqual([]);
      expect(state?.compensationOffset).toBe(0);
    });
    
    it('should apply initial compensation offset', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-7', { compensationOffset: 5 });
      
      const state = synchronizer.getTrackTimingState('track-7');
      expect(state?.compensationOffset).toBe(5);
    });
  });
  
  describe('Error Handling', () => {
    it('should reset track errors', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-8');
      
      // Simulate errors
      const state = synchronizer.getTrackTimingState('track-8');
      if (state) {
        state.errorCount = 3;
        state.lastError = 'Test error';
        state.isActive = false;
      }
      
      synchronizer.resetTrackErrors('track-8');
      
      const updatedState = synchronizer.getTrackTimingState('track-8');
      expect(updatedState?.errorCount).toBe(0);
      expect(updatedState?.lastError).toBeUndefined();
      expect(updatedState?.isActive).toBe(true);
    });
  });
  
  describe('Sync Validation', () => {
    it('should validate sync when no tracks registered', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      const isValid = synchronizer.validateSync();
      expect(isValid).toBe(true);
    });
    
    it('should generate sync report', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-9');
      
      // Wait for sync check
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const report = synchronizer.getSyncReport();
      expect(report).toBeDefined();
      expect(report?.tracks).toBeDefined();
      expect(report?.syncHealth).toBeGreaterThanOrEqual(0);
      expect(report?.syncHealth).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Configuration', () => {
    it('should get default configuration', () => {
      const config = synchronizer.getConfig();
      
      expect(config).toEqual({
        driftTolerance: 1.0,
        sampleRate: 48000,
        driftHistorySize: 10,
        errorThreshold: 5,
        syncCheckInterval: 100,
      });
    });
    
    it('should update configuration', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      
      synchronizer.updateConfig({
        driftTolerance: 2.0,
        errorThreshold: 10,
      });
      
      const config = synchronizer.getConfig();
      expect(config.driftTolerance).toBe(2.0);
      expect(config.errorThreshold).toBe(10);
    });
  });
  
  describe('Transport Integration', () => {
    it('should handle transport timing updates', async () => {
      await synchronizer.initialize(mockTransport, mockEventBus);
      synchronizer.registerTrack('track-10');
      
      // Emit timing update
      mockEventBus.emit('transport:timing-update', {
        time: 1.5,
        position: { bars: 0, beats: 1, sixteenths: 2, ticks: 0 },
        metrics: {
          currentTime: 1.5,
          drift: 0,
          latency: 0,
          lookahead: 100,
          updateInterval: 25,
        },
      });
      
      const state = synchronizer.getTrackTimingState('track-10');
      expect(state?.lastAudioWorkletTime).toBe(1.5);
    });
  });
});