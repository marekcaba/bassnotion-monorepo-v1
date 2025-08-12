# Error Handling Procedures Guide
Story 3.18.4: Service Architecture Implementation

## Overview

This guide documents the comprehensive error handling procedures implemented in the BassNotion playback architecture. Our error handling system is designed to provide resilience, clear diagnostics, and graceful degradation while maintaining excellent performance.

## Error Handling Architecture

### Core Components

1. **Error Classification System** - Categorizes errors by type and severity
2. **Circuit Breaker Pattern** - Prevents cascading failures
3. **Error Recovery Engine** - Automated recovery strategies
4. **Graceful Degradation** - Maintains partial functionality
5. **Error Reporting** - Centralized logging and monitoring

### Error Hierarchy

```
BaseError
├── AudioContextError     - Web Audio API issues
├── NetworkError         - Network connectivity issues
├── ResourceError        - Resource loading/availability
├── ValidationError      - Data validation failures
├── PerformanceError     - Performance threshold violations
└── MobileError         - Mobile-specific issues
```

## Error Classification

### Using the Error Classifier

```typescript
import { ErrorClassifier } from './ErrorClassifier.js';

const classifier = new ErrorClassifier();

try {
  await riskyOperation();
} catch (error) {
  const classified = classifier.classify(error);
  
  console.log(`Type: ${classified.type}`);           // 'network', 'audio', etc.
  console.log(`Severity: ${classified.severity}`);   // 'low', 'medium', 'high', 'critical'
  console.log(`Recoverable: ${classified.recoverable}`);
  console.log(`Category: ${classified.category}`);   // 'transient', 'permanent', 'configuration'
  
  // Handle based on classification
  if (classified.recoverable && classified.category === 'transient') {
    await retryOperation();
  }
}
```

### Error Types and Handling

#### AudioContextError
```typescript
try {
  const context = new AudioContext();
} catch (error) {
  if (error instanceof AudioContextError) {
    switch (error.code) {
      case 'CONTEXT_NOT_ALLOWED':
        // User interaction required
        showPlayButton();
        break;
      case 'CONTEXT_SUSPENDED':
        // Resume context
        await context.resume();
        break;
      case 'SAMPLE_RATE_NOT_SUPPORTED':
        // Use fallback sample rate
        useFallbackConfiguration();
        break;
    }
  }
}
```

#### NetworkError
```typescript
try {
  const asset = await fetchAudioAsset(url);
} catch (error) {
  if (error instanceof NetworkError) {
    if (error.statusCode === 404) {
      // Asset not found - use fallback
      return getDefaultAsset();
    } else if (error.isTimeout) {
      // Network timeout - retry with backoff
      return retryWithBackoff(() => fetchAudioAsset(url));
    } else if (error.isOffline) {
      // Offline - use cached version
      return getCachedAsset(url);
    }
  }
}
```

#### ResourceError
```typescript
try {
  await loadSample(samplePath);
} catch (error) {
  if (error instanceof ResourceError) {
    if (error.reason === 'MEMORY_EXHAUSTED') {
      // Free up memory
      await clearUnusedSamples();
      // Retry with reduced quality
      await loadSample(samplePath, { quality: 'low' });
    } else if (error.reason === 'DECODE_ERROR') {
      // Try alternative format
      await loadSample(samplePath.replace('.ogg', '.mp3'));
    }
  }
}
```

## Circuit Breaker Implementation

### Basic Usage

```typescript
import { CircuitBreaker } from './CircuitBreaker.js';

const circuitBreaker = new CircuitBreaker('audioLoader', {
  failureThreshold: 5,      // Open after 5 failures
  recoveryTimeout: 30000,   // 30 seconds
  halfOpenRequests: 3,      // Test with 3 requests
});

async function loadAudioSafely(url: string) {
  return circuitBreaker.execute(async () => {
    return await loadAudio(url);
  });
}

// Monitor circuit state
circuitBreaker.on('open', () => {
  console.log('Circuit opened - too many failures');
  showDegradedModeUI();
});

circuitBreaker.on('halfOpen', () => {
  console.log('Testing recovery...');
});

circuitBreaker.on('close', () => {
  console.log('Circuit recovered');
  restoreFullUI();
});
```

### Advanced Circuit Breaker

```typescript
const advancedBreaker = new CircuitBreaker('api', {
  failureThreshold: 10,
  recoveryTimeout: 60000,
  
  // Custom failure detection
  isFailure: (error) => {
    // Don't count 404s as failures
    if (error.statusCode === 404) return false;
    // Count timeouts and 5xx as failures
    return error.isTimeout || error.statusCode >= 500;
  },
  
  // Fallback function
  fallback: async () => {
    return getCachedData();
  },
  
  // Health check
  healthCheck: async () => {
    const response = await fetch('/health');
    return response.ok;
  }
});
```

