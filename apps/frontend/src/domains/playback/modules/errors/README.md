# Playback Domain Error Handling System

## Overview

This module provides a comprehensive error handling system for the playback domain, implementing Phase 5.2 of the refactoring plan. It builds upon the existing error infrastructure while adding domain-specific error classes, recovery strategies, circuit breakers, and enhanced reporting.

## Architecture

### 1. Domain-Specific Error Classes

#### Error Hierarchy
```
PlaybackError (base)
├── InstrumentError
│   ├── SamplerError
│   ├── SynthError
│   ├── DrumKitError
│   ├── NotePlaybackError
│   ├── PatternScheduleError
│   ├── VoiceLimitError
│   └── CpuOverloadError
├── MidiError
│   ├── MidiParseError
│   ├── InvalidMidiFileError
│   ├── MidiValidationError
│   ├── MidiTimingError
│   ├── MidiTransformError
│   ├── MidiPipelineError
│   ├── MidiQuantizationError
│   └── MidiTranspositionError
├── StorageError
│   ├── StorageConnectionError
│   ├── StorageAuthError
│   ├── UploadError
│   ├── DownloadError
│   ├── CacheError
│   ├── CacheFullError
│   ├── CDNError
│   ├── BatchOperationError
│   ├── CircuitBreakerOpenError
│   └── RetryExhaustedError
└── TransportError
    ├── ClockSyncError
    ├── SchedulingError
    ├── TimelineError
    ├── AudioWorkletError
    ├── LatencyError
    ├── WidgetSyncError
    ├── EventMissedError
    └── ScheduleOverflowError
```

### 2. Error Recovery System

The `ErrorRecoveryRegistry` provides:
- **Priority-based recovery strategies**: Higher priority strategies are tried first
- **Adaptive strategy selection**: Learns from success rates and recovery times
- **Domain-specific recovery strategies**: Tailored recovery for each error type
- **Recovery metrics**: Tracks effectiveness of each strategy

#### Recovery Strategy Example
```typescript
const registry = new ErrorRecoveryRegistry(eventBus, {
  enableMetrics: true,
  strategySelectionMode: 'adaptive'
});

// Strategies are automatically registered for:
// - Instrument initialization failures
// - Sample loading errors
// - MIDI parsing errors
// - Storage connection failures
// - Transport timing issues
```

### 3. Circuit Breaker Integration

The `CircuitBreakerIntegration` protects critical paths:

#### Protected Paths
- **Storage Operations**: Connection, upload, download, auth
- **Audio Initialization**: Context, instruments, samples, plugins
- **External APIs**: CDN access, edge locations, analytics
- **Resource-Intensive**: MIDI processing, batch operations, caching
- **Transport**: Clock sync, worklet init, widget sync

#### Circuit Breaker Features
- **Adaptive thresholds**: Adjusts based on failure patterns
- **Health checks**: Proactive recovery detection
- **Fallback operations**: Graceful degradation
- **Monitoring**: Real-time metrics and alerts

### 4. Error Reporting Service

The `ErrorReportingService` provides:
- **Error deduplication**: Prevents spam from repeated errors
- **Trend analysis**: Tracks error patterns over time
- **Batch reporting**: Efficient remote error submission
- **Error categorization**: Automatic tagging and classification
- **Sensitive data filtering**: Sanitizes personal information

## Usage

### Basic Error Handling

```typescript
import { InstrumentError, InstrumentErrorCode } from '@/domains/playback/modules/errors';

// Throw domain-specific error
throw new InstrumentError(
  InstrumentErrorCode.INSTRUMENT_INIT_FAILED,
  'Failed to initialize sampler',
  'sampler',
  'bass-sampler-1',
  originalError
);
```

### Error Recovery

```typescript
import { ErrorRecoveryRegistry } from '@/domains/playback/modules/errors';

const registry = new ErrorRecoveryRegistry(eventBus);

try {
  await riskyOperation();
} catch (error) {
  const recovered = await registry.attempt(error, {
    component: 'MyComponent',
    operation: 'riskyOperation'
  });
  
  if (!recovered) {
    // Handle unrecoverable error
  }
}
```

### Circuit Breaker Protection

```typescript
import { CircuitBreakerIntegration, CriticalPath } from '@/domains/playback/modules/errors';

const breakers = new CircuitBreakerIntegration(eventBus);

// Execute with circuit breaker protection
await breakers.executeWithBreaker(
  CriticalPath.STORAGE_DOWNLOAD,
  async () => {
    return await downloadFile(path);
  },
  'download-operation'
);
```

### React Component Integration

```typescript
import { useErrorReporting } from '@/domains/playback/modules/errors/hooks';

function MyComponent() {
  const { reportError, executeWithErrorHandling } = useErrorReporting({
    component: 'MyComponent',
    enableRecovery: true,
    enableCircuitBreaker: true,
    criticalPath: CriticalPath.AUDIO_CONTEXT_INIT
  });
  
  const handleOperation = async () => {
    try {
      await executeWithErrorHandling(
        async () => {
          // Your operation
        },
        'operation-name'
      );
    } catch (error) {
      // Error already reported and recovery attempted
    }
  };
}
```

