# Real Debugging Examples 🕵️‍♂️

Let's walk through actual debugging scenarios step-by-step, showing exactly what you'll see and what to do.

## Example 1: "The Play Button Doesn't Work!"

### What the user reports:
> "I clicked play on the drums but nothing happens!"

### Step 1: Open the Audio Debug Panel

Set in `.env.local`:
```
NEXT_PUBLIC_DEBUG_AUDIO=true
```

Restart and look at bottom-right corner:

```
🎵 Audio Debug (0)     ▲
```

### Step 2: Click the Play Button

After clicking, you see:
```
🎵 Audio Debug (3)     ▼

[15:23:45] DrummerWidget → play
ID: a1b2c3d4...
{ pattern: "basic-beat", tempo: 120 }

[15:23:45] UnifiedTransport → start
ID: a1b2c3d4...
{ bpm: 120, timeSignature: "4/4" }

[15:23:45] AudioEngine → error
ID: a1b2c3d4...
{ error: "AudioContext is suspended" }
```

### Step 3: Found the Problem!

The error tells us: `AudioContext is suspended`

This means the browser blocked audio because there was no user interaction first.

### Step 4: Check the Code

```typescript
// ❌ BAD: Trying to play audio on page load
useEffect(() => {
  audioContext.resume(); // This won't work!
  playDrums();
}, []);

// ✅ GOOD: Wait for user interaction
const handlePlayClick = async () => {
  await audioContext.resume(); // Now it works!
  playDrums();
};
```

### Step 5: Verify the Fix

After fixing, click play again:
```
[15:25:12] DrummerWidget → play
[15:25:12] UnifiedTransport → start
[15:25:12] AudioEngine → resumed
[15:25:12] DrumSampler → triggerAttack
[15:25:12] AudioEngine → soundPlayed ✅
```

Success! 🎉

---

## Example 2: "The Page is Frozen!"

### What the user reports:
> "When I go to the exercise page, everything freezes and I can't click anything!"

### Step 1: Open Browser Console

You see:
```
Warning: Maximum update depth exceeded. This can happen when a 
component calls setState inside useEffect, but useEffect either 
doesn't have a dependency array, or one of the dependencies 
changes on every render.
```

### Step 2: Find the Component

The error shows:
```
at ExerciseSelector (exercise-selector.tsx:45)
at FretboardCard (fretboard-card.tsx:123)
```

### Step 3: Check exercise-selector.tsx:45

```typescript
// ❌ THE PROBLEM CODE:
useEffect(() => {
  setSelectedExercise(exercises[0]); // This runs forever!
}); // 😱 No dependency array!
```

### Step 4: Add Correlation Logging

```typescript
const { logger } = useCorrelation('ExerciseSelector');

useEffect(() => {
  logger.info('Effect running', { 
    exerciseCount: exercises.length 
  });
  setSelectedExercise(exercises[0]);
}); // Still no array - let's see how often it runs
```

Console shows:
```
Effect running { exerciseCount: 5 } // 1000+ times per second!
```

### Step 5: Fix It

```typescript
// ✅ FIXED:
useEffect(() => {
  logger.info('Setting initial exercise');
  if (exercises.length > 0 && !selectedExercise) {
    setSelectedExercise(exercises[0]);
  }
}, [exercises]); // Proper dependencies!
```

Now it only runs when exercises change! 🎉

---

## Example 3: "API Calls Fail Randomly!"

### What the user reports:
> "Sometimes saving works, sometimes it doesn't. No pattern!"

### Step 1: Check Health Indicator

Bottom-left shows: 🟡 (Yellow - degraded)

Click it for details:
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "healthy", "responseTime": 45 },
    "api": { "status": "healthy" },
    "supabase": { "status": "healthy", "responseTime": 890 }
  }
}
```

Supabase is slow (890ms)!

### Step 2: Add Correlation Tracking

```typescript
const { correlationId, logger } = useCorrelation('SaveButton');

