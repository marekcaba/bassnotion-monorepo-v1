# Sentry Error Tracking Setup

## Overview

BassNotion uses Sentry for comprehensive error tracking, performance monitoring, and user session replay. This document covers the setup and configuration for both frontend and backend applications.

## Installation

Already installed:
- Backend: `@sentry/node` and `@sentry/profiling-node`
- Frontend: `@sentry/nextjs`

## Environment Variables

### Backend (.env)

```bash
# Required
SENTRY_DSN=your-backend-dsn-here

# Optional
SENTRY_RELEASE=bassnotion-backend@1.0.0
SENTRY_ENVIRONMENT=production
```

### Frontend (.env.local)

```bash
# Required
NEXT_PUBLIC_SENTRY_DSN=your-frontend-dsn-here

# Optional
NEXT_PUBLIC_SENTRY_RELEASE=bassnotion-frontend@1.0.0
SENTRY_AUTH_TOKEN=your-auth-token-for-source-maps
```

## Features Implemented

### Backend Features

1. **Error Tracking**
   - Automatic error capture with context
   - User context from request headers
   - Correlation ID tracking
   - Custom error filtering

2. **Performance Monitoring**
   - Transaction tracking (10% in production, 100% in development)
   - Profiling integration
   - Database query performance
   - API endpoint monitoring

3. **Custom Helpers**
   ```typescript
   import { captureError, trackEvent, measurePerformance } from '@/config/sentry.config';
   
   // Capture error with context
   captureError(error, { userId, action: 'createExercise' });
   
   // Track custom events
   trackEvent('user_signup', { plan: 'premium' });
   
   // Measure performance
   const result = await measurePerformance('database.query', async () => {
     return await db.query(...);
   });
   ```

### Frontend Features

1. **Error Tracking**
   - React Error Boundary integration
   - Component stack traces
   - User context from localStorage
   - Network error filtering

2. **Session Replay**
   - 10% of all sessions recorded
   - 100% of sessions with errors recorded
   - Privacy-focused (text/input masking)
   - Custom block/ignore selectors

3. **Performance Monitoring**
   - Page load tracking
   - API call monitoring
   - Component render performance
   - Custom transaction tracking

4. **Audio Error Tracking**
   ```typescript
   import { captureAudioError } from '@/shared/utils/sentry';
   
   captureAudioError(error, {
     widget: 'MetronomeWidget',
     action: 'start',
     audioContext: 'suspended'
   });
   ```

## Usage Examples

### Backend Error Handling

```typescript
// In a controller
try {
  const result = await this.service.createExercise(data);
  return result;
} catch (error) {
  captureError(error, {
    controller: 'ExercisesController',
    method: 'create',
    data
  });
  throw error;
}
```

### Frontend Error Handling

```typescript
// In a React component
import { useErrorHandler } from '@/shared/components/ErrorBoundary';
import { captureWidgetError } from '@/shared/utils/sentry';

function MyWidget() {
  const errorHandler = useErrorHandler();
  
  const handlePlay = async () => {
    try {
      await playAudio();
    } catch (error) {
      captureWidgetError(error, 'MyWidget', { action: 'play' });
      errorHandler(error);
    }
  };
}
```

### Performance Tracking

```typescript
// Frontend
import { measureAsyncOperation, reportPerformanceMetric } from '@/shared/utils/sentry';

const data = await measureAsyncOperation('load-samples', async () => {
  const startTime = performance.now();
  const samples = await loadSamples();
  const loadTime = performance.now() - startTime;
  
  reportPerformanceMetric('sample-load-time', loadTime);
  return samples;
});

// Backend
const result = await measurePerformance('youtube.fetch', async () => {
  return await fetchYouTubeData(channelId);
});
```

## Error Filtering

### Ignored Errors

**Backend:**
- Build errors
- TypeScript compilation errors
- Health check requests

**Frontend:**
- ResizeObserver errors
- Browser extension errors
- Network errors in development
- Audio context start errors (handled gracefully)

## Privacy & Security

1. **Data Masking**
   - All text content masked in session replays
   - Input fields masked by default
   - Sensitive elements can use `data-sentry-block`

2. **User Context**
   - Only user ID and email are sent
   - No passwords or sensitive data
   - Context cleared on logout

3. **Filtering**
   - Health endpoints excluded
   - Static assets excluded
   - Worklet files excluded

## Monitoring Dashboard

Once configured, you can:

1. **View Errors**
   - Real-time error tracking
   - Error grouping and trends
   - User impact analysis

2. **Performance Monitoring**
   - Transaction traces
   - Database query performance
   - API endpoint latency

3. **Session Replay**
   - Watch user sessions
   - Identify UX issues
   - Debug complex errors

## Best Practices

1. **Always add context** to errors for better debugging
2. **Use breadcrumbs** to track user actions leading to errors
3. **Set user context** after authentication
4. **Track custom events** for business metrics
5. **Use performance tracking** for critical operations
6. **Test in development** with 100% sampling
7. **Review and tune** sampling rates for production

## Troubleshooting

### Sentry not capturing errors

1. Check DSN is configured correctly
2. Verify environment variables are loaded
3. Check console for Sentry initialization messages
4. Ensure errors aren't being filtered

### Performance impact

1. Reduce `tracesSampleRate` in production
2. Disable session replay if needed
3. Use selective performance tracking
4. Review breadcrumb configuration

### Source maps (Frontend)

For production builds, configure source map upload:

```bash
# In build pipeline
SENTRY_AUTH_TOKEN=your-token pnpm build
```

This enables proper error stack traces in production.