# Browser Testing Guide - Sample Preloading

This guide will help you manually verify that the sample preloading fixes are working correctly in a real browser environment.

## Prerequisites

1. Start the frontend development server:
   ```bash
   pm2 restart bassnotion-frontend
   # OR if not running
   pm2 start ecosystem.config.cjs
   ```

2. Open Chrome DevTools (or your browser's developer tools)
3. Navigate to a tutorial page (e.g., `http://localhost:3001/library/complete-beginner-s-guide`)

## Test 1: Verify Samples Are Preloaded

### Steps:
1. **Open DevTools Console** before scrolling the page
2. **Clear the console** (to see fresh logs)
3. **Scroll the page** slightly (this triggers preloading)

### Expected Console Output:
```
[MetronomePreloadStrategy] Loading essential metronome samples...
[MetronomePreloadStrategy] 🎵 Preloading metronome samples: {...}
[MetronomePreloadStrategy] 📥 Fetching high click...
[MetronomePreloadStrategy] ✅ High click cached
[MetronomePreloadStrategy] 📥 Fetching low click...
[MetronomePreloadStrategy] ✅ Low click cached
[MetronomePreloadStrategy] ✅ Essential metronome samples preloaded and cached as AudioBuffers

[DrumPreloadStrategy] Loading essential drum samples...
[DrumPreloadStrategy] 📥 Loading essential drum samples: {count: 3, drums: [...]}
[DrumPreloadStrategy] 📥 Fetching kick...
[DrumPreloadStrategy] ✅ kick cached
[DrumPreloadStrategy] 📥 Fetching snare...
[DrumPreloadStrategy] ✅ snare cached
[DrumPreloadStrategy] 📥 Fetching hihat...
[DrumPreloadStrategy] ✅ hihat cached
[DrumPreloadStrategy] ✅ Essential drum samples preloaded as AudioBuffers
```

### What to Check:
- ✅ Both strategies complete successfully
- ✅ All samples show "cached" messages
- ✅ Total preload time < 2 seconds

## Test 2: Verify Network Requests

### Steps:
1. **Open DevTools → Network tab**
2. **Clear network log**
3. **Reload the page**
4. **Scroll the page** (triggers preloading)
5. **Wait for preloading to complete** (watch console)

### Expected Network Requests:
You should see **5 sample requests** during preloading:
1. `Click_High.mp3` (metronome)
2. `Click_Low.mp3` (metronome)
3. `kick-v1.wav` (drums)
4. `snare-v1.wav` (drums)
5. `hihat-v1.wav` (drums)

### What to Check:
- ✅ All 5 requests return **200 OK**
- ✅ Requests happen **during scroll**, not during playback
- ✅ Total size < 1MB (samples are small)
- ✅ All load in < 2 seconds

## Test 3: Verify Cache Is Used During Playback

### Steps:
1. **Scroll the page** (wait for preloading to complete)
2. **Clear the Network tab** (important!)
3. **Click the Play button** to start playback
4. **Watch the Console** for cache hit messages

### Expected Console Output During Playback:
```
[WamMetronome] 🎵 WamMetronomeNode: Using shared AudioContext...
[WamMetronome] ✅ Using preloaded metronome samples from cache!

[WamDrummer] ♻️ Using cached buffer for pad 1
[WamDrummer] ♻️ Using cached buffer for pad 3
[WamDrummer] ♻️ Using cached buffer for pad 5
```

### What to Check:
- ✅ Console shows "Using preloaded/cached" messages
- ✅ **Network tab shows 0 new audio requests** (this is the key test!)
- ✅ Metronome sounds immediately (no 9-second delay)
- ✅ Drums sound immediately (no 9-second delay)

## Test 4: Verify Immediate Playback (The Main Fix)

### Steps:
1. **Reload the page** (fresh start)
2. **Scroll to trigger preloading**
3. **Wait for "samples cached" messages** in console
4. **Click Play button**
5. **Measure the time** until you hear the first metronome click

### Expected Behavior:
- ⏱️ First metronome click heard within **< 500ms** of clicking play
- ⏱️ First drum hit heard within **< 500ms** of clicking play
- ✅ No visible delay or loading spinners
- ✅ Audio starts immediately and stays in sync

### BEFORE FIX (the problem):
- ❌ 9+ second delay before hearing any sound
- ❌ Playback runs but is silent for 9 seconds
- ❌ Network requests happening during playback

### AFTER FIX (expected now):
- ✅ Immediate audio playback
- ✅ No network requests during playback
- ✅ Samples preloaded and cached

## Test 5: Cache Persistence (Advanced)

### Steps:
1. **Complete Test 3** (preload and play once)
2. **Stop playback**
3. **DO NOT reload the page**
4. **Clear the Network tab**
5. **Click Play again**

### Expected Behavior:
- ✅ Still no network requests (cache persists in memory)
- ✅ Playback still immediate
- ✅ Console shows "Using cached buffer" messages

## Test 6: Verify Cache Keys (Debugging)

### Steps:
1. **After preloading completes**, run this in the console:

```javascript
// Check GlobalSampleCache
const cache = window.__globalSampleCache || GlobalSampleCache;

// Check metronome samples
console.log('Metronome High:', cache.getCachedBuffer('metronome-high'));
console.log('Metronome Low:', cache.getCachedBuffer('metronome-low'));

// Check drum samples
console.log('Drum Kick:', cache.getCachedBuffer('drum-kick'));
console.log('Drum Snare:', cache.getCachedBuffer('drum-snare'));
console.log('Drum Hihat:', cache.getCachedBuffer('drum-hihat'));

// Check alternate drum keys
console.log('Drum Pad 1:', cache.getCachedBuffer('drum-pad-1'));
console.log('Drum Pad 3:', cache.getCachedBuffer('drum-pad-3'));
console.log('Drum Pad 5:', cache.getCachedBuffer('drum-pad-5'));

// Get cache stats
console.log('Cache Stats:', cache.getStats());
```

### Expected Output:
```javascript
Metronome High: AudioBuffer {duration: 0.08, numberOfChannels: 2, ...}
Metronome Low: AudioBuffer {duration: 0.08, numberOfChannels: 2, ...}
Drum Kick: AudioBuffer {duration: 0.5, numberOfChannels: 2, ...}
Drum Snare: AudioBuffer {duration: 0.3, numberOfChannels: 2, ...}
Drum Hihat: AudioBuffer {duration: 0.2, numberOfChannels: 2, ...}
Drum Pad 1: AudioBuffer {duration: 0.5, numberOfChannels: 2, ...} (same as kick)
Drum Pad 3: AudioBuffer {duration: 0.3, numberOfChannels: 2, ...} (same as snare)
Drum Pad 5: AudioBuffer {duration: 0.2, numberOfChannels: 2, ...} (same as hihat)

Cache Stats: {
  samplesCount: 8,  // 5 unique samples, but drums cached with 2 keys each
  instrumentsCount: 0,
  totalSize: 500000  // approximate bytes
}
```

## Troubleshooting

### Problem: No console logs appear
**Solution:**
- Check that LOG_LEVEL is set to INFO or DEBUG in `.env.local`
- Try filtering console by "Preload" or "Metronome" or "Drum"

### Problem: "CORS error" in console
**Solution:**
- Verify Supabase URL is correct in `.env.local`
- Check that audio-samples bucket is public in Supabase

### Problem: "AudioContext was not allowed to start"
**Solution:**
- This is normal - ignore it
- AudioContext will start on first user interaction (clicking play)

### Problem: Samples not loading
**Solution:**
- Check Network tab for 404 errors
- Verify sample files exist in Supabase:
  - `audio-samples/metronome/Click_High.mp3`
  - `audio-samples/metronome/Click_Low.mp3`
  - `audio-samples/drums/hydrogen-kits/colombo-acoustic/kick-v1.wav`
  - `audio-samples/drums/hydrogen-kits/colombo-acoustic/snare-v1.wav`
  - `audio-samples/drums/hydrogen-kits/colombo-acoustic/hihat-v1.wav`

### Problem: Still hearing 9-second delay
**Solution:**
- Check if samples were actually preloaded (console should show "cached" messages)
- Verify Network tab shows NO requests during playback
- Check if you scrolled the page (preloading only triggers on scroll)
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

## Success Criteria

✅ **All tests pass if:**
1. Samples preload on scroll (< 2 seconds)
2. Console shows "cached" messages
3. Network shows 5 requests during preload, 0 during playback
4. Playback starts immediately (< 500ms)
5. No 9-second delay
6. Cache persists across play/stop cycles

## Performance Metrics to Record

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Preload Time | < 2 seconds | Time from scroll to "samples cached" message |
| Samples Downloaded | 5 files | Count in Network tab |
| Total Download Size | < 1 MB | Network tab summary |
| Playback Start Delay | < 500ms | Time from click to first sound |
| Cache Hit Rate | 100% | No network requests during 2nd+ playback |

## Reporting Issues

If any test fails, please report with:
1. Screenshot of Console (with errors)
2. Screenshot of Network tab (showing requests)
3. Browser and version
4. What test failed and how
5. Environment variables (without sensitive values)