## Error Recovery Strategies

### Automatic Recovery

```typescript
import { ErrorRecovery } from './ErrorRecovery.js';

const recovery = new ErrorRecovery({
  strategies: {
    'audio_context_suspended': async (error) => {
      const context = error.context;
      await context.resume();
      return { recovered: true };
    },
    
    'network_timeout': async (error) => {
      // Retry with exponential backoff
      for (let i = 0; i < 3; i++) {
        await sleep(Math.pow(2, i) * 1000);
        try {
          return await error.operation();
        } catch (e) {
          if (i === 2) throw e;
        }
      }
    },
    
    'memory_pressure': async (error) => {
      // Free memory and retry
      await clearCache();
      gc(); // If available
      return await error.operation();
    }
  },
  
  maxAttempts: 3,
  backoffMultiplier: 2,
});

// Use recovery
try {
  await riskyOperation();
} catch (error) {
  const result = await recovery.attempt(error);
  if (result.recovered) {
    console.log('Successfully recovered from error');
  } else {
    console.error('Recovery failed:', result.error);
  }
}
```

### Manual Recovery Procedures

#### 1. Audio Context Recovery
```typescript
async function recoverAudioContext() {
  // 1. Check current state
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      return true;
    } catch (e) {
      // Continue to step 2
    }
  }
  
  // 2. Create new context if needed
  if (audioContext.state === 'closed') {
    audioContext = new AudioContext();
    await reinitializeAudioGraph();
    return true;
  }
  
  // 3. Handle iOS-specific issues
  if (isIOS() && !audioContext.wasUnlocked) {
    await waitForUserInteraction();
    await unlockAudioContext();
    return true;
  }
  
  return false;
}
```

#### 2. Network Recovery
```typescript
async function recoverNetworkOperation(operation: () => Promise<any>) {
  const strategies = [
    // 1. Simple retry
    async () => {
      await sleep(1000);
      return operation();
    },
    
    // 2. Use alternative endpoint
    async () => {
      const altEndpoint = getAlternativeEndpoint();
      return operation.withEndpoint(altEndpoint);
    },
    
    // 3. Use cached data
    async () => {
      const cached = await getFromCache(operation.cacheKey);
      if (cached) return cached;
      throw new Error('No cached data available');
    },
    
    // 4. Degrade functionality
    async () => {
      return getMinimalFunctionalityData();
    }
  ];
  
  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('All recovery strategies failed');
}
```

## Graceful Degradation

### Implementation

```typescript
import { GracefulDegradation } from './GracefulDegradation.js';

const degradation = new GracefulDegradation({
  levels: [
    {
      name: 'full',
      check: () => true, // Always available
      features: ['high-quality-audio', '3d-visualization', 'effects', 'recording']
    },
    {
      name: 'reduced',
      check: () => performance.memory?.usedJSHeapSize < MEMORY_THRESHOLD,
      features: ['standard-audio', '2d-visualization', 'basic-effects']
    },
    {
      name: 'minimal',
      check: () => navigator.onLine,
      features: ['basic-audio', 'simple-ui']
    },
    {
      name: 'offline',
      check: () => true, // Last resort
      features: ['cached-content-only']
    }
  ]
});

// Monitor degradation level
degradation.on('levelChanged', (event) => {
  console.log(`Degraded from ${event.from} to ${event.to}`);
  updateUIForLevel(event.to);
});

// Check feature availability
if (degradation.isFeatureAvailable('3d-visualization')) {
  render3DVisualizer();
} else {
  renderSimpleVisualizer();
}
```

### Feature Flags

```typescript
class FeatureFlags {
  private flags = new Map<string, boolean>();
  
  constructor(private degradation: GracefulDegradation) {
    this.updateFlags();
    
    degradation.on('levelChanged', () => {
      this.updateFlags();
    });
  }
  
  private updateFlags() {
    const level = this.degradation.getCurrentLevel();
    
    this.flags.set('highQualityAudio', level.includes('high-quality-audio'));
    this.flags.set('3dGraphics', level.includes('3d-visualization'));
    this.flags.set('realtimeEffects', level.includes('effects'));
    this.flags.set('cloudSync', level.includes('cloud-features'));
  }
  
  isEnabled(feature: string): boolean {
    return this.flags.get(feature) || false;
  }
}
```

## Error Reporting

