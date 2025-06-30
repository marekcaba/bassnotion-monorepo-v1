import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Add ResizeObserver polyfill for react-three-fiber and other components
// Manual polyfill since the package import doesn't work in this test environment
if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;
    private observedElements = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.observedElements.add(target);
    }

    unobserve(target: Element) {
      this.observedElements.delete(target);
    }

    disconnect() {
      this.observedElements.clear();
    }
  };
}

// Store original global objects to prevent corruption
const originalGlobals = {
  document: global.document,
  window: global.window,
  navigator: global.navigator,
  performance: global.performance,
  console: global.console,
  fetch: global.fetch,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  // Audio-related globals that tests frequently corrupt
  AudioBuffer: global.AudioBuffer,
  AudioContext: global.AudioContext,
  AnalyserNode: global.AnalyserNode,
  OscillatorNode: global.OscillatorNode,
  Float32Array: global.Float32Array,
  // Timing-related globals
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  requestAnimationFrame: global.requestAnimationFrame,
  cancelAnimationFrame: global.cancelAnimationFrame,
  requestIdleCallback: global.requestIdleCallback,
  cancelIdleCallback: global.cancelIdleCallback,
  // Performance-related globals
  PerformanceObserver: global.PerformanceObserver,
  gc: (global as any).gc,
};

// Enhanced global restoration function
function restoreAllGlobals() {
  try {
    // Restore core globals
    if (
      originalGlobals.document &&
      global.document !== originalGlobals.document
    ) {
      global.document = originalGlobals.document;
    }
    if (originalGlobals.window && global.window !== originalGlobals.window) {
      global.window = originalGlobals.window;
    }
    if (
      originalGlobals.navigator &&
      global.navigator !== originalGlobals.navigator
    ) {
      global.navigator = originalGlobals.navigator;
    }
    if (
      originalGlobals.performance &&
      global.performance !== originalGlobals.performance
    ) {
      global.performance = originalGlobals.performance;
    }
    if (originalGlobals.console && global.console !== originalGlobals.console) {
      global.console = originalGlobals.console;
    }
    if (originalGlobals.fetch && global.fetch !== originalGlobals.fetch) {
      global.fetch = originalGlobals.fetch;
    }
    if (
      originalGlobals.localStorage &&
      global.localStorage !== originalGlobals.localStorage
    ) {
      global.localStorage = originalGlobals.localStorage;
    }
    if (
      originalGlobals.sessionStorage &&
      global.sessionStorage !== originalGlobals.sessionStorage
    ) {
      global.sessionStorage = originalGlobals.sessionStorage;
    }

    // Restore audio-related globals
    if (
      originalGlobals.AudioBuffer &&
      global.AudioBuffer !== originalGlobals.AudioBuffer
    ) {
      global.AudioBuffer = originalGlobals.AudioBuffer;
    }
    if (
      originalGlobals.AudioContext &&
      global.AudioContext !== originalGlobals.AudioContext
    ) {
      global.AudioContext = originalGlobals.AudioContext;
    }
    if (
      originalGlobals.AnalyserNode &&
      global.AnalyserNode !== originalGlobals.AnalyserNode
    ) {
      global.AnalyserNode = originalGlobals.AnalyserNode;
    }
    if (
      originalGlobals.OscillatorNode &&
      global.OscillatorNode !== originalGlobals.OscillatorNode
    ) {
      global.OscillatorNode = originalGlobals.OscillatorNode;
    }
    if (
      originalGlobals.Float32Array &&
      global.Float32Array !== originalGlobals.Float32Array
    ) {
      global.Float32Array = originalGlobals.Float32Array;
    }

    // Restore timing-related globals
    if (
      originalGlobals.setInterval &&
      global.setInterval !== originalGlobals.setInterval
    ) {
      global.setInterval = originalGlobals.setInterval;
    }
    if (
      originalGlobals.clearInterval &&
      global.clearInterval !== originalGlobals.clearInterval
    ) {
      global.clearInterval = originalGlobals.clearInterval;
    }
    if (
      originalGlobals.setTimeout &&
      global.setTimeout !== originalGlobals.setTimeout
    ) {
      global.setTimeout = originalGlobals.setTimeout;
    }
    if (
      originalGlobals.clearTimeout &&
      global.clearTimeout !== originalGlobals.clearTimeout
    ) {
      global.clearTimeout = originalGlobals.clearTimeout;
    }
    if (
      originalGlobals.requestAnimationFrame &&
      global.requestAnimationFrame !== originalGlobals.requestAnimationFrame
    ) {
      global.requestAnimationFrame = originalGlobals.requestAnimationFrame;
    }
    if (
      originalGlobals.cancelAnimationFrame &&
      global.cancelAnimationFrame !== originalGlobals.cancelAnimationFrame
    ) {
      global.cancelAnimationFrame = originalGlobals.cancelAnimationFrame;
    }
    if (
      originalGlobals.requestIdleCallback &&
      global.requestIdleCallback !== originalGlobals.requestIdleCallback
    ) {
      global.requestIdleCallback = originalGlobals.requestIdleCallback;
    }
    if (
      originalGlobals.cancelIdleCallback &&
      global.cancelIdleCallback !== originalGlobals.cancelIdleCallback
    ) {
      global.cancelIdleCallback = originalGlobals.cancelIdleCallback;
    }

    // Restore performance-related globals
    if (
      originalGlobals.PerformanceObserver &&
      global.PerformanceObserver !== originalGlobals.PerformanceObserver
    ) {
      global.PerformanceObserver = originalGlobals.PerformanceObserver;
    }
    if (originalGlobals.gc && (global as any).gc !== originalGlobals.gc) {
      (global as any).gc = originalGlobals.gc;
    }
  } catch (error) {
    console.warn('Failed to restore some globals:', error);
  }
}

