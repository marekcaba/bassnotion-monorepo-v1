import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import type { StructuredLogger } from '@bassnotion/contracts';

export interface RequestWithContext extends FastifyRequest {
  correlationId: string;
  logger: StructuredLogger;
}

/**
 * Request-scoped service that provides access to correlation ID and logger
 * This allows any service to access the current request's correlation context
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private readonly request: RequestWithContext) {}

  /**
   * Get the correlation ID for the current request
   */
  getCorrelationId(): string {
    return this.request.correlationId;
  }

  /**
   * Get the request-scoped logger with correlation context
   */
  getLogger(): StructuredLogger {
    return this.request.logger;
  }

  /**
   * Get the full request context
   */
  getContext() {
    return {
      correlationId: this.request.correlationId,
      logger: this.request.logger,
      userId: (this.request as any).user?.id,
      sessionId: (this.request as any).session?.id };
  }
}