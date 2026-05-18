import * as Sentry from '@sentry/nextjs';

/**
 * Sentry configuration for client-side error tracking
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions will be recorded
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors will be recorded

  // Release tracking
  release:
    process.env.NEXT_PUBLIC_SENTRY_RELEASE || 'bassnotion-frontend@unknown',

  // Error filtering
  beforeSend(event, hint) {
    // Filter out specific errors
    const error = hint.originalException;

    // Don't send ResizeObserver errors
    if (error && error.toString().includes('ResizeObserver')) {
      return null;
    }

    // Don't send network errors in development
    if (
      process.env.NODE_ENV === 'development' &&
      error &&
      error.toString().includes('NetworkError')
    ) {
      return null;
    }

    // Add user context if available
    const user =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('user')
        : null;
    if (user) {
      try {
        const userData = JSON.parse(user);
        event.user = {
          id: userData.id,
          email: userData.email,
        };
      } catch (e) {
        // Ignore parse errors
      }
    }

    return event;
  },

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content by default for privacy
      maskAllText: true,
      maskAllInputs: true,

      // Block specific elements
      blockSelector: '[data-sentry-block]',

      // Ignore specific elements
      ignoreSelector: '[data-sentry-ignore]',

      // Sample rate for network requests/responses. Guard against
      // module being evaluated server-side (e.g. during Next.js's
      // chunk-resolution pass) where `window` doesn't exist — a bare
      // `window.location.origin` here would throw at module load and
      // silently prevent the whole Sentry.init() call from running.
      networkDetailAllowUrls:
        typeof window !== 'undefined' ? [window.location.origin] : [],
    }),
  ],

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',

    // Network errors
    'NetworkError',
    'Failed to fetch',

    // Audio errors that are handled gracefully
    'The AudioContext was not allowed to start',
    'DOMException: The play() request was interrupted',
  ],

  // Ignore transactions from specific URLs
  ignoreTransactions: ['/api/health', '/_next/static', '/worklets/'],

  // Additional options
  attachStacktrace: true,
  autoSessionTracking: true,

  // Breadcrumb options
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    // Don't track navigation to health endpoints
    if (
      breadcrumb.category === 'navigation' &&
      breadcrumb.data?.to?.includes('/health')
    ) {
      return null;
    }

    return breadcrumb;
  },
});
