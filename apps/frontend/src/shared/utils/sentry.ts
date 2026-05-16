import * as Sentry from '@sentry/nextjs';

/**
 * Capture an error with additional context
 */
export function captureError(
  error: Error | string,
  context?: Record<string, any>,
  level: Sentry.SeverityLevel = 'error',
) {
  Sentry.withScope((scope) => {
    scope.setLevel(level);

    if (context) {
      scope.setContext('additional', context);
    }

    if (typeof error === 'string') {
      Sentry.captureMessage(error, level);
    } else {
      Sentry.captureException(error);
    }
  });
}

/**
 * Track a custom event
 */
export function trackEvent(
  message: string,
  category: string,
  data?: Record<string, any>,
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id: string;
  email?: string;
  username?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add custom tags to Sentry
 */
export function addTags(tags: Record<string, string>) {
  Sentry.setTags(tags);
}

/**
 * Add breadcrumb for better error context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info',
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Capture audio playback errors with context
 */
export function captureAudioError(
  error: Error,
  context: {
    audioContext?: string;
    widget?: string;
    action?: string;
    [key: string]: any;
  },
) {
  captureError(error, {
    subsystem: 'audio',
    ...context,
  });
}

/**
 * Capture widget errors with context
 */
export function captureWidgetError(
  error: Error,
  widgetName: string,
  additionalContext?: Record<string, any>,
) {
  captureError(error, {
    subsystem: 'widget',
    widget: widgetName,
    ...additionalContext,
  });
}

/**
 * Report performance metrics
 */
export function reportPerformanceMetric(
  name: string,
  value: number,
  unit: string = 'ms',
) {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${name}: ${value}${unit}`,
    level: 'info',
    data: {
      metric: name,
      value,
      unit,
    },
  });
}
