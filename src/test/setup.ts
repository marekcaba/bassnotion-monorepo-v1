import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    searchParams: new URLSearchParams(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Enhanced Headers API Mock
class MockHeaders {
  private headers: Map<string, string> = new Map();

  append(name: string, value: string): void {
    const existing = this.headers.get(name.toLowerCase());
    if (existing) {
      this.headers.set(name.toLowerCase(), `${existing}, ${value}`);
    } else {
      this.headers.set(name.toLowerCase(), value);
    }
  }

  delete(name: string): void {
    this.headers.delete(name.toLowerCase());
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this.headers.has(name.toLowerCase());
  }

  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  forEach(callback: (value: string, name: string, parent: Headers) => void): void {
    this.headers.forEach((value, name) => {
      callback(value, name, this as any);
    });
  }

  *entries(): IterableIterator<[string, string]> {
    for (const [name, value] of this.headers) {
      yield [name, value];
    }
  }

  *keys(): IterableIterator<string> {
    for (const name of this.headers.keys()) {
      yield name;
    }
  }

  *values(): IterableIterator<string> {
    for (const value of this.headers.values()) {
      yield value;
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }
}

if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = MockHeaders as any;
}

// Enhanced fetch mock
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new MockHeaders(),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    blob: vi.fn().mockResolvedValue(new Blob()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    clone: vi.fn(),
  });
}

// Mock Request and Response for fetch
if (typeof globalThis.Request === 'undefined') {
  globalThis.Request = vi.fn().mockImplementation((url: string, init?: RequestInit) => ({
    url,
    method: init?.method || 'GET',
    headers: new MockHeaders(),
    body: init?.body || null,
    clone: vi.fn(),
  })) as any;
}

if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = vi.fn().mockImplementation((body?: any, init?: ResponseInit) => ({
    ok: init?.status ? init.status < 400 : true,
    status: init?.status || 200,
    statusText: init?.statusText || 'OK',
    headers: new MockHeaders(),
    body,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(String(body || '')),
    blob: vi.fn().mockResolvedValue(new Blob()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    clone: vi.fn(),
  })) as any;
}

