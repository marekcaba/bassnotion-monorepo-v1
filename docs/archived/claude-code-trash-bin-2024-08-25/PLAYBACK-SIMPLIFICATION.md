# Playback System Simplification

## What We Removed

- **PlaybackOrchestrator** service and its stub classes
- **usePlaybackOrchestrator** hook
- Unnecessary abstraction layers

## What We're Using Instead

- **UnifiedTransport** directly via `useTransport()` hook
- **WidgetSyncService** for widget coordination (already working)
- **EventBus** for event communication (already working)

## Changes Made

### GlobalControls.tsx

- Removed `usePlaybackOrchestrator` import and usage
- Updated play/pause to use `transport.start()` and `transport.pause()` directly
- Updated tempo control to use `transport.setTempo()` directly
- Simplified the code by removing orchestrator initialization checks

## Benefits

1. **Simpler codebase** - Removed unnecessary abstraction layer
2. **No initialization timing issues** - Transport is managed by CoreServices
3. **Direct control** - Components use transport directly like test-unified-transport page
4. **Less code to maintain** - Deleted 1000+ lines of unnecessary code

## How It Works Now

```typescript
// In any component that needs playback control:
const transport = useTransport();

// Play
await transport.start();

// Pause
await transport.pause();

// Stop
await transport.stop();

// Set tempo
await transport.setTempo(120);
```

The system is now much cleaner and follows the same pattern as the working test-unified-transport page.
