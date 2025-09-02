# BassNotion Developer Guide 🎸

Welcome to BassNotion! This guide will help you understand how to work with our platform. We'll explain everything like you're learning it for the first time.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding Our Tools](#understanding-our-tools)
3. [How to Debug Issues](#how-to-debug-issues)
4. [Working with Audio](#working-with-audio)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Day Setup

```bash
# 1. Clone the repository
git clone [repository-url]
cd bassnotion-monorepo-v1

# 2. Install dependencies (MUST use pnpm!)
pnpm install

# 3. Copy environment variables
cp .env.example .env.local  # Frontend
cp .env.example .env        # Backend

# 4. Start the development servers
pm2 start ecosystem.config.cjs

# 5. Check if everything is running
pm2 status
```

### Understanding the Project Structure

```
bassnotion-monorepo-v1/
├── apps/
│   ├── frontend/        # Next.js app (runs on port 3001)
│   ├── backend/         # NestJS API (runs on port 3000)
│   └── frontend-e2e/    # End-to-end tests
├── libs/
│   └── contracts/       # Shared types between frontend and backend
├── docs/               # Documentation (you are here!)
└── scripts/            # Utility scripts
```

---

## Understanding Our Tools

### 1. Correlation IDs - The Detective Badge 🔍

**What is it?**
Think of a Correlation ID like a detective badge number. When a user clicks a button, we give that action a unique badge number. As this action travels through our system (frontend → API → database), it keeps the same badge number.

**Why do we need it?**
Imagine you're trying to find out why Sarah's audio didn't play. Without correlation IDs, you'd see thousands of logs from all users mixed together. With correlation IDs, you can filter by Sarah's specific action and see exactly what happened!

**How to use it:**

```typescript
// In a React component
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function PlayButton() {
  // Get a correlation ID and logger for this component
  const { correlationId, logger } = useCorrelation('PlayButton');
  
  const handleClick = async () => {
    // Log what's happening with the correlation ID
    logger.info('User clicked play button', { songId: '123' });
    
    try {
      // Pass the correlation ID to API calls
      const response = await apiClient.post('/api/play', 
        { songId: '123' }, 
        { correlationId }
      );
      
      logger.info('Play request successful', { response });
    } catch (error) {
      logger.error('Play request failed', error);
    }
  };
  
  return <button onClick={handleClick}>Play</button>;
}
```

**Finding logs with correlation ID:**

1. User reports: "The play button didn't work at 3:45 PM"
2. Check browser console for the correlation ID (it's in every log)
3. Search backend logs: `grep "correlation-id-here" logs/backend-out.log`
4. You'll see the complete journey of that click!

### 2. Structured Logging - Writing Clear Notes 📝

**What is it?**
Instead of writing logs like diary entries ("Something went wrong!"), we write them in a structured format that computers can search through easily.

**Bad logging (hard to search):**
```typescript
console.log('User 123 clicked play for song 456 at 3:45 PM');
```

**Good logging (easy to search):**
```typescript
logger.info('User clicked play', {
  userId: '123',
  songId: '456',
  timestamp: '2025-08-30T15:45:00Z'
});
```

**Why it matters:**
- You can search for all play clicks: `action: "User clicked play"`
- You can find all actions by user 123: `userId: "123"`
- You can see what happened at a specific time

### 3. Health Checks - The System Doctor 🏥

**What is it?**
Like a doctor checking your pulse and temperature, health checks tell us if our system is working properly.

**What we check:**
- ✅ Database: Can we read/write data?
- ✅ API: Is the backend responding?
- ✅ Supabase: Can we fetch audio files?

**How to check health:**
1. Look at the bottom-left corner of the app
2. Green dot = Everything is working
3. Yellow dot = Something is slow but working
4. Red dot = Something is broken

**Manual health check:**
```bash
# Check backend health
curl http://localhost:3000/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-08-30T12:00:00Z",
  "checks": {
    "database": { "status": "healthy", "responseTime": 15 },
    "api": { "status": "healthy" },
    "supabase": { "status": "healthy", "responseTime": 45 }
  }
}
```

### 4. Audio Debug Panel - See What's Playing 🎵

**What is it?**
A special panel that shows you everything happening with audio in real-time. It's like having X-ray vision for sound!

**How to enable it:**
```bash
# In your .env.local file
NEXT_PUBLIC_DEBUG_AUDIO=true
```

**How to use it:**
1. Look at bottom-right corner
2. Click "Audio Debug" to expand
3. Watch events appear as you interact with audio
4. Filter events by typing in the search box

**What you'll see:**
```
[12:34:56] UnifiedTransport → start
  { bpm: 120, timeSignature: "4/4" }

[12:34:57] DrummerWidget → schedulePattern
  { pattern: "kick-snare", bar: 1 }

[12:34:58] AudioEngine → bufferLoaded
  { sample: "kick.mp3", duration: 0.5 }
```

---

## How to Debug Issues

### Scenario 1: "The drums don't play!"

**Step 1: Check the health indicator**
- Is it green? System is healthy, problem is in the code
- Is it red? Check which service is down

**Step 2: Open Audio Debug Panel**
- Click play on the drums
- Do you see "DrummerWidget → play" event?
- If not, the click handler might be broken
- If yes, check for error events

**Step 3: Check browser console**
- Look for red errors
- Find the correlation ID in the error
- Search logs with that ID

**Step 4: Use structured logs**
```typescript
// Add debug logging to the drum component
const { logger } = useCorrelation('DrumDebug');

logger.info('Drum state', {
  isLoaded: drumSampler.loaded,
  pattern: currentPattern,
  tempo: tempo
});
```

### Scenario 2: "The page is frozen!"

**Common causes and solutions:**

1. **Infinite re-renders**
```typescript
// ❌ BAD: This causes infinite loop
useEffect(() => {
  setCount(count + 1);  // Updates state on every render
});

// ✅ GOOD: Only runs once
useEffect(() => {
  setCount(count + 1);
}, []); // Empty dependency array
```

2. **Unmemoized callbacks**
```typescript
// ❌ BAD: Creates new function every render
<ExpensiveComponent onUpdate={() => console.log('updated')} />

// ✅ GOOD: Same function reference
const handleUpdate = useCallback(() => {
  console.log('updated');
}, []);
<ExpensiveComponent onUpdate={handleUpdate} />
```

---

## Working with Audio

### The Audio Flow Pipeline

```
User Click → Widget → Transport → Audio Engine → Speakers
     ↓          ↓          ↓            ↓            ↓
   [Log]      [Log]      [Log]        [Log]     [Success!]
```

### Key Services Explained

**1. UnifiedTransport**
- The master clock (like a conductor)
- Keeps everything in sync
- Handles play/pause/stop

**2. AudioEngine**
- Loads and plays actual sounds
- Manages volume and effects
- Handles Web Audio API

**3. Widgets (Drummer, Bass, etc.)**
- User interface components
- Send commands to Transport
- Display visual feedback

### Common Audio Tasks

**Loading a sample:**
```typescript
import { logAudioEvent } from '@/shared/debug/AudioDebugger';

async function loadDrumSample() {
  logAudioEvent('DrumLoader', 'loadStart', { sample: 'kick.mp3' });
  
  try {
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    logAudioEvent('DrumLoader', 'loadSuccess', { sample: 'kick.mp3' });
    return buffer;
  } catch (error) {
    logAudioEvent('DrumLoader', 'loadError', { 
      sample: 'kick.mp3', 
      error: error.message 
    });
    throw error;
  }
}
```

**Playing a sound:**
```typescript
function playDrum(drumType: string) {
  const { logger } = useCorrelation('DrumPlayer');
  
  logger.info('Playing drum', { drumType, time: Tone.now() });
  
  // Schedule the drum hit
  drumSampler.triggerAttackRelease(drumType, '8n');
}
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create the endpoint in backend:**
```typescript
// apps/backend/src/domains/exercises/exercises.controller.ts
@Get('my-new-endpoint')
async getMyData(@Request() req) {
  // The correlation ID is automatically added by middleware
  req.logger.info('Fetching my data');
  
  return {
    data: 'Hello!',
    correlationId: req.correlationId
  };
}
```

2. **Call it from frontend:**
```typescript
const { correlationId } = useCorrelation('MyComponent');
const data = await apiClient.get('/api/exercises/my-new-endpoint', { 
  correlationId 
});
```

### Adding Debug Logging to a Component

```typescript
import { useAudioDebug } from '@/shared/debug/AudioDebugger';

export function MyMusicComponent() {
  const debug = useAudioDebug('MyMusicComponent');
  
  const playSomething = () => {
    // Log the action
    debug.log('play started', { note: 'C4', velocity: 0.8 });
    
    // Your actual code here
    synthesizer.triggerAttack('C4');
    
    // Log success
    debug.log('play completed');
  };
}
```

### Finding Performance Issues

1. **Check the Audio Debug Panel**
   - Look for events firing too frequently
   - Check for events that take too long

2. **Use browser Performance tab**
   - Start recording
   - Perform the slow action
   - Look for long tasks (>50ms)

3. **Add timing logs**
```typescript
const startTime = performance.now();

// Do something expensive
await expensiveOperation();

const duration = performance.now() - startTime;
logger.warn('Expensive operation took too long', { duration });
```

---

## Troubleshooting

### "I can't see the debug panels!"

1. Check your `.env.local`:
```bash
NEXT_PUBLIC_DEBUG_AUDIO=true
```

2. Restart the frontend:
```bash
pm2 restart bassnotion-frontend
```

3. Hard refresh the browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### "The logs are too noisy!"

Use the filter in Audio Debug Panel or grep in terminal:
```bash
# Find only DrummerWidget logs
grep "DrummerWidget" logs/frontend-out.log

# Find logs for specific correlation ID
grep "abc-123-def" logs/backend-out.log

# Find only errors
grep "ERROR" logs/backend-out.log
```

### "I don't understand an error!"

1. Copy the correlation ID from the error
2. Search in both frontend and backend logs
3. The first log with that ID shows where it started
4. The last log shows where it failed
5. Everything in between shows the journey

### "The system feels slow!"

1. Check health indicator - is anything yellow/red?
2. Open Network tab - are API calls taking long?
3. Check Audio Debug Panel - are events delayed?
4. Look for memory leaks:
```typescript
// In browser console
performance.memory
```

---

## Best Practices Checklist

Before committing code, check:

- [ ] Added correlation IDs to new API calls
- [ ] Used structured logging (not console.log)
- [ ] Added debug events for audio operations
- [ ] Wrapped page components in fragments `<>...</>`
- [ ] Memoized callbacks passed as props
- [ ] Added proper error handling with logging
- [ ] Tested with debug mode enabled
- [ ] No infinite loops in useEffect

---

## Quick Reference

### Environment Variables
```bash
# Enable debug mode
NEXT_PUBLIC_DEBUG_AUDIO=true

# API URL (for local development)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### PM2 Commands
```bash
pm2 status                      # Check what's running
pm2 logs bassnotion-frontend    # View frontend logs
pm2 logs bassnotion-backend     # View backend logs
pm2 restart all                 # Restart everything
pm2 stop all                    # Stop everything
```

### Debug Shortcuts
- Health Check: Look bottom-left
- Audio Debug: Look bottom-right
- Correlation ID: Check any log entry
- Performance: Open browser DevTools → Performance tab

---

## Getting Help

1. **Check the logs first** - they usually tell you what's wrong
2. **Use correlation IDs** - they help you trace issues
3. **Enable debug mode** - see what's really happening
4. **Read error messages** - they often suggest solutions
5. **Ask for help** - include correlation IDs and screenshots!

Remember: Every problem leaves clues in the logs. Follow the correlation IDs like breadcrumbs, and you'll find the issue! 🕵️‍♂️

---

*Last updated: August 30, 2025*