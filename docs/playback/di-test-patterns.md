# Dependency Injection Test Patterns

This guide covers testing patterns for instruments and components using the DI pattern in the playback domain.

## Core Testing Utilities

### mockAudioEngine

The `mockAudioEngine` provides a complete mock of the AudioEngine interface:

```typescript
import { createMockAudioEngine } from '@/domains/playback/modules/__tests__/mocks/mockAudioEngine';

const mockAudioEngine = createMockAudioEngine();
```

Features:
- All factory methods return mock nodes with chainable methods
- Spies on all method calls for verification
- Provides sensible defaults for all properties
- Supports both sync and async operations

### setupDI

The `setupDI` utility provides a complete testing environment:

```typescript
import { setupDIMocks, cleanupDIMocks } from '@/domains/playback/modules/__tests__/mocks/setupDI';

beforeEach(() => {
  const { audioEngine, coreServices } = setupDIMocks();
  // Use in your tests
});

afterEach(() => {
  cleanupDIMocks();
});
```

Features:
- Sets up global `window.__coreServices`
- Provides mock AudioEngine and CoreServices
- Handles cleanup automatically
- Configurable for different test scenarios

## Testing Patterns

### Pattern 1: Basic Instrument Testing

```typescript
describe('MyInstrument', () => {
  let instrument: MyInstrument;
  let mockAudioEngine: any;
  
  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
    const config = {
      id: 'test-instrument',
      name: 'Test Instrument',
      type: 'bass',
    };
    instrument = new MyInstrument(config, mockAudioEngine);
  });
  
  it('should initialize with DI', async () => {
    await instrument.initialize();
    
    expect(instrument.state.isInitialized).toBe(true);
    expect(mockAudioEngine.createSampler).toHaveBeenCalled();
  });
  
  it('should trigger notes correctly', () => {
    instrument.trigger({
      audioTime: 0.5,
      timestamp: Date.now(),
      velocity: 0.8,
      data: { note: 'C4' },
    });
    
    const mockSampler = mockAudioEngine.createSampler.mock.results[0].value;
    expect(mockSampler.triggerAttackRelease).toHaveBeenCalledWith(
      'C4',
      expect.any(String),
      0.5,
      0.8
    );
  });
});
```

### Pattern 2: Testing Backward Compatibility

```typescript
describe('Backward Compatibility', () => {
  it('should work without audioEngine', async () => {
    // Mock Tone.js globally
    vi.mock('tone', () => ({
      Sampler: vi.fn(() => mockToneNode()),
      Volume: vi.fn(() => mockToneNode()),
      start: vi.fn(),
    }));
    
    const instrument = new MyInstrument(config);
    await expect(instrument.initialize()).resolves.not.toThrow();
  });
  
  it('should use global CoreServices when available', async () => {
    const { coreServices } = setupDIMocks();
    
    const instrument = new MyInstrument(config);
    await instrument.initialize();
    
    expect(coreServices.getAudioEngine).toHaveBeenCalled();
  });
});
```

### Pattern 3: Testing Processors

```typescript
describe('InstrumentProcessor', () => {
  let processor: MyInstrumentProcessor;
  let mockAudioEngine: any;
  
  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
    processor = new MyInstrumentProcessor(config, mockAudioEngine);
  });
  
  it('should pass audioEngine through initialize', async () => {
    const customEngine = createMockAudioEngine();
    await processor.initialize(samples, customEngine);
    
    // Should use the engine passed to initialize
    expect(customEngine.createSampler).toHaveBeenCalled();
    expect(mockAudioEngine.createSampler).not.toHaveBeenCalled();
  });
  
  it('should create proper audio chain', async () => {
    await processor.initialize(samples);
    
    const sampler = mockAudioEngine.createSampler.mock.results[0].value;
    const volume = mockAudioEngine.createVolume.mock.results[0].value;
    const destination = mockAudioEngine.getDestination.mock.results[0].value;
    
    expect(sampler.connect).toHaveBeenCalledWith(volume);
    expect(volume.connect).toHaveBeenCalledWith(destination);
  });
});
```

### Pattern 4: Testing Complex Audio Chains

