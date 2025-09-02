import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('SentryConfig');

/**
 * Sentry configuration for error tracking and performance monitoring
 */
export function initializeSentry() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry DSN not configured, skipping initialization', { isDevelopment });
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',

    // Performance Monitoring
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in production
    profilesSampleRate: isDevelopment ? 1.0 : 0.1, // Profile 100% of transactions in dev

    // Integrations
    integrations: [
      // Automatically instrument Node.js libraries and frameworks
      nodeProfilingIntegration(),
    ],

    // Release tracking
    release: process.env.SENTRY_RELEASE || 'bassnotion-backend@unknown',

    // Error filtering
    beforeSend(event, hint) {
      // Filter out specific errors in development
      if (isDevelopment) {
        const error = hint.originalException;
        // Skip build errors and typescript errors
        if (error && error.toString().includes('Build failed')) {
          return null;
        }
      }

      // Add user context if available
      if (event.request?.headers && event.request.headers['x-user-id']) {
        event.user = {
          id: event.request.headers['x-user-id'] as string };
      }

      return event;
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },

    // Additional options
    attachStacktrace: true,

    // Transport options
    transportOptions: {
      // Transport options can be added here if needed
    } });

  logger.info('Sentry initialized successfully', { environment: process.env.NODE_ENV });
}

/**
 * Express/Fastify error handler for Sentry
 */
export const sentryErrorHandler = (error: any) => {
  // Capture error with Sentry
  Sentry.captureException(error);
};

/**
 * Helper to capture custom errors with context
 */
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Helper to track custom events
 */
export function trackEvent(name: string, data?: Record<string, any>) {
  Sentry.captureEvent({
    message: name,
    level: 'info',
    extra: data });
}

/**
 * Helper to add user context
 */
export function setUserContext(
  userId: string,
  email?: string,
  username?: string,
) {
  Sentry.setUser({
    id: userId,
    email,
    username });
}

/**
 * Helper to add custom tags
 */
export function addTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Helper to measure performance
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  // Use startSpan for performance measurement
  return Sentry.startSpan({ name: operation, op: 'function' }, async () => {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error as Error;
    }
  });
}
