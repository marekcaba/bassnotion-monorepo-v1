# BassNotion Playback Domain

## Enhanced Export Structure & Widget Integration

**Story 2.1, Task 15**: Complete playback domain integration for widget consumption with Epic 2 support.

### 🎯 Overview

The BassNotion Playback Domain provides a comprehensive, production-ready audio engine with Epic 2 integration for n8n AI agent payload processing. This domain is optimized for widget consumption with tree-shaking support and TypeScript-first development.

### 📦 Package Structure

```
@bassnotion/playback-domain
├── 🎵 Core Audio Engine        (CorePlaybackEngine)
├── 🔧 Service Layer           (Asset, Resource, Mobile Management)
├── 🗄️  State Management        (Zustand Store with Epic 2 Support)
├── 🪝 React Hooks             (Widget-Optimized Consumption)
├── 🎨 Type System             (Comprehensive TypeScript Interfaces)
├── ⚡ Performance Monitoring   (Real-time Metrics & Optimization)
└── 🔌 Plugin Architecture     (Extensible Audio Processing)
```

---

## 🚀 Quick Start for Widgets

### Basic Playback Control Widget

```tsx
import {
  usePlaybackState,
  PlaybackControlRequest,
  PlaybackStateResponse,
} from '@bassnotion/playback-domain';

function BasicPlaybackWidget() {
  const {
    isPlaying,
    isPaused,
    play,
    pause,
    stop,
    tempo,
    setTempo,
    masterVolume,
    setVolume,
    isInitialized,
    error,
  } = usePlaybackState('basic-playback-widget');

  if (!isInitialized) {
    return <div>Initializing audio engine...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="playback-controls">
      <div className="transport-controls">
        <button onClick={play} disabled={isPlaying}>
          ▶️ Play
        </button>
        <button onClick={pause} disabled={!isPlaying}>
          ⏸️ Pause
        </button>
        <button onClick={stop} disabled={!isPlaying && !isPaused}>
          ⏹️ Stop
        </button>
      </div>

      <div className="parameter-controls">
        <label>
          Tempo: {tempo} BPM
          <input
            type="range"
            min={40}
            max={220}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </label>

        <label>
          Volume: {Math.round(masterVolume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
```

### Epic 2 Asset Loading Widget

```tsx
import {
  useAssetLoading,
  N8nPayloadConfig,
  AssetLoadingProgress,
} from '@bassnotion/playback-domain';

function YouTubeExerciserWidget({
  n8nPayload,
}: {
  n8nPayload: N8nPayloadConfig;
}) {
  const {
    progressPercentage,
    loadingMessage,
    canStartPlayback,
    isLoading,
    isComplete,
    hasErrors,
    loadingErrors,
    totalAssets,
    loadedAssets,
    minimumViableAssetsLoaded,
    retryFailedAssets,
    resetAssetLoading,
  } = useAssetLoading('youtube-exerciser');

  // Loading state
  if (isLoading) {
    return (
      <div className="asset-loading-overlay">
        <div className="loading-header">
          <h3>Loading Exercise Assets...</h3>
          <span className="asset-count">
            {loadedAssets}/{totalAssets} assets loaded
          </span>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="progress-text">
            {progressPercentage.toFixed(1)}%
          </span>
        </div>

        <p className="loading-message">{loadingMessage}</p>

        {minimumViableAssetsLoaded && (
          <button
            className="start-partial-button"
            onClick={() => {
              /* Start with loaded assets */
            }}
          >
            Start with Available Assets
          </button>
        )}
      </div>
    );
  }

  // Error state
  if (hasErrors) {
    return (
      <div className="asset-loading-error">
        <h3>⚠️ Loading Failed</h3>
        <div className="error-details">
          {loadingErrors.map((error, index) => (
            <div key={index} className="error-item">
              <strong>{error.errorType}:</strong> {error.errorMessage}
              {error.canRetry && (
                <span className="retry-info">
                  (Retry {error.retryCount}/{error.maxRetries})
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="error-actions">
          <button onClick={retryFailedAssets} className="retry-button">
            🔄 Retry Failed Assets
          </button>
          <button onClick={resetAssetLoading} className="reset-button">
            🔁 Reset and Reload
          </button>
        </div>
      </div>
    );
  }

  // Ready state
  return (
    <div className="exercise-ready">
      <h2>🎸 Bass Exercise Ready!</h2>
      <p>
        All assets loaded successfully. Ready to start your practice session.
      </p>

      <button
        className="start-exercise-button"
        disabled={!canStartPlayback}
        onClick={() => {
          /* Start exercise */
        }}
      >
        🚀 Start Exercise
      </button>
    </div>
  );
}
```

---

## 🔧 Advanced Usage Patterns

### Multi-Widget Synchronization

