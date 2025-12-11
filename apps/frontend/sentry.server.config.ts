import * as Sentry from '@sentry/nextjs';

/**
 * Sentry configuration for server-side error tracking
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Release tracking
  release: process.env.SENTRY_RELEASE || 'bassnotion-frontend@unknown',

  // Error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    const error = hint.originalException;

    // Don't send build errors
    if (error && error.toString().includes('Build Error')) {
      return null;
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Next.js specific
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',

    // Build errors
    'Module not found',
    'Cannot find module',
  ],

  // Additional options
  attachStacktrace: true,
  autoSessionTracking: false, // Disable on server
});
