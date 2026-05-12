'use client';

import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';
import {
  generateCorrelationId,
  createStructuredLogger,
} from '@bassnotion/contracts';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  correlationId?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCorrelationId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private logger = createStructuredLogger('ErrorBoundary');

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCorrelationId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorCorrelationId = generateCorrelationId();
    return { hasError: true, error, errorCorrelationId };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const correlationId =
      this.state.errorCorrelationId ||
      this.props.correlationId ||
      generateCorrelationId();

    // Log to Sentry with correlation ID
    Sentry.withScope((scope) => {
      scope.setContext('componentStack', {
        componentStack: errorInfo.componentStack,
      });
      scope.setTag('correlationId', correlationId);
      scope.setLevel('error');
      Sentry.captureException(error);
    });

    // Log with structured logger
    this.logger.error('React Error Boundary caught an error', error, {
      correlationId,
      componentStack: errorInfo.componentStack,
      errorBoundaryProps: this.props,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    const correlationId = this.props.correlationId || generateCorrelationId();
    this.logger.info('Error boundary reset', { correlationId });
    this.setState({ hasError: false, error: null, errorCorrelationId: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-2 text-2xl font-bold text-gray-900">
              Something went wrong
            </h2>
            <p className="mb-4 text-gray-600">
              We've encountered an unexpected error. The error has been logged
              and we'll look into it.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error details (development only)
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                  Correlation ID: {this.state.errorCorrelationId}
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version for functional components with correlation ID support
 */
export function useErrorHandler(componentName?: string) {
  const logger = createStructuredLogger(componentName || 'ErrorHandler');

  return (
    error: Error,
    errorInfo?: { componentStack?: string },
    correlationId?: string,
  ) => {
    const errorCorrelationId = correlationId || generateCorrelationId();

    // Log with structured logger
    logger.error('Error caught by error handler', error, {
      correlationId: errorCorrelationId,
      componentStack: errorInfo?.componentStack,
      componentName,
    });

    // Log to Sentry with correlation ID
    Sentry.withScope((scope) => {
      if (errorInfo?.componentStack) {
        scope.setContext('componentStack', {
          componentStack: errorInfo.componentStack,
        });
      }
      scope.setTag('correlationId', errorCorrelationId);
      scope.setLevel('error');
      Sentry.captureException(error);
    });

    return errorCorrelationId;
  };
}

/**
 * Page-level error boundary with full-page error UI
 * Use this for wrapping entire pages in app/ directory
 */
interface PageErrorBoundaryProps {
  children: ReactNode;
  pageName: string;
}

export function PageErrorBoundary({
  children,
  pageName,
}: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h1 className="mb-2 text-3xl font-bold text-gray-900">
              Page Error
            </h1>
            <p className="mb-6 text-gray-600">
              We couldn't load the {pageName} page. Please try refreshing or go
              back to the home page.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Refresh Page
              </button>
              <a
                href="/"
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Feature-level error boundary with inline error UI
 * Use this for wrapping feature components like modals, cards, widgets
 */
interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName: string;
  onRetry?: () => void;
}

export function FeatureErrorBoundary({
  children,
  featureName,
  onRetry,
}: FeatureErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6">
          <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            {featureName} Error
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            This feature encountered an error. Please try again.
          </p>
          <button
            onClick={onRetry || (() => window.location.reload())}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Widget-level error boundary with compact error UI
 * Use this for wrapping small widgets that shouldn't break the entire page
 */
interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetName: string;
}

export function WidgetErrorBoundary({
  children,
  widgetName,
}: WidgetErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-full min-h-[100px] flex-col items-center justify-center rounded border border-gray-200 bg-gray-50 p-4">
          <AlertCircle className="mb-2 h-5 w-5 text-gray-400" />
          <p className="text-xs text-gray-500">{widgetName} unavailable</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Auth-level error boundary with redirect to login
 * Use this for wrapping auth-related components
 */
interface AuthErrorBoundaryProps {
  children: ReactNode;
}

export function AuthErrorBoundary({ children }: AuthErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[300px] flex-col items-center justify-center p-8">
          <AlertCircle className="mb-4 h-10 w-10 text-amber-500" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Authentication Error
          </h2>
          <p className="mb-4 text-gray-600">
            There was a problem with authentication. Please try signing in
            again.
          </p>
          <a
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Billing-level error boundary with support contact
 * Use this for wrapping billing/payment components
 */
interface BillingErrorBoundaryProps {
  children: ReactNode;
}

export function BillingErrorBoundary({ children }: BillingErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-6">
          <AlertCircle className="mb-3 h-8 w-8 text-amber-500" />
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            Billing Error
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            We couldn't process your billing request. Your payment information
            is secure.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
            >
              Try Again
            </button>
            <a
              href="mailto:support@bassnotion.com"
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50"
            >
              Contact Support
            </a>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