## Error Codes

### Instrument Errors
- `INSTRUMENT_INIT_FAILED`: Instrument initialization failure
- `SAMPLER_INIT_FAILED`: Sampler initialization failure
- `SYNTH_INIT_FAILED`: Synthesizer initialization failure
- `SAMPLE_MAPPING_FAILED`: Sample mapping/loading failure
- `DRUM_KIT_LOAD_FAILED`: Drum kit loading failure
- `NOTE_PLAY_FAILED`: Note playback failure
- `VOICE_LIMIT_EXCEEDED`: Too many simultaneous voices
- `CPU_OVERLOAD`: CPU usage threshold exceeded

### MIDI Errors
- `MIDI_INVALID_FILE`: Invalid MIDI file format
- `MIDI_PARSE_FAILURE`: MIDI parsing failure
- `MIDI_INVALID_EVENT`: Invalid MIDI event
- `MIDI_TIMING_ERROR`: MIDI timing inconsistency
- `MIDI_TRANSFORM_FAILURE`: MIDI transformation failure

### Storage Errors
- `STORAGE_CONNECTION_FAILED`: Storage service connection failure
- `STORAGE_AUTH_FAILED`: Storage authentication failure
- `STORAGE_UPLOAD_FAILED`: File upload failure
- `STORAGE_DOWNLOAD_FAILED`: File download failure
- `STORAGE_CACHE_FULL`: Cache capacity exceeded
- `STORAGE_CDN_UNREACHABLE`: CDN service unavailable
- `STORAGE_CIRCUIT_BREAKER_OPEN`: Circuit breaker preventing operations

### Transport Errors
- `TRANSPORT_CLOCK_SYNC_FAILED`: Clock synchronization failure
- `TRANSPORT_SCHEDULE_FAILED`: Event scheduling failure
- `TRANSPORT_TIMELINE_INVALID`: Timeline operation invalid
- `TRANSPORT_WORKLET_INIT_FAILED`: Audio worklet initialization failure
- `TRANSPORT_LATENCY_THRESHOLD_EXCEEDED`: Latency above acceptable threshold

## Configuration

### Error Recovery Configuration
```typescript
{
  maxRecoveryAttempts: 3,
  recoveryTimeout: 5000,
  enableMetrics: true,
  strategySelectionMode: 'adaptive' // 'priority' | 'adaptive' | 'round-robin'
}
```

### Circuit Breaker Configuration
```typescript
{
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 10000,
  healthCheckInterval: 30000,
  adaptiveThreshold: {
    enabled: true,
    minThreshold: 3,
    maxThreshold: 10,
    adjustmentRate: 1
  }
}
```

### Error Reporting Configuration
```typescript
{
  enableDeduplication: true,
  deduplicationWindow: 300000, // 5 minutes
  trendAnalysisEnabled: true,
  batchReporting: true,
  batchSize: 10,
  batchInterval: 30000 // 30 seconds
}
```

## Monitoring

### Error Metrics
- Total error count by type and severity
- Error trends over 1h, 24h, and 7d periods
- Recovery success rates by strategy
- Circuit breaker states and trip counts
- Top errors by frequency

### Events
The system emits events for monitoring:
- `error:reported`: When an error is reported
- `recovery:strategy-success`: When recovery succeeds
- `recovery:strategy-failed`: When recovery fails
- `circuitbreaker:state-changed`: When circuit breaker state changes
- `circuitbreaker:alert`: When thresholds are exceeded
- `error:trends-updated`: When error trends are calculated

## Best Practices

1. **Always use domain-specific errors** instead of generic Error class
2. **Include context** when throwing errors (component, operation, etc.)
3. **Configure circuit breakers** for all external dependencies
4. **Monitor recovery metrics** to tune strategy priorities
5. **Use the React hook** for consistent error handling in components
6. **Review error trends** regularly to identify systemic issues

## Migration Guide

### From Generic Errors
```typescript
// Before
throw new Error('Failed to load instrument');

// After
throw new InstrumentError(
  InstrumentErrorCode.INSTRUMENT_INIT_FAILED,
  'Failed to load instrument',
  'sampler',
  instrumentId
);
```

### From Try-Catch to Recovery
```typescript
// Before
try {
  await loadSamples();
} catch (error) {
  console.error('Failed to load samples');
  // Manual recovery attempt
}

// After
try {
  await loadSamples();
} catch (error) {
  const recovered = await recoveryRegistry.attempt(error, context);
  if (!recovered) {
    // Only handle if recovery failed
  }
}
```

### Adding Circuit Breakers
```typescript
// Before
const data = await fetchFromCDN(url);

// After
const data = await circuitBreakers.executeWithBreaker(
  CriticalPath.CDN_ACCESS,
  () => fetchFromCDN(url)
);
```