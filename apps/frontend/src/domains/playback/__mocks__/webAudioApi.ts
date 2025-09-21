/**
 * Web Audio API Mock
 * Provides mock implementations of Web Audio API classes for testing
 */

import { vi } from 'vitest';

export class MockAudioNode {
  connect = vi.fn().mockReturnThis();
  disconnect = vi.fn();
  context = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running' as AudioContextState,
  };
}

export class MockGainNode extends MockAudioNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueCurveAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  };
}

export class MockAudioWorkletNode extends MockAudioNode {
  parameters = new Map();
  port = {
    postMessage: vi.fn(),
    onmessage: null,
  };
}

export class MockAudioContext {
  currentTime = 0;
  sampleRate = 48000;
  state: AudioContextState = 'running';
  createGain = vi.fn(() => new MockGainNode());
  createOscillator = vi.fn();
  createBuffer = vi.fn();
  createBufferSource = vi.fn();
  decodeAudioData = vi.fn();
  destination = new MockAudioNode();
}

// Set up global mocks
if (typeof global !== 'undefined') {
  (global as any).AudioContext = MockAudioContext;
  (global as any).GainNode = MockGainNode;
  (global as any).AudioNode = MockAudioNode;
  (global as any).AudioWorkletNode = MockAudioWorkletNode;
}

// Also set on window for browser-like environment
if (typeof window !== 'undefined') {
  (window as any).AudioContext = MockAudioContext;
  (window as any).GainNode = MockGainNode;
  (window as any).AudioNode = MockAudioNode;
  (window as any).AudioWorkletNode = MockAudioWorkletNode;
}