### Setup Error Reporter

```typescript
import { ErrorReporter } from './ErrorReporter.js';

const reporter = new ErrorReporter({
  endpoint: '/api/errors',
  bufferSize: 100,
  flushInterval: 30000, // 30 seconds
  
  // Filter sensitive information
  sanitize: (error) => {
    delete error.userData;
    delete error.authToken;
    return error;
  },
  
  // Sampling
  shouldReport: (error) => {
    // Report all critical errors
    if (error.severity === 'critical') return true;
    
    // Sample 10% of other errors
    return Math.random() < 0.1;
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  reporter.report({
    message: event.message,
    stack: event.error?.stack,
    url: event.filename,
    line: event.lineno,
    column: event.colno,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  reporter.report({
    type: 'unhandledRejection',
    reason: event.reason,
    promise: event.promise,
    timestamp: Date.now(),
  });
});
```

### Error Context Collection

```typescript
class ErrorContext {
  private context: Record<string, any> = {};
  
  setUser(userId: string, username: string) {
    this.context.user = { id: userId, username };
  }
  
  setSession(sessionId: string, startTime: number) {
    this.context.session = { id: sessionId, startTime };
  }
  
  setEnvironment(env: Record<string, any>) {
    this.context.environment = {
      ...env,
      memory: performance.memory,
      connection: navigator.connection,
      deviceMemory: navigator.deviceMemory,
    };
  }
  
  setPlaybackState(state: PlaybackState) {
    this.context.playback = {
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      tempo: state.tempo,
      loadedSamples: state.loadedSamples.length,
    };
  }
  
  getContext(): Record<string, any> {
    return {
      ...this.context,
      timestamp: Date.now(),
      url: window.location.href,
    };
  }
}

// Use with error reporter
const errorContext = new ErrorContext();

reporter.setContextProvider(() => errorContext.getContext());
```

## Mobile-Specific Error Handling

### iOS Audio Handling

```typescript
class IOSAudioHandler {
  private unlocked = false;
  
  async initialize() {
    if (!this.isIOS()) return;
    
    // Wait for user interaction
    document.addEventListener('touchstart', this.unlock, { once: true });
    document.addEventListener('click', this.unlock, { once: true });
  }
  
  private unlock = async () => {
    if (this.unlocked) return;
    
    try {
      // Create and play silent buffer
      const context = getAudioContext();
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
      
      // Resume if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }
      
      this.unlocked = true;
      this.emit('unlocked');
    } catch (error) {
      console.error('Failed to unlock iOS audio:', error);
      this.scheduleRetry();
    }
  };
  
  private scheduleRetry() {
    setTimeout(() => {
      document.addEventListener('touchstart', this.unlock, { once: true });
    }, 1000);
  }
}
```

### Android Memory Management

```typescript
class AndroidMemoryManager {
  private pressureObserver?: MemoryPressureObserver;
  
  initialize() {
    if (!this.isAndroid()) return;
    
    // Monitor memory pressure
    if ('memory' in performance) {
      this.pressureObserver = new MemoryPressureObserver((entries) => {
        for (const entry of entries) {
          this.handleMemoryPressure(entry.state);
        }
      });
      
      this.pressureObserver.observe();
    }
    
    // Periodic cleanup
    setInterval(() => {
      this.performCleanup();
    }, 60000); // Every minute
  }
  
  private handleMemoryPressure(state: string) {
    switch (state) {
      case 'critical':
        // Aggressive cleanup
        this.clearAllCaches();
        this.reduceSampleQuality();
        this.disableNonEssentialFeatures();
        break;
        
      case 'moderate':
        // Moderate cleanup
        this.clearOldCaches();
        this.compactMemory();
        break;
    }
  }
  
  private performCleanup() {
    const memory = performance.memory;
    const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    if (usage > 0.9) {
      this.clearOldCaches();
    }
    
    if (usage > 0.95) {
      this.emergencyCleanup();
    }
  }
}
```

## Testing Error Handling

### Unit Tests

```typescript
describe('ErrorClassifier', () => {
  it('should classify network errors correctly', () => {
    const error = new NetworkError('Connection failed', 0);
    const classification = classifier.classify(error);
    
    expect(classification.type).toBe('network');
    expect(classification.severity).toBe('high');
    expect(classification.recoverable).toBe(true);
    expect(classification.category).toBe('transient');
  });
  
  it('should classify audio errors correctly', () => {
    const error = new AudioContextError('Context not allowed');
    const classification = classifier.classify(error);
    
    expect(classification.type).toBe('audio');
    expect(classification.severity).toBe('medium');
    expect(classification.recoverable).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Error Recovery Integration', () => {
  it('should recover from audio context suspension', async () => {
    const context = new AudioContext();
    
    // Simulate suspension
    await context.suspend();
    
    // Trigger error
    const error = new AudioContextError('Context suspended', context);
    
    // Attempt recovery
    const recovery = new ErrorRecovery();
    const result = await recovery.attempt(error);
    
    expect(result.recovered).toBe(true);
    expect(context.state).toBe('running');
  });
});
```

