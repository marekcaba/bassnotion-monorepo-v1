/**
 * AnalyticsIntegration - Analytics and error reporting integration
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 *
 * Integrates with analytics platforms for production insights
 */

import { EventBus } from '../core/EventBus.js';
import { ProductionLogger } from '../logging/ProductionLogger.js';
import { AudioError } from '../../errors/AudioErrors.js';

export interface AnalyticsEvent {
  name: string;
  category: string;
  properties?: Record<string, any>;
  timestamp?: number;
  userId?: string;
  sessionId?: string;
}

export interface ErrorReport {
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context: {
    severity: 'info' | 'warning' | 'error' | 'fatal';
    timestamp: number;
    userId?: string;
    sessionId?: string;
    browserInfo?: string;
    audioState?: string;
    breadcrumbs?: Breadcrumb[];
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  };
}

export interface Breadcrumb {
  timestamp: number;
  type: string;
  category: string;
  message: string;
  data?: Record<string, any>;
}

export interface AnalyticsProvider {
  name: string;
  track(event: AnalyticsEvent): Promise<void>;
  identify(userId: string, traits?: Record<string, any>): Promise<void>;
  reportError(report: ErrorReport): Promise<void>;
  setContext(context: Record<string, any>): void;
}

export interface AnalyticsConfig {
  enabled?: boolean;
  providers?: AnalyticsProvider[];
  userId?: string;
  sessionId?: string;
  enableAutoTracking?: boolean;
  enableErrorReporting?: boolean;
  enablePerformanceTracking?: boolean;
  breadcrumbLimit?: number;
  sanitizers?: Array<(data: any) => any>;
}

export class AnalyticsIntegration {
  private eventBus: EventBus;
  private logger: ProductionLogger;
  private config: Required<AnalyticsConfig>;
  private providers: AnalyticsProvider[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private context: Record<string, any> = {};
  private sessionStartTime: number;
  private eventCount = 0;
  private errorCount = 0;

  constructor(
    eventBus: EventBus,
    logger: ProductionLogger,
    config: AnalyticsConfig = {},
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.config = {
      enabled: true,
      providers: [],
      userId: undefined,
      sessionId: this.generateSessionId(),
      enableAutoTracking: true,
      enableErrorReporting: true,
      enablePerformanceTracking: true,
      breadcrumbLimit: 100,
      sanitizers: [],
      ...config,
    };

    this.sessionStartTime = Date.now();
    this.providers = config.providers || [];

    this.initializeProviders();
    this.setupEventTracking();
  }

  /**
   * Initialize analytics providers
   */
  private initializeProviders(): void {
    // Add default providers if none specified
    if (this.providers.length === 0) {
      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        this.providers.push(new GoogleAnalyticsProvider());
      }

      // Sentry
      if (typeof window !== 'undefined' && window.Sentry) {
        this.providers.push(new SentryProvider());
      }
    }

    // Set initial context for all providers
    for (const provider of this.providers) {
      provider.setContext({
        sessionId: this.config.sessionId,
        sessionStartTime: this.sessionStartTime,
        environment: process.env.NODE_ENV || 'development',
      });
    }

    this.logger.info('analytics', 'Analytics providers initialized', {
      providers: this.providers.map((p) => p.name),
    });
  }

  /**
   * Track an event
   */
  async track(
    name: string,
    category = 'general',
    properties?: Record<string, any>,
  ): Promise<void> {
    if (!this.config.enabled) return;

    this.eventCount++;

    const event: AnalyticsEvent = {
      name,
      category,
      properties: this.sanitizeData(properties),
      timestamp: Date.now(),
      userId: this.config.userId,
      sessionId: this.config.sessionId,
    };

    // Add breadcrumb
    this.addBreadcrumb({
      timestamp: event.timestamp!,
      type: 'event',
      category,
      message: name,
      data: properties,
    });

    // Send to all providers
    const promises = this.providers.map((provider) =>
      provider.track(event).catch((error) => {
        this.logger.error(
          'analytics',
          `Failed to track event with ${provider.name}`,
          error,
        );
      }),
    );

    await Promise.all(promises);

    // Log event
    this.logger.debug('analytics', 'Event tracked', event);
  }

  /**
   * Identify user
   */
  async identify(userId: string, traits?: Record<string, any>): Promise<void> {
    if (!this.config.enabled) return;

    this.config.userId = userId;
    this.context.userId = userId;

    const sanitizedTraits = this.sanitizeData(traits);

    // Send to all providers
    const promises = this.providers.map((provider) =>
      provider.identify(userId, sanitizedTraits).catch((error) => {
        this.logger.error(
          'analytics',
          `Failed to identify user with ${provider.name}`,
          error,
        );
      }),
    );

    await Promise.all(promises);

    this.logger.info('analytics', 'User identified', { userId });
  }