```tsx
import {
  usePlaybackState,
  WidgetSyncConfig,
  WidgetPlaybackEvent,
} from '@bassnotion/playback-domain';

function SynchronizedWidget({
  widgetId,
  syncConfig,
}: {
  widgetId: string;
  syncConfig: WidgetSyncConfig;
}) {
  const playbackState = usePlaybackState(widgetId);

  // Sync with other widgets
  useEffect(() => {
    if (syncConfig.enabledWidgets.includes(widgetId)) {
      // Subscribe to sync events
      const unsubscribe = subscribeSyncEvents((event: WidgetPlaybackEvent) => {
        if (event.widgetId !== widgetId && syncConfig.syncTempo) {
          playbackState.setTempo(event.data.tempo);
        }
      });

      return unsubscribe;
    }
  }, [syncConfig, widgetId, playbackState]);

  return <div className="synchronized-widget">{/* Widget content */}</div>;
}
```

### Performance Monitoring Integration

```tsx
import {
  usePlaybackState,
  AudioPerformanceMetrics,
  PerformanceAlert,
} from '@bassnotion/playback-domain';

function PerformanceAwareWidget() {
  const { performanceMetrics, isInitialized } =
    usePlaybackState('performance-widget');

  // Monitor performance and adapt UI
  const performanceLevel = useMemo(() => {
    if (!performanceMetrics) return 'unknown';

    const { latency, cpuUsage, audioDropouts } = performanceMetrics;

    if (latency > 100 || cpuUsage > 0.8 || audioDropouts > 5) {
      return 'poor';
    } else if (latency > 50 || cpuUsage > 0.6 || audioDropouts > 1) {
      return 'fair';
    } else {
      return 'excellent';
    }
  }, [performanceMetrics]);

  return (
    <div className={`widget performance-${performanceLevel}`}>
      <div className="performance-indicator">
        <span className={`status-dot ${performanceLevel}`} />
        Performance: {performanceLevel}
        {performanceMetrics && (
          <div className="metrics-details">
            <span>Latency: {performanceMetrics.latency.toFixed(1)}ms</span>
            <span>CPU: {(performanceMetrics.cpuUsage * 100).toFixed(1)}%</span>
            {performanceMetrics.networkLatency && (
              <span>
                Network: {performanceMetrics.networkLatency.toFixed(1)}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* Adapt UI based on performance */}
      {performanceLevel === 'poor' && (
        <div className="performance-warning">
          ⚠️ Audio performance is degraded. Consider reducing quality settings.
        </div>
      )}
    </div>
  );
}
```

---

## 📘 Epic 2 Integration Guide

### N8n Payload Processing Workflow

```tsx
import {
  CorePlaybackEngine,
  N8nPayloadConfig,
  AssetManifest,
  useAssetLoading,
} from '@bassnotion/playback-domain';

// Example Epic 2 payload from n8n AI agent
const exampleN8nPayload: N8nPayloadConfig = {
  tutorialSpecificMidi: {
    basslineUrl:
      'https://cdn.bassnotion.com/tutorials/beginner-bassline-01.mid',
    chordsUrl: 'https://cdn.bassnotion.com/tutorials/beginner-chords-01.mid',
  },
  libraryMidi: {
    drumPatternId: 'rock-basic-4-4',
    metronomeStyleId: 'digital-click',
  },
  audioSamples: {
    bassNotes: [
      'https://cdn.bassnotion.com/samples/bass/E1.wav',
      'https://cdn.bassnotion.com/samples/bass/A1.wav',
      'https://cdn.bassnotion.com/samples/bass/D2.wav',
      'https://cdn.bassnotion.com/samples/bass/G2.wav',
    ],
    drumHits: [
      'https://cdn.bassnotion.com/samples/drums/kick.wav',
      'https://cdn.bassnotion.com/samples/drums/snare.wav',
      'https://cdn.bassnotion.com/samples/drums/hihat.wav',
    ],
    ambienceTrack: 'https://cdn.bassnotion.com/ambience/studio-room-tone.wav',
  },
  synchronization: {
    bpm: 120,
    timeSignature: '4/4',
    keySignature: 'Em',
  },
};

function Epic2IntegratedWidget() {
  const assetLoading = useAssetLoading('epic2-widget');
  const playbackState = usePlaybackState('epic2-widget');

  // Initialize with Epic 2 payload
  useEffect(() => {
    const initializeFromPayload = async () => {
      const engine = CorePlaybackEngine.getInstance();
      await engine.initializeFromN8nPayload(exampleN8nPayload);
    };

    initializeFromPayload();
  }, []);

  return (
    <div className="epic2-widget">
      <h2>🎵 Epic 2 Bass Tutorial</h2>

      {/* Asset loading progress */}
      <AssetLoadingProgress
        {...assetLoading}
        onComplete={() => console.log('Assets loaded!')}
      />

      {/* Playback controls (enabled when assets ready) */}
      <PlaybackControls
        {...playbackState}
        disabled={!assetLoading.canStartPlayback}
      />
    </div>
  );
}
```

---

## 🏗️ Architecture Integration

### Contracts Validation

