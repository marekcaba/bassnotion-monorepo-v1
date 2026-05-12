# Bass Not Playing Fix Summary

## Problem

After fixing the sample loading timeout issue, bass audio was not playing during playback even though:
- ✅ Bass samples were loaded and cached correctly
- ✅ Bass buffers were decoded (15 buffers for MIDI notes 24-48)
- ✅ Bass buffers were injected into PlaybackEngine
- ✅ Bass track was registered with regionsCount: 1
- ❌ **BUT** bass buffers were cleared BEFORE playback started

## Root Cause

**Timeline from console.md**:
1. Line 2825: Bass buffers injected (15 buffers)
2. Line 2880: Bass buffers CLEARED (previousCount: 15 → 0)
3. Line 8719: Playback starts scheduling 5 tracks
4. Line 7107: **BASS-BUFFER-LOOKUP MISS for midiNote=34 {bufferCount: 0}**

**Why buffers were cleared**:

The `useBassBufferRegistration` hook had the same issue as `useDotSynchronization` - **unstable callback dependencies causing unnecessary re-executions**.

### Technical Details

In [useBassBufferRegistration.ts:346](apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/BassLineWidget/hooks/useBassBufferRegistration.ts#L346), the `registerBassWithPlaybackEngine` useCallback had these dependencies:

```typescript
}, [exercise, samplesLoadedTrigger, volume, isMuted, bassBuffersRef, onSamplesLoaded, onSamplerReady]);
```

**The Problem**:
- `onSamplesLoaded` and `onSamplerReady` are callback props from parent component
- These callbacks are **NOT memoized** by BassLineWidget's parent (FourWidgetsCard)
- Every parent re-render creates new callback instances
- This causes `registerBassWithPlaybackEngine` to be recreated
- The useEffect at line 351-372 depends on `registerBassWithPlaybackEngine`
- **The useEffect runs again**, triggering registration logic

While the hook has guards to prevent duplicate registration for the same exercise (line 117-123), the constant re-creation of the callback was causing instability that led to buffers being cleared during component re-renders.

### Why `setBassBuffers()` Clears First

From [PlaybackEngine.ts:2051-2055](apps/frontend/src/domains/playback/services/core/PlaybackEngine.ts#L2051-L2055):

```typescript
// CRITICAL: Clear existing buffers BEFORE setting new ones to prevent contamination
// from previous exercise's buffers mixing with new exercise's buffers.
// This was causing "corrupted bass" when switching tutorials because
// SimpleInstrumentScheduler.setBuffers() merges instead of replaces.
this.bassScheduler.clearBuffers();
```

This is by design to prevent buffer contamination when switching exercises. However, when combined with the unstable callback issue, it was clearing buffers at the wrong time.

## Solution: Stable Callback Pattern (Same as useDotSynchronization)

Applied the same FAANG-style fix we used for the infinite loop issue:

### Changes Made

**File**: `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/BassLineWidget/hooks/useBassBufferRegistration.ts`

1. **Added refs for unstable callbacks** (after line 56):
```typescript
// ✅ FAANG FIX: Store callback props in refs to prevent infinite re-registrations
const onSamplesLoadedRef = useRef(onSamplesLoaded);
const onSamplerReadyRef = useRef(onSamplerReady);

// Update refs when callbacks change
useEffect(() => {
  onSamplesLoadedRef.current = onSamplesLoaded;
}, [onSamplesLoaded]);

useEffect(() => {
  onSamplerReadyRef.current = onSamplerReady;
}, [onSamplerReady]);
```

2. **Replaced direct callback calls with ref calls** (lines 291-292, 315-316):
```typescript
// Before
onSamplesLoaded(buffersDecoded, midiNotesToLoad.length);
onSamplerReady(true);

// After
onSamplesLoadedRef.current(buffersDecoded, midiNotesToLoad.length);
onSamplerReadyRef.current(true);
```

3. **Removed unstable dependencies from useCallback** (line 346):
```typescript
// Before
}, [exercise, samplesLoadedTrigger, volume, isMuted, bassBuffersRef, onSamplesLoaded, onSamplerReady]);

// After - Removed onSamplesLoaded, onSamplerReady, and bassBuffersRef
}, [exercise, samplesLoadedTrigger, volume, isMuted]);
```

## Why This Works

1. **Stable callback identity**: `registerBassWithPlaybackEngine` no longer changes on every parent render
2. **Prevents unnecessary useEffect runs**: The useEffect at line 351-372 only runs when actual dependencies change
3. **Refs are always current**: Even though callback identity is stable, the ref.current always points to the latest callback
4. **No buffer clearing storms**: Buffers stay registered until an actual exercise change occurs

## Pattern Recognition

This is the **second time** we've encountered this pattern in this codebase:

| Hook | Issue | Fix |
|------|-------|-----|
| `useDotSynchronization` | Infinite re-renders due to unstable `setSharedDots`, `setSelectionOrder` callbacks | Store in refs, update separately |
| `useBassBufferRegistration` | Buffers cleared due to unstable `onSamplesLoaded`, `onSamplerReady` callbacks | Store in refs, update separately |

**Learning**: When passing callback props through multiple component layers without memoization, always use the Stable Callback Pattern (refs) in hooks that depend on them.

## Testing Recommendations

1. ✅ Play exercise - bass should be audible
2. ✅ Switch between exercises - bass should play for each
3. ✅ Switch between tutorials - bass should continue working
4. ✅ Check console.md - should see "Bass buffers injected" followed by scheduling logs, NOT clearing logs
5. ✅ Monitor for "[BASS-BUFFER-LOOKUP] MISS" errors - should be 0

## Related Issues Fixed

- ✅ Sample loading timeout (INFINITE_LOOP_FIX_SUMMARY.md)
- ✅ Infinite re-renders (INFINITE_LOOP_FIX_SUMMARY.md)
- ✅ Bass not playing (this document)

## Files Modified

1. `apps/frontend/src/domains/widgets/components/YouTubeWidgetPage/BassLineWidget/hooks/useBassBufferRegistration.ts`

## Prevention Guidelines

1. **Never put non-memoized callback props in useCallback/useEffect dependency arrays**
2. **Use the Stable Callback Pattern** (refs) when callbacks must be used but can't be memoized at source
3. **Check for unstable dependencies** when debugging why effects run too often
4. **Refer to CLAUDE.md React Anti-Patterns section** (lines 67-90)
5. **Refer to INFINITE_LOOP_FIX_SUMMARY.md** for the pattern example

## FAANG Pattern Applied

```typescript
// ❌ BAD: Direct callback in dependency array
useCallback(() => {
  callbackProp();
}, [callbackProp]); // Re-created every parent render

// ✅ GOOD: Stable Callback Pattern with refs
const callbackRef = useRef(callbackProp);
useEffect(() => {
  callbackRef.current = callbackProp;
}, [callbackProp]);

useCallback(() => {
  callbackRef.current(); // Always calls latest
}, []); // Never re-created
```
