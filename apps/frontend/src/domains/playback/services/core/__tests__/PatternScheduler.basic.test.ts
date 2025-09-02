import { describe, it, expect } from 'vitest';
import { PatternScheduler } from '../PatternScheduler';
import type { Region } from '../../../types/region';

describe('PatternScheduler Basic Tests', () => {
  it('should create a PatternScheduler instance', () => {
    const scheduler = new PatternScheduler();
    expect(scheduler).toBeDefined();
    expect(scheduler).toBeInstanceOf(PatternScheduler);
  });

  it('should register and unregister tracks', () => {
    const scheduler = new PatternScheduler();
    const trackId = 'test-track';
    const regions: Region[] = [
      {
        id: 'region-1',
        trackId,
        name: 'Test Region',
        startPosition: '0:0:0',
        duration: '1:0:0',
        loopCount: 1,
        muted: false,
      },
    ];

    // Should not throw when registering
    expect(() => scheduler.registerTrack(trackId, regions)).not.toThrow();

    // Should not throw when unregistering
    expect(() => scheduler.unregisterTrack(trackId)).not.toThrow();
  });

  it('should provide metrics', () => {
    const scheduler = new PatternScheduler();
    const metrics = scheduler.getMetrics();

    expect(metrics).toHaveProperty('scheduledEvents');
    expect(metrics).toHaveProperty('missedEvents');
    expect(metrics).toHaveProperty('avgLatency');
    expect(metrics).toHaveProperty('cpuUsage');
    expect(metrics.scheduledEvents).toBe(0);
    expect(metrics.missedEvents).toBe(0);
  });

  it('should have proper service configuration', () => {
    const scheduler = new PatternScheduler();
    const config = scheduler.getConfig();

    expect(config).toHaveProperty('isRunning');
    expect(config.isRunning).toBe(false);
  });
});
