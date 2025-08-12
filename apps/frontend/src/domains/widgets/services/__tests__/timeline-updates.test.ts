import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackOrchestrator } from '../PlaybackOrchestrator';
import { widgetSyncService } from '../WidgetSyncService';
import { MusicalTimeEngine } from '@/domains/playback/services/MusicalTimeEngine';

describe('Timeline Updates Integration', () => {
  let orchestrator: PlaybackOrchestrator;
  let timelineUpdateHandler: vi.Mock;

  beforeEach(async () => {
    // Get singleton instances
    orchestrator = PlaybackOrchestrator.getInstance();

    // Initialize orchestrator
    await orchestrator.initialize({
      syncLatencyTarget: 50,
      enablePerformanceMonitoring: false,
    });

    // Set up spy for timeline updates
    timelineUpdateHandler = vi.fn();
    widgetSyncService.subscribe('TIMELINE_UPDATE', timelineUpdateHandler);
  });

  afterEach(async () => {
    // Clean up
    widgetSyncService.unsubscribe('TIMELINE_UPDATE', timelineUpdateHandler);
    await orchestrator.dispose();
  });

  it('should emit TIMELINE_UPDATE events when playback starts', async () => {
    // Start playback
    await orchestrator.startGlobalPlayback();

    // Wait for a few tick updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have received timeline updates
    expect(timelineUpdateHandler).toHaveBeenCalled();

    // Check the structure of timeline update events
    const calls = timelineUpdateHandler.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const firstEvent = calls[0][0];
    expect(firstEvent).toMatchObject({
      type: 'TIMELINE_UPDATE',
      payload: {
        currentTime: expect.any(Number),
        position: {
          measure: expect.any(Number),
          beat: expect.any(Number),
          subdivision: expect.any(Number),
        },
        tick: expect.any(Number),
        tempo: expect.any(Number),
        timeSignature: {
          numerator: expect.any(Number),
          denominator: expect.any(Number),
        },
      },
      source: 'playback-orchestrator',
    });

    // Stop playback
    await orchestrator.stopGlobalPlayback();
  });

  it('should stop emitting TIMELINE_UPDATE events when playback stops', async () => {
    // Start playback
    await orchestrator.startGlobalPlayback();

    // Wait for initial updates
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Clear mock to track only new calls
    timelineUpdateHandler.mockClear();

    // Stop playback
    await orchestrator.stopGlobalPlayback();

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not receive more updates after stopping
    const callsAfterStop = timelineUpdateHandler.mock.calls.length;

    // Wait more
    await new Promise((resolve) => setTimeout(resolve, 50));

    // No new calls should have been made
    expect(timelineUpdateHandler.mock.calls.length).toBe(callsAfterStop);
  });

  it('should include correct timing information in TIMELINE_UPDATE', async () => {
    // Set specific tempo for predictable timing
    orchestrator.setGlobalTempo(120); // 120 BPM = 2 beats per second

    // Start playback
    await orchestrator.startGlobalPlayback();

    // Wait for updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get the last timeline update
    const calls = timelineUpdateHandler.mock.calls;
    const lastEvent = calls[calls.length - 1][0];

    // At 120 BPM, currentTime should advance predictably
    expect(lastEvent.payload.currentTime).toBeGreaterThan(0);
    expect(lastEvent.payload.tempo).toBe(120);

    // Stop playback
    await orchestrator.stopGlobalPlayback();
  });
});
