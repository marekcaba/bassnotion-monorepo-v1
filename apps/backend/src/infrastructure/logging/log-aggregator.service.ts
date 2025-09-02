import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '../../shared/services/request-context.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';

export interface LogDestination {
  type: 'file' | 'database' | 'console' | 'external';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface LogAggregatorConfig {
  destinations: LogDestination[];
  bufferSize: number;
  flushInterval: number;
  maxFileSize: number;
  maxFiles: number;
  logDir: string;
}

export interface BufferedLog {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  correlationId: string;
  userId?: string;
  sessionId?: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

@Injectable()
export class LogAggregatorService implements OnModuleInit, OnModuleDestroy {
  private readonly staticLogger = createStructuredLogger(LogAggregatorService.name);
  private config: LogAggregatorConfig;
  private logBuffer: BufferedLog[] = [];
  private flushTimer?: NodeJS.Timeout;
  private fileStream?: WriteStream;
  private currentLogFile?: string;
  private isShuttingDown = false;

  constructor(
    private readonly db: DatabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {
    this.config = {
      destinations: [
        { type: 'file', enabled: true },
        { type: 'database', enabled: false }, // Disabled by default to avoid log loops
        { type: 'console', enabled: process.env.NODE_ENV === 'development' },
        { type: 'external', enabled: false },
      ],
      bufferSize: parseInt(process.env.LOG_BUFFER_SIZE || '100'),
      flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL || '5000'), // 5 seconds
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      logDir: process.env.LOG_DIR || 'logs/aggregated' };
  }

  async onModuleInit() {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();
    
    logger.info('Initializing log aggregator service', { 
      config: this.config,
      correlationId 
    });

    // Ensure log directory exists
    await this.ensureLogDirectory();

    // Start file stream if file destination is enabled
    if (this.isDestinationEnabled('file')) {
      await this.initializeFileStream();
    }

    // Start flush timer
    this.startFlushTimer();

    // Set up global log interceptor
    this.interceptGlobalLogs();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    
    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining logs
    await this.flush();

    // Close file stream
    if (this.fileStream) {
      await new Promise((resolve) => {
        this.fileStream!.end(resolve);
      });
    }
  }

  /**
   * Add a log entry to the aggregator
   */
  async log(entry: BufferedLog): Promise<void> {
    if (this.isShuttingDown) return;

    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered logs to all enabled destinations
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    const flushPromises: Promise<void>[] = [];

    if (this.isDestinationEnabled('file')) {
      flushPromises.push(this.flushToFile(logsToFlush));
    }

    if (this.isDestinationEnabled('database')) {
      flushPromises.push(this.flushToDatabase(logsToFlush));
    }

    if (this.isDestinationEnabled('external')) {
      flushPromises.push(this.flushToExternal(logsToFlush));
    }

    try {
      await Promise.all(flushPromises);
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Error flushing logs', error as Error, { correlationId });
    }
  }

  /**
   * Flush logs to file
   */
  private async flushToFile(logs: BufferedLog[]): Promise<void> {
    if (!this.fileStream) {
      await this.initializeFileStream();
    }

    const lines = logs.map(log => JSON.stringify(log) + '\n').join('');
    
    return new Promise((resolve, reject) => {
      this.fileStream!.write(lines, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  /**
   * Flush logs to database
   */
  private async flushToDatabase(logs: BufferedLog[]): Promise<void> {
    try {
      const { error } = await this.db.supabase
        .from('structured_logs')
        .insert(logs.map(log => ({
          timestamp: log.timestamp,
          level: log.level,
          service: log.service,
          message: log.message,
          correlation_id: log.correlationId,
          user_id: log.userId,
          session_id: log.sessionId,
          data: log.data,
          error: log.error })));

      if (error) {
        throw error;
      }
    } catch (error) {
      // Log to file instead to avoid infinite loop
      if (this.fileStream) {
        const err = error as Error;
        const errorLog = {
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'LogAggregatorService',
          message: 'Failed to write logs to database',
          correlationId: 'system',
          error: {
            name: err.name || 'DatabaseError',
            message: err.message } };
        this.fileStream.write(JSON.stringify(errorLog) + '\n');
      }
    }
  }

  /**
   * Flush logs to external service (e.g., Elasticsearch, Datadog, etc.)
   */
  private async flushToExternal(logs: BufferedLog[]): Promise<void> {
    // This is a placeholder for external log service integration
    // You would implement the actual API calls here
    const externalEndpoint = process.env.EXTERNAL_LOG_ENDPOINT;
    const apiKey = process.env.EXTERNAL_LOG_API_KEY;

    if (!externalEndpoint || !apiKey) {
      return;
    }

    try {
      const response = await fetch(externalEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ logs }) });

      if (!response.ok) {
        throw new Error(`External log service returned ${response.status}`);
      }
    } catch (error) {
      // Log to file to avoid infinite loop
      if (this.fileStream) {
        const err = error as Error;
        const errorLog = {
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'LogAggregatorService',
          message: 'Failed to send logs to external service',
          correlationId: 'system',
          error: {
            name: err.name || 'ExternalServiceError',
            message: err.message } };
        this.fileStream.write(JSON.stringify(errorLog) + '\n');
      }
    }
  }

  /**
   * Initialize file stream for log writing
   */
  private async initializeFileStream(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.config.logDir, `structured-logs-${timestamp}.jsonl`);
    
    this.fileStream = createWriteStream(this.currentLogFile, {
      flags: 'a',
      encoding: 'utf8' });

    // Rotate logs if file gets too large
    this.fileStream.on('drain', async () => {
      try {
        const stats = await fs.stat(this.currentLogFile!);
        if (stats.size > this.config.maxFileSize) {
          await this.rotateLogFile();
        }
      } catch (error) {
        // File might not exist yet, ignore
      }
    });
  }

