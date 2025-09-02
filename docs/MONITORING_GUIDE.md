# Production Monitoring Guide

## Overview

The BassNotion platform includes comprehensive monitoring capabilities to ensure system health and performance in production.

## Health Check Endpoints

### Basic Health Check
- **Endpoint**: `GET /api/health`
- **Purpose**: Quick health status check
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-08-30T15:50:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 23
    },
    "api": {
      "status": "healthy"
    },
    "supabase": {
      "status": "healthy",
      "responseTime": 45
    }
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

### Detailed Health Check
- **Endpoint**: `GET /api/health/detailed`
- **Purpose**: Comprehensive system metrics
- **Response**: Includes all basic health data plus:
  - CPU usage and count
  - Memory usage (total, used, free, percentage)
  - System load averages
  - Process memory details
  - Process ID and uptime

### Liveness Probe
- **Endpoint**: `GET /api/health/live`
- **Purpose**: Kubernetes liveness probe
- **Response**: `{ "status": "ok" }`
- **Use Case**: Determines if the container should be restarted

### Readiness Probe
- **Endpoint**: `GET /api/health/ready`
- **Purpose**: Kubernetes readiness probe
- **Response**:
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "supabase": true
  }
}
```
- **Use Case**: Determines if the container can receive traffic

### Performance Metrics
- **Endpoint**: `GET /api/health/metrics`
- **Purpose**: Request and error tracking metrics
- **Response**:
```json
{
  "requests": {
    "total": 10000,
    "successful": 9950,
    "failed": 50,
    "averageResponseTime": 125
  },
  "errors": {
    "total": 50,
    "byType": {
      "404": 30,
      "500": 10,
      "503": 10
    }
  },
  "timestamp": "2024-08-30T15:50:00.000Z"
}
```

## Performance Tracking

The system automatically tracks:
- Request count (total, successful, failed)
- Response times (last 1000 requests)
- Error rates by type
- Average response time

Performance data is collected via the `PerformanceMiddleware` which runs on all non-health endpoints.

## Frontend Health Monitoring

The frontend includes a `HealthStatus` component that:
- Displays real-time health status
- Shows when the backend is unavailable
- Positioned at bottom-left of the screen (70px from bottom)
- Automatically polls health endpoint every 30 seconds

## Logging

All monitoring endpoints use structured logging with:
- Correlation IDs for request tracking
- Service identifiers
- Timestamp and log levels
- Performance metrics

## Monitoring Best Practices

1. **Health Check Frequency**
   - Basic health: Every 30 seconds
   - Detailed health: Every 5 minutes
   - Metrics: Every minute for dashboards

2. **Alert Thresholds**
   - CPU > 80% for 5 minutes
   - Memory > 90%
   - Average response time > 500ms
   - Error rate > 5%

3. **Dashboard Setup**
   - Use `/api/health/metrics` for real-time graphs
   - Monitor all health endpoints
   - Track uptime and availability
   - Set up alerts for degraded/unhealthy states

## Integration with Monitoring Services

### Grafana
```yaml
datasources:
  - name: BassNotion Health
    type: json
    url: https://api.bassnotion.com/health/metrics
    jsonData:
      interval: 60s
```

### Prometheus
```yaml
scrape_configs:
  - job_name: 'bassnotion'
    metrics_path: '/api/health/metrics'
    scrape_interval: 60s
    static_configs:
      - targets: ['api.bassnotion.com']
```

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Troubleshooting

### Health Check Failures
1. Check individual component status in `/api/health`
2. Review detailed metrics in `/api/health/detailed`
3. Check logs for correlation IDs
4. Verify database connectivity
5. Check Supabase API availability

### Performance Issues
1. Monitor `/api/health/metrics` for response times
2. Check CPU and memory in `/api/health/detailed`
3. Review error rates by type
4. Enable debug logging if needed

### Frontend Connection Issues
1. Check browser console for CORS errors
2. Verify API URL configuration
3. Check network tab for failed requests
4. Review health status component visibility