// Mock for standardized-audio-context library used by Tone.js
import { vi } from 'vitest';

// TODO: Review non-null assertion - consider null safety
console.log('🔊 STANDARDIZED-AUDIO-CONTEXT MOCK LOADED!');

// Enhanced mock for AudioContext listener with all required properties
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

console.log('🔊 Mock listener created with forwardX:', mockListener.forwardX);

// Enhanced mock AudioContext compatible with standardized-audio-context
const createMockAudioContext = () => ({
  currentTime: 1.234567,
  sampleRate: 44100,
  state: 'running',
  destination: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 0,
  },
  listener: mockListener,
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  })),
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: {
      value: 440,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    detune: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    type: 'sine',
    context: null,
    numberOfInputs: 0,
    numberOfOutputs: 1,
  })),
  createAnalyser: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    minDecibels: -100,
    maxDecibels: -30,
    smoothingTimeConstant: 0.8,
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  })),
  createBiquadFilter: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: {
      value: 350,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    Q: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    type: 'lowpass',
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  })),
  createDelay: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    delayTime: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    context: null,
    numberOfInputs: 1,
    numberOfOutputs: 1,
  })),
  createDynamicsCompressor: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    threshold: {
      value: -24,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    knee: {
      value: 30,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    ratio: {
      value: 12,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    attack: {
      value: 0.003,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    release: {
      value: 0.25,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    reduction: 0,
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
    playbackRate: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    detune: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    context: null,
    numberOfInputs: 0,
    numberOfOutputs: 1,
  })),
  createBuffer: vi.fn(
    (numberOfChannels = 2, length = 44100, sampleRate = 44100) => ({
      length,
      numberOfChannels,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: vi.fn((_channel) => new Float32Array(length)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    }),
  ),
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
  onstatechange: null,
  baseLatency: 0.01,
  outputLatency: 0.01,
});

// Mock AudioContext constructor
export class AudioContext {
  constructor(_options: any = {}) {
    console.log(
      '🔊 Standardized AudioContext mock constructor called with options:',
      _options,
    );
    return createMockAudioContext();
  }
}

// Mock OfflineAudioContext
export class OfflineAudioContext {
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    console.log('🔊 Standardized OfflineAudioContext mock constructor called');
    const context = createMockAudioContext();
    return {
      ...context,
      length,
      startRendering: vi
        .fn()
        .mockResolvedValue(
          context.createBuffer(numberOfChannels, length, sampleRate),
        ),
    };
  }
}

// Mock utility functions
export const isSupported = vi.fn(() => true);

// Export default for compatibility
export default {
  AudioContext,
  OfflineAudioContext,
  isSupported,
};
