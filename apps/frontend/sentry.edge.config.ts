import * as Sentry from '@sentry/nextjs';

/**
 * Sentry configuration for edge runtime (middleware)
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Performance Monitoring (reduced for edge)
  tracesSampleRate: 0.05, // 5% sampling for edge functions

  // Release tracking
  release: process.env.SENTRY_RELEASE || 'bassnotion-frontend@unknown',

  // Disable features not available in edge runtime
  autoSessionTracking: false,
  attachStacktrace: false,
});
