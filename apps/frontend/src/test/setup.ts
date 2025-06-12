import '@testing-library/jest-dom';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// 🎯 STEP 3.3: ULTIMATE TIMEOUT FIX - Mock fetch at module level
vi.mock('undici', () => ({
  fetch: vi.fn(),
  Request: vi.fn(),
  Response: vi.fn(),
  Headers: vi.fn(),
}));

// 🎯 STEP 3.3: CRITICAL TIMEOUT FIX - Create comprehensive fast mock fetch
const mockFetch = vi
  .fn()
  .mockImplementation(async (url: string, _options?: RequestInit) => {
    // Handle different URL patterns without delays for maximum speed
    const urlStr = url.toString();

    // Handle relative URLs that are causing Invalid URL errors
    if (urlStr.startsWith('/')) {
      url = `https://test-cdn.example.com${urlStr}`;
    }

    // Mock different response types based on URL
    let contentType = 'application/octet-stream';
    let responseData: ArrayBuffer;
    let responseText = 'test content';

    if (urlStr.includes('.mp3') || urlStr.includes('audio')) {
      contentType = 'audio/mpeg';
      responseData = new ArrayBuffer(352800); // ~8kB MP3 sample
      responseText = 'binary audio data';
    } else if (urlStr.includes('.mid') || urlStr.includes('midi')) {
      contentType = 'audio/midi';
      responseData = new ArrayBuffer(1024); // Small MIDI file
      responseText = 'binary midi data';
    } else if (urlStr.includes('.json') || urlStr.includes('manifest')) {
      contentType = 'application/json';
      const manifestData = {
        assets: [
          {
            id: 'audio0',
            url: 'https://cdn.example.com/audio0.mp3',
            type: 'audio/mpeg',
          },
          {
            id: 'audio1',
            url: 'https://cdn.example.com/audio1.mp3',
            type: 'audio/mpeg',
          },
        ],
        metadata: { version: '1.0', timestamp: Date.now() },
      };
      responseText = JSON.stringify(manifestData);
      responseData = new TextEncoder().encode(responseText)
        .buffer as ArrayBuffer;
    } else {
      responseData = new ArrayBuffer(1024); // Default small file
    }

    // Return immediate successful response
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      type: 'basic' as ResponseType,
      url: url,
      redirected: false,
      arrayBuffer: () => Promise.resolve(responseData),
      blob: () =>
        Promise.resolve(
          new Blob([new Uint8Array(responseData)], { type: contentType }),
        ),
      json: () => Promise.resolve(JSON.parse(responseText)),
      text: () => Promise.resolve(responseText),
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'content-type') return contentType;
          if (name.toLowerCase() === 'content-length')
            return responseData.byteLength.toString();
          return null;
        },
        has: (name: string) =>
          ['content-type', 'content-length'].includes(name.toLowerCase()),
        entries: function* () {
          yield ['content-type', contentType];
          yield ['content-length', responseData.byteLength.toString()];
        },
        keys: function* () {
          yield 'content-type';
          yield 'content-length';
        },
        values: function* () {
          yield contentType;
          yield responseData.byteLength.toString();
        },
        forEach: (callback: any) => {
          callback(contentType, 'content-type');
          callback(responseData.byteLength.toString(), 'content-length');
        },
      },
      clone: vi.fn(),
      body: null,
      bodyUsed: false,
      formData: () => Promise.resolve(new FormData()),
    };
  });

// 🎯 STEP 3.3: Set global mocks immediately
vi.stubGlobal('fetch', mockFetch);
(global as any).__testFetchImplementation = mockFetch;

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Enhanced cleanup after each test with Network State Reset
afterEach(() => {
  cleanup();

  // Clear all Worker mock state
  if ((global as any).__mockWorkers) {
    const mockWorkers = (global as any).__mockWorkers;
    // Terminate all active workers
    mockWorkers.forEach((worker: any) => {
      if (worker.isHealthy) {
        worker.terminate();
      }
    });
    mockWorkers.clear();
  }

  // Reset fetch behavior to success
  if ((global as any).__resetFetchBehavior) {
    (global as any).__resetFetchBehavior();
  }

  // Clear performance marks/measures
  if (global.performance) {
    global.performance.clearMarks?.();
    global.performance.clearMeasures?.();
    global.performance.clearResourceTimings?.();
  }

  // Clear all mocks to prevent state leakage (but preserve console mocks)
  // Store console mocks before clearing
  const preservedConsoleMocks = {
    log: global.console.log,
    error: global.console.error,
    warn: global.console.warn,
    info: global.console.info,
    debug: global.console.debug,
  };

  vi.clearAllMocks();

  // Restore console mocks after clearing
  Object.assign(global.console, preservedConsoleMocks);
  Object.assign(globalThis.console, preservedConsoleMocks);

  // Reset global state
  if ((global as any).Tone?.Transport) {
    (global as any).Tone.Transport.stop();
    (global as any).Tone.Transport.cancel();
    (global as any).Tone.Transport.position = '0:0:0';
    (global as any).Tone.Transport.state = 'stopped';
  }

  // 🎯 STEP 3.3: Keep the mock active for next test
  vi.stubGlobal('fetch', mockFetch);
  (global as any).__testFetchImplementation = mockFetch;
});

