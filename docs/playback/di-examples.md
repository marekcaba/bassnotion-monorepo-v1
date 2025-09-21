# Dependency Injection Examples

This document provides real-world examples of the DI pattern implementation in the playback domain.

## Example 1: BassInstrument

### Implementation
```typescript
// BassInstrument.ts
export class BassInstrument extends Instrument<BassInstrumentConfig> {
  private processor: BassInstrumentProcessor;
  private audioEngine?: any;

  constructor(config: BassInstrumentConfig, audioEngine?: any) {
    super(config);
    this.audioEngine = audioEngine;
    this.processor = new BassInstrumentProcessor(config, this.audioEngine);
  }

  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }
    
    await this.processor.initialize(bassSamples, this.audioEngine);
    this._state.isInitialized = true;
  }
}

// BassInstrumentProcessor.ts
export class BassInstrumentProcessor {
  private audioEngine?: any;
  private sampler?: any;
  private volume?: any;

  constructor(config: any, audioEngine?: any) {
    this.config = config;
    this.audioEngine = audioEngine;
  }

  async initialize(samples: any, audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    // Create audio nodes using factory methods
    this.volume = this.createVolume(-6);
    this.sampler = this.createSampler({
      urls: samples,
      release: 1,
    });

    // Connect nodes
    this.sampler.connect(this.volume);
    this.volume.connect(this.getDestination());
  }

  private createSampler(options: any): any {
    return this.audioEngine?.createSampler?.(options) || new Tone.Sampler(options);
  }

  private createVolume(db: number): any {
    return this.audioEngine?.createVolume?.(db) || new Tone.Volume(db);
  }
}
```

### Testing
```typescript
describe('BassInstrument', () => {
  let bassInstrument: BassInstrument;
  let mockAudioEngine: any;

  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
    bassInstrument = new BassInstrument(config, mockAudioEngine);
  });

  it('should pass audioEngine to processor', async () => {
    await bassInstrument.initialize();
    
    const processor = (bassInstrument as any).processor;
    expect(processor.audioEngine).toBe(mockAudioEngine);
    expect(mockAudioEngine.createSampler).toHaveBeenCalled();
    expect(mockAudioEngine.createVolume).toHaveBeenCalled();
  });
});
```

## Example 2: Channel (Mixing Component)

### Implementation
```typescript
export class Channel {
  private audioEngine?: any;
  private input: any;
  private gainNode: any;
  private pannerNode: any;
  private eq: ChannelEQ;

  constructor(config: ChannelConfig) {
    this.audioEngine = config.audioEngine;
    
    // Create all audio nodes using factory methods
    this.input = this.createGain(1);
    this.gainNode = this.createGain(config.initialState?.volume ?? 0.75);
    this.pannerNode = this.createPanner(config.initialState?.pan ?? 0);
    
    // Create EQ section
    this.eq = this.createEQ();
    
    // Build signal chain
    this.buildSignalChain();
  }

  private createEQ(): ChannelEQ {
    const highShelf = this.createEQ3({
      low: 0,
      mid: 0,
      high: 0,
      lowFrequency: 320,
      highFrequency: 3200,
    });

    const parametric = [
      this.createFilter({ type: 'peaking', frequency: 100, Q: 1, gain: 0 }),
      this.createFilter({ type: 'peaking', frequency: 1000, Q: 1, gain: 0 }),
      this.createFilter({ type: 'peaking', frequency: 5000, Q: 1, gain: 0 }),
      this.createFilter({ type: 'peaking', frequency: 10000, Q: 1, gain: 0 }),
    ];

    return { highShelf, parametric, bypassed: false };
  }

  // Factory methods
  private createGain(gain?: number): any {
    return this.audioEngine?.createGain?.(gain) || new Tone.Gain(gain);
  }

  private createPanner(pan?: number): any {
    return this.audioEngine?.createPanner?.(pan) || new Tone.Panner(pan);
  }

  private createEQ3(options?: any): any {
    return this.audioEngine?.createEQ3?.(options) || new Tone.EQ3(options);
  }

  private createFilter(options?: any): any {
    return this.audioEngine?.createFilter?.(options) || new Tone.Filter(options);
  }
}
```

### Testing
```typescript
describe('Channel', () => {
  it('should create channel with DI', () => {
    const mockAudioEngine = createMockAudioEngine();
    const channel = new Channel({
      channelId: 'test-channel',
      name: 'Test Channel',
      audioEngine: mockAudioEngine,
    });

    expect(mockAudioEngine.createGain).toHaveBeenCalledTimes(3); // input, gain, mute
    expect(mockAudioEngine.createPanner).toHaveBeenCalled();
    expect(mockAudioEngine.createEQ3).toHaveBeenCalled();
    expect(mockAudioEngine.createFilter).toHaveBeenCalledTimes(4); // 4-band parametric
  });
});
```

