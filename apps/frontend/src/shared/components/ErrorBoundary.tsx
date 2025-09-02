'use client';

import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertCircle } from 'lucide-react';
import { generateCorrelationId, createStructuredLogger } from '@bassnotion/contracts';

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
    const correlationId = this.state.errorCorrelationId || this.props.correlationId || generateCorrelationId();
    
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
  
  return (error: Error, errorInfo?: { componentStack?: string }, correlationId?: string) => {
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