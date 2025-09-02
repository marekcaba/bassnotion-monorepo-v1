/**
 * Correlation ID utilities for request tracking across services
 */

export const CORRELATION_HEADER = 'x-correlation-id';

/**
 * Generate a new correlation ID
 * Works in both Node.js and browser environments
 */
export function generateCorrelationId(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 16+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract correlation ID from headers or generate new one
 */
export function getCorrelationId(headers?: Record<string, string | string[] | undefined>): string {
  if (!headers) return generateCorrelationId();
  
  const correlationId = headers[CORRELATION_HEADER];
  
  if (Array.isArray(correlationId)) {
    return correlationId[0] || generateCorrelationId();
  }
  
  return correlationId || generateCorrelationId();
}

/**
 * Create correlation context for logging
 */
export interface CorrelationContext {
  correlationId: string;
  timestamp: string;
  service?: string;
  userId?: string;
  sessionId?: string;
}

export function createCorrelationContext(
  correlationId: string,
  additional?: Partial<CorrelationContext>
): CorrelationContext {
  return {
    correlationId,
    timestamp: new Date().toISOString(),
    ...additional,
  };
}