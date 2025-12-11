import { setGlobalLogTransporter, LogEntry } from '@bassnotion/contracts';
import { LogTransportService } from './log-transport.service.js';

/**
 * Initialize the global log transporter to send logs to the aggregator
 */
export function initializeLogging(logTransport: LogTransportService): void {
  // Set up the global log transporter
  setGlobalLogTransporter((entry: LogEntry) => {
    // Send to log aggregator
    logTransport
      .log(entry.level, entry.context.service || 'Unknown', entry.message, {
        correlationId: entry.context.correlationId,
        userId: entry.context.userId,
        sessionId: entry.context.sessionId,
        data: entry.data,
        error: entry.error,
      })
      .catch((error) => {
        // Log to console if aggregator fails
        console.error('Failed to send log to aggregator:', error);
      });
  });

  // Log that logging has been initialized
  logTransport.log('info', 'LogInitializer', 'Global logging initialized', {
    correlationId: 'system',
    data: {
      aggregationEnabled: process.env.LOG_AGGREGATION === 'true',
      environment: process.env.NODE_ENV,
    },
  });
}