const handleSave = async () => {
  logger.info('Save started', { correlationId });
  
  try {
    const result = await apiClient.post('/api/exercises/save', 
      exerciseData, 
      { correlationId }
    );
    logger.info('Save succeeded', { correlationId });
  } catch (error) {
    logger.error('Save failed', error, { correlationId });
  }
};
```

### Step 3: Capture a Failure

When it fails, console shows:
```
ERROR: Save failed { 
  correlationId: "xyz-789-abc",
  error: "Network timeout" 
}
```

### Step 4: Trace Backend Logs

```bash
grep "xyz-789-abc" logs/backend-out.log
```

Results:
```
[15:45:23] INFO: Incoming request { correlationId: "xyz-789-abc", url: "/api/exercises/save" }
[15:45:23] INFO: Saving exercise { correlationId: "xyz-789-abc", exerciseId: "123" }
[15:45:33] ERROR: Supabase timeout { correlationId: "xyz-789-abc", duration: 10000 }
```

It took 10 seconds and timed out!

### Step 5: Add Retry Logic

```typescript
const saveWithRetry = async (data: any, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      logger.info(`Save attempt ${i + 1}`, { correlationId });
      return await apiClient.post('/api/exercises/save', data, {
        correlationId,
        timeout: 15000 // Increase timeout
      });
    } catch (error) {
      if (i === retries - 1) throw error;
      logger.warn(`Save failed, retrying...`, { attempt: i + 1 });
      await new Promise(r => setTimeout(r, 1000)); // Wait 1s
    }
  }
};
```

Now it retries and usually succeeds! 🎉

---

## Example 4: "Memory Leak - App Gets Slower Over Time"

### What the user reports:
> "The app is fast at first, but after 5 minutes it's really sluggish"

### Step 1: Check Memory Usage

Open browser console:
```javascript
console.log(performance.memory);
// {
//   usedJSHeapSize: 245000000,  // 245 MB!
//   totalJSHeapSize: 270000000,
//   jsHeapSizeLimit: 4294705152
// }
```

That's too high for our app!

### Step 2: Profile Memory

1. Open Chrome DevTools → Memory tab
2. Take heap snapshot
3. Use the app for 1 minute
4. Take another snapshot
5. Compare snapshots

You see:
```
AudioBuffer: 1,234 instances (+1,200)
Detached DOM nodes: 567 (+550)
```

### Step 3: Find the Leak

Add debug logging:
```typescript
const { logger } = useCorrelation('AudioBufferDebug');

// In your audio loading code
let bufferCount = 0;

function loadAudioBuffer(url: string) {
  bufferCount++;
  logger.warn('Loading buffer', { 
    url, 
    totalBuffers: bufferCount 
  });
  
  // Original code...
}
```

Console shows:
```
Loading buffer { url: "kick.mp3", totalBuffers: 1 }
Loading buffer { url: "kick.mp3", totalBuffers: 2 }
Loading buffer { url: "kick.mp3", totalBuffers: 3 }
... (same file loading repeatedly!)
```

### Step 4: Find Where It's Called

```typescript
// ❌ THE PROBLEM:
useEffect(() => {
  loadDrumSamples(); // This loads every render!
}, [currentPattern]); // Changes often!
```

### Step 5: Fix with Caching

```typescript
// ✅ SOLUTION:
const audioBufferCache = new Map();

async function loadAudioBuffer(url: string) {
  // Check cache first
  if (audioBufferCache.has(url)) {
    logger.info('Using cached buffer', { url });
    return audioBufferCache.get(url);
  }
  
  logger.info('Loading new buffer', { url });
  const buffer = await fetchAndDecode(url);
  audioBufferCache.set(url, buffer);
  return buffer;
}

// Also fix the effect
useEffect(() => {
  loadDrumSamples();
}, []); // Only load once!
```

Memory usage stays flat now! 🎉

---

## Example 5: "Works on My Machine, Not in Production!"

### What happens:
> Local: ✅ Everything works
> Production: ❌ Audio widgets don't load

### Step 1: Compare Environments

Add debug logging:
```typescript
logger.info('Environment check', {
  env: process.env.NODE_ENV,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  audioDebug: process.env.NEXT_PUBLIC_DEBUG_AUDIO,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
});
```

Local shows:
```
Environment check {
  env: "development",
  apiUrl: "http://localhost:3000",
  audioDebug: "true",
  supabaseUrl: "https://xxx.supabase.co"
}
```

Production shows:
```
Environment check {
  env: "production",
  apiUrl: undefined,  // 🚨 Missing!
  audioDebug: undefined,
  supabaseUrl: undefined  // 🚨 Missing!
}
```

### Step 2: Check Build Logs

```bash
Warning: NEXT_PUBLIC_API_URL is not defined
Warning: NEXT_PUBLIC_SUPABASE_URL is not defined
```

### Step 3: Fix Production Environment

In your deployment platform (Vercel, etc.):
```
NEXT_PUBLIC_API_URL=https://api.bassnotion.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Step 4: Verify After Deploy

```typescript
// Add a health check on app load
if (typeof window !== 'undefined') {
  console.log('BassNotion Environment:', {
    api: process.env.NEXT_PUBLIC_API_URL ? '✅' : '❌',
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌',
    version: process.env.NEXT_PUBLIC_VERSION || 'unknown'
  });
}
```

Now production shows:
```
BassNotion Environment: {
  api: '✅',
  supabase: '✅',
  version: '1.0.0'
}
```

Success! 🎉

---

## Pro Tips from These Examples

1. **Always get a correlation ID first** - It's your investigation ID
2. **Read error messages carefully** - They usually tell you exactly what's wrong
3. **Check one thing at a time** - Don't change multiple things
4. **Log before and after** - Know where things break
5. **Compare working vs broken** - What's different?
6. **Use the tools** - Health check, debug panel, correlation IDs
7. **Follow the breadcrumbs** - Logs tell a story

Remember: Every bug is solvable. You just need to find the right clue! 🔍