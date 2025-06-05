# BassNotion Playback Engine - TypeScript Declaration Files

## Overview

This directory contains comprehensive TypeScript declaration files (`.d.ts`) for external consumption of the BassNotion Playback Engine. These files enable full TypeScript support when using the engine as a library in other applications.

## File Structure

```
playback/
├── declarations/              # External API declarations for library consumption
│   ├── index.d.ts            # Main declaration file with all public APIs
│   ├── types.d.ts            # Extended type definitions for advanced use
│   ├── package.d.ts          # Package-level declarations and module structure
│   └── types-guide.md        # This documentation file
├── index.ts                   # Implementation entry point
├── constants.ts               # Implementation constants
├── types/                     # Internal TypeScript type definitions
│   ├── audio.ts              # Internal audio types
│   └── plugin.ts             # Internal plugin types
├── services/                  # Service implementations
├── hooks/                     # React hooks
├── store/                     # State management
├── utils/                     # Utility functions
└── __tests__/                 # Test files
```

**Organization Philosophy:**

- `declarations/` - External API for library consumption (TypeScript .d.ts files)
- Root level - Internal implementation files
- Other folders - Domain-specific implementation details

## Usage

### Basic Import (Main Module)

```typescript
import {
  CoreAudioEngine,
  AudioContextManager,
  PerformanceMonitor,
  type CoreAudioEngineConfig,
  type PlaybackState,
} from '@bassnotion/playback';

// Initialize the engine
const engine = new CoreAudioEngine({
  audioContext: {
    latencyHint: 'interactive',
    sampleRate: 48000,
  },
  performance: {
    enableMonitoring: true,
    alertThresholds: {
      maxLatency: 50,
      maxCpuUsage: 80,
    },
  },
});

// Use with full TypeScript support
const state: PlaybackState = engine.getState();
```

### Modular Imports (Tree-Shaking Optimized)

```typescript
// Core engine components
import { CoreAudioEngine } from '@bassnotion/playback/core';

// Error handling
import {
  PlaybackError,
  AudioContextError,
  ErrorClassifier,
} from '@bassnotion/playback/errors';

// Mobile optimization
import { MobileOptimizer, BatteryManager } from '@bassnotion/playback/mobile';

// Plugin system
import { BaseAudioPlugin, PluginManager } from '@bassnotion/playback/plugins';

// Resource management
import {
  ResourceManager,
  MemoryLeakDetector,
} from '@bassnotion/playback/resources';

// React integration
import {
  useCorePlaybackEngine,
  usePlaybackStore,
} from '@bassnotion/playback/react';

// Utilities
import {
  detectDeviceCapabilities,
  supportsLowLatencyAudio,
} from '@bassnotion/playback/utils';

// Constants
import {
  DEFAULT_AUDIO_CONFIG,
  PERFORMANCE_THRESHOLDS,
} from '@bassnotion/playback/constants';
```

### Advanced Types

```typescript
// Extended type definitions for advanced use cases
import type {
  AudioProcessingChain,
  FrequencyAnalysisData,
  PerformanceProfile,
  MemorySnapshot,
  PluginSandbox,
  ErrorTelemetry,
} from '@bassnotion/playback/types';

// Use advanced types for specialized implementations
const processingChain: AudioProcessingChain = {
  input: audioContext.createGain(),
  output: audioContext.createGain(),
  nodes: [],
  effects: [],
  bypass: false,
  wetDryMix: 0.5,
};
```

## API Categories

### 🎵 Core Audio Engine

- `CoreAudioEngine` - Main audio processing engine
- `AudioContextManager` - Browser-compatible audio context management
- `PerformanceMonitor` - Real-time performance monitoring

### 📱 Mobile Optimization

- `MobileOptimizer` - Device-specific optimizations
- `BatteryManager` - Battery usage monitoring and optimization
- `IOSOptimizer` - iOS-specific audio optimizations
- `AndroidOptimizer` - Android-specific audio optimizations
- `BackgroundProcessor` - Background audio processing

### 🔌 Plugin Architecture

- `BaseAudioPlugin` - Base class for creating audio plugins
- `PluginManager` - Plugin lifecycle and communication management
- Plugin interfaces and metadata types

### 🧠 Resource Management

