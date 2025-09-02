# CoreServices Preload Fix - Proper Loading Order

## Error
```
Error: CoreServices not found on window. Make sure AudioProvider is mounted.
```

## Cause
Trying to preload samples before CoreServices (which provides Tone.js) was available. The preloading started immediately on mount, but AudioProvider hadn't initialized CoreServices yet.

## Solution
Wait for CoreServices to be available before starting preload:

```javascript
// Wait for CoreServices to be available
let attempts = 0;
while (!(window as any).CoreServices && attempts < 50) {
  console.log('⏳ Waiting for CoreServices...', attempts);
  await new Promise(resolve => setTimeout(resolve, 100));
  attempts++;
}

if (!(window as any).CoreServices) {
  throw new Error('CoreServices not available after 5 seconds');
}

console.log('✅ CoreServices available, starting preload...');
```

## Loading Timeline

### T=0ms: Page Mount
- Component mounts
- Preload effect runs
- Starts waiting for CoreServices

### T=0-1000ms: Wait for CoreServices
- AudioProvider initializing
- CoreServices being created
- Preload waiting in loop

### T=~1000ms: CoreServices Ready
- CoreServices detected on window
- Preload begins
- ChordInstrumentProcessor created

### T=1000-6000ms: Sample Loading
- Loading 5 velocity layers
- Widget shows loading placeholder
- Samples downloading from Supabase

### T=~6000ms: Ready
- Samples loaded
- Widget renders
- Ready for playback

## Key Points
1. **Must wait for CoreServices** - It provides Tone.js instance
2. **Still preloads early** - Starts as soon as CoreServices available
3. **Widget still waits** - Shows loading until samples ready
4. **No duplicate loading** - Single load path

## Console Output
```
🎯 Waiting for CoreServices before preloading...
⏳ Waiting for CoreServices... 0
⏳ Waiting for CoreServices... 1
✅ CoreServices available, starting preload...
🎵 Preloading Salamander piano samples...
🎹 Loading Salamander Grand Piano for PIANO preset...
✅ All audio systems preloaded and ready!
```

## Dependencies
1. AudioProvider mounts → Creates CoreServices
2. CoreServices available → Can create Tone.js instances
3. Tone.js ready → Can load samples
4. Samples loaded → Widget can render