  /**
   * Rotate log files when they get too large
   */
  private async rotateLogFile(): Promise<void> {
    if (this.fileStream) {
      await new Promise((resolve) => {
        this.fileStream!.end(resolve);
      });
    }

    await this.initializeFileStream();
    await this.cleanupOldLogs();
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDir);
      const logFiles = files
        .filter(f => f.startsWith('structured-logs-') && f.endsWith('.jsonl'))
        .sort()
        .reverse();

      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.config.maxFiles);
      
      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.config.logDir, file));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true });
    } catch (error) {
      const logger = this.requestContext?.getLogger() || this.staticLogger;
      const correlationId = this.requestContext?.getCorrelationId();
      logger.error('Failed to create log directory', error as Error, { correlationId });
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors in timer
      });
    }, this.config.flushInterval);
  }

  /**
   * Check if a destination is enabled
   */
  private isDestinationEnabled(type: string): boolean {
    const destination = this.config.destinations.find(d => d.type === type);
    return destination?.enabled || false;
  }

  /**
   * Intercept global console logs and structured logs
   */
  private interceptGlobalLogs(): void {
    // This is where we would intercept the structured logger output
    // For now, we'll rely on the structured logger calling our log method directly
  }

  /**
   * Search logs by correlation ID
   */
  async searchByCorrelationId(correlationId: string): Promise<BufferedLog[]> {
    const results: BufferedLog[] = [];

    // Search in current buffer
    results.push(...this.logBuffer.filter(log => log.correlationId === correlationId));

    // Search in database if enabled
    if (this.isDestinationEnabled('database')) {
      try {
        const { data } = await this.db.supabase
          .from('structured_logs')
          .select('*')
          .eq('correlation_id', correlationId)
          .order('timestamp', { ascending: true });

        if (data) {
          results.push(...data.map(row => ({
            timestamp: row.timestamp,
            level: row.level,
            service: row.service,
            message: row.message,
            correlationId: row.correlation_id,
            userId: row.user_id,
            sessionId: row.session_id,
            data: row.data,
            error: row.error })));
        }
      } catch (error) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        logger.error('Error searching logs in database', error as Error, { correlationId });
      }
    }

    // TODO: Search in files (would need to implement file parsing)

    return results.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 100): Promise<BufferedLog[]> {
    const results: BufferedLog[] = [];

    // Add from buffer
    results.push(...this.logBuffer.slice(-limit));

    // Get from database if enabled and we need more
    if (this.isDestinationEnabled('database') && results.length < limit) {
      try {
        const { data } = await this.db.supabase
          .from('structured_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(limit - results.length);

        if (data) {
          results.push(...data.map(row => ({
            timestamp: row.timestamp,
            level: row.level,
            service: row.service,
            message: row.message,
            correlationId: row.correlation_id,
            userId: row.user_id,
            sessionId: row.session_id,
            data: row.data,
            error: row.error })));
        }
      } catch (error) {
        const logger = this.requestContext?.getLogger() || this.staticLogger;
        const correlationId = this.requestContext?.getCorrelationId();
        logger.error('Error getting recent logs from database', error as Error, { correlationId });
      }
    }

    return results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, limit);
  }
}