### Error Injection Testing

```typescript
class ErrorInjector {
  private enabled = false;
  private errorRates = new Map<string, number>();
  
  enable() {
    this.enabled = true;
  }
  
  disable() {
    this.enabled = false;
  }
  
  setErrorRate(operation: string, rate: number) {
    this.errorRates.set(operation, rate);
  }
  
  async execute<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }
    
    const rate = this.errorRates.get(operation) || 0;
    if (Math.random() < rate) {
      throw new Error(`Injected error for ${operation}`);
    }
    
    return fn();
  }
}

// Use in tests
const injector = new ErrorInjector();
injector.enable();
injector.setErrorRate('loadSample', 0.5); // 50% failure rate

// Test error handling
await expect(loadSampleWithInjection()).rejects.toThrow();
```

## Best Practices

### 1. Error Boundaries

Always use error boundaries to prevent cascading failures:

```typescript
export function withErrorBoundary<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T> {
  return fn().catch(error => {
    console.error('Error boundary caught:', error);
    
    // Report error
    ErrorReporter.report(error);
    
    // Return fallback or rethrow
    if (fallback !== undefined) {
      return fallback;
    }
    
    throw error;
  });
}
```

### 2. Contextual Errors

Always provide context with errors:

```typescript
class ContextualError extends Error {
  constructor(
    message: string,
    public context: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Usage
throw new ContextualError('Failed to load sample', {
  sampleId: sample.id,
  url: sample.url,
  size: sample.size,
  format: sample.format,
  timestamp: Date.now(),
});
```

### 3. Error Aggregation

Aggregate related errors to avoid spam:

```typescript
class ErrorAggregator {
  private errors = new Map<string, AggregatedError>();
  
  add(error: Error, key?: string) {
    const errorKey = key || error.message;
    
    if (!this.errors.has(errorKey)) {
      this.errors.set(errorKey, {
        error,
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }
    
    const aggregated = this.errors.get(errorKey)!;
    aggregated.count++;
    aggregated.lastSeen = Date.now();
    
    // Report if threshold reached
    if (aggregated.count === 10) {
      this.report(errorKey);
    }
  }
  
  report(key: string) {
    const aggregated = this.errors.get(key);
    if (!aggregated) return;
    
    ErrorReporter.report({
      ...aggregated.error,
      aggregation: {
        count: aggregated.count,
        firstSeen: aggregated.firstSeen,
        lastSeen: aggregated.lastSeen,
      }
    });
    
    this.errors.delete(key);
  }
}
```

### 4. User-Friendly Messages

Map technical errors to user-friendly messages:

```typescript
const ERROR_MESSAGES = {
  NETWORK_OFFLINE: 'You appear to be offline. Please check your connection.',
  AUDIO_PERMISSION: 'Please allow audio permissions to continue.',
  BROWSER_UNSUPPORTED: 'Your browser doesn\'t support this feature. Try Chrome or Firefox.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again.',
  SAMPLE_LOAD_FAILED: 'Unable to load audio. Try refreshing the page.',
};

function getUserMessage(error: Error): string {
  if (error instanceof NetworkError && !navigator.onLine) {
    return ERROR_MESSAGES.NETWORK_OFFLINE;
  }
  
  if (error instanceof AudioContextError) {
    return ERROR_MESSAGES.AUDIO_PERMISSION;
  }
  
  // Default message
  return ERROR_MESSAGES.SERVER_ERROR;
}
```

## Performance Considerations

1. **Lazy Error Creation**: Don't create error objects unless needed
2. **Sampling**: Don't report every error in production
3. **Batching**: Batch error reports to reduce network overhead
4. **Async Reporting**: Never block the main thread for error reporting
5. **Circuit Breaking**: Prevent error handling from causing more errors

## Summary

This error handling system provides:

- **Classification**: Automatic error categorization
- **Recovery**: Automated and manual recovery strategies
- **Degradation**: Graceful feature reduction
- **Reporting**: Comprehensive error tracking
- **Performance**: < 0.1ms overhead per error

Remember: Good error handling is invisible to users but invaluable to developers.