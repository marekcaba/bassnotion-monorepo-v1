# Migration Guide: useCorePlaybackEngine to useCoreServices

## Overview

This guide helps you migrate from the deprecated `useCorePlaybackEngine` hook to the modern `useCoreServices` hook. The new hook provides direct integration with CoreServices without adapter patterns, resulting in better performance and cleaner code.

## Key Changes

### 1. Import Statement

```typescript
// Old
import { useCorePlaybackEngine } from '@/domains/playback/hooks';

// New
import { useCoreServices } from '@/domains/playback/hooks';
```

### 2. Hook Usage

The basic usage remains the same:

```typescript
// Old
const { state, controls, engine } = useCorePlaybackEngine({
  enablePerformanceMonitoring: false,
});

// New
const { state, controls, services } = useCoreServices({
  enablePerformanceMonitoring: false,
});
```

### 3. Direct Service Access

Instead of a fake engine object, you now get direct access to services:

```typescript
// Old
const engine = result.engine; // Adapter object

// New
const {
  coreServices,
  audioEngine,
  transport,
  eventBus,
  pluginManager,
} = result.services;
```

## Migration Examples

### Example 1: Basic Widget

**Before:**
```typescript
import { useCorePlaybackEngine } from '@/domains/playback/hooks';

function MyWidget() {
  const { controls: playbackControls } = useCorePlaybackEngine({
    enablePerformanceMonitoring: false,
  });

  const handlePlay = async () => {
    await playbackControls.play();
  };

  const handleSetTempo = (bpm: number) => {
    playbackControls.setTempo(bpm);
  };

  return (
    <div>
      <button onClick={handlePlay}>Play</button>
      <input type="number" onChange={(e) => handleSetTempo(+e.target.value)} />
    </div>
  );
}
```

**After:**
```typescript
import { useCoreServices } from '@/domains/playback/hooks';

function MyWidget() {
  const { controls: playbackControls } = useCoreServices({
    enablePerformanceMonitoring: false,
  });

  const handlePlay = async () => {
    await playbackControls.play();
  };

  const handleSetTempo = (bpm: number) => {
    playbackControls.setTempo(bpm);
  };

  return (
    <div>
      <button onClick={handlePlay}>Play</button>
      <input type="number" onChange={(e) => handleSetTempo(+e.target.value)} />
    </div>
  );
}
```

### Example 2: Advanced Usage with Direct Service Access

**Before:**
```typescript
import { useCorePlaybackEngine } from '@/domains/playback/hooks';

function AdvancedWidget() {
  const { state, controls, engine, initialize } = useCorePlaybackEngine();

  useEffect(() => {
    if (engine) {
      // Using fake engine methods
      const unsubscribe = engine.on('stateChange', handleStateChange);
      return unsubscribe;
    }
  }, [engine]);

  const getMetrics = () => {
    return engine?.getPerformanceMetrics();
  };
}
```

**After:**
```typescript
import { useCoreServices } from '@/domains/playback/hooks';

function AdvancedWidget() {
  const { state, controls, services, initialize } = useCoreServices();

  useEffect(() => {
    if (services.eventBus) {
      // Direct event bus access
      const unsubscribe = services.eventBus.on(
        'transport:state-changed',
        handleStateChange
      );
      return unsubscribe;
    }
  }, [services.eventBus]);

  const getMetrics = () => {
    return services.audioEngine?.getPerformanceMetrics();
  };
}
```

## API Differences

### State Object
The state object remains unchanged:
- `playbackState`
- `audioContextState`
- `isInitialized`
- `isLoading`
- `error`
- `config`
- `performanceMetrics`
- `performanceAlerts`
- `canPlay`
- `isPlaying`
- `hasError`
- `hasCriticalAlerts`

### Controls Object
The controls object remains unchanged:
- `play()`
- `pause()`
- `stop()`
- `seek(position)`
- `setMasterVolume(volume)`
- `setTempo(bpm)`
- `setPitch(semitones)`
- `setSwingFactor(factor)`
- Audio source methods (limited support in both)

### Services Object (New)
Direct access to core services:
- `coreServices` - The main CoreServices instance
- `audioEngine` - AudioEngine instance
- `transport` - UnifiedTransport instance
- `eventBus` - EventBus instance
- `pluginManager` - PluginManager instance

## Benefits of Migration

1. **Better Performance**: No adapter layer overhead
2. **Direct Service Access**: Access real services, not fake objects
3. **Cleaner Code**: No more adapter patterns or workarounds
4. **Future-Proof**: Aligned with modern architecture
5. **Better TypeScript Support**: Proper types for all services

## Gradual Migration

The old `useCorePlaybackEngine` hook will continue to work during the transition period. It now uses `useCoreServices` internally, so you can migrate at your own pace.

When you see this warning in the console:
```
⚠️ useCorePlaybackEngine is deprecated. Please migrate to useCoreServices for better performance and features.
```

It's time to update that component!

## Common Issues

### Issue 1: Direct engine access
If your code directly accesses `engine` methods:

```typescript
// Old
engine.getInstance();
engine.on('event', handler);

// New
// Use services directly
services.eventBus.on('event', handler);
```

### Issue 2: Event names changed
Some event names have changed to be more descriptive:

```typescript
// Old events
'stateChange' -> 'transport:state-changed'
'audioContextChange' -> 'audio:context-state-changed'
'tempoChange' -> 'transport:tempo-changed'
'masterVolumeChange' -> 'audio:volume-changed'
```

### Issue 3: Missing methods
Some methods like `setPitch()` are not yet implemented in the new system. These will log warnings but won't break your app.

## Need Help?

If you encounter issues during migration:
1. Check the console for specific error messages
2. Ensure services are initialized before use
3. Review the new hook implementation in `useCoreServices.ts`
4. Ask for help in the team chat

## Timeline

- **Now**: Both hooks work, deprecation warnings shown
- **Next Sprint**: Update all core widgets
- **Future**: Remove legacy hook completely