```typescript
describe('Complex Audio Routing', () => {
  let channel: Channel;
  let mockAudioEngine: any;
  
  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
    channel = new Channel({
      channelId: 'test',
      audioEngine: mockAudioEngine,
    });
  });
  
  it('should create complete channel strip', () => {
    // Verify all components created
    expect(mockAudioEngine.createGain).toHaveBeenCalledTimes(4); // input, gain, mute, solo
    expect(mockAudioEngine.createPanner).toHaveBeenCalledTimes(1);
    expect(mockAudioEngine.createEQ3).toHaveBeenCalledTimes(1);
    expect(mockAudioEngine.createFilter).toHaveBeenCalledTimes(4); // 4-band parametric
    expect(mockAudioEngine.createCompressor).toHaveBeenCalledTimes(1);
    expect(mockAudioEngine.createGate).toHaveBeenCalledTimes(1);
  });
  
  it('should route signal correctly', () => {
    const nodes = {
      input: mockAudioEngine.createGain.mock.results[0].value,
      gain: mockAudioEngine.createGain.mock.results[1].value,
      panner: mockAudioEngine.createPanner.mock.results[0].value,
      output: mockAudioEngine.createGain.mock.results[3].value,
    };
    
    // Verify signal chain
    expect(nodes.input.connect).toHaveBeenCalledWith(expect.any(Object));
    expect(nodes.gain.connect).toHaveBeenCalledWith(nodes.panner);
    expect(nodes.panner.connect).toHaveBeenCalledWith(expect.any(Object));
  });
});
```

### Pattern 5: Testing with Mock Verification

```typescript
describe('Mock Verification Patterns', () => {
  let mockAudioEngine: any;
  
  beforeEach(() => {
    mockAudioEngine = createMockAudioEngine();
  });
  
  it('should verify factory method arguments', async () => {
    const instrument = new MyInstrument(config, mockAudioEngine);
    await instrument.initialize();
    
    // Verify specific arguments
    expect(mockAudioEngine.createSampler).toHaveBeenCalledWith({
      urls: expect.any(Object),
      release: 1,
      baseUrl: expect.any(String),
    });
    
    expect(mockAudioEngine.createVolume).toHaveBeenCalledWith(-6);
  });
  
  it('should verify method call order', async () => {
    const instrument = new MyInstrument(config, mockAudioEngine);
    await instrument.initialize();
    
    const callOrder = [
      mockAudioEngine.createVolume,
      mockAudioEngine.createSampler,
      mockAudioEngine.getDestination,
    ];
    
    // Verify calls happened in specific order
    callOrder.forEach((method, index) => {
      expect(method.mock.invocationCallOrder[0]).toBeGreaterThan(
        index === 0 ? 0 : callOrder[index - 1].mock.invocationCallOrder[0]
      );
    });
  });
});
```

### Pattern 6: Integration Testing

```typescript
describe('Integration Tests', () => {
  let diSetup: any;
  
  beforeEach(() => {
    diSetup = setupDIMocks();
  });
  
  afterEach(() => {
    cleanupDIMocks();
  });
  
  it('should integrate with global services', async () => {
    // Component gets audioEngine from global
    const router = new AudioEventRouter();
    await router.initialize();
    
    // Verify it found and used global audioEngine
    expect(diSetup.coreServices.getAudioEngine).toHaveBeenCalled();
    expect(diSetup.audioEngine.createSampler).toHaveBeenCalled();
  });
  
  it('should handle mixed DI usage', async () => {
    const directDI = new BassInstrument(config, diSetup.audioEngine);
    const globalDI = new DrumKit(config); // Uses global
    
    await directDI.initialize();
    await globalDI.initialize();
    
    // Both should work
    expect(directDI.state.isInitialized).toBe(true);
    expect(globalDI.state.isInitialized).toBe(true);
  });
});
```

## Advanced Testing Scenarios

### Testing Async Loading

```typescript
it('should handle async sample loading', async () => {
  const mockAudioEngine = createMockAudioEngine();
  
  // Mock async loading
  mockAudioEngine.createSampler.mockImplementation((options) => {
    const sampler = {
      ...mockToneNode(),
      loaded: false,
      triggerAttackRelease: vi.fn(),
    };
    
    // Simulate async loading
    setTimeout(() => {
      sampler.loaded = true;
      if (options.onload) options.onload();
    }, 100);
    
    return sampler;
  });
  
  const instrument = new MyInstrument(config, mockAudioEngine);
  await instrument.initialize();
  
  // Wait for loading
  await vi.waitFor(() => {
    expect(instrument.state.isInitialized).toBe(true);
  });
});
```

### Testing Error Handling

