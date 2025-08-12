/**
 * Real Tone.js Tests for DrummerWidget
 * 
 * Uses actual Tone.js Transport to verify scheduling behavior
 */

import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Tone from 'tone';
import { DrummerWidget } from '../DrummerWidget';
import { createRealToneTest } from '@/test/utils/realToneTestUtils';
import { SyncProvider } from '../../../base/SyncProvider';

describe('DrummerWidget - Real Tone.js Integration', () => {
  let env: ReturnType<typeof createRealToneTest>;
  let scheduledCallbacks: Array<{ time: number; position: string }> = [];

  beforeEach(async () => {
    scheduledCallbacks = [];
    env = createRealToneTest({ bpm: 120 });
    await env.setup();
    
    // Mock console to capture logs
    vi.spyOn(console, 'log').mockImplementation((msg, ...args) => {
      if (msg?.includes('DRUM TRANSPORT SCHEDULE EXECUTED')) {
        scheduledCallbacks.push(args[0]);
      }
    });
  });

  afterEach(async () => {
    await env.cleanup();
    vi.restoreAllMocks();
  });

  it('should continue scheduling drum patterns after first callback', async () => {
    const mockTrack = {
      userId: 'test-user',
      exerciseId: 'test-exercise',
      trackId: 'drums',
      enabled: true,
      volume: 0,
      settings: {
        pattern: [1, 0, 1, 0, 1, 0, 1, 0],
        tempo: 120,
        swing: 0,
      },
    };

    const { rerender } = render(
      <SyncProvider>
        <DrummerWidget
          track={mockTrack}
          syncProps={{
            isPlaying: false,
            currentBeat: 0,
            currentBar: 0,
            tempo: 120,
            swing: 0,
          }}
        />
      </SyncProvider>
    );

    // Start playback
    rerender(
      <SyncProvider>
        <DrummerWidget
          track={mockTrack}
          syncProps={{
            isPlaying: true,
            currentBeat: 0,
            currentBar: 0,
            tempo: 120,
            swing: 0,
          }}
        />
      </SyncProvider>
    );

    // Start Transport
    Tone.Transport.start();

    // Wait for multiple schedule callbacks
    await waitFor(
      () => {
        // Should have at least 4 callbacks in 2 seconds at 120 BPM
        expect(scheduledCallbacks.length).toBeGreaterThanOrEqual(4);
      },
      { timeout: 3000 }
    );

    // Verify callbacks continued past the first one
    expect(scheduledCallbacks[0]).toBeDefined();
    expect(scheduledCallbacks[1]).toBeDefined();
    expect(scheduledCallbacks[2]).toBeDefined();
    expect(scheduledCallbacks[3]).toBeDefined();

    // Verify time progression
    const times = scheduledCallbacks.map(cb => cb.time);
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[2]).toBeGreaterThan(times[1]);
    expect(times[3]).toBeGreaterThan(times[2]);

    console.log('Captured callbacks:', scheduledCallbacks);
  });

  it('should handle Transport.scheduleRepeat correctly', async () => {
    let callCount = 0;
    const times: number[] = [];

    // Direct test of Transport.scheduleRepeat
    const scheduleId = Tone.Transport.scheduleRepeat((time) => {
      callCount++;
      times.push(time);
      console.log(`Direct schedule test - callback ${callCount}: time=${time}`);
    }, '8n');

    Tone.Transport.start();

    // Wait for callbacks
    await new Promise(resolve => setTimeout(resolve, 2000));

    Tone.Transport.clear(scheduleId);
    Tone.Transport.stop();

    // Should have multiple callbacks
    expect(callCount).toBeGreaterThan(1);
    expect(times.length).toBeGreaterThan(1);
    
    console.log(`Direct test results: ${callCount} callbacks over 2 seconds`);
  });

  it('should not lose schedules on React re-renders', async () => {
    const mockTrack = {
      userId: 'test-user',
      exerciseId: 'test-exercise',
      trackId: 'drums',
      enabled: true,
      volume: 0,
      settings: {
        pattern: [1, 0, 1, 0, 1, 0, 1, 0],
        tempo: 120,
        swing: 0,
      },
    };

    const { rerender } = render(
      <SyncProvider>
        <DrummerWidget
          track={mockTrack}
          syncProps={{
            isPlaying: true,
            currentBeat: 0,
            currentBar: 0,
            tempo: 120,
            swing: 0,
          }}
        />
      </SyncProvider>
    );

    Tone.Transport.start();

    // Wait for first callback
    await waitFor(() => {
      expect(scheduledCallbacks.length).toBeGreaterThan(0);
    });

    const callbacksBeforeRerender = scheduledCallbacks.length;

    // Trigger re-render with same props
    rerender(
      <SyncProvider>
        <DrummerWidget
          track={mockTrack}
          syncProps={{
            isPlaying: true,
            currentBeat: 0,
            currentBar: 0,
            tempo: 120,
            swing: 0,
          }}
        />
      </SyncProvider>
    );

    // Wait for more callbacks
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should continue getting callbacks after re-render
    expect(scheduledCallbacks.length).toBeGreaterThan(callbacksBeforeRerender);
    
    console.log(`Callbacks before re-render: ${callbacksBeforeRerender}, after: ${scheduledCallbacks.length}`);
  });
});