# Instrument Dependency Injection Migration Guide

This guide helps instrument creators update their instruments to use the new dependency injection pattern for better testability.

## Quick Start

### Before (Direct Tone.js usage)
```typescript
import * as Tone from 'tone';

export class MyInstrument {
  private sampler: Tone.Sampler;
  private volume: Tone.Volume;
  
  constructor(config: MyInstrumentConfig) {
    this.sampler = new Tone.Sampler({
      urls: config.samples,
    });
    this.volume = new Tone.Volume(-6);
    this.sampler.connect(this.volume);
    this.volume.toDestination();
  }
}
```

### After (With DI support)
```typescript
import * as Tone from 'tone';

export class MyInstrument {
  private sampler: any;
  private volume: any;
  private audioEngine?: any;
  
  constructor(config: MyInstrumentConfig, audioEngine?: any) {
    this.audioEngine = audioEngine;
    
    // Use factory methods
    this.sampler = this.createSampler({
      urls: config.samples,
    });
    this.volume = this.createVolume(-6);
    this.sampler.connect(this.volume);
    this.volume.connect(this.getDestination());
  }
  
  // Factory methods
  private createSampler(options: any): any {
    return this.audioEngine?.createSampler?.(options) || new Tone.Sampler(options);
  }
  
  private createVolume(volume: number): any {
    return this.audioEngine?.createVolume?.(volume) || new Tone.Volume(volume);
  }
  
  private getDestination(): any {
    return this.audioEngine?.getDestination?.() || Tone.Destination;
  }
}
```

## Step-by-Step Migration

### Step 1: Update Constructor

Add optional `audioEngine` parameter:

```typescript
// Before
constructor(config: InstrumentConfig) {
  this.config = config;
}

// After
constructor(config: InstrumentConfig, audioEngine?: any) {
  this.config = config;
  this.audioEngine = audioEngine;
}
```

### Step 2: Add Factory Methods

For each Tone.js class you use, add a factory method:

```typescript
private createSampler(options?: any): any {
  if (this.audioEngine?.createSampler) {
    return this.audioEngine.createSampler(options);
  }
  return new Tone.Sampler(options);
}

private createPlayer(options?: any): any {
  if (this.audioEngine?.createPlayer) {
    return this.audioEngine.createPlayer(options);
  }
  return new Tone.Player(options);
}

private createVolume(volume?: number): any {
  if (this.audioEngine?.createVolume) {
    return this.audioEngine.createVolume(volume);
  }
  return new Tone.Volume(volume);
}

private createGain(gain?: number): any {
  if (this.audioEngine?.createGain) {
    return this.audioEngine.createGain(gain);
  }
  return new Tone.Gain(gain);
}

private getDestination(): any {
  if (this.audioEngine?.getDestination) {
    return this.audioEngine.getDestination();
  }
  return Tone.Destination;
}
```

### Step 3: Replace Direct Instantiation

Find all `new Tone.*` calls and replace with factory methods:

```typescript
// Before
this.sampler = new Tone.Sampler({ urls: samples });
this.gain = new Tone.Gain(0.8);
this.reverb = new Tone.Reverb(2);

// After
this.sampler = this.createSampler({ urls: samples });
this.gain = this.createGain(0.8);
this.reverb = this.createReverb(2);
```

### Step 4: Update Initialize Methods

If your instrument has an async `initialize` method:

```typescript
async initialize(audioEngine?: any): Promise<void> {
  // Store audioEngine if provided
  if (audioEngine) {
    this.audioEngine = audioEngine;
  }
  
  // Load Tone with audioEngine
  const tone = await this.loadTone();
  
  // Continue with initialization
  await this.loadSamples();
}

private async loadTone(): Promise<any> {
  const { loadGlobalTone } = await import('../../services/plugins/toneLoader.js');
  return loadGlobalTone(this.audioEngine);
}
```

### Step 5: Handle Processors

If your instrument uses a separate processor class:

```typescript
export class MyInstrument extends Instrument {
  private processor: MyInstrumentProcessor;
  
  constructor(config: Config, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;
    // Pass audioEngine to processor
    this.processor = new MyInstrumentProcessor(config, this.audioEngine);
  }
  
  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }
    // Pass audioEngine to processor initialize
    await this.processor.initialize(this.audioEngine);
  }
}
```

## Common Patterns

### Pattern 1: Simple Sampler Instrument

```typescript
export class SimpleSamplerInstrument extends Instrument {
  private sampler?: any;
  private audioEngine?: any;
  
  constructor(config: InstrumentConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;
  }
  
  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }
    
    this.sampler = this.createSampler({
      urls: this.config.samples,
      release: 1,
      onload: () => {
        this._state.isLoading = false;
        this._state.isInitialized = true;
      },
    });
    
    this.sampler.connect(this.getDestination());
  }
  
  trigger(event: InstrumentEvent): void {
    if (!this.sampler) return;
    
    this.sampler.triggerAttackRelease(
      event.data.note || 'C4',
      event.duration || '8n',
      event.audioTime,
      event.velocity
    );
  }
  
  private createSampler(options: any): any {
    return this.audioEngine?.createSampler?.(options) || new Tone.Sampler(options);
  }
  
  private getDestination(): any {
    return this.audioEngine?.getDestination?.() || Tone.Destination;
  }
}
```

