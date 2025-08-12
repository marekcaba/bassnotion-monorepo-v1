# Widget Tone Instance Fix

## Problem
Widgets were not producing audio because they were checking a stale Tone.Transport reference. The logs showed:
- `Transport?.state: 'stopped'` even after Transport was started
- Widgets waiting forever for Transport to start
- Transport was actually running (emitting beats/bars) but widgets couldn't see it

## Root Cause
The widgets were using a closure-captured `Tone` reference from when the component first rendered:
```typescript
const Tone = audioReady ? getTone() : null;  // Captured once
const Transport = Tone?.Transport;            // Stale reference

// Later in loop callback:
if (Tone.Transport.state === 'started') {     // Checking stale reference!
```

## Solution
Make widgets get a fresh Tone reference each time they need to check Transport state:

### 1. In HarmonyWidget Loop Callback (line 1139-1143):
```typescript
// CRITICAL FIX: Always get fresh Tone reference from getTone()
const currentTone = getTone();
const actualTransport = currentTone?.Transport;
const transportState = actualTransport?.state || 'stopped';
```

### 2. In Transport Start Polling (line 1349-1351):
```typescript
// Get fresh Tone reference each time
const currentTone = getTone();
const currentTransportState = currentTone?.Transport?.state || 'stopped';
```

### 3. In Initial State Check (line 1327-1330):
```typescript
// Get fresh Tone reference to ensure we have the correct Transport
const currentTone = getTone();
const transportState = currentTone?.Transport?.state || 'stopped';
const transportPosition = currentTone?.Transport?.position || '0:0:0';
```

## Why This Works
- `getTone()` returns the current Tone instance from AudioEngine
- This ensures widgets are checking the same Transport instance that TransportController is using
- No more stale references from closures

## Testing
1. Refresh the test-transport page
2. Click Play button
3. Widgets should now see Transport state as 'started'
4. Widgets will start their loops and produce audio

## Status
✅ HarmonyWidget fixed to use fresh Tone references
⏳ DrummerWidget and MetronomeWidget may need similar fixes if they still don't work