```tsx
import {
  MetronomeSettingsSchema,
  AudioContextConfigSchema,
  N8nPayloadConfigSchema,
  validatePlaybackRequest,
} from '@bassnotion/contracts';

// Validate user input with Zod schemas
function validateTempo(bpm: string): number {
  const result = MetronomeSettingsSchema.pick({ bpm: true }).safeParse({
    bpm: Number(bpm),
  });

  if (!result.success) {
    throw new Error(`Invalid tempo: ${result.error.message}`);
  }

  return result.data.bpm;
}

// Validate Epic 2 payload
function validateN8nPayload(payload: unknown): N8nPayloadConfig {
  const result = N8nPayloadConfigSchema.safeParse(payload);

  if (!result.success) {
    throw new Error(`Invalid n8n payload: ${result.error.message}`);
  }

  return result.data;
}
```

### State Management Integration

```tsx
import { usePlaybackStore } from '@bassnotion/playback-domain';

// Direct store access for advanced use cases
function AdvancedWidget() {
  // Use selectors for fine-grained subscriptions
  const audioSources = usePlaybackStore((state) => state.audioSources);
  const performanceAlerts = usePlaybackStore(
    (state) => state.performanceAlerts,
  );
  const assetLoadingProgress = usePlaybackStore(
    (state) => state.assetLoadingProgress,
  );

  // Use actions for direct state manipulation
  const addAudioSource = usePlaybackStore((state) => state.addAudioSource);
  const updatePerformanceMetrics = usePlaybackStore(
    (state) => state.updatePerformanceMetrics,
  );
  const setAssetLoadingState = usePlaybackStore(
    (state) => state.setAssetLoadingState,
  );

  return (
    <div className="advanced-widget">
      {/* Direct state access for complex widgets */}
    </div>
  );
}
```

---

## ⚡ Performance Optimization

### Tree-Shaking Support

```tsx
// ✅ Good: Import only what you need
import { usePlaybackState } from '@bassnotion/playback-domain';

// ❌ Avoid: Importing the entire domain
import * as PlaybackDomain from '@bassnotion/playback-domain';

// ✅ Good: Import specific types
import type { PlaybackState, AudioTrack } from '@bassnotion/playback-domain';
```

### Mobile Optimization

```tsx
import {
  usePlaybackState,
  MobileAudioConfig,
} from '@bassnotion/playback-domain';

function MobileOptimizedWidget() {
  const playbackState = usePlaybackState('mobile-widget');

  // Configure for mobile
  const mobileConfig: MobileAudioConfig = {
    optimizeForBattery: true,
    reducedLatencyMode: false, // Preserve battery
    autoSuspendOnBackground: true,
    gestureActivationRequired: true,
  };

  return <div className="mobile-widget">{/* Mobile-optimized UI */}</div>;
}
```

---

## 🔍 Debugging and Development

### Development Mode Features

```tsx
import {
  usePlaybackState,
  useAssetLoading,
  AudioPerformanceMetrics,
} from '@bassnotion/playback-domain';

function DevelopmentWidget() {
  const playback = usePlaybackState('dev-widget');
  const assetLoading = useAssetLoading('dev-widget');

  // Debug information (removed in production builds)
  if (process.env.NODE_ENV === 'development') {
    console.group('🎵 Playback Debug Info');
    console.log('Playback State:', playback.playbackState);
    console.log('Performance Metrics:', playback.performanceMetrics);
    console.log('Asset Loading:', {
      stage: assetLoading.loadingStage,
      progress: assetLoading.progressPercentage,
      errors: assetLoading.loadingErrors,
    });
    console.groupEnd();
  }

  return <div className="development-widget">{/* Development features */}</div>;
}
```

---

## 📚 API Reference

### Core Hooks

- **`usePlaybackState(widgetId?)`**: Primary hook for playback control and state
- **`useAssetLoading(widgetId?)`**: Epic 2 asset loading progress and management
- **`useCorePlaybackEngine(config?)`**: Low-level engine access for advanced use cases

### Type Exports

- **State Types**: `PlaybackState`, `AudioContextState`, `PerformanceMetrics`
- **Configuration Types**: `CorePlaybackEngineConfig`, `MobileAudioConfig`
- **Epic 2 Types**: `N8nPayloadConfig`, `AssetManifest`, `AssetLoadingProgress`
- **Widget Types**: `WidgetPlaybackEvent`, `WidgetSyncConfig`, `WidgetAudioConfig`

### Validation Schemas

- **`@bassnotion/contracts`**: Zod schemas for runtime validation
- **Epic 2 Schemas**: `N8nPayloadConfigSchema`, `AssetManifestSchema`
- **Audio Schemas**: `MetronomeSettingsSchema`, `AudioContextConfigSchema`

---

## 🎯 Best Practices

1. **Always use `widgetId`** for tracking and debugging
2. **Check `isInitialized`** before performing audio operations
3. **Handle loading and error states** appropriately
4. **Use contracts validation** for user inputs
5. **Optimize for mobile** with appropriate configurations
6. **Subscribe only to needed state** to prevent unnecessary re-renders
7. **Implement proper cleanup** in useEffect hooks

---

## 🔗 Related Documentation

- [Core Audio Engine Documentation](./services/README.md)
- [State Management Guide](./store/README.md)
- [Performance Optimization](./performance/README.md)
- [Epic 2 Integration Spec](../../docs/epic-2-integration.md)
- [Widget Development Guide](../../widgets/README.md)
