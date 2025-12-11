import { Injectable } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';

@Injectable()
export class HealthService {
  private logger = createStructuredLogger('health-service');
  private requestMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    responseTimes: [] as number[],
  };
  private errorMetrics = {
    total: 0,
    byType: {} as Record<string, number>,
  };

  recordRequest(responseTime: number, success: boolean, error?: string) {
    this.requestMetrics.total++;
    if (success) {
      this.requestMetrics.successful++;
    } else {
      this.requestMetrics.failed++;
      if (error) {
        this.errorMetrics.total++;
        this.errorMetrics.byType[error] =
          (this.errorMetrics.byType[error] || 0) + 1;
      }
    }

    // Keep only last 1000 response times
    this.requestMetrics.responseTimes.push(responseTime);
    if (this.requestMetrics.responseTimes.length > 1000) {
      this.requestMetrics.responseTimes.shift();
    }
  }

  getMetrics() {
    const avgResponseTime =
      this.requestMetrics.responseTimes.length > 0
        ? this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) /
          this.requestMetrics.responseTimes.length
        : 0;

    return {
      requests: {
        total: this.requestMetrics.total,
        successful: this.requestMetrics.successful,
        failed: this.requestMetrics.failed,
        averageResponseTime: Math.round(avgResponseTime),
      },
      errors: {
        total: this.errorMetrics.total,
        byType: this.errorMetrics.byType,
      },
    };
  }

  resetMetrics() {
    this.requestMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      responseTimes: [],
    };
    this.errorMetrics = {
      total: 0,
      byType: {},
    };
    this.logger.info('Metrics reset');
  }
}