## Example 3: Velocity Sampler

### Implementation
```typescript
export class SalamanderVelocitySampler {
  private audioEngine?: any;
  private velocityLayers: Map<number, any> = new Map();

  constructor(audioEngine?: any) {
    this.audioEngine = audioEngine;
  }

  async initialize(audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    // Load velocity layers
    for (const velocity of [0.2, 0.4, 0.6, 0.8, 1.0]) {
      const sampler = await this.createVelocityLayer(velocity);
      this.velocityLayers.set(velocity, sampler);
    }
  }

  private async createVelocityLayer(velocity: number): Promise<any> {
    const urls = this.getUrlsForVelocity(velocity);
    
    const sampler = this.createSampler({
      urls,
      release: 1,
      baseUrl: '/samples/salamander/',
    });

    const volume = this.createVolume(this.velocityToDb(velocity));
    
    sampler.connect(volume);
    volume.connect(this.getDestination());

    return { sampler, volume, velocity };
  }

  private createSampler(options: any): any {
    if (this.audioEngine?.createSampler) {
      return this.audioEngine.createSampler(options);
    }
    
    if (!Tone) {
      throw new Error('Tone.js not loaded and no audioEngine provided');
    }
    
    return new Tone.Sampler(options);
  }
}
```

## Example 4: AudioEventRouter Integration

### Implementation
```typescript
export class AudioEventRouter {
  private audioEngine?: any;
  private instruments: Map<string, Instrument> = new Map();

  async initialize(context?: AudioContext): Promise<void> {
    // Get AudioEngine from CoreServices
    const globalServices = (window as any).__coreServices || 
                         (window as any).__globalCoreServices;
    if (globalServices?.getAudioEngine) {
      this.audioEngine = globalServices.getAudioEngine();
    }

    // Initialize instruments with AudioEngine
    await this.initializeInstruments(context);
  }

  private async initializeInstruments(context?: AudioContext): Promise<void> {
    // Create metronome with DI
    const metronome = new Metronome(
      { type: 'metronome', name: 'Metronome' },
      this.audioEngine
    );
    await metronome.initialize(this.audioEngine);
    this.instruments.set('metronome', metronome);

    // Create drums with DI
    const drums = new DrumKit(
      { id: 'drums', type: 'drums', name: 'Drum Kit' },
      this.audioEngine
    );
    await drums.initialize(this.audioEngine);
    this.instruments.set('drums', drums);

    // Create bass with DI
    const bass = new BassInstrument(
      { id: 'bass', type: 'bass', name: 'Bass' },
      this.audioEngine
    );
    await bass.initialize(this.audioEngine);
    this.instruments.set('bass', bass);

    // Create harmony with DI
    const harmony = new HarmonyInstrument(
      { id: 'harmony', type: 'harmony', name: 'Harmony' },
      this.audioEngine
    );
    await harmony.initialize(context, this.audioEngine);
    this.instruments.set('harmony', harmony);
  }
}
```

## Example 5: Test Setup Utilities

### mockAudioEngine.ts
```typescript
export const createMockAudioEngine = () => {
  const mockNode = () => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    toDestination: vi.fn().mockReturnThis(),
  });

  return {
    isReady: vi.fn(() => true),
    getTone: vi.fn(() => mockTone),
    
    // Node creation
    createGain: vi.fn((gain) => ({
      ...mockNode(),
      gain: { value: gain ?? 1, rampTo: vi.fn() },
    })),
    
    createSampler: vi.fn((options) => ({
      ...mockNode(),
      triggerAttackRelease: vi.fn(),
      loaded: true,
    })),
    
    createVolume: vi.fn((db) => ({
      ...mockNode(),
      volume: { value: db ?? 0 },
    })),
    
    createPanner: vi.fn((pan) => ({
      ...mockNode(),
      pan: { value: pan ?? 0, rampTo: vi.fn() },
    })),
    
    // Effects
    createReverb: vi.fn(() => ({
      ...mockNode(),
      wet: { value: 0.5 },
    })),
    
    createDelay: vi.fn(() => ({
      ...mockNode(),
      delayTime: { value: 0.25 },
      feedback: { value: 0.5 },
    })),
    
    // Utilities
    getDestination: vi.fn(() => ({ connect: vi.fn() })),
    now: vi.fn(() => 0),
  };
};
```

