import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../../health/health.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private logger = createStructuredLogger('performance-middleware');

  constructor(
    private readonly healthService: HealthService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url } = req;

    // Track response
    const originalSend = res.send;
    res.send = (body: any) => {
      const responseTime = Date.now() - start;
      const success = res.statusCode < 400;

      // Record metrics
      this.healthService.recordRequest(
        responseTime,
        success,
        !success ? `${res.statusCode}` : undefined,
      );

      // Log performance data
      this.logger.info('Request completed', {
        method,
        url,
        statusCode: res.statusCode,
        responseTime,
        correlationId: req.headers['x-correlation-id'] });

      // Call original send
      return originalSend.call(res, body);
    };

    next();
  }
}
