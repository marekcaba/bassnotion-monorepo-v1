import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseCoreService } from '../infrastructure/database/database-core.service.js';
import { HealthService } from './health.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import * as os from 'os';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: CheckResult;
    api: CheckResult;
    supabase: CheckResult;
  };
  version?: string;
  uptime?: number;
}

interface DetailedHealthStatus extends HealthStatus {
  system: {
    cpu: {
      usage: number;
      count: number;
    };
    memory: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    load: number[];
  };
  process: {
    pid: number;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
}

interface CheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  timestamp: string;
}

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  private logger = createStructuredLogger('health-check');

  constructor(
    private readonly db: DatabaseCoreService,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get basic health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealth(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      api: { status: 'healthy' as const }, // API is healthy if we got here
      supabase: await this.checkSupabase(),
    };

    const overallStatus = this.calculateOverallStatus(checks);

    const result: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || 'unknown',
      uptime: process.uptime(),
    };

    this.logger.info('Health check completed', { result });

    return result;
  }

  @Get('detailed')
  @ApiOperation({ summary: 'Get detailed health status with system metrics' })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status retrieved successfully',
  })
  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const basicHealth = await this.getHealth();

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    const detailed: DetailedHealthStatus = {
      ...basicHealth,
      system: {
        cpu: {
          usage: Math.round(cpuUsage * 100) / 100,
          count: cpus.length,
        },
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          percentage: Math.round((usedMemory / totalMemory) * 100),
        },
        load: os.loadavg(),
      },
      process: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    return detailed;
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness(): Promise<{ status: string }> {
    // Simple liveness check - if the endpoint responds, the service is alive
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to handle requests',
  })
  async getReadiness(): Promise<{
    ready: boolean;
    checks: Record<string, boolean>;
  }> {
    // Readiness check - verify all dependencies are ready
    const dbCheck = await this.checkDatabase();
    const supabaseCheck = await this.checkSupabase();

    const checks = {
      database: dbCheck.status === 'healthy',
      supabase: supabaseCheck.status === 'healthy',
    };

    const ready = Object.values(checks).every((check) => check === true);

    return { ready, checks };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
  })
  async getMetrics(): Promise<PerformanceMetrics> {
    const metrics = this.healthService.getMetrics();

    return {
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      // Simple query to check database connectivity
      const result = await this.db
        .getClient()
        .from('exercises')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - start;

      if (result.error) {
        return {
          status: 'unhealthy',
          responseTime,
          error: result.error.message,
        };
      }

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkSupabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl) {
        return {
          status: 'unhealthy',
          error: 'SUPABASE_URL not configured',
        };
      }

      if (!supabaseAnonKey) {
        return {
          status: 'unhealthy',
          error: 'SUPABASE_ANON_KEY not configured',
        };
      }

      // Check if we can reach Supabase with proper authentication
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      const responseTime = Date.now() - start;

      if (response.ok) {
        return {
          status: 'healthy',
          responseTime,
        };
      }

      return {
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private calculateOverallStatus(
    checks: HealthStatus['checks'],
  ): HealthStatus['status'] {
    const checkValues = Object.values(checks);

    if (checkValues.every((check) => check.status === 'healthy')) {
      return 'healthy';
    }

    if (checkValues.some((check) => check.status === 'unhealthy')) {
      return 'unhealthy';
    }

    return 'degraded';
  }
}
