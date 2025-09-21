import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AudioWorkletManager,
  type TimingUpdate,
} from '../AudioWorkletManager.js';

// Mock AudioContext and AudioWorkletNode
class MockAudioContext {
  state = 'running';
  sampleRate = 48000;
  baseLatency = 0.01;
  outputLatency = 0.02;
  currentTime = 0;
  destination = { connect: vi.fn() };

  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 0 },
    };
  }

  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
}

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
  };

  connect = vi.fn();
  disconnect = vi.fn();

  simulateMessage(data: any) {
    if (this.port.onmessage) {
      this.port.onmessage(new MessageEvent('message', { data }));
    }
  }
}

// Mock global AudioWorkletNode
(global as any).AudioWorkletNode = function (
  context: any,
  name: string,
  options: any,
) {
  return new MockAudioWorkletNode();
};

describe('AudioWorkletManager', () => {
  let manager: AudioWorkletManager;
  let mockContext: MockAudioContext;
  let mockWorkletNode: MockAudioWorkletNode;

  beforeEach(() => {
    vi.clearAllMocks();

    manager = new AudioWorkletManager({
      updateInterval: 0.00267,
      lookAheadTime: 0.2,
    });

    mockContext = new MockAudioContext();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('initialization', () => {
    it('should initialize with AudioContext', async () => {
      await manager.initialize(mockContext as any);

      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledWith(
        '/worklets/timing-processor.js',
      );
    });

    it('should handle suspended AudioContext', async () => {
      mockContext.state = 'suspended';
      const resumeSpy = vi.spyOn(mockContext, 'resume');

      await manager.initialize(mockContext as any);

      expect(resumeSpy).toHaveBeenCalled();
    });

    it('should create silent oscillator', async () => {
      const createOscSpy = vi.spyOn(mockContext, 'createOscillator');
      const createGainSpy = vi.spyOn(mockContext, 'createGain');

      await manager.initialize(mockContext as any);

      expect(createOscSpy).toHaveBeenCalled();
      expect(createGainSpy).toHaveBeenCalled();
    });

    it('should set up message handling', async () => {
      await manager.initialize(mockContext as any);

      // Get the created worklet node
      const workletNode = (manager as any)
        .audioWorkletNode as MockAudioWorkletNode;
      expect(workletNode.port.onmessage).toBeDefined();
    });
  });

  describe('timing updates', () => {
    beforeEach(async () => {
      await manager.initialize(mockContext as any);
      mockWorkletNode = (manager as any)
        .audioWorkletNode as MockAudioWorkletNode;
    });

    it('should handle timing updates', async () => {
      const updatePromise = new Promise<TimingUpdate>((resolve) => {
        manager.once('timing-update', resolve);
      });

      // Start the manager to set current session ID
      manager.start();

      // Get the current session ID from the manager
      const currentSessionId = (manager as any).currentSessionId;

      // Simulate timing update from worklet with correct session ID
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 1.5,
        audioContextTime: 1.5,
        frame: 72000,
        playbackFrame: 72000,
        isPlaying: true,
        updateCount: 1,
        processorId: 'test123',
        sessionId: currentSessionId,
        messageSequence: 0,
      });

      const update = await updatePromise;
      expect(update).toEqual({
        time: 1.5,
        audioContextTime: 1.5,
        frame: 72000,
        playbackFrame: 72000,
        isPlaying: true,
        updateCount: 1,
      });
    });

    it('should reject stale timing updates', async () => {
      let updateCount = 0;

      manager.on('timing-update', () => {
        updateCount++;
      });

      // Start and stop to increment session ID
      manager.start();
      manager.stop();

      // Simulate stale update with old session ID
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 1.5,
        sessionId: 0, // Old session ID
        messageSequence: 1,
      });

      // Should not receive the update
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(updateCount).toBe(0);
    });

    it('should reject out-of-order updates', async () => {
      let updateCount = 0;

      manager.on('timing-update', () => {
        updateCount++;
      });

      manager.start();
      const currentSessionId = (manager as any).currentSessionId;

      // Send first update with sequence 0 (valid)
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 1.0,
        audioContextTime: 1.0,
        frame: 48000,
        playbackFrame: 48000,
        isPlaying: true,
        updateCount: 1,
        sessionId: currentSessionId,
        messageSequence: 0,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send next update with higher sequence (valid)
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 1.1,
        audioContextTime: 1.1,
        frame: 52800,
        playbackFrame: 52800,
        isPlaying: true,
        updateCount: 2,
        sessionId: currentSessionId,
        messageSequence: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Send out-of-order update with older sequence number (should be rejected)
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 1.5,
        audioContextTime: 1.5,
        frame: 72000,
        playbackFrame: 72000,
        isPlaying: true,
        updateCount: 3,
        sessionId: currentSessionId,
        messageSequence: 0, // Lower sequence number - should be rejected
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(updateCount).toBe(2); // Only first two updates accepted
    });
  });

  describe('control messages', () => {
    beforeEach(async () => {
      await manager.initialize(mockContext as any);
      mockWorkletNode = (manager as any)
        .audioWorkletNode as MockAudioWorkletNode;
    });

    it('should send start message', () => {
      manager.start();

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'start',
        fromFrame: undefined,
      });
    });

    it('should send start message with frame', () => {
      manager.start(48000);

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'start',
        fromFrame: 48000,
      });
    });

    it('should send pause message', () => {
      manager.pause();

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'pause',
      });
    });

    it('should send stop message and increment session', () => {
      const initialSessionId = (manager as any).currentSessionId;

      manager.stop();

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'stop',
      });

      expect((manager as any).currentSessionId).toBe(initialSessionId + 1);
    });

    it('should send seek message', () => {
      manager.seek(10.5);

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'seek',
        position: 10.5,
      });
    });

    it('should send config update', () => {
      manager.updateConfig({
        updateInterval: 0.005,
        lookAheadTime: 0.3,
      });

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'update-config',
        updateInterval: 0.005,
        lookAheadTime: 0.3,
      });
    });
  });

  describe('stats and metrics', () => {
    beforeEach(async () => {
      await manager.initialize(mockContext as any);
      mockWorkletNode = (manager as any)
        .audioWorkletNode as MockAudioWorkletNode;
    });

    it('should request stats', () => {
      manager.getStats();

      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'get-stats',
      });
    });

    it('should handle stats response', async () => {
      const statsPromise = new Promise((resolve) => {
        manager.once('stats', resolve);
      });

      mockWorkletNode.simulateMessage({
        type: 'stats',
        updateCount: 100,
        missedUpdates: 2,
        accuracy: '98.00%',
        currentFrame: 480000,
        isPlaying: true,
      });

      const stats = await statsPromise;
      expect(stats).toMatchObject({
        type: 'stats',
        updateCount: 100,
        missedUpdates: 2,
        accuracy: '98.00%',
      });
    });

    it('should get current timing', async () => {
      // Start the manager
      manager.start();
      const currentSessionId = (manager as any).currentSessionId;

      // Wait for the timing update to be processed
      const updatePromise = new Promise<void>((resolve) => {
        manager.once('timing-update', () => resolve());
      });

      // Send a complete timing update
      mockWorkletNode.simulateMessage({
        type: 'timing-update',
        time: 5.5,
        audioContextTime: 5.5,
        frame: 264000,
        playbackFrame: 264000,
        isPlaying: true,
        updateCount: 1,
        sessionId: currentSessionId,
        messageSequence: 0,
      });

      // Wait for the update to be processed
      await updatePromise;

      const timing = manager.getCurrentTiming();
      expect(timing).toEqual({
        time: 5.5,
        frame: 264000,
      });
    });
  });

  describe('lifecycle', () => {
    it('should check if active', async () => {
      expect(manager.isActive()).toBe(false);

      await manager.initialize(mockContext as any);
      expect(manager.isActive()).toBe(true);

      manager.destroy();
      expect(manager.isActive()).toBe(false);
    });

    it('should clean up on destroy', async () => {
      await manager.initialize(mockContext as any);
      mockWorkletNode = (manager as any)
        .audioWorkletNode as MockAudioWorkletNode;

      const disconnectSpy = vi.spyOn(mockWorkletNode, 'disconnect');

      manager.destroy();

      expect(disconnectSpy).toHaveBeenCalled();
      expect((manager as any).audioWorkletNode).toBeNull();
      expect((manager as any).silentOscillator).toBeNull();
      expect((manager as any).gainNode).toBeNull();
    });
  });
});
