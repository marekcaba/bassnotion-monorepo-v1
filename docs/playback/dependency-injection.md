# Dependency Injection Pattern for Playback Domain

## Overview

The playback domain has been refactored to support dependency injection (DI) for better testability and flexibility. The primary focus is on injecting the `AudioEngine` to avoid direct Tone.js dependencies and enable proper mocking in tests.

## Key Principles

1. **Optional Parameters**: All DI is done through optional parameters to maintain backward compatibility
2. **Factory Methods**: Audio nodes are created through factory methods rather than direct instantiation
3. **Fallback to Tone.js**: When no AudioEngine is provided, code falls back to direct Tone.js usage
4. **Test-First Design**: The pattern enables comprehensive unit testing without browser audio context

## Implementation Pattern

### Basic Constructor Pattern

```typescript
export class MyInstrument {
  private audioEngine?: any;

  constructor(config: MyInstrumentConfig, audioEngine?: any) {
    this.config = config;
    this.audioEngine = audioEngine;
  }

  // Factory method for creating audio nodes
  private createGain(gain?: number): any {
    if (this.audioEngine?.createGain) {
      return this.audioEngine.createGain(gain);
    }
    // Fallback to direct Tone.js usage
    return new Tone.Gain(gain);
  }
}
```

### Initialize Method Pattern

For classes that need async initialization:

```typescript
export class MyProcessor {
  private audioEngine?: any;

  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    // Use factory methods for all audio node creation
    const sampler = this.createSampler(options);
    // ... rest of initialization
  }
}
```

### Global Services Fallback

For components that need to access CoreServices:

```typescript
private getAudioEngine(): any {
  // Check if already provided
  if (this.audioEngine) {
    return this.audioEngine;
  }

  // Try to get from global services
  const globalServices = (window as any).__coreServices ||
                        (window as any).__globalCoreServices;
  if (globalServices?.getAudioEngine) {
    return globalServices.getAudioEngine();
  }

  return null;
}
```

## Factory Methods

The AudioEngine provides these factory methods:

```typescript
// Basic audio nodes
createGain(gain?: number): any
createPanner(pan?: number): any
createVolume(volume?: number): any
createMeter(options?: any): any
createAnalyser(type?: string, size?: number): any

// Effects
createReverb(options?: any): any
createDelay(options?: any): any
createCompressor(options?: any): any
createLimiter(options?: any): any
createFilter(options?: any): any
createEQ3(options?: any): any
createGate(options?: any): any
createDistortion(options?: any): any

// Instruments
createSampler(options?: any): any
createPlayer(options?: any): any
createSynth(options?: any): any

// Utilities
getDestination(): any
now(): number
```

## Testing Pattern

### Mock AudioEngine

```typescript
import { createMockAudioEngine } from '@/domains/playback/modules/__tests__/mocks/mockAudioEngine';

const mockAudioEngine = createMockAudioEngine();
const instrument = new MyInstrument(config, mockAudioEngine);
```

### Setup DI Mocks

```typescript
import { setupDIMocks } from '@/domains/playback/modules/__tests__/mocks/setupDI';

beforeEach(() => {
  const { audioEngine, coreServices } = setupDIMocks();
  // Use audioEngine in your tests
});
```

### Verify DI Usage

```typescript
it('should use provided audioEngine for node creation', () => {
  const mockAudioEngine = createMockAudioEngine();
  const instrument = new MyInstrument(config, mockAudioEngine);

  instrument.initialize();

  expect(mockAudioEngine.createGain).toHaveBeenCalled();
  expect(mockAudioEngine.createSampler).toHaveBeenCalled();
});
```

## Migration Guide

### For Existing Instruments

1. Add optional `audioEngine` parameter to constructor:

   ```typescript
   constructor(config: Config, audioEngine?: any) {
     // ...
     this.audioEngine = audioEngine;
   }
   ```

2. Add factory methods for all Tone.js instantiations:

   ```typescript
   private createGain(gain?: number): any {
     return this.audioEngine?.createGain?.(gain) || new Tone.Gain(gain);
   }
   ```

3. Replace all `new Tone.*` calls with factory methods:

   ```typescript
   // Before
   this.gainNode = new Tone.Gain(0.5);

   // After
   this.gainNode = this.createGain(0.5);
   ```

### For New Instruments

1. Always accept `audioEngine` as optional parameter
2. Use factory methods from the start
3. Include comprehensive DI tests

### For Components Using Instruments

```typescript
// Get audioEngine from CoreServices
const globalServices = (window as any).__coreServices;
const audioEngine = globalServices?.getAudioEngine?.();

// Pass to instrument
const bass = new BassInstrument(config, audioEngine);
await bass.initialize();
```

## Backward Compatibility

The DI pattern maintains 100% backward compatibility:

1. All parameters are optional
2. Existing code continues to work without changes
3. Direct Tone.js usage is still supported as fallback
4. No breaking changes to public APIs

## Common Patterns

### Processor with AudioEngine

```typescript
export class MyProcessor {
  private audioEngine?: any;
  private tone?: any;

  async initialize(audioEngine?: any): Promise<void> {
    this.audioEngine = audioEngine;
    this.tone = await this.loadTone();

    // Create nodes using factories
    const sampler = this.createSampler({
      urls: this.samples,
      baseUrl: this.baseUrl,
    });
  }

  private async loadTone(): Promise<any> {
    const { loadGlobalTone } =
      await import('../../services/plugins/toneLoader.js');
    return loadGlobalTone(this.audioEngine);
  }
}
```

### Mixing Component with AudioEngine

```typescript
export class Channel {
  private audioEngine?: any;

  constructor(config: ChannelConfig) {
    this.audioEngine = config.audioEngine;

    // Create all nodes with factories
    this.gainNode = this.createGain(config.gain);
    this.pannerNode = this.createPanner(config.pan);
  }
}
```

## Best Practices

1. **Always make audioEngine optional** - Maintains backward compatibility
2. **Use factory methods consistently** - Even for simple node creation
3. **Test both with and without DI** - Ensure both paths work
4. **Document DI support** - Add comments about optional audioEngine parameter
5. **Avoid constructor-time audio loading** - Use initialize() methods instead
6. **Check for audioEngine methods** - Use optional chaining: `audioEngine?.createGain?.()`
7. **Provide meaningful fallbacks** - Always fall back to direct Tone.js usage

## Troubleshooting

### Common Issues

1. **"Cannot read property 'createGain' of undefined"**
   - Ensure audioEngine is properly passed through initialization chain
   - Check that factory method includes null checks

2. **Tests failing with "Tone is not defined"**
   - Use proper mock setup with `setupDIMocks()`
   - Ensure all Tone.js usage goes through factories

3. **AudioEngine methods not available**
   - Verify AudioEngine version includes required factory methods
   - Check that ToneWrapper has all necessary delegations

### Debug Tips

1. Add logging to track audioEngine propagation:

   ```typescript
   console.log('AudioEngine provided:', !!audioEngine);
   ```

2. Verify factory method usage in tests:

   ```typescript
   expect(mockAudioEngine.createGain).toHaveBeenCalledTimes(1);
   ```

3. Check global services availability:
   ```typescript
   console.log('CoreServices available:', !!(window as any).__coreServices);
   ```