// Create proper AudioParam mock that matches Web Audio API
const createMockAudioParam = (defaultValue = 0) => ({
  value: defaultValue,
  defaultValue,
  minValue: -3.4028235e38,
  maxValue: 3.4028235e38,
  automationRate: 'a-rate' as const,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  setValueCurveAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  cancelAndHoldAtTime: vi.fn(),
});

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  sampleRate: 44100,
  currentTime: 0,
  destination: {
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
  },
  createGain: vi.fn(() => ({
    gain: createMockAudioParam(1),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    smoothingTimeConstant: 0.8,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    frequency: { value: 440, setValueAtTime: vi.fn() },
    type: 'sine',
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createBuffer: vi.fn((numberOfChannels, length, sampleRate) => ({
    numberOfChannels,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  })),
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  decodeAudioData: vi.fn(() =>
    Promise.resolve({
      numberOfChannels: 2,
      length: 44100,
      sampleRate: 44100,
      duration: 1,
      getChannelData: vi.fn(() => new Float32Array(44100)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    }),
  ),
  close: vi.fn(() => Promise.resolve()),
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  audioWorklet: {
    addModule: vi.fn(() => Promise.resolve()),
  },
};

const mockAudioBuffer = {
  numberOfChannels: 2,
  length: 44100,
  sampleRate: 44100,
  duration: 1,
  getChannelData: vi.fn(() => new Float32Array(44100)),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
};

// Global mocks with proper type assertions
(global as any).AudioContext = vi.fn(() => mockAudioContext);
(global as any).webkitAudioContext = vi.fn(() => mockAudioContext);
(global as any).AudioBuffer = vi.fn(() => mockAudioBuffer);

// Enhanced Mock Worker for WorkerPoolManager with Proper Isolation
const globalWorkerMap = new Map();

const createMockWorker = (scriptURL = '') => {
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const worker = {
    id: workerId,
    type: scriptURL.includes('audio') ? 'audio' : 'sequencer',
    isHealthy: true,
    currentLoad: 0,
    totalJobsProcessed: 0,
    errors: 0,
    __processingOrder: [],
    __responseDelay: 5, // Fast response for tests
    __failureRate: 0.1,

    postMessage: vi.fn().mockImplementation((message) => {
      // Track current load
      worker.currentLoad++;

      // Handle initialization immediately to prevent timeouts
      if (message.type === 'init') {
        process.nextTick(() => {
          if (worker.onmessage) {
            (worker.onmessage as any)({
              data: {
                id: message.id,
                type: 'init_complete',
                payload: { initialized: true },
                timestamp: Date.now(),
              },
            });
          }
        });
        return;
      }

      // Handle other messages with minimal delay
      setTimeout(() => {
        worker.currentLoad = Math.max(0, worker.currentLoad - 1);

        if (worker.isHealthy && Math.random() > (worker.__failureRate || 0.1)) {
          // Successful processing
          worker.totalJobsProcessed++;
          (worker.onmessage as any)?.({
            data: {
              id: message.id,
              type: 'processing_complete',
              payload: {
                processed: true,
                workerId: worker.id,
                result: message.payload, // Echo back payload for verification
              },
              processingTime: 10 + Math.random() * 20, // Fast processing
              timestamp: Date.now(),
            },
          });
        } else {
          // Failure case
          worker.errors++;
          (worker.onerror as any)?.(new Error('Worker processing failed'));
        }
      }, worker.__responseDelay || 5);
    }),

    terminate: vi.fn().mockImplementation(() => {
      worker.isHealthy = false;
      globalWorkerMap.delete(workerId);
    }),

    addEventListener: vi.fn().mockImplementation((type, listener) => {
      if (type === 'message' && typeof listener === 'function') {
        worker.onmessage = listener;
      } else if (type === 'error' && typeof listener === 'function') {
        worker.onerror = listener;
      }
    }),

    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    __isMock: true,
  };

  globalWorkerMap.set(workerId, worker);
  return worker;
};

// Mock Worker constructor with proper support detection
(global as any).Worker = vi.fn().mockImplementation((scriptURL) => {
  // Check if Worker is being tested for support (simulated by deleting global Worker)
  if ((global as any).__workerDisabled) {
    throw new Error('Worker is not supported');
  }

  return createMockWorker(scriptURL);
});

// Expose global worker map for test utilities
(global as any).__mockWorkers = globalWorkerMap;

// Enhanced MessageChannel mock
(global as any).MessageChannel = vi.fn(() => ({
  port1: {
    postMessage: vi.fn(),
    onmessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
  },
  port2: {
    postMessage: vi.fn(),
    onmessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
  },
}));

// Mock URL API for worker script creation
if (!(global as any).URL) {
  (global as any).URL = {
    createObjectURL: vi.fn().mockReturnValue('blob:mock-worker-url'),
    revokeObjectURL: vi.fn(),
  };
}

// Mock Blob for worker script construction
if (!(global as any).Blob) {
  (global as any).Blob = vi.fn().mockImplementation((parts, options) => ({
    size: parts ? parts.join('').length : 0,
    type: options?.type || 'application/javascript',
  }));
}

// Comprehensive Navigator API Mock for consistent test environment
const createNavigatorMock = () => ({
  hardwareConcurrency: 2,
  deviceMemory: 4,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  onLine: true,
  platform: 'Win32',
  language: 'en-US',
  languages: ['en-US', 'en'],
  cookieEnabled: true,
  doNotTrack: null,
  maxTouchPoints: 0,
  vendor: 'Google Inc.',
  vendorSub: '',
  productSub: '20030107',
  appName: 'Netscape',
  appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  appCodeName: 'Mozilla',
  product: 'Gecko',

  // Methods
  javaEnabled: vi.fn(() => false),
  sendBeacon: vi.fn(() => true),
  vibrate: vi.fn(() => false),

  // Additional properties for device detection
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
  },

  // Battery API mock
  getBattery: vi.fn(() =>
    Promise.resolve({
      charging: true,
      chargingTime: Infinity,
      dischargingTime: Infinity,
      level: 0.8,
    }),
  ),
});

// Apply navigator mock to all global references
const navigatorMock = createNavigatorMock();

Object.defineProperty(global, 'navigator', {
  value: navigatorMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'navigator', {
  value: navigatorMock,
  writable: true,
  configurable: true,
});

// Also ensure it's available on window if it exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'navigator', {
    value: navigatorMock,
    writable: true,
    configurable: true,
  });
}

