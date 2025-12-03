# Fix First Beat Stutter - The Real Solution

## Problem Analysis

### The Symptoms:
1. First beat stutters/repeats multiple times
2. Console shows multiple triggers at position 0:0:0
3. Transport.state shows "stopped" even after calling start()
4. AudioContext warnings (separate issue)

### The Real Root Cause:

The stutter is NOT caused by AudioContext initialization. It's caused by:

1. **Loops are created with `loop.start(0)`** which means "start immediately"
2. **Transport hasn't actually started moving** when loops begin firing
3. **Multiple loops fire callbacks at position 0:0:0** before Transport advances

From the logs:
```
🥁 Drummer Loop - Transport state: stopped Position: 0:0:0
🥁 Triggering kick at subdivision 0, velocity: 127
🥁 Triggering hihat at subdivision 0, velocity: 70
[This repeats 10+ times]
```

## Why Current Solutions Don't Work

### 1. Dynamic Imports (Won't Fix Stutter)
- Solves AudioContext warning
- Doesn't solve timing/synchronization issues
- Adds complexity without addressing root cause

### 2. setTimeout Delays (Band-aid)
```javascript
setTimeout(() => {
  loopRef.current.start(0);
}, 100);
```
- Works sometimes but is unreliable
- Delays playback start
- Doesn't guarantee Transport is running

### 3. Transport.start() with offset
```javascript
this.toneTransport.start('+0.1', 0);
```
- The offset doesn't help if loops are already running

## The Correct Solution

### Option 1: Schedule Loop Start with Transport Time (Recommended)

Instead of starting loops immediately, schedule them to start when Transport actually starts:

```javascript
// In widget effect when creating loop
loopRef.current = new Tone.Loop((time) => {
  // Loop callback
}, '8n');

// DON'T start immediately
// loopRef.current.start(0); ❌

// Instead, schedule it to start when Transport starts
if (Tone.Transport.state === 'started') {
  // Transport already running, start now
  loopRef.current.start();
} else {
  // Schedule to start when Transport starts
  Tone.Transport.once('start', () => {
    loopRef.current.start();
  });
}
```

### Option 2: Use Transport.scheduleOnce for First Beat

Prevent multiple firings by using Tone's scheduling:

```javascript
// In loop callback
if (currentBar === 0 && currentSubdivision === 0) {
  // Check if we've already scheduled this beat
  if (!this.firstBeatScheduled) {
    this.firstBeatScheduled = true;
    
    // Schedule the sound, don't trigger immediately
    Tone.Transport.scheduleOnce((time) => {
      // Trigger sounds here
      kick.triggerAttackRelease('C1', '8n', time);
    }, '0:0:0');
  }
}
```

### Option 3: Proper Widget Initialization Sequence

```javascript
class AudioWidget {
  private loop: Tone.Loop | null = null;
  private isInitialized = false;
  
  async initialize() {
    // 1. Create loop but DON'T start it
    this.loop = new Tone.Loop(callback, '8n');
    this.isInitialized = true;
  }
  
  async startPlayback() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // 2. Start loop only when playback starts
    if (this.loop) {
      // Start at next transport position to avoid double-trigger
      this.loop.start('@1m');
    }
  }
}
```

### Option 4: Fix in CorePlaybackEngine

Update CorePlaybackEngine to ensure loops don't start until Transport is actually running:

```javascript
public async play(): Promise<void> {
  // ... existing code ...
  
  // Start transport
  this.toneTransport.start();
  
  // Wait for transport to actually start
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      if (this.toneTransport.state === 'started') {
        clearInterval(checkInterval);
        resolve();
      }
    }, 10);
  });
  
  // Now emit event to start widgets
  this.emit('playbackStateChanged', { state: 'playing', source: 'engine' });
}
```

## Implementation Priority

1. **Fix Transport state detection** (Option 4)
   - Ensures Transport is actually running before widgets start
   - Centralized solution

2. **Update widget loop creation** (Option 1)
   - Use Transport events instead of immediate start
   - More reliable than setTimeout

3. **Add safeguards in loop callbacks** (Option 2)
   - Prevent multiple triggers at position 0:0:0
   - Defense in depth

## Testing the Fix

1. Open dev console
2. Click play
3. Should see:
   - Transport state: "started" (not "stopped")
   - Each sound triggers ONCE at position 0:0:0
   - No repeated log messages

## Summary

The first beat stutter is caused by loops starting before Transport is running, not by AudioContext initialization. The solution is proper synchronization between Transport state and loop execution, not dynamic imports.