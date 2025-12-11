# Log Aggregation Service Guide

This guide explains how to use and configure the centralized log aggregation service in BassNotion.

## Overview

The log aggregation service collects all structured logs from across the platform and stores them in multiple destinations for analysis and debugging.

## Features

- **Centralized Collection**: All logs flow through a single aggregation point
- **Multiple Destinations**: Logs can be sent to files, database, or external services
- **Buffered Writing**: Logs are buffered for efficient batch writes
- **Automatic Rotation**: Log files are automatically rotated when they reach size limits
- **Correlation Search**: Search and trace requests using correlation IDs
- **Performance Optimized**: Minimal impact on application performance

## Configuration

### Environment Variables

```bash
# Enable log aggregation (default: false in dev, true in production)
LOG_AGGREGATION=true

# Log buffer settings
LOG_BUFFER_SIZE=100        # Number of logs to buffer before flushing
LOG_FLUSH_INTERVAL=5000    # Flush interval in milliseconds

# File logging settings
LOG_DIR=logs/aggregated    # Directory for log files
LOG_MAX_FILE_SIZE=10485760 # Max file size in bytes (10MB)
LOG_MAX_FILES=10           # Number of log files to keep

# External service settings (optional)
EXTERNAL_LOG_ENDPOINT=https://your-log-service.com/api/logs
EXTERNAL_LOG_API_KEY=your-api-key

# Console logging
LOG_TO_CONSOLE=false       # Set to true to also log to console in production
```

### Destinations

The service supports multiple log destinations:

1. **File** (enabled by default)
   - Writes to JSONL files in the configured directory
   - Automatic rotation and cleanup

2. **Database** (disabled by default)
   - Stores in `structured_logs` table
   - Enables powerful querying capabilities

3. **Console** (development only)
   - Outputs to stdout/stderr
   - Useful for development debugging

4. **External** (optional)
   - Send to services like Elasticsearch, Datadog, etc.
   - Configure endpoint and API key

## API Endpoints

### Search by Correlation ID

```bash
GET /api/v1/logs/search?correlationId=xxx-xxx-xxx

# Response
{
  "success": true,
  "data": {
    "correlationId": "xxx-xxx-xxx",
    "logs": [...],
    "count": 42
  }
}
```

### Get Recent Logs

```bash
GET /api/v1/logs/recent?limit=100

# Response
{
  "success": true,
  "data": {
    "logs": [...],
    "count": 100,
    "limit": 100
  }
}
```

### Get Log Statistics

```bash
GET /api/v1/logs/stats

# Response
{
  "success": true,
  "data": {
    "total": 1000,
    "byLevel": {
      "INFO": 800,
      "WARN": 150,
      "ERROR": 50
    },
    "byService": {
      "UserService": 300,
      "AudioPlayer": 200,
      ...
    },
    "recentErrors": [...]
  }
}
```

### Trace Request Flow

```bash
GET /api/v1/logs/trace?correlationId=xxx-xxx-xxx

# Response
{
  "success": true,
  "data": {
    "correlationId": "xxx-xxx-xxx",
    "startTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-01-01T00:00:05Z",
    "totalDuration": 5000,
    "serviceCount": 5,
    "services": ["UserService", "AuthGuard", ...],
    "timeline": [...],
    "logs": [...]
  }
}
```

## Database Schema

If using database storage, logs are stored in the `structured_logs` table:

```sql
CREATE TABLE structured_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  level VARCHAR(10) NOT NULL,
  service VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  correlation_id VARCHAR(255) NOT NULL,
  user_id UUID,
  session_id VARCHAR(255),
  data JSONB,
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage Examples

### Searching for a Specific Request

```typescript
// Frontend - Get correlation ID from failed request
const response = await apiClient.get('/api/users/123');
const correlationId = response.headers['x-correlation-id'];

// Search for all logs related to this request
const logs = await apiClient.get(
  `/api/v1/logs/search?correlationId=${correlationId}`,
);
```

### Monitoring Errors

```typescript
// Get recent errors
const stats = await apiClient.get('/api/v1/logs/stats');
const recentErrors = stats.data.recentErrors;

// Trace each error
for (const error of recentErrors) {
  const trace = await apiClient.get(
    `/api/v1/logs/trace?correlationId=${error.correlationId}`,
  );
  console.log(`Error flow:`, trace.data.timeline);
}
```

### Command Line Search

```bash
# Search logs in files
grep "correlation-xxx" logs/aggregated/*.jsonl | jq .

# Parse and filter logs
cat logs/aggregated/structured-logs-*.jsonl | \
  jq 'select(.level == "ERROR") | {timestamp, service, message}'
```

## Performance Considerations

1. **Buffer Size**: Larger buffers reduce write frequency but increase memory usage
2. **Flush Interval**: Shorter intervals provide more real-time logs but increase I/O
3. **File Size**: Smaller files are easier to search but create more files
4. **Database Storage**: Enable only if you need advanced querying capabilities

## Troubleshooting

### Logs Not Appearing

1. Check if `LOG_AGGREGATION=true` is set
2. Verify the log directory exists and is writable
3. Check for errors in the application logs
4. Ensure the LoggingModule is imported in AppModule

### High Memory Usage

1. Reduce `LOG_BUFFER_SIZE`
2. Decrease `LOG_FLUSH_INTERVAL`
3. Check for log storms (excessive logging)

### Database Connection Issues

1. Logs will fallback to file storage automatically
2. Check database connection settings
3. Verify the `structured_logs` table exists

### File System Full

1. Reduce `LOG_MAX_FILES`
2. Decrease `LOG_MAX_FILE_SIZE`
3. Set up external log archival

## Best Practices

1. **Use Correlation IDs**: Always include correlation IDs in your logs
2. **Log Levels**: Use appropriate log levels (debug, info, warn, error)
3. **Structured Data**: Include relevant context in the data field
4. **Avoid Sensitive Data**: Never log passwords, tokens, or PII
5. **Monitor Volume**: Keep an eye on log volume to avoid storage issues

## Integration with External Services

### Elasticsearch

```typescript
// Set environment variables
EXTERNAL_LOG_ENDPOINT=https://your-es-cluster.com/_bulk
EXTERNAL_LOG_API_KEY=your-api-key

// Logs will be automatically sent to Elasticsearch
```

### Datadog

```typescript
// Set environment variables
EXTERNAL_LOG_ENDPOINT=https://http-intake.logs.datadoghq.com/v1/input
EXTERNAL_LOG_API_KEY=your-datadog-api-key

// Configure Datadog tags in the log data
```

### Custom Integration

Implement a custom handler in `log-aggregator.service.ts`:

```typescript
private async flushToExternal(logs: BufferedLog[]): Promise<void> {
  // Your custom integration code
}
```

## Security Considerations

1. **Access Control**: Log endpoints require authentication
2. **Data Sanitization**: Sensitive data should never be logged
3. **Retention Policy**: Set up automatic cleanup of old logs
4. **Encryption**: Use HTTPS for external log services
5. **Rate Limiting**: Log endpoints are rate-limited

## Future Enhancements

- [ ] Real-time log streaming via WebSockets
- [ ] Advanced log analytics dashboard
- [ ] Automatic anomaly detection
- [ ] Log-based alerting system
- [ ] Integration with APM tools
