/**
 * Debug logger that bypasses console entirely
 */

interface LogEntry {
  timestamp: string;
  message: string;
  data?: any;
  stack?: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  log(message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      message,
      data,
      stack: new Error().stack,
    };

    this.logs.push(entry);

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Also try to use console if available
    try {
      if (typeof console !== 'undefined' && console.log) {
        logger.info(`[DebugLogger] ${message}`, data || '');
      }
    } catch (e) {
      // Ignore console errors
    }
  }

  getLogs() {
    return this.logs;
  }

  clear() {
    this.logs = [];
  }

  // Get logs as formatted string
  getLogsAsString() {
    return this.logs
      .map(
        (log) =>
          `[${log.timestamp}] ${log.message}${log.data ? ' - ' + JSON.stringify(log.data) : ''}`,
      )
      .join('\n');
  }
}

// Create global instance
const debugLogger = new DebugLogger();

// Make it globally available
if (typeof window !== 'undefined') {
  (window as any).__debugLogger = debugLogger;
}

export { debugLogger };
