# Frontend Testing Infrastructure Guide

## Overview

This directory contains shared testing infrastructure for the BassNotion frontend, providing standardized mocking utilities for audio libraries and basic test setup.

## Architecture

```
test/
├── mocks/
│   └── audioLibraryMocks.ts # Tone.js and audio library mocking
├── setup.ts               # Global test setup (Web Audio, Workers, Tone.js)
└── README.md              # This guide
```

## Audio Library Mock Infrastructure

### Purpose

Our `audioLibraryMocks.ts` provides comprehensive Tone.js mocking for audio processing tests:

- **Audio Context** management
- **Transport** timing and scheduling
- **Audio Nodes** (synths, effects, players)
- **Parameter Automation** (AudioParam mocking)
- **Audio Analysis** tools

### Basic Usage

```typescript
import { createAudioLibraryMocks, audioPresets } from '../test/mocks/audioLibraryMocks.js';

describe('AudioService', () => {
  let audioMocks: ReturnType<typeof createAudioLibraryMocks>;

  beforeEach(() => {
    audioMocks = createAudioLibraryMocks(audioPresets.fullToneJS);
  });

  afterEach(() => {
    audioMocks.cleanup();
  });

  test('should load audio samples', async () => {
    const player = audioMocks.mockPlayer;
    expect(player.loaded).toBe(true);
    expect(player.buffer.duration).toBe(1);
  });
});
```

### Audio Presets

```typescript
// Full Tone.js setup for complex audio services
audioPresets.fullToneJS = {
  enableWebAudio: true,
  enableAnalyzer: true,
  enableRecorder: true,
  timing: { contextStarted: true, contextState: 'running' }
}

// Minimal setup for basic audio tests
audioPresets.minimal = {
  enableWebAudio: false,
  enableMIDI: false,
}

// MIDI-enabled setup
audioPresets.withMIDI = {
  enableWebAudio: true,
  enableMIDI: true,
  enableAnalyzer: true,
}

// Analysis-focused setup
audioPresets.analysis = {
  enableWebAudio: true,
  enableAnalyzer: true,
  enableRecorder: true,
}
```

## Test Classification & Strategy

### Audio Processing Tests (Use audioLibraryMocks.ts)

These tests require Tone.js and audio library mocking:

```typescript
// HIGH COMPLEXITY - Use audioLibraryMocks.ts with fullToneJS preset
- SyncProcessor (Tone.js synchronization)
- BassProcessor (Bass line generation with Tone.js)
- DrumProcessor (Drum pattern generation)
- CorePlaybackEngine (Complete audio engine)

// MEDIUM COMPLEXITY - Use audioLibraryMocks.ts with targeted presets
- AudioBufferManager, AudioEffectsChain
- PerformanceOptimizer (audio-related optimizations)
- QualityScaler (audio quality management)

// SIMPLE - Use global setup.ts mocks
- PluginLoader, PluginManager (basic Tone.js usage)
- Basic audio utilities and helpers
```

### Basic Web API Tests (Use setup.ts)

These tests need only basic global mocks provided by setup.ts:

```typescript
// BASIC WEB API MOCKING - Covered by setup.ts
- WorkerPoolManager (Worker mocking)
- Basic audio components (global Tone.js, Web Audio mocks)
- State management (no special browser APIs needed)
```

## Global Test Setup (setup.ts)

The `setup.ts` file provides essential global mocks for:

- **Web Audio API** (AudioContext, audio nodes)
- **Web Workers** (Worker, MessageChannel)  
- **Tone.js** (Transport, instruments, effects)
- **Testing Library** integration

These are automatically available in all tests.

### Usage Examples

#### Audio Processing Service Test

