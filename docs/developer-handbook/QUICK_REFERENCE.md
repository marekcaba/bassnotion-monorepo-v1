# BassNotion Quick Reference Card 🎸

## 🚀 Daily Commands

```bash
# Start everything
pm2 start ecosystem.config.cjs

# Check status
pm2 status

# View logs
pm2 logs bassnotion-frontend
pm2 logs bassnotion-backend

# Restart after code changes
pm2 restart bassnotion-frontend
pm2 restart bassnotion-backend
```

## 🔍 Debugging Checklist

When something breaks:

1. **Check Health Indicator** (bottom-left)
   - 🟢 Green = System OK, check your code
   - 🟡 Yellow = Something slow
   - 🔴 Red = Service down

2. **Find the Correlation ID**

   ```javascript
   // It's in every log entry
   ERROR: Play failed { correlationId: "abc-123-def-456" }
   ```

3. **Search Logs**

   ```bash
   # Find all logs for this action
   grep "abc-123-def-456" logs/*.log
   ```

4. **Check Audio Debug Panel** (bottom-right)
   - Is the event showing up?
   - Any error events?
   - Events in correct order?

## 🎵 Audio Debug Mode

```bash
# In .env.local
NEXT_PUBLIC_DEBUG_AUDIO=true

# Restart frontend
pm2 restart bassnotion-frontend
```

## 📝 Logging Right

```typescript
// ❌ DON'T DO THIS
console.log('Something happened');

// ✅ DO THIS
const { logger } = useCorrelation('ComponentName');
logger.info('User action', {
  action: 'play',
  songId: '123',
  timestamp: Date.now(),
});
```

## 🐛 Common Fixes

### Page Frozen?

```typescript
// Check for these:
useEffect(() => {
  // Missing dependency array?
}, []); // ← Don't forget this!

// Unmemoized callbacks?
const handleClick = useCallback(() => {
  // your code
}, []); // ← Memoize it!
```

### Audio Not Playing?

```typescript
// Add debug logging
import { logAudioEvent } from '@/shared/debug/AudioDebugger';

logAudioEvent('MyComponent', 'play-attempt', {
  isLoaded: audioLoaded,
  context: audioContext.state,
});
```

### Can't Find Bug?

```typescript
// Add correlation tracking
const { correlationId, logger } = useCorrelation('BugHunt');

// Log at start
logger.info('Starting operation', { step: 1 });

// Log at each step
logger.info('Midpoint reached', { step: 2, data });

// Log at end/error
logger.error('Operation failed', error);
```

## 🛠️ Quick Patterns

### API Call with Correlation

```typescript
const { correlationId } = useCorrelation('MyComponent');
const result = await apiClient.get('/api/endpoint', {
  correlationId,
});
```

### Component with Debug Logging

```typescript
export function MyComponent() {
  const { logger } = useCorrelation('MyComponent');
  const debug = useAudioDebug('MyComponent');

  const doSomething = () => {
    logger.info('Starting action');
    debug.log('Audio event', { note: 'C4' });
  };

  return <button onClick={doSomething}>Click</button>;
}
```

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    context: 'Additional context here',
    correlationId,
  });
  // Still throw it up
  throw error;
}
```

## 🚨 Emergency Commands

```bash
# Everything broken? Start fresh:
pm2 delete all
pm2 start ecosystem.config.cjs

# Clear all logs
rm logs/*.log

# Reset node modules
rm -rf node_modules
pnpm install

# Check what's using ports
lsof -i :3000  # Backend port
lsof -i :3001  # Frontend port
```

## 📞 Getting Help

When asking for help, provide:

1. **Correlation ID** from the error
2. **Screenshot** of debug panels
3. **Time** when it happened
4. **What** you were trying to do
5. **Logs** with the correlation ID

---

Remember: `Correlation ID = Your Detective Badge` 🔍

_Print this out and keep it handy!_
