import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getCorrelationId,
  CORRELATION_HEADER,
  createStructuredLogger,
  createCorrelationContext } from '@bassnotion/contracts';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Extract or generate correlation ID
    const correlationId = getCorrelationId(req.headers as any);

    // Add to request object for use in services
    (req as any).correlationId = correlationId;

    // Add to response headers for tracing
    // In Fastify middleware, we need to use raw.setHeader
    if (res && res.raw && res.raw.setHeader) {
      res.raw.setHeader(CORRELATION_HEADER, correlationId);
    }

    // Create logger instance for this request
    const context = createCorrelationContext(correlationId, {
      service: 'backend',
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id });

    const logger = createStructuredLogger('backend', context);
    (req as any).logger = logger;

    // Log incoming request
    logger.info('Incoming request', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'] });

    next();
  }
}
