/**
 * Audio Library Mock Infrastructure
 *
 * Provides consistent, reusable audio library mocking for audio processing tests.
 * Used by services like SyncProcessor, BassProcessor, DrumProcessor, CorePlaybackEngine, etc.
 *
 * Usage:
 *   import { createAudioLibraryMocks } from '../../test/mocks/audioLibraryMocks.js';
 *   const mocks = createAudioLibraryMocks(options);
 */

import { vi } from 'vitest';

export interface AudioMockOptions {
  // Tone.js timing options
  timing?: {
    contextStarted?: boolean;
    contextState?: 'running' | 'suspended' | 'closed';
    lookAhead?: number;
    bufferSize?: number;
    bufferTime?: number;
  };

  // Audio context options
  audioContext?: {
    sampleRate?: number;
    currentTime?: number;
  };

  // Transport options
  transport?: {
    bpm?: number;
    position?: string;
    state?: 'started' | 'stopped' | 'paused';
  };

  // Enable/disable specific features
  enableWebAudio?: boolean;
  enableMIDI?: boolean;
  enableAnalyzer?: boolean;
  enableRecorder?: boolean;

  // Logging
  enableAudioLogs?: boolean;
}

export interface ToneJSMocks {
  mockTone: any;
  mockPlayer: any;
  mockSynth: any;
  mockTransport: any;
  mockDestination: any;
  mockContext: any;
  mockPanner: any;
  mockVolume: any;
  mockFilter: any;
  mockDistortion: any;
  mockReverb: any;
  mockDelay: any;
  mockChorus: any;
  mockCompressor: any;
  mockEQ3: any;
  mockOscillator: any;
  mockEnvelope: any;
  mockAnalyser: any;
  mockRecorder: any;
  cleanup: () => void;
}