### setupDI.ts
```typescript
export const setupDIMocks = (audioEngine = createMockAudioEngine()) => {
  const mockCoreServices = {
    getAudioEngine: vi.fn(() => audioEngine),
    getTransport: vi.fn(() => mockTransport),
    getSampleCache: vi.fn(() => mockSampleCache),
  };

  (global as any).window = {
    __coreServices: mockCoreServices,
    __globalCoreServices: mockCoreServices,
    AudioContext: vi.fn().mockImplementation(() => mockAudioContext),
  };

  return { audioEngine, coreServices: mockCoreServices };
};

export const cleanupDIMocks = () => {
  delete (global as any).window;
  vi.clearAllMocks();
};
```

### Usage in Tests
```typescript
describe('MyInstrument Integration', () => {
  let audioEngine: any;
  let coreServices: any;

  beforeEach(() => {
    const setup = setupDIMocks();
    audioEngine = setup.audioEngine;
    coreServices = setup.coreServices;
  });

  afterEach(() => {
    cleanupDIMocks();
  });

  it('should work with global CoreServices', async () => {
    // Instrument gets audioEngine from global
    const instrument = new MyInstrument(config);
    await instrument.initialize();

    // Verify it used the global audioEngine
    expect(coreServices.getAudioEngine).toHaveBeenCalled();
    expect(audioEngine.createSampler).toHaveBeenCalled();
  });

  it('should prefer provided audioEngine over global', async () => {
    const customAudioEngine = createMockAudioEngine();
    const instrument = new MyInstrument(config, customAudioEngine);
    await instrument.initialize();

    // Should use custom, not global
    expect(customAudioEngine.createSampler).toHaveBeenCalled();
    expect(audioEngine.createSampler).not.toHaveBeenCalled();
  });
});
```

## Example 6: Complex Processor Pattern

### HarmonyProcessor with WAM Integration
```typescript
export class WamHarmonyProcessor {
  private audioEngine?: any;
  private wamPlugin?: any;
  private samplers: Map<string, any> = new Map();

  constructor(config: any, audioEngine?: any) {
    this.config = config;
    this.audioEngine = audioEngine;
  }

  async initialize(context: AudioContext, audioEngine?: any): Promise<void> {
    if (audioEngine) {
      this.audioEngine = audioEngine;
    }

    // Initialize WAM plugin
    if (this.config.useWAM) {
      await this.initializeWAM(context);
    } else {
      await this.initializeSamplers();
    }
  }

  private async initializeSamplers(): Promise<void> {
    const tone = await this.loadTone();

    // Create samplers for different instruments
    for (const [name, samples] of Object.entries(this.config.instruments)) {
      const sampler = this.createSampler({ urls: samples });
      const volume = this.createVolume(-6);
      const reverb = this.createReverb({ decay: 2, wet: 0.2 });

      // Chain: sampler -> volume -> reverb -> destination
      sampler.connect(volume);
      volume.connect(reverb);
      reverb.connect(this.getDestination());

      this.samplers.set(name, { sampler, volume, reverb });
    }
  }

  triggerChord(params: ChordParams): void {
    const instrument = this.samplers.get(this.currentInstrument);
    if (!instrument) return;

    params.notes.forEach(note => {
      instrument.sampler.triggerAttackRelease(
        note,
        params.duration,
        params.time,
        params.velocity
      );
    });
  }

  private async loadTone(): Promise<any> {
    const { loadGlobalTone } = await import('../../services/plugins/toneLoader.js');
    return loadGlobalTone(this.audioEngine);
  }

  // Factory methods follow the same pattern...
}
```

## Best Practices Summary

1. **Always Optional**: Keep audioEngine parameters optional
2. **Pass Through**: Pass audioEngine through initialization chains
3. **Factory First**: Use factory methods for all audio node creation
4. **Fallback Ready**: Always provide Tone.js fallback
5. **Test Both Paths**: Test with and without DI
6. **Global Access**: Use CoreServices when audioEngine not provided
7. **Lazy Loading**: Load Tone.js only when needed via loadGlobalTone()
8. **Type Safety**: Use `any` for audioEngine to avoid circular deps

## Common Pitfalls

1. **Forgetting to pass audioEngine to child components**
   ```typescript
   // ❌ Bad
   this.processor = new Processor(config);
   
   // ✅ Good
   this.processor = new Processor(config, this.audioEngine);
   ```

2. **Not checking for audioEngine methods**
   ```typescript
   // ❌ Bad
   return this.audioEngine.createGain(gain);
   
   // ✅ Good
   return this.audioEngine?.createGain?.(gain) || new Tone.Gain(gain);
   ```

3. **Creating audio nodes in constructor**
   ```typescript
   // ❌ Bad - Tone might not be loaded
   constructor(config: Config, audioEngine?: any) {
     this.sampler = this.createSampler(config.samples);
   }
   
   // ✅ Good - Create in initialize
   async initialize(audioEngine?: any): Promise<void> {
     this.sampler = this.createSampler(config.samples);
   }
   ```