```typescript
import { createAudioLibraryMocks, audioPresets } from '../test/mocks/audioLibraryMocks.js';

describe('BassProcessor', () => {
  let audioMocks: ReturnType<typeof createAudioLibraryMocks>;
  let processor: BassProcessor;

  beforeEach(() => {
    // Use full Tone.js setup for complex audio processing
    audioMocks = createAudioLibraryMocks(audioPresets.fullToneJS);
    processor = new BassProcessor();
  });

  afterEach(() => {
    audioMocks.cleanup();
  });

  test('should generate bass line with correct pattern', () => {
    const pattern = ['C2', 'E2', 'G2', 'C3'];
    processor.generatePattern(pattern);
    
    expect(audioMocks.mockSynth.triggerAttackRelease).toHaveBeenCalledTimes(4);
  });

  test('should apply bass-specific effects', () => {
    processor.applyBassEffects();
    
    expect(audioMocks.mockFilter.frequency.value).toBe(200); // Low-pass for bass
    expect(audioMocks.mockCompressor.threshold.value).toBe(-12);
  });
});
```

#### Simple Worker Test

```typescript
// Uses global setup.ts mocks automatically
describe('WorkerPoolManager', () => {
  test('should create workers', () => {
    const manager = new WorkerPoolManager();
    manager.createWorker('test-worker.js');
    
    expect(global.Worker).toHaveBeenCalledWith('test-worker.js');
  });
});
```

## Migration Guide

### For Audio Processing Tests

1. **Identify audio dependencies** - Does your service use Tone.js, Web Audio API?
2. **Choose appropriate preset**:
   - `fullToneJS` - Complex audio processing, effects, analysis
   - `minimal` - Basic audio functionality testing
   - `withMIDI` - MIDI input/output required
   - `analysis` - Audio analysis and recording features

3. **Update test structure**:
```typescript
// Before - Manual Tone.js mocking
const mockSynth = { triggerAttackRelease: vi.fn() };
vi.mock('tone', () => ({ Synth: vi.fn(() => mockSynth) }));

// After - Standardized audio mocks
const audioMocks = createAudioLibraryMocks(audioPresets.fullToneJS);
expect(audioMocks.mockSynth.triggerAttackRelease).toHaveBeenCalled();
```

### For Basic Tests

1. **Use global setup** - Most tests can rely on setup.ts global mocks
2. **No additional imports needed** - Worker, basic Tone.js, Web Audio are available
3. **Focus on business logic** - Let global mocks handle technical dependencies

## Best Practices

### Audio Mock Management

```typescript
// ✅ Good - Use presets for consistency
const audioMocks = createAudioLibraryMocks(audioPresets.fullToneJS);

// ✅ Good - Clean up after tests
afterEach(() => {
  audioMocks.cleanup();
});

// ❌ Avoid - Manual Tone.js mocking
vi.mock('tone', () => ({ /* manual setup */ }));
```

### Test Performance

- **Use minimal presets** when possible for faster test execution
- **Avoid complex audio analysis** unless specifically testing that functionality
- **Leverage setup.ts globals** for basic functionality

### Debugging

- **Check preset configuration** if audio mocks aren't working as expected
- **Verify cleanup calls** to prevent test interference
- **Use `enableAudioLogs` option** for debugging audio mock behavior

## Available Audio Mock APIs

### Core Audio Nodes
- `mockSynth` - Tone.js synthesizer with trigger methods
- `mockPlayer` - Audio sample player with loading simulation
- `mockTransport` - Timing and scheduling system
- `mockDestination` - Audio output destination

### Effects and Processing
- `mockReverb`, `mockDelay`, `mockChorus` - Audio effects
- `mockCompressor`, `mockEQ3` - Audio processing
- `mockFilter`, `mockDistortion` - Audio shaping

### Analysis and Recording
- `mockAnalyser` - Frequency and waveform analysis
- `mockRecorder` - Audio recording simulation

### Parameter Control
- All audio parameters support realistic AudioParam API:
  - `setValueAtTime()`, `rampTo()`, `linearRampTo()`
  - Proper value tracking and automation

## Troubleshooting

### Common Issues

1. **"Cannot read properties of undefined"**
   - Check that you're using the correct preset for your test needs
   - Verify cleanup is called in afterEach

2. **"Mock function not called"**
   - Ensure your service is using the mocked Tone.js instances
   - Check that audio mocks are set up before service initialization

3. **Timer-related test failures**
   - Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` for timing tests
   - Consider audio preset timing options for transport synchronization

### Support

For questions about testing infrastructure:
1. Check this guide first
2. Look at existing test examples in `domains/playback/services/__tests__/`
3. Review the audio mock source code in `mocks/audioLibraryMocks.ts` 