// Mock Console methods for spy expectations (High-Impact Fix)
// Create persistent spy objects that work across all tests
const consoleMocks = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Set global console to use these persistent mocks
Object.defineProperty(global, 'console', {
  value: {
    ...global.console,
    ...consoleMocks,
  },
  writable: true,
  configurable: true,
});

// Also set on globalThis for Node.js compatibility
Object.defineProperty(globalThis, 'console', {
  value: {
    ...globalThis.console,
    ...consoleMocks,
  },
  writable: true,
  configurable: true,
});

// Mock Tone.js
vi.mock('tone', async () => {
  const mockToneNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn(),
    chain: vi.fn(),
    context: mockAudioContext,
  };

  const mockToneInstrument = {
    ...mockToneNode,
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    volume: { value: 0 },
  };

  const mockTransport = {
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    position: '0:0:0',
    state: 'stopped',
    bpm: { value: 120 },
    loopStart: '0:0:0',
    loopEnd: '4:0:0',
    loop: false,
    swing: 0,
    seconds: 0,
    scheduleRepeat: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    clear: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  // Mock utility functions
  const gainToDb = vi.fn((gain: number) => {
    if (gain <= 0) return -Infinity;
    return 20 * Math.log10(gain);
  });
  const dbToGain = vi.fn((db: number) => Math.pow(10, db / 20));
  const now = vi.fn(() => 0);

  return {
    // Core Tone.js classes
    Gain: vi.fn().mockImplementation((gain = 1) => {
      const gainNode = {
        ...mockToneNode,
        gain: {
          ...createMockAudioParam(gain),
          rampTo: vi.fn(),
          linearRampTo: vi.fn(),
          exponentialRampTo: vi.fn(),
        },
        input: createMockAudioParam(),
        output: createMockAudioParam(),
      };
      return gainNode;
    }),
    Limiter: vi.fn().mockImplementation((threshold = -6) => ({
      ...mockToneNode,
      threshold: { value: threshold },
    })),
    Analyser: vi.fn().mockImplementation((type = 'fft', size = 1024) => ({
      ...mockToneNode,
      getValue: vi.fn(() => new Float32Array(size)),
      type,
      size,
    })),
    Master: mockToneNode,
    Destination: mockToneNode,

    // Instruments
    Synth: vi.fn().mockImplementation(() => mockToneInstrument),
    MonoSynth: vi.fn().mockImplementation(() => mockToneInstrument),
    PolySynth: vi.fn().mockImplementation(() => mockToneInstrument),
    Sampler: vi.fn().mockImplementation(() => mockToneInstrument),

    // Transport - both as property and getter
    Transport: mockTransport,
    getTransport: vi.fn(() => mockTransport),

    // Effects
    Reverb: vi.fn().mockImplementation(() => mockToneNode),
    Delay: vi.fn().mockImplementation(() => mockToneNode),
    Chorus: vi.fn().mockImplementation(() => mockToneNode),
    Distortion: vi.fn().mockImplementation(() => mockToneNode),
    Panner: vi.fn().mockImplementation((pan = 0) => ({
      ...mockToneNode,
      pan: { value: pan },
    })),

    // Utility functions - directly available on namespace
    gainToDb,
    dbToGain,
    now,

    // Context management
    start: vi.fn(() => Promise.resolve()),
    getContext: vi.fn(() => mockAudioContext),
    setContext: vi.fn(() => Promise.resolve()),
    getDestination: vi.fn(() => mockToneNode),

    // Time utilities
    Time: vi.fn().mockImplementation((time) => ({
      toSeconds: vi.fn(() => parseFloat(time) || 0),
      valueOf: vi.fn(() => parseFloat(time) || 0),
    })),

    // Default export for compatibility
    default: {
      gainToDb,
      dbToGain,
      now,
      start: vi.fn(() => Promise.resolve()),
      getContext: vi.fn(() => mockAudioContext),
      setContext: vi.fn(() => Promise.resolve()),
      Transport: mockTransport,
      getDestination: vi.fn(() => mockToneNode),
    },
  };
});

