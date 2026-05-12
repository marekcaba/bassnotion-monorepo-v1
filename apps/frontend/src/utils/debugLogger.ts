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

    // REMOVED: No longer output to console to prevent INFO logs
    // This logger is for internal storage only
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
  window.__debugLogger = debugLogger;
}

export { debugLogger };