// Global cleanup to run after each test
afterEach(() => {
  try {
    // Aggressive DOM cleanup to prevent corruption between domains
    if (global.document) {
      // Clear all timers that might be attached to elements
      const allElements = global.document.querySelectorAll('*');
      allElements.forEach((element: any) => {
        // Clear any attached timers or events
        if (element._timers) {
          element._timers.forEach((timer: any) => clearTimeout(timer));
          delete element._timers;
        }
        if (element._intervals) {
          element._intervals.forEach((interval: any) =>
            clearInterval(interval),
          );
          delete element._intervals;
        }
      });

      // Clear document body completely
      if (global.document.body) {
        global.document.body.innerHTML = '';
      }

      // Clear any test containers that might be lingering
      const testContainers = global.document.querySelectorAll(
        '[data-testid="test-root"], #test-root',
      );
      testContainers.forEach((container) => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
    }

    // Force garbage collection if available to prevent memory buildup
    if ((global as any).gc) {
      try {
        (global as any).gc();
      } catch {
        // GC might not be available in all test environments
      }
    }

    // Restore all global objects
    restoreAllGlobals();

    // Clear all timers aggressively
    vi.clearAllTimers();

    // Use real timers to prevent timer conflicts
    vi.useRealTimers();

    // Clear all mocks
    vi.clearAllMocks();

    // Reset modules to prevent state pollution
    vi.resetModules();

    // Additional audio context cleanup
    if (global.window && (global.window as any).audioContextInstances) {
      (global.window as any).audioContextInstances.forEach((ctx: any) => {
        if (ctx && typeof ctx.close === 'function') {
          try {
            ctx.close();
          } catch {
            // Ignore close errors
          }
        }
      });
      (global.window as any).audioContextInstances = [];
    }
  } catch (cleanupError) {
    console.warn('Test cleanup warning:', cleanupError);
  }
});

// Additional protection: Force restoration if globals are corrupted
beforeEach(() => {
  try {
    // Quick check for critical global corruption
    if (
      !global.document ||
      typeof global.document.createElement !== 'function'
    ) {
      console.warn('DOM corruption detected, forcing restoration...');

      // Force re-initialization of JSDOM if needed
      try {
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
          url: 'http://localhost',
          pretendToBeVisual: true,
          resources: 'usable',
        });

        global.window = dom.window as any;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
      } catch (jsdomError) {
        console.error('Failed to restore JSDOM:', jsdomError);
      }

      restoreAllGlobals();
    }

    // Ensure clean slate for each test
    if (global.document && global.document.body) {
      global.document.body.innerHTML = '';
    }
  } catch (setupError) {
    console.warn('Test setup warning:', setupError);
  }

  // Ensure audio context globals are available for audio tests
  if (!global.AudioContext) {
    // Create a comprehensive AudioContext mock that satisfies standardized-audio-context
    const mockListener = {
      forwardX: { value: 0, setValueAtTime: vi.fn() },
      forwardY: { value: 0, setValueAtTime: vi.fn() },
      forwardZ: { value: -1, setValueAtTime: vi.fn() },
      upX: { value: 0, setValueAtTime: vi.fn() },
      upY: { value: 1, setValueAtTime: vi.fn() },
      upZ: { value: 0, setValueAtTime: vi.fn() },
      positionX: { value: 0, setValueAtTime: vi.fn() },
      positionY: { value: 0, setValueAtTime: vi.fn() },
      positionZ: { value: 0, setValueAtTime: vi.fn() },
    };

    global.AudioContext = vi.fn(() => ({
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      baseLatency: 0.01,
      outputLatency: 0.02,
      listener: mockListener,
      destination: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        context: null,
        numberOfInputs: 1,
        numberOfOutputs: 0,
      },
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() },
        channelCount: 2,
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        context: null,
        numberOfInputs: 1,
        numberOfOutputs: 1,
      })),
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { value: 440, setValueAtTime: vi.fn() },
        detune: { value: 0, setValueAtTime: vi.fn() },
        type: 'sine',
        channelCount: 2,
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        context: null,
        numberOfInputs: 0,
        numberOfOutputs: 1,
      })),
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteFrequencyData: vi.fn(),
        getFloatFrequencyData: vi.fn(),
        getByteTimeDomainData: vi.fn(),
        getFloatTimeDomainData: vi.fn(),
        fftSize: 2048,
        frequencyBinCount: 1024,
        minDecibels: -100,
        maxDecibels: -30,
        smoothingTimeConstant: 0.8,
        channelCount: 2,
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        context: null,
        numberOfInputs: 1,
        numberOfOutputs: 1,
      })),
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: { value: 1, setValueAtTime: vi.fn() },
        detune: { value: 0, setValueAtTime: vi.fn() },
        channelCount: 2,
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        context: null,
        numberOfInputs: 0,
        numberOfOutputs: 1,
      })),
      createBuffer: vi.fn((numberOfChannels, length, sampleRate) => ({
        length,
        numberOfChannels,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: vi.fn(() => new Float32Array(length)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      })),
      decodeAudioData: vi.fn().mockResolvedValue({
        length: 44100,
        numberOfChannels: 2,
        sampleRate: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => new Float32Array(44100)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      }),
      suspend: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      // Additional properties that standardized-audio-context might expect
      onstatechange: null,
    })) as any;
  }
  // Ensure AudioBuffer is available
  if (!global.AudioBuffer) {
    global.AudioBuffer = class MockAudioBuffer {
      length: number;
      sampleRate: number;
      numberOfChannels: number;
      duration: number;

      constructor(options: {
        length: number;
        sampleRate: number;
        numberOfChannels?: number;
      }) {
        this.length = options.length;
        this.sampleRate = options.sampleRate;
        this.numberOfChannels = options.numberOfChannels || 2;
        this.duration = this.length / this.sampleRate;
      }

      getChannelData(_channel: number): Float32Array {
        return new Float32Array(this.length);
      }

      copyFromChannel(
        _destination: Float32Array,
        _channelNumber: number,
      ): void {
        // Mock implementation - no operation needed
      }
      copyToChannel(_source: Float32Array, _channelNumber: number): void {
        // Mock implementation - no operation needed
      }
    } as any;
  }
});

// Export the restoration function for use in other test files
export { restoreAllGlobals, originalGlobals };