- `ResourceManager` - Comprehensive resource lifecycle management
- `MemoryLeakDetector` - Memory leak detection and prevention
- `GarbageCollectionOptimizer` - Intelligent garbage collection
- `AudioResourceDisposer` - Professional audio resource cleanup
- `ResourceUsageMonitor` - Real-time resource monitoring

### ⚡ Performance & Testing

- `ABTestFramework` - A/B testing for performance optimization
- Performance profiling and metrics collection
- Statistical analysis and experiment management

### 🚨 Error Handling

- Comprehensive error taxonomy with specialized error classes
- Automatic error recovery and circuit breaker patterns
- Graceful degradation strategies
- Error classification and reporting

### 👥 Worker Pool Management

- `WorkerPoolManager` - Background processing with worker threads
- Audio processing jobs and queue management
- Performance monitoring for worker threads

### 💾 State Persistence

- `StatePersistenceManager` - Session recovery and state management
- Cross-tab synchronization
- Storage optimization and cleanup

### ⚛️ React Integration

- `useCorePlaybackEngine` - React hook for engine integration
- `usePlaybackStore` - Zustand store integration
- Type-safe store selectors

### 🛠️ Utilities

- Device capability detection
- Mobile audio constraints
- Feature support detection
- Performance tier assessment

## Type Safety Features

### Strict Typing

All APIs are fully typed with comprehensive interfaces:

```typescript
interface CoreAudioEngineConfig {
  audioContext: AudioContextOptions;
  performance: PerformanceConfig;
  mobile: MobileAudioConfig;
  plugins: PluginConfig[];
  errorHandling: ErrorHandlingConfig;
  resourceManagement: ResourceManagementConfig;
}
```

### Enum Support

Comprehensive enums for type safety:

```typescript
enum PlaybackStatus {
  Uninitialized = 'uninitialized',
  Initializing = 'initializing',
  Ready = 'ready',
  Playing = 'playing',
  Paused = 'paused',
  Stopped = 'stopped',
  Error = 'error',
  Disposed = 'disposed',
}

enum ErrorSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}
```

### Generic Types

Support for generic types where appropriate:

```typescript
interface ManagedResource<T = any> {
  id: string;
  resource: T;
  metadata: ResourceMetadata;
  refs: number;
  weakRefs: Set<WeakRef<object>>;
}

// Usage
const audioBufferResource: ManagedResource<AudioBuffer> =
  resourceManager.get('buffer-1');
```

### Type Guards

Runtime type checking with type guards:

```typescript
// Usage in consuming applications
if (isPlaybackError(error)) {
  console.log(`Playback error: ${error.code} - ${error.message}`);
}

if (isAudioContextError(error)) {
  console.log(`Audio context error: ${error.audioContextErrorCode}`);
}
```

## Browser Compatibility

### Supported Browsers

- **Chrome**: ≥ 66 (full support)
- **Firefox**: ≥ 60 (full support)
- **Safari**: ≥ 14.1 (full support)
- **Edge**: ≥ 79 (full support)

### Mobile Support

- **iOS**: ≥ 14.5 (with Safari optimizations)
- **Android**: ≥ 90 (with Chrome optimizations)

### Feature Detection

```typescript
import { isFeatureSupported } from '@bassnotion/playback/utils';

if (isFeatureSupported('web-audio-api')) {
  // Web Audio API is available
}

if (isFeatureSupported('low-latency')) {
  // Low-latency audio is supported
}
```

## Framework Integration

### React

```typescript
import { useCorePlaybackEngine } from '@bassnotion/playback/react';

function AudioPlayer() {
  const { engine, state, isInitialized, play, pause } = useCorePlaybackEngine({
    audioContext: { latencyHint: 'interactive' }
  });

  return (
    <div>
      <button onClick={play} disabled={!isInitialized}>
        Play
      </button>
      <button onClick={pause} disabled={!state.isPlaying}>
        Pause
      </button>
    </div>
  );
}
```

### Vue (Experimental)

```typescript
// Vue 3 composition API integration (experimental)
import { ref, onMounted } from 'vue';
import { CoreAudioEngine } from '@bassnotion/playback/core';

export function usePlaybackEngine() {
  const engine = ref<CoreAudioEngine | null>(null);
  const isInitialized = ref(false);

  onMounted(async () => {
    engine.value = new CoreAudioEngine();
    await engine.value.initialize();
    isInitialized.value = true;
  });

  return { engine, isInitialized };
}
```