  /**
   * Report error
   */
  async reportError(
    error: Error | AudioError,
    severity: ErrorReport['context']['severity'] = 'error',
    extra?: Record<string, any>,
  ): Promise<void> {
    if (!this.config.enabled || !this.config.enableErrorReporting) return;

    this.errorCount++;

    const report: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error instanceof AudioError ? error.code : undefined,
      },
      context: {
        severity,
        timestamp: Date.now(),
        userId: this.config.userId,
        sessionId: this.config.sessionId,
        browserInfo: navigator.userAgent,
        audioState: this.getAudioState(),
        breadcrumbs: [...this.breadcrumbs],
        tags: {
          environment: process.env.NODE_ENV || 'development',
          version: process.env.REACT_APP_VERSION || 'unknown',
        },
        extra: this.sanitizeData(extra),
      },
    };

    // Send to all providers
    const promises = this.providers.map((provider) =>
      provider.reportError(report).catch((err) => {
        this.logger.error(
          'analytics',
          `Failed to report error with ${provider.name}`,
          err,
        );
      }),
    );

    await Promise.all(promises);

    // Log error
    this.logger.error('analytics', 'Error reported', error, report.context);
  }

  /**
   * Add breadcrumb
   */
  private addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);

    // Maintain limit
    if (this.breadcrumbs.length > this.config.breadcrumbLimit) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Setup automatic event tracking
   */
  private setupEventTracking(): void {
    if (!this.config.enableAutoTracking) return;

    // Audio events
    this.eventBus.on('audio:initialized', (data) => {
      this.track('audio_initialized', 'audio', data);
    });

    this.eventBus.on('audio:error', ({ error }) => {
      this.reportError(error, 'error');
    });

    this.eventBus.on('audio:state-changed', (data) => {
      this.track('audio_state_changed', 'audio', data);
    });

    // Performance events
    if (this.config.enablePerformanceTracking) {
      this.eventBus.on('performance:warning', (data) => {
        this.track('performance_warning', 'performance', data);
      });

      this.eventBus.on('optimization:target-exceeded', (data) => {
        this.track('optimization_target_exceeded', 'performance', data);
      });
    }

    // User interaction events
    this.trackUserInteractions();

    // Page lifecycle events
    this.trackPageLifecycle();
  }

  /**
   * Track user interactions
   */
  private trackUserInteractions(): void {
    // Click tracking
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      // Track audio-related clicks
      if (target.matches('[data-track-click]')) {
        const trackName = target.getAttribute('data-track-click');
        const trackProps = target.getAttribute('data-track-props');

        this.track(
          `click_${trackName}`,
          'interaction',
          trackProps ? JSON.parse(trackProps) : undefined,
        );
      }
    });
  }

  /**
   * Track page lifecycle
   */
  private trackPageLifecycle(): void {
    // Page visibility
    document.addEventListener('visibilitychange', () => {
      this.track('page_visibility_changed', 'lifecycle', {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
      });
    });

    // Page unload
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Date.now() - this.sessionStartTime;

      this.track('session_end', 'lifecycle', {
        duration: sessionDuration,
        eventCount: this.eventCount,
        errorCount: this.errorCount,
      });
    });
  }

  /**
   * Get current audio state
   */
  private getAudioState(): string {
    // This would be retrieved from AudioEngine
    return 'unknown';
  }

  /**
   * Sanitize data before sending
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    let sanitized = data;

    // Apply custom sanitizers
    for (const sanitizer of this.config.sanitizers) {
      sanitized = sanitizer(sanitized);
    }

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];

    if (typeof sanitized === 'object') {
      const cleaned = { ...sanitized };

      for (const field of sensitiveFields) {
        if (field in cleaned) {
          cleaned[field] = '[REDACTED]';
        }
      }

      return cleaned;
    }

    return sanitized;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get analytics summary
   */
  getSummary(): {
    sessionId: string;
    sessionDuration: number;
    eventCount: number;
    errorCount: number;
    providers: string[];
  } {
    return {
      sessionId: this.config.sessionId!,
      sessionDuration: Date.now() - this.sessionStartTime,
      eventCount: this.eventCount,
      errorCount: this.errorCount,
      providers: this.providers.map((p) => p.name),
    };
  }

  /**
   * Dispose analytics
   */
  dispose(): void {
    // Send final events
    this.track('analytics_disposed', 'lifecycle', this.getSummary());

    // Clear data
    this.breadcrumbs = [];
    this.context = {};
  }
}

/**
 * Google Analytics Provider
 */
class GoogleAnalyticsProvider implements AnalyticsProvider {
  name = 'Google Analytics';

  async track(event: AnalyticsEvent): Promise<void> {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event.name, {
        event_category: event.category,
        ...event.properties,
      });
    }
  }

  async identify(userId: string, traits?: Record<string, any>): Promise<void> {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        user_id: userId,
        ...traits,
      });
    }
  }

  async reportError(report: ErrorReport): Promise<void> {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: report.error.message,
        fatal: report.context.severity === 'fatal',
      });
    }
  }

  setContext(context: Record<string, any>): void {
    // Set custom dimensions if needed
  }
}

/**
 * Sentry Provider
 */
class SentryProvider implements AnalyticsProvider {
  name = 'Sentry';

  async track(event: AnalyticsEvent): Promise<void> {
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.addBreadcrumb({
        message: event.name,
        category: event.category,
        data: event.properties,
      });
    }
  }

  async identify(userId: string, traits?: Record<string, any>): Promise<void> {
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.setUser({
        id: userId,
        ...traits,
      });
    }
  }

  async reportError(report: ErrorReport): Promise<void> {
    if (typeof window !== 'undefined' && window.Sentry) {
      const Sentry = window.Sentry;

      Sentry.withScope((scope: unknown) => {
        const typedScope = scope as {
          setLevel: (level: string) => void;
          setContext: (name: string, context: Record<string, unknown>) => void;
          setTag: (key: string, value: string) => void;
          setExtra: (key: string, value: unknown) => void;
        };
        typedScope.setLevel(report.context.severity);
        typedScope.setContext('audio', {
          state: report.context.audioState,
        });

        if (report.context.tags) {
          Object.entries(report.context.tags).forEach(([key, value]) => {
            typedScope.setTag(key, value);
          });
        }

        if (report.context.extra) {
          Object.entries(report.context.extra).forEach(([key, value]) => {
            typedScope.setExtra(key, value);
          });
        }

        Sentry.captureException(new Error(report.error.message));
      });
    }
  }

  setContext(context: Record<string, any>): void {
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.setContext('session', context);
    }
  }
}
