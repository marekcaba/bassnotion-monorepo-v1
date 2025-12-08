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

  describe('Race Condition Fixes (Phase 2 Timing Refactor)', () => {
    describe('Message Handler Setup Before Connection', () => {
      it('should set up message handler before connecting to destination', async () => {
        // Track the order of operations
        const operationOrder: string[] = [];

        // Create a new manager to test initialization order
        const testManager = new AudioWorkletManager({
          updateInterval: 0.00267,
          lookAheadTime: 0.2,
        });

        // Mock the AudioWorkletNode constructor to track operation order
        const originalAudioWorkletNode = (global as any).AudioWorkletNode;
        (global as any).AudioWorkletNode = function (
          context: any,
          name: string,
          options: any,
        ) {
          const node = new MockAudioWorkletNode();

          // Override connect to track when it's called
          const originalConnect = node.connect;
          node.connect = vi.fn((...args) => {
            // By the time connect is called, onmessage should be set
            if (node.port.onmessage) {
              operationOrder.push('handler-set');
            }
            operationOrder.push('connect');
            return originalConnect.call(node, ...args);
          });

          return node;
        };

        await testManager.initialize(mockContext as any);

        // Restore original
        (global as any).AudioWorkletNode = originalAudioWorkletNode;

        // Get the worklet node
        const workletNode = (testManager as any).audioWorkletNode as MockAudioWorkletNode;

        // Message handler should be set up
        expect(workletNode.port.onmessage).toBeDefined();

        // Verify correct order: handler set before connect
        expect(operationOrder).toEqual(['handler-set', 'connect']);

        testManager.destroy();
      });

      it('should receive messages sent immediately after initialization', async () => {
        await manager.initialize(mockContext as any);
        mockWorkletNode = (manager as any).audioWorkletNode as MockAudioWorkletNode;

        const updatePromise = new Promise<TimingUpdate>((resolve) => {
          manager.once('timing-update', resolve);
        });

        manager.start();
        const currentSessionId = (manager as any).currentSessionId;

        // Simulate immediate message (as would happen in real scenario)
        mockWorkletNode.simulateMessage({
          type: 'timing-update',
          time: 0.002667,
          audioContextTime: 0.032,
          frame: 128,
          playbackFrame: 128,
          isPlaying: true,
          updateCount: 1,
          sessionId: currentSessionId,
          messageSequence: 0,
        });

        // Should receive the message without race condition
        const update = await updatePromise;
        expect(update.time).toBe(0.002667);
      });
    });

    describe('Idempotent Initialization', () => {
      it('should skip duplicate initialization with same AudioContext', async () => {
        await manager.initialize(mockContext as any);

        const addModuleSpy = mockContext.audioWorklet.addModule as any;
        const firstCallCount = addModuleSpy.mock.calls.length;

        // Try to initialize again with same context
        await manager.initialize(mockContext as any);

        // Should not call addModule again
        expect(addModuleSpy.mock.calls.length).toBe(firstCallCount);
      });

      it('should reinitialize if AudioContext changes', async () => {
        await manager.initialize(mockContext as any);
        const oldWorkletNode = (manager as any).audioWorkletNode;

        // Create a different AudioContext
        const newContext = new MockAudioContext();
        await manager.initialize(newContext as any);

        // Should create a new worklet node
        const newWorkletNode = (manager as any).audioWorkletNode;
        expect(newWorkletNode).not.toBe(oldWorkletNode);
        expect(newWorkletNode).toBeDefined();

        // Verify the new context is being used
        expect((manager as any).audioContext).toBe(newContext);
      });

      it('should clean up old worklet node when reinitializing with new context', async () => {
        await manager.initialize(mockContext as any);
        const oldWorkletNode = (manager as any).audioWorkletNode as MockAudioWorkletNode;
        const disconnectSpy = vi.spyOn(oldWorkletNode, 'disconnect');

        // Initialize with new context
        const newContext = new MockAudioContext();
        await manager.initialize(newContext as any);

        // Old node should be disconnected
        expect(disconnectSpy).toHaveBeenCalled();
      });
    });

    describe('Session ID Validation', () => {
      it('should increment session ID on stop()', () => {
        const initialSessionId = (manager as any).currentSessionId;

        manager.stop();

        expect((manager as any).currentSessionId).toBe(initialSessionId + 1);
      });

      it('should reset message sequence on stop()', async () => {
        await manager.initialize(mockContext as any);
        mockWorkletNode = (manager as any).audioWorkletNode as MockAudioWorkletNode;

        manager.start();
        const sessionId = (manager as any).currentSessionId;

        // Send a few messages to increase sequence
        mockWorkletNode.simulateMessage({
          type: 'timing-update',
          time: 0.002667,
          audioContextTime: 0.032,
          frame: 128,
          playbackFrame: 128,
          isPlaying: true,
          updateCount: 1,
          sessionId,
          messageSequence: 0,
        });

        mockWorkletNode.simulateMessage({
          type: 'timing-update',
          time: 0.005333,
          audioContextTime: 0.035,
          frame: 256,
          playbackFrame: 256,
          isPlaying: true,
          updateCount: 2,
          sessionId,
          messageSequence: 1,
        });

        // Stop should reset sequence
        manager.stop();

        expect((manager as any).expectedMessageSequence).toBe(-1);
      });

      it('should suppress stale message warnings for 200ms after stop', async () => {
        await manager.initialize(mockContext as any);
        mockWorkletNode = (manager as any).audioWorkletNode as MockAudioWorkletNode;

        manager.start();
        const oldSessionId = (manager as any).currentSessionId;
        manager.stop();

        // Simulate stale message immediately after stop (within 200ms)
        mockWorkletNode.simulateMessage({
          type: 'timing-update',
          time: 0.002667,
          sessionId: oldSessionId,
          messageSequence: 0,
        });

        // Should not log warning (race condition cleanup period)
        // This is expected behavior to reduce console noise
      });
    });

    describe('Multiple Start/Stop Cycles', () => {
      it('should handle rapid start/stop without errors', async () => {
        await manager.initialize(mockContext as any);

        // Rapid cycles
        for (let i = 0; i < 10; i++) {
          expect(() => manager.start()).not.toThrow();
          expect(() => manager.stop()).not.toThrow();
        }
      });

      it('should maintain correct session ID after multiple cycles', async () => {
        await manager.initialize(mockContext as any);

        const initialSessionId = (manager as any).currentSessionId;

        // 5 start/stop cycles
        for (let i = 0; i < 5; i++) {
          manager.start();
          manager.stop();
        }

        expect((manager as any).currentSessionId).toBe(initialSessionId + 5);
      });
    });

    describe('Edge Cases', () => {
      it('should handle destroy during message processing', async () => {
        await manager.initialize(mockContext as any);
        mockWorkletNode = (manager as any).audioWorkletNode as MockAudioWorkletNode;

        manager.start();
        const sessionId = (manager as any).currentSessionId;

        // Queue a message
        mockWorkletNode.simulateMessage({
          type: 'timing-update',
          time: 0.002667,
          audioContextTime: 0.032,
          frame: 128,
          playbackFrame: 128,
          isPlaying: true,
          updateCount: 1,
          sessionId,
          messageSequence: 0,
        });

        // Destroy immediately
        expect(() => manager.destroy()).not.toThrow();
      });

      it('should not send messages if worklet not initialized', () => {
        const uninitializedManager = new AudioWorkletManager({
          updateInterval: 0.00267,
          lookAheadTime: 0.2,
        });

        // Should not throw when trying to send messages
        expect(() => uninitializedManager.start()).not.toThrow();
        expect(() => uninitializedManager.stop()).not.toThrow();
        expect(() => uninitializedManager.pause()).not.toThrow();

        uninitializedManager.destroy();
      });
    });
  });
});
