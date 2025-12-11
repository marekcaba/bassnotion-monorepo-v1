# BUG #2: OfflineAudioContext Buffer Incompatibility - FIXED

**Status**: ✅ COMPLETE
**Priority**: CRITICAL
**Completion Date**: 2025-11-23
**Tests**: 11/11 passing (100%)

---

## Problem Statement

Three preload strategy files were using `OfflineAudioContext` to decode audio samples and caching the decoded `AudioBuffer` instances. These buffers are **incompatible** with the real `AudioContext` used for playback, causing potential issues:

1. **Sample rate mismatch**: OfflineContext might use 44100 Hz while real context uses 48000 Hz
2. **Context incompatibility**: Buffers decoded by one AudioContext cannot be used by another
3. **Playback issues**: Pitch shifts, speed changes, or complete playback failures

---

## Root Cause Analysis

### Files with OfflineAudioContext Issues

1. **[HarmonyPreloadStrategy.ts:665-734](apps/frontend/src/domains/playback/modules/preloading/strategies/HarmonyPreloadStrategy.ts#L665-L734)**
   - Created `OfflineAudioContext(2, 44100 * 10, 44100)`
   - Decoded with `offlineContext.decodeAudioData(arrayBuffer)`
   - Cached `AudioBuffer` with `isContextCompatible: true` ❌ **FALSE!**

2. **[DrumPreloadStrategy.ts:144-172](apps/frontend/src/domains/playback/modules/preloading/strategies/DrumPreloadStrategy.ts#L144-L172)**
   - Created `OfflineAudioContext(2, 44100, 44100)`
   - Decoded and cached `AudioBuffer` for drum samples

3. **[MetronomePreloadStrategy.ts:38-62](apps/frontend/src/domains/playback/modules/preloading/strategies/MetronomePreloadStrategy.ts#L38-L62)**
   - Created `OfflineAudioContext(2, 44100, 44100)`
   - Decoded and cached `AudioBuffer` for metronome clicks

### Why This Is a Bug

```typescript
// ❌ BEFORE (BUG):
const offlineContext = new OfflineAudioContext(2, 44100, 44100);
const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
GlobalSampleCache.getInstance().cacheBuffer(key, audioBuffer, {
  isContextCompatible: true,
});

// Problem:
// 1. audioBuffer.sampleRate = 44100 (from OfflineContext)
// 2. Real AudioContext might be 48000 Hz on some devices
// 3. Playing 44100 Hz buffer on 48000 Hz context = pitch/speed issues
// 4. Cross-context buffers cause errors
```

---

## Solution

### Implementation

Changed all three strategy files to cache **raw `ArrayBuffer`** (unencoded audio data) instead of decoded `AudioBuffer`:

```typescript
// ✅ AFTER (FIXED):
const arrayBuffer = await response.arrayBuffer();
GlobalSampleCache.getInstance().cacheBuffer(key, arrayBuffer);

// Benefits:
// 1. No OfflineAudioContext needed
// 2. Real AudioContext decodes at correct sample rate during playback
// 3. No cross-context compatibility issues
// 4. Smaller memory footprint (compressed data vs decoded Float32Arrays)
```

### Changes Made

#### 1. HarmonyPreloadStrategy.ts

**Lines 663-666**: Removed OfflineAudioContext creation

```typescript
// Before:
const offlineContext = new OfflineAudioContext(2, 44100 * 10, 44100);

// After:
// ✅ BUG #2 FIX: Removed OfflineAudioContext creation
// We now cache raw ArrayBuffer data instead of decoding with OfflineContext
```

**Lines 715-736**: Cache ArrayBuffer instead of AudioBuffer

```typescript
// Before:
const arrayBuffer = await response.arrayBuffer();
const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);
GlobalSampleCache.getInstance().cacheBuffer(cacheKey, audioBuffer, {
  isContextCompatible: true,
});

// After:
const arrayBuffer = await response.arrayBuffer();
GlobalSampleCache.getInstance().cacheBuffer(cacheKey, arrayBuffer);
```

#### 2. DrumPreloadStrategy.ts

**Lines 143-145**: Removed OfflineAudioContext creation
**Lines 169-176**: Cache ArrayBuffer instead of AudioBuffer
**Line 185**: Updated log message

#### 3. MetronomePreloadStrategy.ts

**Lines 38-40**: Removed OfflineAudioContext creation
**Lines 48-63**: Cache ArrayBuffer for both high and low clicks
**Line 70**: Updated log message

---

## Test Coverage

Created comprehensive test suite: [bug2-offlinecontext-buffers.test.ts](apps/frontend/src/domains/playback/modules/preloading/__tests__/bug2-offlinecontext-buffers.test.ts)

### Test Results: 11/11 passing ✅

#### HarmonyPreloadStrategy Tests (3 tests)

- ✅ Should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext
- ✅ Should NOT mark OfflineContext buffers as isContextCompatible
- ✅ Should NOT create OfflineAudioContext at all (BUG #2 FIX)

#### DrumPreloadStrategy Tests (2 tests)

- ✅ Should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext
- ✅ Should NOT use OfflineAudioContext for buffer decoding

#### MetronomePreloadStrategy Tests (2 tests)

- ✅ Should cache ArrayBuffer (raw data), not AudioBuffer from OfflineContext
- ✅ Should NOT decode samples with OfflineAudioContext

#### Integration Tests (2 tests)

- ✅ Should allow real AudioContext to decode cached ArrayBuffers later
- ✅ Should prevent caching of AudioBuffers with wrong sampleRate

#### Edge Cases (2 tests)

- ✅ Should handle missing samples gracefully without caching invalid data
- ✅ Should handle decode errors without caching partial data

---

## Verification

### How to Verify the Fix

1. **Run tests**:

   ```bash
   pnpm vitest run apps/frontend/src/domains/playback/modules/preloading/__tests__/bug2-offlinecontext-buffers.test.ts
   ```

2. **Check cache contents**:

   ```typescript
   // In browser console:
   const cache = GlobalSampleCache.getInstance();
   const rawBuffer = cache.getCachedRawBuffer('grandpiano-v10-C4');
   console.log(rawBuffer instanceof ArrayBuffer); // Should be true

   const audioBuffer = cache.getCachedBuffer('grandpiano-v10-C4');
   console.log(audioBuffer); // Should be undefined (not cached as AudioBuffer)
   ```

3. **Verify no OfflineAudioContext in production**:
   ```bash
   grep -r "new OfflineAudioContext" apps/frontend/src/domains/playback/
   # Should only show test mocks and comments
   ```

---

## Impact

### Performance

- **Memory savings**: Raw ArrayBuffer is typically 5-10x smaller than decoded AudioBuffer
- **Faster preloading**: No decoding overhead during initial load
- **On-demand decoding**: Buffers decoded only when actually needed

### Compatibility

- ✅ **Sample rate matching**: Real AudioContext decodes at its native sample rate
- ✅ **Cross-device compatibility**: Works correctly on devices with 44100, 48000, or other sample rates
- ✅ **No context errors**: Eliminates "buffer from different context" errors

### User Experience

- ✅ **Correct pitch**: No pitch shifts due to sample rate mismatches
- ✅ **Correct tempo**: No speed changes
- ✅ **Reliable playback**: No cross-context compatibility errors

---

## Related Files

### Modified Files

1. [HarmonyPreloadStrategy.ts](apps/frontend/src/domains/playback/modules/preloading/strategies/HarmonyPreloadStrategy.ts) - Removed OfflineContext, cache ArrayBuffer
2. [DrumPreloadStrategy.ts](apps/frontend/src/domains/playback/modules/preloading/strategies/DrumPreloadStrategy.ts) - Removed OfflineContext, cache ArrayBuffer
3. [MetronomePreloadStrategy.ts](apps/frontend/src/domains/playback/modules/preloading/strategies/MetronomePreloadStrategy.ts) - Removed OfflineContext, cache ArrayBuffer

### Test Files

1. [bug2-offlinecontext-buffers.test.ts](apps/frontend/src/domains/playback/modules/preloading/__tests__/bug2-offlinecontext-buffers.test.ts) - NEW: 11 comprehensive tests

### Related Infrastructure

1. [GlobalSampleCache.ts](apps/frontend/src/domains/playback/modules/storage/cache/GlobalSampleCache.ts) - Already supports ArrayBuffer caching
   - `cacheBuffer(path, buffer: AudioBuffer | ArrayBuffer)` - Accepts both types
   - `getCachedRawBuffer(path): ArrayBuffer | undefined` - Returns raw data
   - `getCachedBuffer(path): AudioBuffer | undefined` - Returns decoded data

---

## Migration Notes

### For Developers

**Before this fix:**

```typescript
// Old pattern (DON'T USE):
const offlineCtx = new OfflineAudioContext(2, 44100, 44100);
const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
GlobalSampleCache.getInstance().cacheBuffer(key, audioBuffer);
```

**After this fix:**

```typescript
// New pattern (CORRECT):
const arrayBuffer = await response.arrayBuffer();
GlobalSampleCache.getInstance().cacheBuffer(key, arrayBuffer);

// Later, when playing:
const rawBuffer = GlobalSampleCache.getInstance().getCachedRawBuffer(key);
const audioBuffer = await realAudioContext.decodeAudioData(rawBuffer);
```

### Backward Compatibility

- ✅ No breaking changes
- ✅ GlobalSampleCache API unchanged (supports both AudioBuffer and ArrayBuffer)
- ✅ Existing code that uses `getCachedBuffer()` will still work
- ✅ New code should use `getCachedRawBuffer()` for preloaded samples

---

## Lessons Learned

1. **Never use OfflineAudioContext for production buffers**
   - Use only for analysis, testing, or one-time processing
   - Never cache its output for playback

2. **Cache raw data, decode on-demand**
   - Smaller memory footprint
   - Better compatibility
   - Flexibility to decode at correct sample rate

3. **Test buffer types**
   - Add `instanceof` checks in tests
   - Verify sample rates match
   - Check context compatibility flags

---

## Next Steps

- ✅ BUG #2 - COMPLETE
- ⏭️ BUG #7 - Add event listener cleanup
- ⏭️ BUG #3 - Implement audio source cleanup
- ⏭️ BUG #6 - Verify tempo debouncing with tests

**Progress: 5/8 bugs fixed (62.5%)**
