# Drummer Widget Fix

## Problem

The drummer widget was not playing any sounds even though the Transport was started. The logs showed:

```
🔴 DrummerWidget Loop: Skipping - loopRef: true, syncIsPlaying: false, Transport.state: stopped, shouldPlay: false
```

## Root Cause

The drum loop callback was checking `syncIsPlaying` which was captured from the closure when the loop was created. This value became stale and remained `false` even after playback started, because:

1. The loop callback captures variables from its closure when created
2. `syncIsPlaying` was false when the loop was created
3. Even though `isPlaying` prop changed to true, the loop callback still had the old value

## Fix Applied

Added a ref to track the current playing state:

```typescript
// CRITICAL FIX: Use ref to track current playing state for loop callback
const isPlayingRef = useRef(isPlaying);
useEffect(() => {
  isPlayingRef.current = isPlaying;
}, [isPlaying]);
```

Updated the loop callback to use the ref:

```typescript
// CRITICAL FIX: Use isPlayingRef.current to get current playing state (not stale closure value)
const shouldPlay =
  loopRef.current && (isPlayingRef.current || isTransportStarted);
```

## Why This Works

- Refs maintain a mutable reference that persists across renders
- The ref's `.current` property always contains the latest value
- The loop callback can access the current playing state through the ref
- This avoids the stale closure problem

## Result

The drummer widget now correctly plays drum sounds when playback starts, synchronized with other widgets.
