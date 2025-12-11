# Log Aggregation Service Complete 🎉

## Summary

We've successfully implemented a comprehensive log aggregation service that collects, stores, and provides searchability for all structured logs across the BassNotion platform.

## What Was Implemented

### 1. Log Aggregation Service (`LogAggregatorService`)

- **Buffered Writing**: Logs are buffered and flushed in batches for efficiency
- **Multiple Destinations**: Support for file, database, console, and external services
- **Automatic Rotation**: Log files rotate when they reach size limits
- **Cleanup**: Old log files are automatically removed
- **Search Capabilities**: Search logs by correlation ID
- **Performance Optimized**: Minimal impact on application performance

### 2. Log Transport Service (`LogTransportService`)

- **Global Integration**: Connects structured logger to aggregator
- **Console Interception**: Captures all console output in production
- **Flexible Configuration**: Enable/disable based on environment

### 3. Database Storage

- **Supabase Table**: `structured_logs` table with optimized indexes
- **Retention Policy**: Automatic cleanup of logs older than 30 days
- **Summary Views**: Pre-aggregated views for analytics
- **RLS Policies**: Users can only see their own logs (admins see all)

### 4. API Endpoints

- **`GET /api/v1/logs/search`**: Search by correlation ID
- **`GET /api/v1/logs/recent`**: Get recent logs with pagination
- **`GET /api/v1/logs/stats`**: Get log statistics and error summary
- **`GET /api/v1/logs/trace`**: Trace complete request flow

### 5. Frontend Components

- **LogViewer Component**: Interactive log search and visualization
- **Debug Page**: `/debug/logs` page for log analysis
- **Timeline View**: Visual representation of request flow
- **Service Grouping**: See which services were involved

## Configuration

### Environment Variables

```bash
# Backend (.env)
LOG_AGGREGATION=true              # Enable aggregation
LOG_BUFFER_SIZE=100              # Buffer size before flush
LOG_FLUSH_INTERVAL=5000          # Flush interval (ms)
LOG_DIR=logs/aggregated          # Log file directory
LOG_MAX_FILE_SIZE=10485760       # Max file size (10MB)
LOG_MAX_FILES=10                 # Files to keep

# Frontend (.env.local)
NEXT_PUBLIC_LOG_AGGREGATION=true # Show aggregation status
```

## How It Works

### 1. Log Flow

```
Application Code → Structured Logger → Log Transporter → Log Aggregator → Destinations
```

### 2. Buffering Strategy

- Logs are buffered up to `LOG_BUFFER_SIZE` entries
- Buffer flushes every `LOG_FLUSH_INTERVAL` milliseconds
- Immediate flush when buffer is full
- Graceful shutdown flushes remaining logs

### 3. Storage Strategy

- **Files**: JSONL format for easy parsing
- **Database**: Structured storage with indexes
- **External**: Optional integration point

## Usage Examples

### Backend Service

```typescript
const logger = this.requestContext?.getLogger() || this.staticLogger;
logger.info('Operation completed', {
  duration: 1234,
  correlationId,
});
// This log is automatically aggregated
```

### Frontend Component

```typescript
const { correlationId, logger } = useCorrelation('MyComponent');
logger.error('API call failed', error, { correlationId });
// This log flows through the API to aggregation
```

### Searching Logs

```typescript
// In debug page or via API
const trace = await apiClient.get(
  `/api/v1/logs/trace?correlationId=${correlationId}`,
);
// Returns complete request flow with timing
```

## File Structure Created

```
apps/backend/src/infrastructure/logging/
├── log-aggregator.service.ts    # Core aggregation service
├── log-transport.service.ts     # Logger integration
├── logs.controller.ts           # API endpoints
├── logging.module.ts            # NestJS module
└── log-initializer.ts          # Startup configuration

apps/frontend/src/
├── shared/components/LogViewer.tsx  # Log search UI
└── app/debug/logs/page.tsx         # Debug page

supabase/migrations/
└── 20240901000000_create_structured_logs_table.sql

docs/
└── LOG_AGGREGATION_GUIDE.md    # Comprehensive documentation
```

## Key Features

### 1. Correlation Search

- Search all logs for a specific correlation ID
- See the complete request lifecycle
- Identify bottlenecks and errors

### 2. Request Tracing

- Visual timeline of request flow
- Service-by-service breakdown
- Duration between events
- Total request time

### 3. Error Analysis

- Recent errors dashboard
- Error grouping by service
- Stack traces preserved
- Context data included

### 4. Performance Monitoring

- Log volume statistics
- Service-level metrics
- Buffer performance stats
- Write performance tracking

## Benefits Achieved

1. **Centralized Logging**: All logs in one place
2. **Request Tracing**: Follow requests across services
3. **Error Investigation**: Quickly find and analyze errors
4. **Performance Analysis**: Identify slow operations
5. **Debugging Power**: Complete context for any issue
6. **Production Ready**: Minimal performance impact
7. **Scalable**: Handles high log volumes efficiently

## Security Considerations

- **Authentication Required**: All log endpoints require auth
- **User Isolation**: Users only see their own logs
- **Admin Access**: Admins can see all logs
- **No Sensitive Data**: Passwords/tokens never logged
- **Rate Limited**: Prevents log endpoint abuse

## Next Steps

1. **Enable in Production**

   ```bash
   LOG_AGGREGATION=true
   ```

2. **Configure External Service** (Optional)

   ```bash
   EXTERNAL_LOG_ENDPOINT=https://your-service.com
   EXTERNAL_LOG_API_KEY=your-key
   ```

3. **Monitor Log Volume**
   - Check disk usage regularly
   - Adjust retention as needed
   - Consider external storage for long-term

4. **Train Team**
   - Show how to use correlation IDs
   - Demonstrate log search
   - Practice debugging with traces

## Troubleshooting

### If logs aren't appearing:

1. Check `LOG_AGGREGATION=true`
2. Verify log directory permissions
3. Check application logs for errors
4. Ensure LoggingModule is imported

### If search is slow:

1. Add more specific indexes
2. Reduce retention period
3. Archive old logs
4. Consider external service

### If disk fills up:

1. Reduce `LOG_MAX_FILES`
2. Decrease `LOG_MAX_FILE_SIZE`
3. Shorten retention period
4. Set up log archival

## Success Metrics

✅ Log aggregation service fully implemented
✅ Multiple storage destinations supported
✅ API endpoints for log search and analysis
✅ Frontend UI for log visualization
✅ Request tracing with timing analysis
✅ Automatic rotation and cleanup
✅ Production-ready with minimal overhead
✅ Complete documentation and examples

The log aggregation service is now ready for production use and will dramatically improve debugging and monitoring capabilities across the BassNotion platform.
