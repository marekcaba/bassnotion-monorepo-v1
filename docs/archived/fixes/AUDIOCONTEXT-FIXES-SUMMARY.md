# AudioContext Fixes Summary

## Problem

The console was showing numerous "AudioContext mismatch" warnings when using Tone.js with the Web Audio API. These warnings were appearing because:

1. Tone.js wraps the native AudioContext in a Context object
2. When connecting Tone.js nodes to native AudioContext nodes, the contexts appear different
3. Multiple AudioContext instances were being created, invalidating cached AudioBuffers

## Solution: Persistent Global AudioContext

### 1. AudioEngine Maintains Global Persistent Context

**File**: `apps/frontend/src/domains/playback/services/core/AudioEngine.ts`

```typescript
// Persistent context management
private keepAliveInterval: number | null = null;
private static globalContext: AudioContext | null = null; // Shared across all instances

// In performInitialization():
if (AudioEngine.globalContext && AudioEngine.globalContext.state !== 'closed') {
  this.context = AudioEngine.globalContext;
} else {
  // Create new persistent context
  AudioEngine.globalContext = this.context;
  // Also store on window for absolute persistence
  if (typeof window !== 'undefined') {
    (window as any).__persistentAudioContext = this.context;
  }
}

// Keep-alive mechanism prevents suspension
private startKeepAlive(): void {
  this.keepAliveInterval = setInterval(() => {
    if (this.context && this.context.state === 'running') {
      // Play silent buffer to keep context active
      const buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start();
    }
  }, 10000); // Every 10 seconds
}
```

### 2. Updated safeConnect() to Handle Context Mismatches Gracefully

**File**: `apps/frontend/src/domains/playback/services/plugins/SalamanderVelocitySampler.ts`

The `safeConnect()` function now:

- Checks for Tone.js Context wrapper vs native AudioContext
- Looks for the persistent global context
- Only warns about true mismatches, not expected Tone.js wrapper differences
- Continues with connection even if contexts appear different (they usually work)

### 3. Improved Context Checking in Other Components

**File**: `apps/frontend/src/domains/playback/services/plugins/wam/WamKeyboard.ts`

- Added persistent context checking when reusing pre-loaded instruments
- Removed verbose logging for expected context differences

**File**: `apps/frontend/src/domains/playback/services/storage/CachedToneBufferLoader.ts`

- Added check for persistent context before clearing cached buffers
- Avoids reloading buffers unnecessarily when using the persistent context

### 4. Reduced Console Noise

- Removed verbose success logging for normal operations
- Only log warnings for actual problems, not expected Tone.js wrapper behavior
- Check for persistent context before logging context mismatch warnings

## Benefits

1. **Instant Playback**: Pre-loaded instruments remain valid across the entire session
2. **No Buffer Invalidation**: Using a single persistent context prevents AudioBuffer invalidation
3. **Cleaner Console**: Warnings only appear for actual issues, not normal Tone.js operation
4. **Memory Efficient**: Samples loaded once can be reused everywhere
5. **Professional DAW Behavior**: Mimics how professional DAWs maintain a single audio engine

## Key Insight

The AudioContext "mismatch" warnings were mostly false positives caused by Tone.js wrapping the native AudioContext. By:

1. Using a single persistent AudioContext stored globally
2. Updating connection logic to understand Tone.js wrappers
3. Adding keep-alive to prevent browser suspension

We achieve professional-grade audio performance with instant playback and no duplicate loading.
