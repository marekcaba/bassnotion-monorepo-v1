import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Tone from 'tone';
import { UnifiedTransport } from '../core/index.js';
import { AudioEngine } from '../core/AudioEngine';
import { WidgetSyncService } from '../../../widgets/services/WidgetSyncService';

describe('UnifiedTransport Integration Tests', () => {
  let transportController: UnifiedTransport;
  let audioEngine: AudioEngine;
  let syncService: WidgetSyncService;
  let eventCallbacks: Map<string, Function[]>;

  beforeEach(async () => {
    // Reset Tone.js
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    
    // Initialize services
    audioEngine = AudioEngine.getInstance();
    await audioEngine.initialize();
    
    transportController = new UnifiedTransport(audioEngine);
    syncService = WidgetSyncService.getInstance();
    
    // Track events
    eventCallbacks = new Map();
  });

  afterEach(() => {
    // Clean up
    Tone.Transport.stop();
    Tone.Transport.cancel();
    eventCallbacks.clear();
  });

  describe('Transport Start/Stop Flow', () => {
    it('should start transport and emit play event', async () => {
      const playEventReceived = vi.fn();
      syncService.on('PLAY', playEventReceived);

      // Start transport
      await transportController.start();

      // Verify transport is running
      expect(Tone.Transport.state).toBe('started');
      expect(transportController.getState()).toBe('playing');
      
      // Verify play event was emitted
      expect(playEventReceived).toHaveBeenCalled();
    });

    it('should stop transport and emit stop event', async () => {
      const stopEventReceived = vi.fn();
      syncService.on('STOP', stopEventReceived);

      // Start then stop
      await transportController.start();
      await transportController.stop();

      // Verify transport is stopped
      expect(Tone.Transport.state).toBe('stopped');
      expect(transportController.getState()).toBe('stopped');
      
      // Verify stop event was emitted
      expect(stopEventReceived).toHaveBeenCalled();
    });

    it('should maintain transport position during play', async () => {
      await transportController.start();
      
      // Wait for transport to advance
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const position = Tone.Transport.seconds;
      expect(position).toBeGreaterThan(0);
      
      // Position should continue advancing
      await new Promise(resolve => setTimeout(resolve, 100));
      const newPosition = Tone.Transport.seconds;
      expect(newPosition).toBeGreaterThan(position);
    });
  });

  describe('Tempo Changes', () => {
    it('should update tempo and emit tempo change event', async () => {
      const tempoChangeReceived = vi.fn();
      syncService.on('TEMPO_CHANGE', tempoChangeReceived);

      const newTempo = 100;
      transportController.setTempo(newTempo);

      expect(Tone.Transport.bpm.value).toBe(newTempo);
      expect(tempoChangeReceived).toHaveBeenCalledWith(
        expect.objectContaining({ tempo: newTempo })
      );
    });

    it('should maintain playback during tempo change', async () => {
      await transportController.start();
      const wasPlaying = Tone.Transport.state === 'started';

      transportController.setTempo(140);

      expect(Tone.Transport.state).toBe(wasPlaying ? 'started' : 'stopped');
    });
  });

  describe('Loop Functionality', () => {
    it('should set loop points correctly', () => {
      const startBar = 0;
      const endBar = 4;
      
      transportController.setLoop(true, startBar, endBar);

      expect(Tone.Transport.loop).toBe(true);
      expect(Tone.Transport.loopStart).toBe(0);
      expect(Tone.Transport.loopEnd).toBe('4m');
    });

    it('should emit loop change event', () => {
      const loopChangeReceived = vi.fn();
      syncService.on('LOOP_CHANGE', loopChangeReceived);

      transportController.setLoop(true, 0, 8);

      expect(loopChangeReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          startBar: 0,
          endBar: 8
        })
      );
    });
  });

  describe('Transport Position and Seek', () => {
    it('should seek to specific position', () => {
      const targetPosition = '2:0:0';
      transportController.seek(targetPosition);

      // Convert back to bars:beats:sixteenths
      const currentPosition = Tone.Transport.position;
      expect(currentPosition.toString()).toContain('2:0');
    });

    it('should emit position event when seeking', () => {
      const positionReceived = vi.fn();
      syncService.on('POSITION', positionReceived);

      transportController.seek('1:0:0');

      expect(positionReceived).toHaveBeenCalled();
    });
  });

  describe('AudioContext State Management', () => {
    it('should handle suspended audio context on start', async () => {
      // Simulate suspended context
      Object.defineProperty(Tone.context, 'state', {
        get: () => 'suspended',
        configurable: true
      });

      const result = await transportController.start();

      // Should still attempt to start
      expect(result).toBe(true);
    });

    it('should report audio context state correctly', () => {
      const state = transportController.getAudioContextState();
      expect(['running', 'suspended', 'closed']).toContain(state);
    });
  });

  describe('Transport Scheduling', () => {
    it('should schedule events at correct time', (done) => {
      let eventFired = false;
      
      // Schedule an event
      Tone.Transport.schedule((time) => {
        eventFired = true;
        expect(time).toBeGreaterThan(0);
        done();
      }, '+0.1');

      transportController.start();
    });

    it('should handle multiple scheduled events', async () => {
      const events: number[] = [];
      
      // Schedule multiple events
      [0.1, 0.2, 0.3].forEach(delay => {
        Tone.Transport.schedule(() => {
          events.push(delay);
        }, `+${delay}`);
      });

      await transportController.start();
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle start failures gracefully', async () => {
      // Mock a failure
      vi.spyOn(Tone.Transport, 'start').mockImplementation(() => {
        throw new Error('Transport start failed');
      });

      const result = await transportController.start();
      expect(result).toBe(false);
      expect(transportController.getState()).toBe('stopped');
    });

    it('should recover from stop failures', async () => {
      await transportController.start();
      
      // Mock a stop failure
      vi.spyOn(Tone.Transport, 'stop').mockImplementation(() => {
        throw new Error('Transport stop failed');
      });

      await transportController.stop();
      // Should handle gracefully
      expect(transportController.getState()).toBe('stopped');
    });
  });

  describe('Transport State Consistency', () => {
    it('should maintain consistent state across start/stop cycles', async () => {
      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await transportController.start();
        expect(transportController.getState()).toBe('playing');
        expect(Tone.Transport.state).toBe('started');

        await transportController.stop();
        expect(transportController.getState()).toBe('stopped');
        expect(Tone.Transport.state).toBe('stopped');
      }
    });

    it('should reset position on stop', async () => {
      await transportController.start();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      await transportController.stop();
      
      const position = Tone.Transport.position;
      expect(position.toString()).toBe('0:0:0');
    });
  });
});