import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Tone from 'tone';
import { WidgetSyncService } from '../WidgetSyncService';
import { UnifiedTransport } from '../../../playback/services/core/index.js';
import { AudioEngine } from '../../../playback/services/core/AudioEngine';

describe('Transport-Widget Event Flow Integration Tests', () => {
  let syncService: WidgetSyncService;
  let transportController: UnifiedTransport;
  let audioEngine: AudioEngine;
  let eventLog: Array<{ event: string; timestamp: number; source: string; data?: any }>;
  let widgetMocks: Map<string, WidgetMock>;

  class WidgetMock {
    id: string;
    isConnected = false;
    isPlaying = false;
    lastSyncTime = 0;
    syncTimeouts = 0;
    eventLog: Array<{ event: string; timestamp: number }> = [];

    constructor(id: string) {
      this.id = id;
    }

    connect() {
      this.isConnected = true;
      this.lastSyncTime = Date.now();
    }

    disconnect() {
      this.isConnected = false;
    }

    handleEvent(event: string, data: any) {
      this.eventLog.push({ event, timestamp: Date.now() });
      this.lastSyncTime = Date.now();

      switch (event) {
        case 'PLAY':
          this.isPlaying = true;
          break;
        case 'STOP':
          this.isPlaying = false;
          break;
      }
    }

    checkSyncTimeout(timeoutMs = 30000) {
      const timeSinceLastSync = Date.now() - this.lastSyncTime;
      if (timeSinceLastSync > timeoutMs) {
        this.syncTimeouts++;
        console.warn(`[${this.id}] Sync connection lost (${timeSinceLastSync}ms since last sync)`);
        return true;
      }
      return false;
    }
  }

  beforeEach(async () => {
    // Initialize services
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();
    
    transportController = new TransportController(audioEngine);
    syncService = WidgetSyncService.getInstance();
    
    // Reset event log
    eventLog = [];
    
    // Create widget mocks
    widgetMocks = new Map();
    ['enhanced-metronome-widget', 'harmony-widget', 'drummer-widget'].forEach(id => {
      widgetMocks.set(id, new WidgetMock(id));
    });
    
    // Reset transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  });

  afterEach(() => {
    // Clean up
    widgetMocks.clear();
    eventLog = [];
    Tone.Transport.stop();
    Tone.Transport.cancel();
  });

  describe('Event Propagation Chain', () => {
    it('should propagate events from transport to all widgets', async () => {
      // Set up event listeners for each widget
      widgetMocks.forEach((widget, id) => {
        syncService.on('PLAY', (data) => {
          widget.handleEvent('PLAY', data);
          eventLog.push({
            event: 'PLAY',
            timestamp: Date.now(),
            source: id,
            data
          });
        });
        
        syncService.on('STOP', (data) => {
          widget.handleEvent('STOP', data);
          eventLog.push({
            event: 'STOP',
            timestamp: Date.now(),
            source: id,
            data
          });
        });
      });

      // Start transport
      const startTime = Date.now();
      await transportController.start();
      
      // Emit play event
      syncService.emit('PLAY', { source: 'test-transport-page' });

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all widgets received play event
      widgetMocks.forEach((widget, id) => {
        expect(widget.isPlaying).toBe(true);
        expect(widget.eventLog.some(e => e.event === 'PLAY')).toBe(true);
      });

      // Check event timing
      const playEvents = eventLog.filter(e => e.event === 'PLAY');
      expect(playEvents.length).toBe(3); // One for each widget

      // Events should arrive within 50ms of each other
      if (playEvents.length > 1) {
        const firstEventTime = playEvents[0].timestamp;
        const lastEventTime = playEvents[playEvents.length - 1].timestamp;
        expect(lastEventTime - firstEventTime).toBeLessThan(50);
      }

      // Stop transport
      await transportController.stop();
      syncService.emit('STOP', { source: 'test-transport-page' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify all widgets stopped
      widgetMocks.forEach(widget => {
        expect(widget.isPlaying).toBe(false);
      });
    });

    it('should maintain event order', async () => {
      const widget = widgetMocks.get('drummer-widget')!;
      const events: string[] = [];

      // Listen to multiple event types
      ['PLAY', 'STOP', 'TEMPO_CHANGE', 'POSITION'].forEach(eventType => {
        syncService.on(eventType, () => {
          events.push(eventType);
          widget.handleEvent(eventType, {});
        });
      });

      // Emit events in sequence
      syncService.emit('PLAY', {});
      syncService.emit('TEMPO_CHANGE', { tempo: 140 });
      syncService.emit('POSITION', { position: '1:0:0' });
      syncService.emit('STOP', {});

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify order
      expect(events).toEqual(['PLAY', 'TEMPO_CHANGE', 'POSITION', 'STOP']);
    });
  });

  describe('Sync Connection Timeout Issue', () => {
    it('should detect sync timeout after 30 seconds', async () => {
      const widget = widgetMocks.get('enhanced-metronome-widget')!;
      widget.connect();

      // Simulate no sync updates for 30+ seconds
      widget.lastSyncTime = Date.now() - 31000;

      const hasTimeout = widget.checkSyncTimeout();
      expect(hasTimeout).toBe(true);
      expect(widget.syncTimeouts).toBe(1);
    });

    it('should maintain sync with regular heartbeat', async () => {
      const widget = widgetMocks.get('harmony-widget')!;
      widget.connect();

      // Simulate heartbeat mechanism
      const heartbeatInterval = setInterval(() => {
        widget.lastSyncTime = Date.now();
        syncService.emit('HEARTBEAT', { timestamp: Date.now() });
      }, 5000); // Every 5 seconds

      // Check sync status over time
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 6000));
        const hasTimeout = widget.checkSyncTimeout();
        expect(hasTimeout).toBe(false);
      }

      clearInterval(heartbeatInterval);
    });

    it('should identify missing heartbeat mechanism', async () => {
      // This test demonstrates the issue: no heartbeat mechanism exists
      const widget = widgetMocks.get('drummer-widget')!;
      widget.connect();

      // Start playback
      syncService.emit('PLAY', { source: 'transport' });
      widget.handleEvent('PLAY', {});

      // Wait for 31 seconds (simulated)
      widget.lastSyncTime = Date.now() - 31000;

      // Check timeout
      const hasTimeout = widget.checkSyncTimeout();
      expect(hasTimeout).toBe(true);

      // This is the core issue - widgets lose sync after 30s
      console.log('ISSUE IDENTIFIED: No heartbeat mechanism to maintain sync connection');
    });
  });

  describe('Event Subscription and Unsubscription', () => {
    it('should handle widget connection lifecycle', () => {
      const widget = widgetMocks.get('harmony-widget')!;
      const eventHandler = vi.fn();

      // Register widget
      syncService.registerWidget(widget.id);
      syncService.on('PLAY', eventHandler);
      widget.connect();

      // Emit event
      syncService.emit('PLAY', { test: true });
      expect(eventHandler).toHaveBeenCalledWith({ test: true });

      // Unregister
      syncService.off('PLAY', eventHandler);
      syncService.unregisterWidget(widget.id);
      widget.disconnect();

      // Event should not be received
      eventHandler.mockClear();
      syncService.emit('PLAY', { test: true });
      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should handle multiple widgets subscribing to same event', () => {
      const handlers = new Map<string, vi.Mock>();
      
      widgetMocks.forEach((widget, id) => {
        const handler = vi.fn();
        handlers.set(id, handler);
        syncService.on('PLAY', handler);
      });

      syncService.emit('PLAY', { multi: true });

      handlers.forEach((handler, id) => {
        expect(handler).toHaveBeenCalledWith({ multi: true });
      });
    });
  });

  describe('Transport State Synchronization', () => {
    it('should sync transport state with widget state', async () => {
      const stateLog: Array<{ transport: string; widgets: Map<string, boolean> }> = [];

      // Monitor state changes
      const checkStates = () => {
        const widgetStates = new Map<string, boolean>();
        widgetMocks.forEach((widget, id) => {
          widgetStates.set(id, widget.isPlaying);
        });
        
        stateLog.push({
          transport: Tone.Transport.state,
          widgets: widgetStates
        });
      };

      // Set up listeners
      widgetMocks.forEach(widget => {
        syncService.on('PLAY', () => widget.isPlaying = true);
        syncService.on('STOP', () => widget.isPlaying = false);
      });

      // Initial state
      checkStates();
      expect(Tone.Transport.state).toBe('stopped');

      // Start transport
      await transportController.start();
      syncService.emit('PLAY', { source: 'transport' });
      checkStates();

      // All should be playing
      const playingState = stateLog[stateLog.length - 1];
      expect(playingState.transport).toBe('started');
      playingState.widgets.forEach(isPlaying => {
        expect(isPlaying).toBe(true);
      });

      // Stop transport
      await transportController.stop();
      syncService.emit('STOP', { source: 'transport' });
      checkStates();

      // All should be stopped
      const stoppedState = stateLog[stateLog.length - 1];
      expect(stoppedState.transport).toBe('stopped');
      stoppedState.widgets.forEach(isPlaying => {
        expect(isPlaying).toBe(false);
      });
    });

    it('should handle state mismatch scenarios', async () => {
      // Simulate the reported issue: Transport playing but widgets not connected
      await transportController.start();
      expect(Tone.Transport.state).toBe('started');

      // Widgets not connected
      widgetMocks.forEach(widget => {
        expect(widget.isConnected).toBe(false);
      });

      // This is the mismatch scenario from the logs
      console.log('MISMATCH: Transport is started but widgets are not connected');

      // Emit play event manually
      syncService.emit('PLAY', { source: 'transport' });

      // Widgets should receive event even if not connected
      widgetMocks.forEach(widget => {
        syncService.on('PLAY', () => {
          widget.isPlaying = true;
          // But they're not connected, so they can't actually play
          if (!widget.isConnected) {
            console.log(`${widget.id}: Received PLAY but not connected`);
          }
        });
      });

      syncService.emit('PLAY', { source: 'transport' });
      
      // This demonstrates the issue
      widgetMocks.forEach(widget => {
        expect(widget.isPlaying).toBe(false); // Because they're not connected
      });
    });
  });

  describe('Performance and Timing', () => {
    it('should process events quickly', async () => {
      const processingTimes: number[] = [];
      
      syncService.on('PLAY', () => {
        const start = performance.now();
        // Simulate some processing
        for (let i = 0; i < 1000; i++) {
          Math.sqrt(i);
        }
        const duration = performance.now() - start;
        processingTimes.push(duration);
      });

      // Emit multiple events
      for (let i = 0; i < 10; i++) {
        syncService.emit('PLAY', { index: i });
      }

      // All should process quickly
      processingTimes.forEach(time => {
        expect(time).toBeLessThan(10); // Less than 10ms
      });
    });

    it('should handle rapid event bursts', async () => {
      let eventCount = 0;
      
      syncService.on('POSITION', () => {
        eventCount++;
      });

      // Simulate rapid position updates
      const startTime = Date.now();
      while (Date.now() - startTime < 1000) {
        syncService.emit('POSITION', { 
          seconds: Tone.Transport.seconds,
          position: Tone.Transport.position
        });
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
      }

      // Should handle many events
      expect(eventCount).toBeGreaterThan(50);
    });
  });

  describe('Proposed Fix: Heartbeat Implementation', () => {
    it('should maintain sync with heartbeat mechanism', async () => {
      // Proposed solution: Add heartbeat to WidgetSyncService
      class WidgetSyncServiceWithHeartbeat extends WidgetSyncService {
        private heartbeatInterval: NodeJS.Timeout | null = null;
        
        startHeartbeat() {
          this.heartbeatInterval = setInterval(() => {
            this.emit('HEARTBEAT', { 
              timestamp: Date.now(),
              transportState: Tone.Transport.state,
              position: Tone.Transport.position
            });
          }, 5000); // Every 5 seconds
        }
        
        stopHeartbeat() {
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
        }
      }

      const enhancedSync = new WidgetSyncServiceWithHeartbeat();
      
      // Set up widget with heartbeat listener
      const widget = widgetMocks.get('drummer-widget')!;
      widget.connect();
      
      enhancedSync.on('HEARTBEAT', (data) => {
        widget.lastSyncTime = Date.now();
        console.log('Heartbeat received:', data);
      });

      // Start heartbeat
      enhancedSync.startHeartbeat();

      // Simulate long playback session
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const hasTimeout = widget.checkSyncTimeout();
        expect(hasTimeout).toBe(false);
        console.log(`After ${(i + 1) * 5} seconds: No timeout`);
      }

      enhancedSync.stopHeartbeat();
    });
  });
});