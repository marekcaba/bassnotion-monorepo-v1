# Monitoring Dashboard

## Overview

BassNotion includes a comprehensive monitoring dashboard for tracking system health, performance metrics, and real-time analytics. The dashboard provides visibility into:

- System health status
- Service availability 
- Performance metrics
- Real-time resource usage
- Historical trends

## Accessing the Dashboard

The monitoring dashboard is available at:

```
http://localhost:3001/admin/monitoring
```

In production, proper authentication should be implemented to restrict access.

## Dashboard Features

### 1. System Overview

The top section displays key metrics at a glance:

- **System Status**: Overall health (healthy/degraded/unhealthy)
- **Response Time**: Average API response time
- **Error Rate**: Percentage of failed requests
- **CPU Usage**: Current CPU utilization

### 2. Services Tab

Monitor the status of critical services:

- **API Server**: Health and response time
- **Database**: Connection status and query performance
- **Cache**: (When implemented) Cache service status

### 3. System Resources Tab

Track resource utilization:

- **Memory Usage**: RAM usage with visual progress bar
- **Load Average**: System load over 1, 5, and 15 minutes

### 4. Performance Tab

Detailed endpoint performance metrics:

- Response times (average, P95, P99)
- Request counts
- Error rates by endpoint
- Method types (GET, POST, etc.)

### 5. Real-time Metrics Tab

Live charts displaying:

- **CPU Usage**: Historical CPU utilization
- **Memory Usage**: Memory consumption over time
- **Response Time**: API latency trends
- **Error Rate**: Error percentage trends

## Auto-refresh Settings

The dashboard supports configurable refresh intervals:

- 5 seconds (default)
- 10 seconds
- 30 seconds  
- 1 minute

## Health Check Endpoints

The monitoring system uses these endpoints:

### Basic Health Check
```bash
GET /api/health
```

Returns basic health status:
```json
{
  "status": "ok",
  "timestamp": "2025-08-30T16:00:00.000Z",
  "message": "BassNotion Backend is running",
  "database": "connected"
}
```

### Detailed Health Check
```bash
GET /api/health/detailed
```

Returns comprehensive system information including CPU, memory, and service status.

### Liveness Probe
```bash
GET /api/health/live
```

Simple check to verify the service is running.

### Readiness Probe
```bash
GET /api/health/ready
```

Verifies all dependencies are ready to handle requests.

### Performance Metrics
```bash
GET /api/health/metrics
```

Returns performance metrics for API endpoints.

## Implementation Details

### Frontend Components

- **MonitoringDashboard**: Main dashboard page (`/apps/frontend/src/app/admin/monitoring/page.tsx`)
- **MetricsChart**: Real-time chart component for visualizing metrics
- **AdminLayout**: Layout wrapper for admin pages

### Backend Integration

The health endpoints are implemented in:
- `/apps/backend/src/health/health.controller.ts` (TypeScript implementation)
- `/apps/backend/src/health.js` (Fallback for PM2)

### Data Flow

1. Frontend polls health endpoints at configured intervals
2. Data is processed and stored in component state
3. Historical data is maintained for charts (last 50 data points)
4. UI updates automatically with new data

## Future Enhancements

1. **Alerting System**
   - Email/SMS alerts for critical issues
   - Threshold-based notifications
   - Alert history and acknowledgment

2. **Advanced Metrics**
   - Database query performance
   - Cache hit rates
   - WebSocket connection stats
   - Audio processing metrics

3. **Integration with APM Tools**
   - Connect to Sentry for error details
   - Link to external monitoring services
   - Export metrics to Prometheus/Grafana

4. **User Activity Monitoring**
   - Active user counts
   - Feature usage statistics
   - Session duration metrics

5. **Custom Dashboards**
   - Configurable widget layouts
   - Saved dashboard configurations
   - Role-based dashboard views

## Security Considerations

1. **Authentication Required**
   - Currently limited to localhost access
   - Production should implement admin authentication
   - Consider role-based access control

2. **Data Sensitivity**
   - No PII in metrics
   - Aggregate data only
   - Secure transmission (HTTPS)

## Troubleshooting

### Dashboard Not Loading

1. Verify backend is running: `pm2 status`
2. Check health endpoint: `curl http://localhost:3000/api/health`
3. Verify frontend is running on port 3001
4. Check browser console for errors

### Metrics Not Updating

1. Check refresh interval setting
2. Verify network connectivity
3. Check backend logs: `pm2 logs bassnotion-backend`
4. Ensure CORS is properly configured

### Performance Issues

1. Increase refresh interval for slower connections
2. Reduce chart history length if needed
3. Monitor browser memory usage
4. Consider pagination for large datasets