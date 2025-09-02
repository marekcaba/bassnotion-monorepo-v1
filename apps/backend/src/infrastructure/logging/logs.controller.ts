import { Controller, Get, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { LogAggregatorService, BufferedLog } from './log-aggregator.service.js';
import { AuthGuard } from '../../domains/user/auth/guards/auth.guard.js';
import { createStructuredLogger } from '@bassnotion/contracts';

@ApiTags('logs')
@Controller('api/v1/logs')
export class LogsController {
  private readonly staticLogger = createStructuredLogger(LogsController.name);

  constructor(
    private readonly logAggregator: LogAggregatorService,
  ) {}

  @Get('search')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search logs by correlation ID' })
  @ApiQuery({ name: 'correlationId', required: true, description: 'Correlation ID to search for' })
  @HttpCode(HttpStatus.OK)
  async searchByCorrelationId(
    @Query('correlationId') correlationId: string,
    @Req() request: FastifyRequest,
  ): Promise<{ success: boolean; data: { correlationId: string; logs: BufferedLog[]; count: number } }> {
    const logger = (request as any).logger || this.staticLogger;
    const requestCorrelationId = (request as any).correlationId;
    
    logger.info('Searching logs by correlation ID', { 
      searchCorrelationId: correlationId,
      correlationId: requestCorrelationId 
    });

    const logs = await this.logAggregator.searchByCorrelationId(correlationId);
    
    logger.info('Log search completed', { 
      searchCorrelationId: correlationId,
      resultCount: logs.length,
      correlationId: requestCorrelationId 
    });

    return {
      success: true,
      data: {
        correlationId,
        logs,
        count: logs.length } };
  }

  @Get('recent')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get recent logs' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of logs to return (default: 100)' })
  @HttpCode(HttpStatus.OK)
  async getRecentLogs(
    @Query('limit') limit?: string,
    @Req() request?: FastifyRequest,
  ): Promise<{ success: boolean; data: { logs: BufferedLog[]; count: number; limit: number } }> {
    const logger = (request as any).logger || this.staticLogger;
    const correlationId = (request as any).correlationId;
    
    const logLimit = limit ? parseInt(limit) : 100;
    
    logger.info('Fetching recent logs', { limit: logLimit, correlationId });

    const logs = await this.logAggregator.getRecentLogs(logLimit);
    
    logger.info('Recent logs fetched', { 
      count: logs.length,
      correlationId 
    });

    return {
      success: true,
      data: {
        logs,
        count: logs.length,
        limit: logLimit } };
  }

  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get logging statistics' })
  @HttpCode(HttpStatus.OK)
  async getStats(
    @Req() request: FastifyRequest,
  ) {
    const logger = (request as any).logger || this.staticLogger;
    const correlationId = (request as any).correlationId;
    
    logger.info('Fetching log statistics', { correlationId });

    // Get recent logs for stats
    const recentLogs = await this.logAggregator.getRecentLogs(1000);
    
    // Calculate statistics
    const stats = {
      total: recentLogs.length,
      byLevel: {} as Record<string, number>,
      byService: {} as Record<string, number>,
      recentErrors: [] as any[] };

    // Count by level and service
    recentLogs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byService[log.service] = (stats.byService[log.service] || 0) + 1;
      
      if (log.level === 'ERROR' && stats.recentErrors.length < 10) {
        stats.recentErrors.push({
          timestamp: log.timestamp,
          service: log.service,
          message: log.message,
          correlationId: log.correlationId });
      }
    });

    logger.info('Log statistics calculated', { 
      total: stats.total,
      correlationId 
    });

    return {
      success: true,
      data: stats };
  }

  @Get('trace')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Trace a request flow by correlation ID' })
  @ApiQuery({ name: 'correlationId', required: true, description: 'Correlation ID to trace' })
  @HttpCode(HttpStatus.OK)
  async traceRequest(
    @Query('correlationId') correlationId: string,
    @Req() request: FastifyRequest,
  ): Promise<{ success: boolean; data: { correlationId: string; totalLogs: number; timeline: any[]; services: Record<string, BufferedLog[]>; summary: any } }> {
    const logger = (request as any).logger || this.staticLogger;
    const requestCorrelationId = (request as any).correlationId;
    
    logger.info('Tracing request flow', { 
      traceCorrelationId: correlationId,
      correlationId: requestCorrelationId 
    });

    const logs = await this.logAggregator.searchByCorrelationId(correlationId);
    
    // Group logs by service
    const serviceGroups = new Map<string, any[]>();
    logs.forEach(log => {
      if (!serviceGroups.has(log.service)) {
        serviceGroups.set(log.service, []);
      }
      serviceGroups.get(log.service)!.push(log);
    });

    // Build trace timeline
    const timeline = logs.map(log => ({
      timestamp: log.timestamp,
      service: log.service,
      level: log.level,
      message: log.message,
      duration: 0, // Will be calculated
    }));

    // Calculate durations between events
    for (let i = 1; i < timeline.length; i++) {
      const prevTime = new Date(timeline[i - 1].timestamp).getTime();
      const currTime = new Date(timeline[i].timestamp).getTime();
      timeline[i - 1].duration = currTime - prevTime;
    }

    // Calculate total request duration
    const startTime = logs.length > 0 ? new Date(logs[0].timestamp).getTime() : 0;
    const endTime = logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).getTime() : 0;
    const totalDuration = endTime - startTime;

    logger.info('Request trace completed', { 
      traceCorrelationId: correlationId,
      serviceCount: serviceGroups.size,
      eventCount: logs.length,
      totalDuration,
      correlationId: requestCorrelationId 
    });

    // Convert serviceGroups Map to Record<string, BufferedLog[]>
    const services: Record<string, BufferedLog[]> = {};
    serviceGroups.forEach((logs, service) => {
      services[service] = logs;
    });

    return {
      success: true,
      data: {
        correlationId,
        totalLogs: logs.length,
        timeline,
        services,
        summary: {
          startTime: logs[0]?.timestamp,
          endTime: logs[logs.length - 1]?.timestamp,
          totalDuration,
          serviceCount: serviceGroups.size,
          eventCount: logs.length
        } } };
  }
}