export const createAudioLibraryMocks = (
  options: AudioMockOptions = {},
): ToneJSMocks => {
  const defaults = {
    timing: {
      contextStarted: true,
      contextState: 'running' as const,
      lookAhead: 0.1,
      bufferSize: 1024,
      bufferTime: 0.1,
    },
    audioContext: {
      sampleRate: 44100,
      currentTime: 0,
    },
    transport: {
      bpm: 120,
      position: '0:0:0',
      state: 'stopped' as const,
    },
  };

  const config = {
    timing: { ...defaults.timing, ...options.timing },
    audioContext: { ...defaults.audioContext, ...options.audioContext },
    transport: { ...defaults.transport, ...options.transport },
  };

  // Base audio node mock with common functionality
  const createAudioNodeMock = (type: string) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
    context: null, // Will be set below
    numberOfInputs: 1,
    numberOfOutputs: 1,
    _type: type,
    toDestination: vi.fn(),
    fan: vi.fn(),
    chain: vi.fn(),
  });

  // Mock AudioContext
  const mockContext = {
    state: config.timing.contextState,
    sampleRate: config.audioContext.sampleRate,
    currentTime: config.audioContext.currentTime,
    destination: createAudioNodeMock('Destination'),
    listener: {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: -1 },
      upX: { value: 0 },
      upY: { value: 1 },
      upZ: { value: 0 },
    },
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
    createGain: vi.fn(),
    createOscillator: vi.fn(),
    createAnalyser: vi.fn(),
    createDelay: vi.fn(),
    createBiquadFilter: vi.fn(),
    createDynamicsCompressor: vi.fn(),
    createConvolver: vi.fn(),
    createPanner: vi.fn(),
    createStereoPanner: vi.fn(),
    createWaveShaper: vi.fn(),
    createPeriodicWave: vi.fn(),
    createChannelSplitter: vi.fn(),
    createChannelMerger: vi.fn(),
    createScriptProcessor: vi.fn(),
    decodeAudioData: vi.fn().mockResolvedValue({}),
  };

  // Mock Destination
  const mockDestination = {
    ...createAudioNodeMock('Destination'),
    volume: {
      value: 0,
      rampTo: vi.fn(),
      linearRampTo: vi.fn(),
      exponentialRampTo: vi.fn(),
      targetRampTo: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      setRampPoint: vi.fn(),
      cancelScheduledValues: vi.fn(),
      cancelAndHoldAtTime: vi.fn(),
    },
    mute: false,
  };

  // Mock Transport with realistic timing methods
  const mockTransport = {
    bpm: {
      value: config.transport.bpm,
      rampTo: vi.fn(),
    },
    position: config.transport.position,
    state: config.transport.state,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    schedule: vi.fn(),
    scheduleRepeat: vi.fn(),
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    cancel: vi.fn(),
    getSecondsAtTime: vi.fn().mockReturnValue(0),
    getTicksAtTime: vi.fn().mockReturnValue(0),
    getTimeAtTick: vi.fn().mockReturnValue(0),
    nextSubdivision: vi.fn(),
    now: vi.fn().mockReturnValue(0),
    immediate: vi.fn().mockReturnValue(0),
    ticks: 0,
    PPQ: 192,
    seconds: 0,
    progress: 0,
    loop: false,
    loopStart: 0,
    loopEnd: '1m',
    swing: 0,
    swingSubdivision: '8n',
    timeSignature: [4, 4],
    lookAhead: config.timing.lookAhead,
    latencyHint: 'interactive',
  };

  // Mock Player with complete audio loading functionality
  const mockPlayer = {
    ...createAudioNodeMock('Player'),
    loaded: true,
    buffer: {
      length: 44100,
      sampleRate: 44100,
      numberOfChannels: 2,
      duration: 1,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    },
    volume: {
      value: 0,
      rampTo: vi.fn(),
    },
    playbackRate: 1,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    reverse: false,
    autostart: false,
    fadeIn: 0,
    fadeOut: 0,
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    seek: vi.fn(),
    state: 'stopped',
  };

  // Mock AudioParam for parameter automation
  const createAudioParamMock = (initialValue = 0) => ({
    value: initialValue,
    defaultValue: initialValue,
    minValue: -3.4028235e38,
    maxValue: 3.4028235e38,
    rampTo: vi.fn(),
    linearRampTo: vi.fn(),
    exponentialRampTo: vi.fn(),
    targetRampTo: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setRampPoint: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  });

  // Mock Volume control
  const mockVolume = {
    ...createAudioNodeMock('Volume'),
    volume: createAudioParamMock(0),
    mute: false,
  };

  // Mock Panner for spatial audio
  const mockPanner = {
    ...createAudioNodeMock('Panner'),
    pan: createAudioParamMock(0),
    positionX: createAudioParamMock(0),
    positionY: createAudioParamMock(0),
    positionZ: createAudioParamMock(0),
    orientationX: createAudioParamMock(1),
    orientationY: createAudioParamMock(0),
    orientationZ: createAudioParamMock(0),
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    coneInnerAngle: 360,
    coneOuterAngle: 0,
    coneOuterGain: 0,
    distanceModel: 'inverse',
    panningModel: 'HRTF',
  };

  // Mock Effects
  const mockFilter = {
    ...createAudioNodeMock('Filter'),
    frequency: createAudioParamMock(350),
    Q: createAudioParamMock(1),
    gain: createAudioParamMock(0),
    type: 'lowpass',
    rolloff: -12,
  };

  const mockDistortion = {
    ...createAudioNodeMock('Distortion'),
    distortion: createAudioParamMock(0.4),
    oversample: '4x',
  };

  const mockReverb = {
    ...createAudioNodeMock('Reverb'),
    roomSize: createAudioParamMock(0.7),
    dampening: createAudioParamMock(3000),
    decay: 1.5,
    preDelay: 0.01,
    wet: createAudioParamMock(0.4),
    ready: Promise.resolve(),
  };

  const mockDelay = {
    ...createAudioNodeMock('Delay'),
    delayTime: createAudioParamMock(0.1),
    feedback: createAudioParamMock(0.125),
    wet: createAudioParamMock(0.2),
    maxDelay: 1,
  };

  const mockChorus = {
    ...createAudioNodeMock('Chorus'),
    frequency: createAudioParamMock(1.5),
    delayTime: createAudioParamMock(2.5),
    depth: createAudioParamMock(0.7),
    feedback: createAudioParamMock(0.1),
    type: 'sine',
    spread: 180,
    wet: createAudioParamMock(0.3),
  };

  const mockCompressor = {
    ...createAudioNodeMock('Compressor'),
    threshold: createAudioParamMock(-24),
    ratio: createAudioParamMock(12),
    knee: createAudioParamMock(30),
    attack: createAudioParamMock(0.003),
    release: createAudioParamMock(0.25),
    reduction: 0,
  };

  const mockEQ3 = {
    ...createAudioNodeMock('EQ3'),
    low: createAudioParamMock(0),
    mid: createAudioParamMock(0),
    high: createAudioParamMock(0),
    lowFrequency: createAudioParamMock(400),
    highFrequency: createAudioParamMock(2500),
    Q: createAudioParamMock(1),
  };

  // Mock Synth and sound sources
  const mockSynth = {
    ...createAudioNodeMock('Synth'),
    volume: createAudioParamMock(0),
    oscillator: {
      type: 'triangle',
      frequency: createAudioParamMock(440),
      detune: createAudioParamMock(0),
    },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 1,
      attackCurve: 'linear',
      decayCurve: 'exponential',
      releaseCurve: 'exponential',
    },
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    setNote: vi.fn(),
    releaseAll: vi.fn(),
  };

  const mockOscillator = {
    ...createAudioNodeMock('Oscillator'),
    frequency: createAudioParamMock(440),
    detune: createAudioParamMock(0),
    type: 'sine',
    phase: 0,
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    state: 'stopped',
  };

  const mockEnvelope = {
    ...createAudioNodeMock('Envelope'),
    attack: 0.01,
    decay: 0.1,
    sustain: 1,
    release: 0.5,
    attackCurve: 'linear',
    decayCurve: 'exponential',
    releaseCurve: 'exponential',
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    triggerAttackRelease: vi.fn(),
    cancel: vi.fn(),
  };

  // Mock Analysis tools
  const mockAnalyser = {
    ...createAudioNodeMock('Analyser'),
    size: 1024,
    type: 'fft',
    smoothing: 0.8,
    getValue: vi.fn().mockReturnValue(new Float32Array(1024)),
    getFrequencyData: vi.fn().mockReturnValue(new Float32Array(1024)),
    getTimeDomainData: vi.fn().mockReturnValue(new Float32Array(1024)),
  };

  const mockRecorder = {
    ...createAudioNodeMock('Recorder'),
    state: 'stopped',
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(new Blob()),
    clear: vi.fn(),
    get: vi.fn().mockResolvedValue(new Blob()),
  };

  // Complete Tone.js API Mock
  const mockTone = {
    // Core
    context: mockContext,
    Destination: vi.fn(() => mockDestination),
    getDestination: vi.fn(() => mockDestination),
    Transport: mockTransport,
    getTransport: vi.fn(() => mockTransport),
    Master: mockDestination,

    // Sources
    Player: vi.fn(() => mockPlayer),
    Synth: vi.fn(() => mockSynth),
    Oscillator: vi.fn(() => mockOscillator),
    PolySynth: vi.fn(() => ({
      ...createAudioNodeMock('PolySynth'),
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      triggerAttackRelease: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      releaseAll: vi.fn(),
    })),
    Sampler: vi.fn(() => ({
      ...createAudioNodeMock('Sampler'),
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      triggerAttackRelease: vi.fn(),
      loaded: true,
      load: vi.fn().mockResolvedValue(undefined),
    })),

    // Effects
    Volume: vi.fn(() => mockVolume),
    Gain: vi.fn(() => ({
      ...createAudioNodeMock('Gain'),
      gain: createAudioParamMock(1),
    })),
    PitchShift: vi.fn(() => ({
      ...createAudioNodeMock('PitchShift'),
      pitch: 0,
      windowSize: 0.1,
      delayTime: createAudioParamMock(0),
      feedback: createAudioParamMock(0),
      wet: createAudioParamMock(1),
    })),
    Panner: vi.fn(() => mockPanner),
    Filter: vi.fn(() => mockFilter),
    Distortion: vi.fn(() => mockDistortion),
    Reverb: vi.fn(() => mockReverb),
    Delay: vi.fn(() => mockDelay),
    Chorus: vi.fn(() => mockChorus),
    Compressor: vi.fn(() => mockCompressor),
    Limiter: vi.fn(() => ({
      ...createAudioNodeMock('Limiter'),
      threshold: createAudioParamMock(-6),
    })),
    Gate: vi.fn(() => ({
      ...createAudioNodeMock('Gate'),
      threshold: createAudioParamMock(-40),
      attack: createAudioParamMock(0.01),
      release: createAudioParamMock(0.1),
    })),
    StereoWidener: vi.fn(() => ({
      ...createAudioNodeMock('StereoWidener'),
      width: createAudioParamMock(0),
    })),
    CrossFade: vi.fn(() => ({
      ...createAudioNodeMock('CrossFade'),
      fade: createAudioParamMock(0.5),
      a: createAudioNodeMock('CrossFadeA'),
      b: createAudioNodeMock('CrossFadeB'),
    })),
    EQ3: vi.fn(() => mockEQ3),

    // Envelopes
    Envelope: vi.fn(() => mockEnvelope),
    AmplitudeEnvelope: vi.fn(() => ({
      ...mockEnvelope,
      attack: 0.01,
      decay: 0.1,
      sustain: 1,
      release: 1,
    })),

    // Sequencing
    Sequence: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      removeAll: vi.fn(),
      events: [],
      callback: vi.fn(),
      interval: '8n',
      humanize: false,
      probability: 1,
      mute: false,
      playbackRate: 1,
    })),

    // Analysis
    Analyser: vi.fn(() => mockAnalyser),
    Recorder: vi.fn(() => mockRecorder),

    // Timing and Scheduling
    now: vi.fn().mockReturnValue(0),
    immediate: vi.fn().mockReturnValue(0),
    Time: vi.fn((time) => time),
    Frequency: vi.fn((freq) => freq),

    // Utilities
    dbToGain: vi.fn((db) => Math.pow(10, db / 20)),
    gainToDb: vi.fn((gain) => 20 * Math.log10(gain)),
    intervalToFrequencyRatio: vi.fn(),

    // Context management
    start: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn(() => mockContext),
    setContext: vi.fn(),

    // Type checking
    type: 'Tone',
    version: '14.7.77',

    // Buffer and loading
    Buffer: vi.fn(() => ({
      length: 44100,
      duration: 1,
      sampleRate: 44100,
      numberOfChannels: 2,
      loaded: true,
      load: vi.fn().mockResolvedValue(undefined),
      reverse: vi.fn(),
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    })),

    ToneAudioBuffer: vi.fn(() => ({
      length: 44100,
      duration: 1,
      sampleRate: 44100,
      numberOfChannels: 2,
      loaded: true,
      load: vi.fn().mockResolvedValue(undefined),
    })),

    ToneAudioNode: vi.fn(() => createAudioNodeMock('ToneAudioNode')),

    // Effects chains
    Chain: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    })),

    // Advanced timing
    Clock: vi.fn(() => ({
      frequency: createAudioParamMock(1),
      callback: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
    })),

    Draw: {
      schedule: vi.fn(),
      cancel: vi.fn(),
    },

    // MIDI
    Midi: options.enableMIDI
      ? {
          fromUrl: vi.fn().mockResolvedValue({}),
          fromBytes: vi.fn(),
        }
      : undefined,
  };

  // Set up context references
  Object.values(mockTone).forEach((mock: any) => {
    if (mock && typeof mock === 'object' && 'context' in mock) {
      mock.context = mockContext;
    }
  });

  // Mock global AudioContext if needed
  if (options.enableWebAudio) {
    (global as any).AudioContext = vi.fn(() => mockContext);
    (global as any).webkitAudioContext = vi.fn(() => mockContext);
  }

  // Setup logging
  if (options.enableAudioLogs) {
    console.log('[AudioMocks] Tone.js mocks initialized');
  }

  const cleanup = () => {
    vi.clearAllMocks();
    if (options.enableAudioLogs) {
      console.log('[AudioMocks] Cleaned up');
    }
  };

  return {
    mockTone,
    mockPlayer,
    mockSynth,
    mockTransport,
    mockDestination,
    mockContext,
    mockPanner,
    mockVolume,
    mockFilter,
    mockDistortion,
    mockReverb,
    mockDelay,
    mockChorus,
    mockCompressor,
    mockEQ3,
    mockOscillator,
    mockEnvelope,
    mockAnalyser,
    mockRecorder,
    cleanup,
  };
};

// Preset configurations for different audio testing scenarios
export const audioPresets = {
  // Full Tone.js setup for complex audio services
  fullToneJS: {
    enableWebAudio: true,
    enableAnalyzer: true,
    enableRecorder: true,
    timing: {
      contextStarted: true,
      contextState: 'running' as const,
    },
    transport: {
      bpm: 120,
      state: 'stopped' as const,
    },
  } as AudioMockOptions,

  // Minimal setup for basic audio tests
  minimal: {
    enableWebAudio: false,
    enableMIDI: false,
    enableAnalyzer: false,
    enableRecorder: false,
  } as AudioMockOptions,

  // MIDI-enabled setup
  withMIDI: {
    enableWebAudio: true,
    enableMIDI: true,
    enableAnalyzer: true,
  } as AudioMockOptions,

  // Analysis-focused setup
  analysis: {
    enableWebAudio: true,
    enableAnalyzer: true,
    enableRecorder: true,
    timing: {
      bufferSize: 2048,
    },
  } as AudioMockOptions,
};
