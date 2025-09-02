'use client';

import React, { ComponentType } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export interface WithErrorBoundaryOptions {
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Higher-order component that wraps a component with an ErrorBoundary
 * and automatically provides correlation ID from the component's context
 */
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const ComponentWithErrorBoundary = (props: P) => {
    // Get correlation ID from the wrapped component's context
    const { correlationId } = useCorrelation(Component.displayName || Component.name || 'Component');
    
    return (
      <ErrorBoundary
        correlationId={correlationId}
        fallback={options.fallback}
        onError={options.onError}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  
  return ComponentWithErrorBoundary;
}

/**
 * Hook to wrap async operations with error handling and correlation ID
 */
export function useAsyncError(componentName?: string) {
  const { correlationId, logger } = useCorrelation(componentName || 'AsyncOperation');
  
  return React.useCallback((error: Error) => {
    logger.error('Async error caught', error, { correlationId });
    
    // Re-throw to trigger nearest error boundary
    throw error;
  }, [correlationId, logger]);
}