// Mock IndexedDB for CDNCache tests
const mockIndexedDB = {
  open: vi.fn(() => ({
    onsuccess: vi.fn(),
    onerror: vi.fn(),
    onupgradeneeded: vi.fn(),
    result: {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        })),
      })),
    },
  })),
  deleteDatabase: vi.fn(),
  cmp: vi.fn(),
  databases: vi.fn(() => Promise.resolve([])),
};

(global as any).indexedDB = mockIndexedDB;

// Comprehensive Performance API Mock (fixes Node.js undici markResourceTiming error)
const createPerformanceMock = () => ({
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByType: vi.fn(() => []),
  getEntriesByName: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),

  // Critical: markResourceTiming for Node.js undici compatibility
  markResourceTiming: vi.fn().mockImplementation((_timingInfo?: any) => {
    // No-op implementation to prevent undici errors
    return;
  }),
  clearResourceTimings: vi.fn(),

  // Performance Observer mock
  observer: {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  },

  // Memory information
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },

  // Navigation timing
  timing: {
    navigationStart: 0,
    loadEventEnd: 100,
    loadEventStart: 95,
    domContentLoadedEventEnd: 90,
    domContentLoadedEventStart: 85,
    responseEnd: 80,
    responseStart: 75,
    requestStart: 70,
    connectEnd: 65,
    connectStart: 60,
    domainLookupEnd: 55,
    domainLookupStart: 50,
    fetchStart: 45,
    redirectEnd: 0,
    redirectStart: 0,
    unloadEventEnd: 0,
    unloadEventStart: 0,
  },

  toJSON: vi.fn(() => ({ now: Date.now() })),
});

// Apply performance mock to all possible global references
const performanceMock = createPerformanceMock();

Object.defineProperty(global, 'performance', {
  value: performanceMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'performance', {
  value: performanceMock,
  writable: true,
  configurable: true,
});

// Also ensure it's available on window if it exists
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'performance', {
    value: performanceMock,
    writable: true,
    configurable: true,
  });
}

// Mock URL.createObjectURL for blob handling
global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
global.URL.revokeObjectURL = vi.fn();

// 🎯 STEP 3.3: CRITICAL FIX - Ensure mock is applied after every singleton reset
beforeEach(async () => {
  // Re-apply the fetch mock after any singleton resets
  vi.stubGlobal('fetch', mockFetch);
  (global as any).__testFetchImplementation = mockFetch;

  // Explicitly set AssetManager fetch implementation if it exists
  try {
    const { AssetManager } = await import(
      '../domains/playback/services/AssetManager.js'
    );
    AssetManager.setGlobalFetchImplementation(mockFetch);
  } catch {
    // AssetManager might not be imported yet, that's fine
  }
});
