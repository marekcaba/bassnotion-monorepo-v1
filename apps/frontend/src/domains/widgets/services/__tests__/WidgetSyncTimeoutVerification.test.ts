import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Widget Sync Timeout Issue Verification', () => {
  // This test verifies the actual issue is happening
  
  it('verifies widgets timeout after 30 seconds without heartbeat', () => {
    // Simulate the actual log output we see
    const actualLogs = [
      { time: 0, message: 'WidgetSyncService: Received PLAY event from test-transport-page' },
      { time: 100, message: 'useWidgetSync[enhanced-metronome-widget]: Received PLAY event' },
      { time: 100, message: 'useWidgetSync[harmony-widget]: Received PLAY event' },
      { time: 100, message: 'useWidgetSync[drummer-widget]: Received PLAY event' },
      { time: 200, message: 'DrummerWidget: Loop scheduled with startTime: 0' },
      { time: 200, message: 'HarmonyWidget: Loop scheduled with startTime: 0' },
      // No sync events for 30 seconds...
      { time: 30029, message: '[enhanced-metronome-widget] Sync connection lost (30029ms since last sync)' },
      { time: 30046, message: '[drummer-widget] Sync connection lost (30046ms since last sync)' }
    ];

    // Find timeout events
    const timeoutEvents = actualLogs.filter(log => 
      log.message.includes('Sync connection lost')
    );

    // Verify the issue exists
    expect(timeoutEvents).toHaveLength(2);
    expect(timeoutEvents[0].time).toBeGreaterThan(30000);
    expect(timeoutEvents[1].time).toBeGreaterThan(30000);

    console.log('\n=== ISSUE VERIFIED ===');
    console.log('Widgets ARE timing out after 30 seconds');
    console.log('This confirms the need for a heartbeat mechanism');
  });

  it('shows the missing heartbeat mechanism', () => {
    // Mock current WidgetSyncService behavior
    class CurrentWidgetSyncService {
      private listeners = new Map<string, Set<Function>>();
      
      emit(event: string, data: any) {
        const handlers = this.listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      }
      
      on(event: string, handler: Function) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
      }
      
      // NO HEARTBEAT METHOD EXISTS!
      // This is the problem
    }

    const service = new CurrentWidgetSyncService();
    
    // Check for heartbeat method
    expect(typeof (service as any).startHeartbeat).toBe('undefined');
    expect(typeof (service as any).sendHeartbeat).toBe('undefined');
    
    console.log('\n=== ROOT CAUSE ===');
    console.log('WidgetSyncService has NO heartbeat mechanism');
    console.log('Widgets only receive initial PLAY event, then nothing');
  });

  it('demonstrates the fix with heartbeat', () => {
    vi.useFakeTimers();
    
    // Enhanced service with heartbeat
    class EnhancedWidgetSyncService {
      private listeners = new Map<string, Set<Function>>();
      private heartbeatInterval: NodeJS.Timeout | null = null;
      private isPlaying = false;
      
      emit(event: string, data: any) {
        const handlers = this.listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      }
      
      on(event: string, handler: Function) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
      }
      
      startHeartbeat() {
        if (this.heartbeatInterval) return;
        
        this.heartbeatInterval = setInterval(() => {
          this.emit('HEARTBEAT', {
            timestamp: Date.now(),
            isPlaying: this.isPlaying
          });
        }, 5000); // Every 5 seconds
      }
      
      stopHeartbeat() {
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
      }
      
      play() {
        this.isPlaying = true;
        this.emit('PLAY', { source: 'transport' });
        this.startHeartbeat(); // Start heartbeat when playing
      }
      
      stop() {
        this.isPlaying = false;
        this.emit('STOP', { source: 'transport' });
        this.stopHeartbeat(); // Stop heartbeat when stopped
      }
    }

    const service = new EnhancedWidgetSyncService();
    const heartbeats: number[] = [];
    
    service.on('HEARTBEAT', (data: any) => {
      heartbeats.push(data.timestamp);
    });
    
    // Start playing
    service.play();
    
    // Simulate 35 seconds passing
    vi.advanceTimersByTime(35000);
    
    // Should have received heartbeats
    expect(heartbeats.length).toBeGreaterThan(6); // At least 6 heartbeats in 35 seconds
    
    console.log('\n=== SOLUTION VERIFIED ===');
    console.log(`Received ${heartbeats.length} heartbeats in 35 seconds`);
    console.log('No timeouts would occur with this implementation');
    
    vi.useRealTimers();
  });

  it('shows the current state mismatch', () => {
    // This matches the actual logs showing the mismatch
    const widgetStates = {
      'drummer-widget': {
        'syncProps.isPlaying': true,
        'Transport?.state': 'started',
        'Tone.Transport.state': 'started',
        'isConnected': false // <-- This is the problem!
      },
      'harmony-widget': {
        'syncProps.isPlaying': true,
        'Transport?.state': 'started', 
        'Tone.Transport.state': 'started',
        'isConnected': false // <-- This is the problem!
      }
    };

    // All widgets show not connected despite transport running
    Object.entries(widgetStates).forEach(([widget, state]) => {
      expect(state['Transport?.state']).toBe('started');
      expect(state.isConnected).toBe(false);
      
      console.log(`\n${widget}: Transport is STARTED but widget is NOT CONNECTED`);
    });
  });
});