## Build System Integration

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      '@bassnotion/playback': path.resolve(
        __dirname,
        'node_modules/@bassnotion/playback',
      ),
    },
  },
  optimization: {
    usedExports: true, // Enable tree-shaking
    sideEffects: false,
  },
};
```

### Vite

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    include: ['@bassnotion/playback'],
  },
  build: {
    rollupOptions: {
      external: ['tone'], // Exclude peer dependencies
    },
  },
});
```

### Rollup

```javascript
// rollup.config.js
export default {
  external: ['tone', 'react', 'zustand'], // Peer dependencies
  output: {
    globals: {
      tone: 'Tone',
      react: 'React',
      zustand: 'zustand',
    },
  },
};
```

## Performance Considerations

### Tree-Shaking

The declaration files support full tree-shaking:

```typescript
// Only imports the needed components
import { CoreAudioEngine } from '@bassnotion/playback/core';
import { MobileOptimizer } from '@bassnotion/playback/mobile';
// Other modules are not included in the bundle
```

### Lazy Loading

```typescript
// Lazy load optional features
const { LazyImports } = await import('@bassnotion/playback/lazy');

if (process.env.NODE_ENV === 'development') {
  const devTools = await LazyImports.loadDevTools();
}
```

### Bundle Size Optimization

- Modular imports reduce bundle size
- Dead code elimination through tree-shaking
- Optional dependencies for advanced features
- Lazy loading for development tools

## Migration Guide

### From Legacy APIs

```typescript
// Old way (deprecated)
import { CorePlaybackEngine } from '@bassnotion/playback/legacy';

// New way (recommended)
import { CoreAudioEngine } from '@bassnotion/playback/core';

// The old CorePlaybackEngine is aliased to CoreAudioEngine for compatibility
```

### Epic 2 Transition

The declaration files include forward compatibility for Epic 2:

```typescript
// Current implementation
const engine = new CoreAudioEngine(config);

// Epic 2 integration (future)
const n8nPayload: N8nPayloadConfig = {
  tutorialSpecificMidi: {
    /* ... */
  },
  libraryMidi: {
    /* ... */
  },
  audioSamples: {
    /* ... */
  },
  synchronization: {
    /* ... */
  },
};

await engine.initializeFromN8nPayload(n8nPayload);
```

## Debugging and Development

### Debug Mode

```typescript
// Enable debug features in development
if (process.env.NODE_ENV === 'development') {
  window.__BASSNOTION_PLAYBACK_DEBUG__ = true;
}
```

### Error Reporting

```typescript
import { ErrorReporter } from '@bassnotion/playback/errors';

// Get error logs for debugging
const logs = ErrorReporter.getErrorLogs();
console.table(logs);
```

### Performance Profiling

```typescript
import { PerformanceMonitor } from '@bassnotion/playback/core';

const monitor = new PerformanceMonitor();
monitor.startMonitoring();

// Generate performance report
const report = monitor.generateReport();
console.log('Performance Report:', report);
```

## Contributing

### Adding New Types

When adding new features to the playback engine:

1. Update the main `index.d.ts` file
2. Add extended types to `types.d.ts` if needed
3. Update the modular exports in `package.d.ts`
4. Add usage examples to this guide
5. Test with consuming applications

### Type Testing

```typescript
// Type-only imports for testing
import type { CoreAudioEngine } from '@bassnotion/playback';

// Test type compatibility
type EngineType = CoreAudioEngine;
const engine: EngineType = new CoreAudioEngine();
```

## Support and Resources

- **Documentation**: [BassNotion Docs](https://docs.bassnotion.com)
- **Issues**: [GitHub Issues](https://github.com/bassnotion/bassnotion-monorepo/issues)
- **Community**: [Discord Server](https://discord.gg/bassnotion)
- **NPM Package**: `@bassnotion/playback`

## Version Compatibility

- **Current Version**: 2.1.0
- **Minimum Node.js**: 16.0.0
- **Minimum TypeScript**: 4.8.0
- **Peer Dependencies**:
  - `tone`: ^15.0.4
  - `react`: >=18.0.0 (optional)
  - `zustand`: ^5.0.0 (optional)

---

_This documentation is part of **Story 2.1, Task 9, Subtask 9.5**: Create TypeScript declaration files for external consumption._