```typescript
it('should handle initialization errors gracefully', async () => {
  const mockAudioEngine = createMockAudioEngine();
  mockAudioEngine.createSampler.mockImplementation(() => {
    throw new Error('Failed to create sampler');
  });
  
  const instrument = new MyInstrument(config, mockAudioEngine);
  
  await expect(instrument.initialize()).rejects.toThrow();
  expect(instrument.state.isInitialized).toBe(false);
  expect(instrument.state.error).toContain('Failed to initialize');
});
```

### Testing Parameter Updates

```typescript
it('should update audio parameters correctly', () => {
  const mockAudioEngine = createMockAudioEngine();
  const channel = new Channel({ channelId: 'test', audioEngine: mockAudioEngine });
  
  const gainNode = mockAudioEngine.createGain.mock.results[0].value;
  
  // Test volume changes
  channel.setVolume(0.5, 0.1);
  expect(gainNode.gain.rampTo).toHaveBeenCalledWith(0.5, 0.1);
  
  // Test immediate changes
  channel.setVolume(0.8, 0);
  expect(gainNode.gain.value).toBe(0.8);
});
```

## Mock Helpers

### Custom Mock Extensions

```typescript
// Extend mockAudioEngine for specific tests
const createCustomMockAudioEngine = () => {
  const base = createMockAudioEngine();
  
  // Add custom behavior
  base.createSampler.mockImplementation((options) => ({
    ...mockToneNode(),
    triggerAttackRelease: vi.fn((note, duration, time, velocity) => {
      // Custom logic for testing
      console.log(`Triggered ${note} at velocity ${velocity}`);
    }),
  }));
  
  return base;
};
```

### Mock State Verification

```typescript
// Helper to verify audio node state
const verifyAudioNodeState = (node: any, expectedState: any) => {
  Object.entries(expectedState).forEach(([key, value]) => {
    if (typeof value === 'object') {
      expect(node[key]).toMatchObject(value);
    } else {
      expect(node[key]).toBe(value);
    }
  });
};

// Usage
it('should set correct node parameters', () => {
  const volume = mockAudioEngine.createVolume(-12);
  verifyAudioNodeState(volume, {
    volume: { value: -12 },
    mute: false,
  });
});
```

## Performance Testing

```typescript
describe('Performance', () => {
  it('should handle multiple instruments efficiently', async () => {
    const mockAudioEngine = createMockAudioEngine();
    const startTime = performance.now();
    
    // Create multiple instruments
    const instruments = Array.from({ length: 100 }, (_, i) => 
      new MyInstrument({ id: `inst-${i}` }, mockAudioEngine)
    );
    
    // Initialize all
    await Promise.all(instruments.map(i => i.initialize()));
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should complete in reasonable time
    expect(totalTime).toBeLessThan(1000); // 1 second
    
    // Verify all initialized
    instruments.forEach(inst => {
      expect(inst.state.isInitialized).toBe(true);
    });
  });
});
```

## Debugging Tips

1. **Use Mock Call History**
   ```typescript
   console.log('All createSampler calls:', mockAudioEngine.createSampler.mock.calls);
   console.log('First result:', mockAudioEngine.createSampler.mock.results[0]);
   ```

2. **Verify Connection Chain**
   ```typescript
   const connections = [];
   mockAudioEngine.createGain.mockImplementation(() => ({
     connect: vi.fn((destination) => {
       connections.push({ from: 'gain', to: destination });
     }),
   }));
   ```

3. **Track Audio Engine Usage**
   ```typescript
   const usageTracker = new Set();
   Object.keys(mockAudioEngine).forEach(key => {
     const original = mockAudioEngine[key];
     mockAudioEngine[key] = vi.fn((...args) => {
       usageTracker.add(key);
       return original(...args);
     });
   });
   ```

## Common Test Failures and Solutions

### "Cannot read property 'createGain' of undefined"
**Cause**: AudioEngine not properly mocked or passed
**Solution**: Ensure mockAudioEngine is created and passed to constructor

### "Tone is not defined"
**Cause**: Direct Tone.js usage without mock
**Solution**: Use vi.mock('tone') or ensure all usage goes through factories

### "Maximum call stack exceeded"
**Cause**: Circular mock references
**Solution**: Use base mockToneNode() function, avoid circular connections

### "Expected mock function to have been called"
**Cause**: Method not called due to conditional logic
**Solution**: Verify initialization completed, check state flags