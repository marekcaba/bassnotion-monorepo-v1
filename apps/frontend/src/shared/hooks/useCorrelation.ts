import { useMemo } from 'react';
import {
  generateCorrelationId,
  createStructuredLogger,
  createCorrelationContext,
  StructuredLogger,
} from '@bassnotion/contracts';
import { useAuth } from '@/domains/user/hooks/use-auth';

interface UseCorrelationReturn {
  correlationId: string;
  logger: StructuredLogger;
}

/**
 * Hook to provide correlation ID and structured logger for a component
 */
export function useCorrelation(componentName: string): UseCorrelationReturn {
  const { user } = useAuth();

  // Generate a stable correlation ID for this component instance
  const correlationId = useMemo(() => generateCorrelationId(), []);

  // Create a logger with correlation context
  const logger = useMemo(() => {
    const context = createCorrelationContext(correlationId, {
      service: `frontend:${componentName}`,
      userId: user?.id,
      sessionId:
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem('sessionId') || undefined
          : undefined,
    });

    return createStructuredLogger(`frontend:${componentName}`, context);
  }, [correlationId, componentName, user?.id]);

  return { correlationId, logger };
}

/**
 * Create a session ID on app initialization
 */
export function initializeSession(): void {
  if (
    typeof window !== 'undefined' &&
    !window.sessionStorage.getItem('sessionId')
  ) {
    window.sessionStorage.setItem('sessionId', generateCorrelationId());
  }
}
