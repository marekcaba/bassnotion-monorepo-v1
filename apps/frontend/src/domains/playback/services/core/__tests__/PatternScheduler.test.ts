import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternScheduler } from '../PatternScheduler';
import { EventBus } from '../EventBus';
import { UnifiedTransport } from '../UnifiedTransport';
import type { Region } from '../../../types/region';
import type { DrumPattern } from '../../../types/pattern';

// Mock dependencies
vi.mock('../EventBus');
vi.mock('../UnifiedTransport');

describe('PatternScheduler', () => {
  let scheduler: PatternScheduler;
  let mockEventBus: EventBus;
  let mockTransport: UnifiedTransport;

  beforeEach(() => {
    // Create scheduler instance first
    scheduler = new PatternScheduler();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await scheduler.initialize();
      
      expect(mockTransport.on).toHaveBeenCalledWith('position-update', expect.any(Function));
      expect(mockTransport.on).toHaveBeenCalledWith('state-change', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('track-regions-updated', expect.any(Function));
    });

    it('should handle initialization errors', async () => {
      vi.mocked(UnifiedTransport.getInstance).mockImplementationOnce(() => {
        throw new Error('Transport error');
      });
      
      await expect(scheduler.initialize()).rejects.toThrow('Failed to initialize PatternScheduler');
    });
  });

  describe('region management', () => {
    beforeEach(async () => {
      await scheduler.initialize();
    });

    it('should register track with regions', () => {
      const trackId = 'test-track';
      const regions: Region[] = [
        {
          id: 'region-1',
          trackId,
          name: 'Test Region',
          startPosition: '0:0:0',
          duration: '1:0:0',
          loopCount: 0,
          muted: false
        }
      ];
      
      scheduler.registerTrack(trackId, regions);
      
      // Verify internal state (would need to expose for testing)
      expect(scheduler.getMetrics().scheduledEvents).toBe(0);
    });

    it('should unregister track', () => {
      const trackId = 'test-track';
      scheduler.registerTrack(trackId, []);
      scheduler.unregisterTrack(trackId);
      
      expect(scheduler.getMetrics().scheduledEvents).toBe(0);
    });
  });

  describe('scheduling', () => {
    beforeEach(async () => {
      await scheduler.initialize();
      await scheduler.start();
    });

    it('should schedule events from drum pattern', () => {
      const drumPattern: DrumPattern = {
        id: 'drum-1',
        events: [
          { position: '0:0:0', drum: 'kick', velocity: 0.8 },
          { position: '0:1:0', drum: 'snare', velocity: 0.6 }
        ],
        loopLength: 1
      };

      const region: Region = {
        id: 'region-1',
        trackId: 'drums',
        name: 'Drum Region',
        startPosition: '0:0:0',
        duration: '1:0:0',
        pattern: drumPattern,
        loopCount: 1,
        muted: false
      };

      scheduler.registerTrack('drums', [region]);
      
      // Simulate position update
      const positionHandler = vi.mocked(mockTransport.on).mock.calls
        .find(call => call[0] === 'position-update')?.[1];
      
      if (positionHandler) {
        positionHandler({
          position: '0:0:0',
          audioTime: 0
        });
      }

      // Verify events were scheduled
      expect(mockTransport.scheduleOnce).toHaveBeenCalled();
    });
  });

  describe('performance metrics', () => {
    beforeEach(async () => {
      await scheduler.initialize();
    });

    it('should track performance metrics', () => {
      const metrics = scheduler.getMetrics();
      
      expect(metrics).toHaveProperty('scheduledEvents');
      expect(metrics).toHaveProperty('missedEvents');
      expect(metrics).toHaveProperty('avgLatency');
      expect(metrics).toHaveProperty('cpuUsage');
    });
  });

  describe('service lifecycle', () => {
    it('should handle start/stop/restart', async () => {
      await scheduler.initialize();
      await scheduler.start();
      await scheduler.stop();
      await scheduler.restart();
      
      expect(scheduler.getConfig().isRunning).toBe(true);
    });

    it('should dispose properly', async () => {
      await scheduler.initialize();
      await scheduler.dispose();
      
      expect(mockTransport.off).toHaveBeenCalledWith('position-update', expect.any(Function));
      expect(mockTransport.off).toHaveBeenCalledWith('state-change', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('track-regions-updated', expect.any(Function));
    });
  });

  describe('health check', () => {
    it('should report healthy status when initialized', async () => {
      await scheduler.initialize();
      const health = await scheduler.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details?.isInitialized).toBe(true);
    });

    it('should report unhealthy status when not initialized', async () => {
      const health = await scheduler.healthCheck();
      
      expect(health.status).toBe('unhealthy');
    });
  });
});