### Pattern 2: Multi-Layer Velocity Sampler

```typescript
export class VelocitySamplerInstrument extends Instrument {
  private layers: Map<string, any> = new Map();
  private audioEngine?: any;
  
  constructor(config: VelocitySamplerConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;
  }
  
  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }
    
    // Create velocity layers
    for (const [velocity, samples] of Object.entries(this.config.velocityLayers)) {
      const sampler = this.createSampler({ urls: samples });
      const gain = this.createGain();
      
      sampler.connect(gain);
      gain.connect(this.getDestination());
      
      this.layers.set(velocity, { sampler, gain });
    }
  }
  
  trigger(event: InstrumentEvent): void {
    const layer = this.selectLayer(event.velocity);
    if (!layer) return;
    
    layer.sampler.triggerAttackRelease(
      event.data.note,
      event.duration,
      event.audioTime
    );
    
    // Set velocity-based gain
    layer.gain.gain.value = event.velocity;
  }
}
```

### Pattern 3: Synth Instrument

```typescript
export class SynthInstrument extends Instrument {
  private synth?: any;
  private audioEngine?: any;
  
  constructor(config: SynthConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;
  }
  
  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }
    
    this.synth = this.createSynth({
      oscillator: { type: this.config.waveform || 'sine' },
      envelope: {
        attack: this.config.attack || 0.1,
        decay: this.config.decay || 0.2,
        sustain: this.config.sustain || 0.5,
        release: this.config.release || 0.8,
      },
    });
    
    this.synth.connect(this.getDestination());
    this._state.isInitialized = true;
  }
  
  private createSynth(options: any): any {
    return this.audioEngine?.createSynth?.(options) || new Tone.Synth(options);
  }
}
```

## Testing Your Migrated Instrument

### Basic Test Setup

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyInstrument } from '../MyInstrument';
import { createMockAudioEngine } from '@/domains/playback/modules/__tests__/mocks/mockAudioEngine';

describe('MyInstrument with DI', () => {
  let instrument: MyInstrument;
  let mockAudioEngine: any;
  
  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
    instrument = new MyInstrument(config, mockAudioEngine);
  });
  
  it('should use audioEngine for creating nodes', async () => {
    await instrument.initialize();
    
    expect(mockAudioEngine.createSampler).toHaveBeenCalled();
    expect(mockAudioEngine.createVolume).toHaveBeenCalled();
  });
  
  it('should still work without audioEngine', async () => {
    const instrumentWithoutDI = new MyInstrument(config);
    
    // Should not throw
    await expect(instrumentWithoutDI.initialize()).resolves.not.toThrow();
  });
});
```

### Comprehensive Test Example

```typescript
describe('MyInstrument', () => {
  describe('with dependency injection', () => {
    let instrument: MyInstrument;
    let mockAudioEngine: any;
    
    beforeEach(() => {
      mockAudioEngine = createMockAudioEngine();
      instrument = new MyInstrument(config, mockAudioEngine);
    });
    
    it('should initialize with mocked audio engine', async () => {
      await instrument.initialize();
      expect(instrument.state.isInitialized).toBe(true);
    });
    
    it('should trigger notes using mocked sampler', () => {
      instrument.trigger({
        audioTime: 0,
        timestamp: Date.now(),
        velocity: 0.8,
        data: { note: 'C4' },
      });
      
      const mockSampler = mockAudioEngine.createSampler.mock.results[0].value;
      expect(mockSampler.triggerAttackRelease).toHaveBeenCalledWith(
        'C4',
        expect.any(String),
        0,
        0.8
      );
    });
  });
  
  describe('backward compatibility', () => {
    it('should work without audioEngine', async () => {
      const instrument = new MyInstrument(config);
      // Mock Tone.js for the test
      vi.mock('tone', () => ({
        Sampler: vi.fn(() => mockToneNode()),
        Volume: vi.fn(() => mockToneNode()),
        Destination: { connect: vi.fn() },
      }));
      
      await expect(instrument.initialize()).resolves.not.toThrow();
    });
  });
});
```

## Checklist

- [ ] Added optional `audioEngine` parameter to constructor
- [ ] Added factory methods for all Tone.js classes used
- [ ] Replaced all `new Tone.*` calls with factory methods
- [ ] Updated `initialize` method to accept `audioEngine`
- [ ] Passed `audioEngine` to any child processors or components
- [ ] Added tests for DI usage
- [ ] Verified backward compatibility
- [ ] Updated any documentation or examples

## FAQs

**Q: Do I need to add types for audioEngine?**  
A: No, keep it as `any` to avoid circular dependencies. The AudioEngine implementation handles type safety internally.

**Q: What if I need a Tone.js feature not in the factory methods?**  
A: Add a feature request or implement the factory method following the pattern in ToneWrapper.

**Q: Should I make audioEngine required?**  
A: No, always keep it optional for backward compatibility.

**Q: How do I handle Tone.js static methods?**  
A: Use the loaded Tone instance from `loadGlobalTone()` or add methods to AudioEngine as needed.

**Q: What about performance overhead?**  
A: The factory method pattern has negligible overhead - it's just one extra function call.

## Support

For questions or issues with the migration:

1. Check the main [Dependency Injection documentation](./dependency-injection.md)
2. Review example migrations in the codebase
3. Ask in the team chat with the tag #playback-di