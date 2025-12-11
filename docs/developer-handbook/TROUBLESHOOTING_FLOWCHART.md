# BassNotion Troubleshooting Flowchart 🔧

## Start Here ↓

```
Is the app completely broken?
├─ YES → Go to [Emergency Recovery](#emergency-recovery)
└─ NO → Continue ↓

What's the problem?
├─ Audio not playing → Go to [Audio Issues](#audio-issues)
├─ Page frozen/slow → Go to [Performance Issues](#performance-issues)
├─ API errors → Go to [API Issues](#api-issues)
├─ Can't find bug → Go to [Mystery Bugs](#mystery-bugs)
└─ Something else → Go to [General Debugging](#general-debugging)
```

---

## Audio Issues 🎵

```
Can you see the Audio Debug Panel?
├─ NO → Set NEXT_PUBLIC_DEBUG_AUDIO=true in .env.local
│       → pm2 restart bassnotion-frontend
│       → Hard refresh browser (Cmd+Shift+R)
└─ YES → Continue ↓

Click the audio trigger. Do you see events in the panel?
├─ NO → The click handler is broken
│       → Check console for errors
│       → Add console.log in onClick handler
└─ YES → Continue ↓

Do you see any red error events?
├─ YES → Read the error message
│       → Common: "AudioContext suspended"
│       → Fix: User must interact first
└─ NO → Continue ↓

Do you see "bufferLoaded" events?
├─ NO → Samples not loading
│       → Check Network tab for 404s
│       → Check Supabase storage
└─ YES → Continue ↓

Check browser console for errors
├─ "No AudioContext" → Audio not initialized
├─ "CORS error" → Supabase bucket not public
└─ Other → Copy error + correlation ID
```

### Quick Fixes for Audio:

1. **AudioContext Suspended**: Need user interaction first
2. **Samples not loading**: Check Network tab, might be 404
3. **No sound but no errors**: Check system volume 🔊

---

## Performance Issues 🐌

```
Is the page completely frozen?
├─ YES → Open browser console
│       → Look for "Maximum update depth exceeded"
│       → This means infinite re-render loop
│       → Go to [Fix Infinite Loops](#fix-infinite-loops)
└─ NO → Continue ↓

Is it slow all the time or sometimes?
├─ ALL THE TIME → Check initial load
│       → Open Network tab
│       → Refresh page
│       → What's taking long?
└─ SOMETIMES → Continue ↓

When does it get slow?
├─ After clicking something → Check that component
├─ After a while → Memory leak
└─ During audio playback → Too many audio events
```

### Fix Infinite Loops:

```typescript
// Find useEffect without dependencies
useEffect(() => {
  setSomething(x); // ❌ BAD
}); // Missing []

// Find setState in render
function Component() {
  setSomething(x); // ❌ BAD - causes re-render
  return <div>...</div>;
}

// Find circular dependencies
useEffect(() => {
  setA(b); // A depends on B
}, [b]);
useEffect(() => {
  setB(a); // B depends on A - CIRCULAR!
}, [a]);
```

---

## API Issues 🌐

```
Check Health Status (bottom-left)
├─ 🔴 RED → Backend is down
│       → pm2 status
│       → pm2 restart bassnotion-backend
└─ 🟢 GREEN → Continue ↓

Check Network tab in browser
├─ 404 → Endpoint doesn't exist
├─ 500 → Backend error (check backend logs)
├─ 401 → Not authenticated
└─ 403 → Not authorized

Get the correlation ID from the error
→ grep "correlation-id" logs/backend-out.log
→ This shows the full backend journey
```

### Common API Fixes:

- **404**: Check if endpoint exists in controller
- **500**: Check backend logs for stack trace
- **CORS**: Backend running on wrong port

---

## Mystery Bugs 🔍

```
Step 1: Get a Correlation ID
├─ From error message
├─ From console log
└─ Generate one: useCorrelation('Debug')

Step 2: Add Strategic Logging
→ At start of operation
→ Before each major step
→ After each major step
→ In catch blocks

Step 3: Reproduce with Logs
→ Clear console
→ Do the action
→ Copy all logs

Step 4: Trace the Journey
→ grep "correlation-id" logs/*.log
→ Read from first to last
→ Where does it stop?
```

### Debug Code Template:

```typescript
export function ProblematicComponent() {
  const { correlationId, logger } = useCorrelation('Debug');

  logger.info('Component mounted', {
    correlationId,
    timestamp: Date.now(),
  });

  const problematicFunction = async () => {
    logger.info('Function started', { step: 1 });

    try {
      logger.info('About to do risky thing', { step: 2 });
      const result = await riskyOperation();
      logger.info('Risky thing succeeded', { step: 3, result });

      logger.info('About to do another thing', { step: 4 });
      await anotherOperation();
      logger.info('Another thing succeeded', { step: 5 });
    } catch (error) {
      logger.error('Failed at step', error, {
        lastSuccessfulStep: 'Check logs above',
      });
      throw error;
    }
  };
}
```

---

## General Debugging 🛠️

### The Universal Process:

1. **Identify When** it happens
   - Always? → Check initialization
   - Sometimes? → Check conditions
   - After deploy? → Check env vars

2. **Identify Where** it happens
   - Frontend? → Check browser console
   - Backend? → Check pm2 logs
   - Database? → Check health endpoint

3. **Get a Correlation ID**
   - Find in any log entry
   - Tracks the entire flow

4. **Follow the Trail**

   ```bash
   # See everything for one action
   grep "your-correlation-id" logs/*.log | sort
   ```

5. **Add More Logging**
   - Before the problem area
   - After the problem area
   - Find where it stops

---

## Emergency Recovery 🚨

### Nothing Works!

```bash
# 1. Stop everything
pm2 stop all

# 2. Clear potential problems
rm -rf .next
rm -rf dist
rm -rf node_modules/.cache

# 3. Reinstall
pnpm install

# 4. Restart
pm2 start ecosystem.config.cjs

# 5. Check health
curl http://localhost:3000/health
```

### Still Broken?

```bash
# Check if ports are blocked
lsof -i :3000
lsof -i :3001

# Kill stuck processes
killall node

# Check disk space
df -h

# Check memory
free -m
```

### Nuclear Option:

```bash
# Complete reset
git stash
git checkout main
git pull
rm -rf node_modules
pnpm install
pm2 delete all
pm2 start ecosystem.config.cjs
```

---

## Prevention Checklist ✅

Before deploying:

- [ ] Test with `NEXT_PUBLIC_DEBUG_AUDIO=true`
- [ ] Check for console errors
- [ ] Verify health endpoint is green
- [ ] Test main user flows
- [ ] Check for memory leaks (leave running 5 mins)

After deploying:

- [ ] Check health endpoint
- [ ] Monitor logs for errors
- [ ] Test critical paths
- [ ] Watch for correlation IDs with errors

---

## Remember:

> "Every bug leaves breadcrumbs. Follow the correlation IDs!" 🥖

When in doubt:

1. Get the correlation ID
2. Check the logs
3. Add more logging
4. Try again

_You got this!_ 💪