// Enhanced AudioContext Mock with close() method
const mockAudioContext = {
  get currentTime() { return mockPerformanceTime / 1000; }, // Convert ms to seconds for audio timing
  state: 'running',
  sampleRate: 44100,
  destination: {
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  },
  createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
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
    onended: null,
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createOscillator: vi.fn(() => ({
    frequency: { value: 440, setValueAtTime: vi.fn() },
    type: 'sine',
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createDynamicsCompressor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  createConvolver: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
  decodeAudioData: vi.fn().mockResolvedValue({
    numberOfChannels: 2,
    length: 44100,
    sampleRate: 44100,
    getChannelData: vi.fn(() => new Float32Array(44100)),
  }),
  // ✅ CRITICAL FIX: Add close() method
  close: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
};

// ✅ CRITICAL FIX: Ensure AudioContext constructor returns proper mock
if (typeof globalThis.AudioContext === 'undefined') {
  globalThis.AudioContext = vi.fn().mockImplementation(() => {
    console.log('🔊 AudioContext mock created with close() method');
    return mockAudioContext;
  }) as any;
}

if (typeof globalThis.webkitAudioContext === 'undefined') {
  globalThis.webkitAudioContext = vi.fn().mockImplementation(() => {
    console.log('🔊 webkitAudioContext mock created with close() method');
    return mockAudioContext;
  }) as any;
}

// ✅ CRITICAL FIX: Mock window.AudioContext and window.webkitAudioContext
class MockAudioContext {
  currentTime = 1.234567;
  state = 'running';
  sampleRate = 44100;
  destination = {
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  };

  constructor(options?: AudioContextOptions) {
    console.log('🔊 MockAudioContext constructor called with options:', options);
    // Copy all methods from mockAudioContext
    Object.assign(this, mockAudioContext);
  }

  createBuffer = mockAudioContext.createBuffer;
  createBufferSource = mockAudioContext.createBufferSource;
  createGain = mockAudioContext.createGain;
  createAnalyser = mockAudioContext.createAnalyser;
  createOscillator = mockAudioContext.createOscillator;
  createDynamicsCompressor = mockAudioContext.createDynamicsCompressor;
  createConvolver = mockAudioContext.createConvolver;
  decodeAudioData = mockAudioContext.decodeAudioData;
  close = mockAudioContext.close;
  resume = mockAudioContext.resume;
  suspend = mockAudioContext.suspend;
}

// Set up global and window AudioContext mocks
globalThis.AudioContext = MockAudioContext as any;

// ✅ CRITICAL FIX: Mock window object for browser environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {} as any;
}

// ✅ CRITICAL FIX: Mock window.AudioContext specifically
globalThis.window.AudioContext = MockAudioContext as any;
(globalThis.window as any).webkitAudioContext = MockAudioContext as any;

// ✅ CRITICAL FIX: Add comprehensive Canvas API mocks
if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  const mockCanvas = {
    width: 300,
    height: 150,
    getContext: vi.fn((type: string) => {
      if (type === '2d') {
        return {
          fillStyle: '#000000',
          strokeStyle: '#000000',
          lineWidth: 1,
          font: '10px sans-serif',
          textAlign: 'start',
          textBaseline: 'alphabetic',
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          clearRect: vi.fn(),
          fillText: vi.fn(),
          strokeText: vi.fn(),
          measureText: vi.fn(() => ({ width: 50 })),
          beginPath: vi.fn(),
          closePath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arc: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          scale: vi.fn(),
          createImageData: vi.fn(),
          getImageData: vi.fn(),
          putImageData: vi.fn(),
        };
      }
      return null;
    }),
    // ✅ CRITICAL FIX: Add toDataURL method that returns realistic data URL
    toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
    toBlob: vi.fn((callback: (blob: Blob) => void) => {
      const blob = new Blob(['mock-canvas-data'], { type: 'image/png' });
      callback(blob);
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  globalThis.HTMLCanvasElement = vi.fn(() => mockCanvas) as any;
  
  // Also mock document.createElement for canvas
  const originalCreateElement = document.createElement;
  document.createElement = vi.fn((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      return mockCanvas as any;
    }
    return originalCreateElement.call(document, tagName);
  });
}

// Enhanced Performance API with realistic incrementing timing
let mockPerformanceTime = 1000; // Start at 1000ms
const mockPerformanceNow = () => {
  mockPerformanceTime += Math.random() * 16 + 1; // Add 1-17ms (realistic frame timing)
  return mockPerformanceTime;
};

if (typeof globalThis.performance === 'undefined') {
  globalThis.performance = {
    now: mockPerformanceNow,
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    timing: {
      navigationStart: Date.now() - 5000,
      loadEventEnd: Date.now() - 1000,
      domContentLoadedEventEnd: Date.now() - 2000,
    },
  } as any;
} else {
  // ✅ CRITICAL FIX: Enhance existing performance.now() to return realistic incrementing values
  const originalNow = globalThis.performance.now;
  globalThis.performance.now = mockPerformanceNow;
}

// Add missing global APIs for browser environment simulation
if (typeof globalThis.setInterval === 'undefined') {
  globalThis.setInterval = vi.fn((callback: () => void, delay: number) => {
    return setTimeout(callback, delay);
  }) as any;
}

if (typeof globalThis.clearInterval === 'undefined') {
  globalThis.clearInterval = vi.fn() as any;
}

if (typeof globalThis.setTimeout === 'undefined') {
  globalThis.setTimeout = vi.fn() as any;
}

if (typeof globalThis.clearTimeout === 'undefined') {
  globalThis.clearTimeout = vi.fn() as any;
} 