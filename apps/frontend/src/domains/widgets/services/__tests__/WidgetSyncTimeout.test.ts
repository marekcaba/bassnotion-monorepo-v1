import { describe, it, expect, vi } from 'vitest';

describe('Widget Sync Timeout Issue Diagnosis', () => {
  it('identifies the sync timeout issue from logs', () => {
    // This test documents the issue found in the logs
    const logEntries = [
      '[enhanced-metronome-widget] Sync connection lost (30029ms since last sync)',
      '[drummer-widget] Sync connection lost (30046ms since last sync)'
    ];

    // Parse timeout values
    const timeouts = logEntries.map(log => {
      const match = log.match(/\((\d+)ms since last sync\)/);
      return match ? parseInt(match[1]) : 0;
    });

    // All timeouts are around 30 seconds
    timeouts.forEach(timeout => {
      expect(timeout).toBeGreaterThan(30000);
      expect(timeout).toBeLessThan(31000);
    });

    console.log('\n=== ISSUE IDENTIFIED ===');
    console.log('Widgets lose sync connection after ~30 seconds');
    console.log('Root cause: No heartbeat/keepalive mechanism');
    console.log('Widgets receive initial PLAY event but no subsequent sync updates');
  });

  it('demonstrates the event flow problem', () => {
    const eventLog = [
      { time: 0, event: 'PLAY', widget: 'all', description: 'Initial play event received' },
      { time: 100, event: 'START_LOOP', widget: 'drummer', description: 'Drum loop starts' },
      { time: 100, event: 'START_LOOP', widget: 'harmony', description: 'Harmony loop starts' },
      { time: 30000, event: 'TIMEOUT', widget: 'metronome', description: 'Sync connection lost' },
      { time: 30046, event: 'TIMEOUT', widget: 'drummer', description: 'Sync connection lost' }
    ];

    // After initial events, no sync events for 30 seconds
    const syncEvents = eventLog.filter(e => 
      e.event === 'SYNC' || e.event === 'HEARTBEAT' || e.event === 'POSITION'
    );

    expect(syncEvents.length).toBe(0);
    
    console.log('\n=== EVENT FLOW ANALYSIS ===');
    console.log('Events found:', eventLog.map(e => e.event).join(', '));
    console.log('Missing: HEARTBEAT, SYNC, or regular POSITION updates');
  });

  it('shows the transport state mismatch', () => {
    const states = {
      transport: {
        state: 'started',
        position: '0:0:0.736'
      },
      widgets: {
        drummer: {
          syncIsPlaying: true,
          isConnected: false, // <-- This is the problem
          loopState: 'started'
        },
        harmony: {
          syncIsPlaying: true,
          isConnected: false, // <-- This is the problem
          loopState: 'started'
        }
      }
    };

    // Transport is playing but widgets are not connected
    expect(states.transport.state).toBe('started');
    Object.values(states.widgets).forEach(widget => {
      expect(widget.isConnected).toBe(false);
    });

    console.log('\n=== STATE MISMATCH ===');
    console.log('Transport state:', states.transport.state);
    console.log('Widget connection states:', 
      Object.entries(states.widgets)
        .map(([name, state]) => `${name}: ${state.isConnected ? 'connected' : 'NOT CONNECTED'}`)
        .join(', ')
    );
  });

  it('proposes solution: heartbeat mechanism', () => {
    // Mock heartbeat implementation
    class HeartbeatManager {
      private interval: NodeJS.Timeout | null = null;
      private listeners: Set<Function> = new Set();

      start() {
        this.interval = setInterval(() => {
          this.broadcast({
            type: 'HEARTBEAT',
            timestamp: Date.now(),
            transportState: 'started',
            position: '0:0:0'
          });
        }, 5000); // Every 5 seconds
      }

      stop() {
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
      }

      onHeartbeat(callback: Function) {
        this.listeners.add(callback);
      }

      private broadcast(data: any) {
        this.listeners.forEach(listener => listener(data));
      }
    }

    const heartbeat = new HeartbeatManager();
    const receivedHeartbeats: number[] = [];

    heartbeat.onHeartbeat((data: any) => {
      receivedHeartbeats.push(data.timestamp);
    });

    // Simulate heartbeat
    const mockInterval = vi.fn();
    vi.spyOn(global, 'setInterval').mockImplementation((callback) => {
      mockInterval.mockImplementation(callback);
      return 123 as any;
    });

    heartbeat.start();
    
    // Simulate heartbeats
    for (let i = 0; i < 10; i++) {
      mockInterval({ timestamp: Date.now() + i * 5000 });
    }

    expect(receivedHeartbeats.length).toBe(10);

    console.log('\n=== PROPOSED SOLUTION ===');
    console.log('1. Add HeartbeatManager to WidgetSyncService');
    console.log('2. Send heartbeat every 5 seconds when transport is playing');
    console.log('3. Widgets update lastSyncTime on heartbeat receipt');
    console.log('4. This prevents the 30-second timeout');
  });

  it('shows the fix implementation path', () => {
    const fixSteps = [
      {
        file: 'WidgetSyncService.ts',
        changes: [
          'Add heartbeatInterval property',
          'Start heartbeat in startSync() method',
          'Stop heartbeat in stopSync() method',
          'Emit HEARTBEAT event with transport state'
        ]
      },
      {
        file: 'useWidgetSync.ts',
        changes: [
          'Listen for HEARTBEAT events',
          'Update lastSyncTime on heartbeat',
          'Reset connection timeout counter'
        ]
      },
      {
        file: 'TransportController.ts',
        changes: [
          'Notify WidgetSyncService on start/stop',
          'Include position in state updates'
        ]
      }
    ];

    console.log('\n=== IMPLEMENTATION STEPS ===');
    fixSteps.forEach((step, index) => {
      console.log(`\n${index + 1}. ${step.file}:`);
      step.changes.forEach(change => {
        console.log(`   - ${change}`);
      });
    });

    expect(fixSteps.length).toBe(3);
  });
});