import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Tone from 'tone';
import { WidgetSyncService } from '../WidgetSyncService';
import {
  UnifiedTransport,
  AudioEngine,
} from '../../../playback/services/core/index.js';

describe('Widget Loop Synchronization Integration Tests', () => {
  let syncService: WidgetSyncService;
  let transportController: UnifiedTransport;
  let audioEngine: AudioEngine;
  let mockWidgets: Map<string, MockWidget>;

  class MockWidget {
    id: string;
    loop: Tone.Loop | null = null;
    isPlaying = false;
    loopCallback: Function | null = null;
    executionCount = 0;
    lastExecutionTime = 0;

    constructor(id: string) {
      this.id = id;
    }

    createLoop(interval: string, callback: Function) {
      this.loopCallback = callback;
      this.loop = new Tone.Loop((time) => {
        this.executionCount++;
        this.lastExecutionTime = time;
        callback(time);
      }, interval);
    }

    start(time?: number) {
      if (this.loop) {
        this.loop.start(time);
        this.isPlaying = true;
      }
    }

    stop() {
      if (this.loop) {
        this.loop.stop();
        this.isPlaying = false;
      }
    }

    dispose() {
      if (this.loop) {
        this.loop.dispose();
        this.loop = null;
      }
    }
  }

  beforeEach(async () => {
    // Initialize services
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();

    transportController = new TransportController(audioEngine);
    syncService = WidgetSyncService.getInstance();

    // Create mock widgets
    mockWidgets = new Map();
    mockWidgets.set('drummer', new MockWidget('drummer'));
    mockWidgets.set('harmony', new MockWidget('harmony'));
    mockWidgets.set('metronome', new MockWidget('metronome'));

    // Reset transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  });

  afterEach(() => {
    // Clean up
    mockWidgets.forEach((widget) => widget.dispose());
    mockWidgets.clear();
    Tone.Transport.stop();
    Tone.Transport.cancel();
  });

  describe('Widget Loop Creation and Synchronization', () => {
    it('should create loops with correct intervals', () => {
      const drummer = mockWidgets.get('drummer')!;
      const harmony = mockWidgets.get('harmony')!;
      const metronome = mockWidgets.get('metronome')!;

      // Create loops with different intervals
      drummer.createLoop('8n', () => {}); // 8th notes
      harmony.createLoop('1m', () => {}); // 1 measure
      metronome.createLoop('4n', () => {}); // Quarter notes

      expect(drummer.loop).toBeTruthy();
      expect(harmony.loop).toBeTruthy();
      expect(metronome.loop).toBeTruthy();
    });

    it('should start all widget loops when transport starts', async () => {
      // Setup widget loops
      mockWidgets.forEach((widget, id) => {
        widget.createLoop('4n', () => {
          console.log(`${id} loop executed`);
        });
      });

      // Subscribe widgets to sync service
      syncService.on('PLAY', () => {
        mockWidgets.forEach((widget) => widget.start(0));
      });

      // Start transport
      await transportController.start();

      // Verify all widgets started
      mockWidgets.forEach((widget) => {
        expect(widget.isPlaying).toBe(true);
      });
    });

    it('should stop all widget loops when transport stops', async () => {
      // Setup and start widgets
      mockWidgets.forEach((widget) => {
        widget.createLoop('4n', () => {});
        widget.start();
      });

      // Subscribe to stop event
      syncService.on('STOP', () => {
        mockWidgets.forEach((widget) => widget.stop());
      });

      // Stop transport
      await transportController.stop();

      // Verify all widgets stopped
      mockWidgets.forEach((widget) => {
        expect(widget.isPlaying).toBe(false);
      });
    });
  });

  describe('Loop Timing and Synchronization', () => {
    it('should maintain sync between widget loops', async () => {
      const executionTimes: Map<string, number[]> = new Map();

      // Create loops that track execution times
      mockWidgets.forEach((widget, id) => {
        executionTimes.set(id, []);
        widget.createLoop('4n', (time: number) => {
          executionTimes.get(id)!.push(time);
        });
      });

      // Start all widgets at the same time
      const startTime = 0;
      mockWidgets.forEach((widget) => widget.start(startTime));

      // Start transport
      await transportController.start();

      // Let it run for a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Stop transport
      await transportController.stop();

      // Verify widgets executed
      executionTimes.forEach((times, widgetId) => {
        expect(times.length).toBeGreaterThan(0);
        console.log(`${widgetId} executed ${times.length} times`);
      });

      // Check that first execution of all widgets happened at similar times
      const firstExecutions = Array.from(executionTimes.values())
        .map((times) => times[0])
        .filter((time) => time !== undefined);

      if (firstExecutions.length > 1) {
        const minTime = Math.min(...firstExecutions);
        const maxTime = Math.max(...firstExecutions);
        const drift = maxTime - minTime;

        // Should be synchronized within 50ms
        expect(drift).toBeLessThan(0.05);
      }
    });

    it('should handle tempo changes while maintaining sync', async () => {
      // Create synchronized loops
      mockWidgets.forEach((widget) => {
        widget.createLoop('4n', () => {});
        widget.start(0);
      });

      await transportController.start();

      // Change tempo
      const originalTempo = Tone.Transport.bpm.value;
      const newTempo = 140;
      transportController.setTempo(newTempo);

      // Verify tempo changed
      expect(Tone.Transport.bpm.value).toBe(newTempo);

      // Verify loops are still running
      mockWidgets.forEach((widget) => {
        expect(widget.isPlaying).toBe(true);
      });

      // Reset tempo
      transportController.setTempo(originalTempo);
    });
  });

  describe('Widget Event Handling', () => {
    it('should handle widget registration and unregistration', () => {
      const widgetId = 'test-widget';
      const eventHandler = vi.fn();

      // Register widget
      syncService.registerWidget(widgetId);
      syncService.on('PLAY', eventHandler);

      // Emit play event
      syncService.emit('PLAY', { source: 'test' });

      expect(eventHandler).toHaveBeenCalled();

      // Unregister
      syncService.unregisterWidget(widgetId);
      syncService.off('PLAY', eventHandler);
    });

    it('should propagate position updates to widgets', async () => {
      const positionUpdates: number[] = [];

      // Subscribe to position updates
      syncService.on('POSITION', (data: any) => {
        positionUpdates.push(data.seconds);
      });

      await transportController.start();

      // Manually trigger some position updates
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const position = Tone.Transport.seconds;
        syncService.emit('POSITION', {
          seconds: position,
          position: Tone.Transport.position,
        });
      }

      await transportController.stop();

      // Should have received position updates
      expect(positionUpdates.length).toBeGreaterThan(0);

      // Positions should be increasing
      for (let i = 1; i < positionUpdates.length; i++) {
        expect(positionUpdates[i]).toBeGreaterThan(positionUpdates[i - 1]);
      }
    });
  });

  describe('Loop Scheduling and Quantization', () => {
    it('should start loops at quantized positions', async () => {
      const drummer = mockWidgets.get('drummer')!;
      const startTimes: number[] = [];

      drummer.createLoop('4n', (time: number) => {
        startTimes.push(time);
      });

      // Start at next downbeat
      await transportController.start();
      drummer.start('@1m');

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await transportController.stop();

      // First execution should be at a measure boundary
      if (startTimes.length > 0) {
        const firstTime = startTimes[0];
        const measureLength = (60 / Tone.Transport.bpm.value) * 4; // 4/4 time
        const measurePosition = firstTime % measureLength;

        // Should start near measure boundary (within 50ms)
        expect(measurePosition).toBeLessThan(0.05);
      }
    });

    it('should maintain phase relationships between widgets', async () => {
      const phaseData: Map<string, number[]> = new Map();

      // Create loops with different subdivisions
      const drummer = mockWidgets.get('drummer')!;
      const metronome = mockWidgets.get('metronome')!;

      phaseData.set('drummer', []);
      phaseData.set('metronome', []);

      drummer.createLoop('8n', (time: number) => {
        phaseData.get('drummer')!.push(time);
      });

      metronome.createLoop('4n', (time: number) => {
        phaseData.get('metronome')!.push(time);
      });

      // Start both at the same time
      await transportController.start();
      drummer.start(0);
      metronome.start(0);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transportController.stop();

      // Drummer should execute twice as often as metronome
      const drummerCount = phaseData.get('drummer')!.length;
      const metronomeCount = phaseData.get('metronome')!.length;

      if (drummerCount > 0 && metronomeCount > 0) {
        const ratio = drummerCount / metronomeCount;
        // Should be approximately 2:1
        expect(ratio).toBeGreaterThan(1.8);
        expect(ratio).toBeLessThan(2.2);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from widget loop errors', async () => {
      const errorWidget = new MockWidget('error-widget');
      let errorCount = 0;

      errorWidget.createLoop('4n', () => {
        errorCount++;
        if (errorCount === 2) {
          throw new Error('Widget loop error');
        }
      });

      errorWidget.start();
      await transportController.start();

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should continue running despite error
      expect(errorCount).toBeGreaterThan(2);

      await transportController.stop();
    });

    it('should handle widget disconnection gracefully', async () => {
      const widget = mockWidgets.get('drummer')!;
      widget.createLoop('4n', () => {});

      // Start widget
      widget.start();
      await transportController.start();

      // Simulate disconnection by disposing loop
      widget.dispose();

      // Transport should continue running
      expect(Tone.Transport.state).toBe('started');

      await transportController.stop();
    });
  });

  describe('Performance and Timing Accuracy', () => {
    it('should maintain accurate timing under load', async () => {
      const timingData: number[] = [];
      const expectedInterval = Tone.Time('4n').toSeconds();

      const widget = mockWidgets.get('metronome')!;
      widget.createLoop('4n', (time: number) => {
        timingData.push(time);
        // Simulate some processing
        for (let i = 0; i < 1000; i++) {
          Math.sqrt(i);
        }
      });

      widget.start();
      await transportController.start();

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await transportController.stop();

      // Analyze timing accuracy
      if (timingData.length > 2) {
        const intervals: number[] = [];
        for (let i = 1; i < timingData.length; i++) {
          intervals.push(timingData[i] - timingData[i - 1]);
        }

        const avgInterval =
          intervals.reduce((a, b) => a + b) / intervals.length;
        const deviation = Math.abs(avgInterval - expectedInterval);

        // Should be within 10ms of expected interval
        expect(deviation).toBeLessThan(0.01);
      }
    });
  });
});
