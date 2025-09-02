# Security Implementation

## Overview

BassNotion implements multiple layers of security to protect against common web vulnerabilities. This document outlines the security measures in place and how they work.

## Security Middleware Stack

### 1. Helmet.js Integration

Helmet helps secure the application by setting various HTTP headers:

```typescript
// Configuration in security.config.ts
export const helmetConfig = {
  contentSecurityPolicy: false, // Disabled for development
  crossOriginEmbedderPolicy: false,
  originAgentCluster: true,
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
};
```

**Headers Set:**
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-XSS-Protection: 0` - Disabled (modern browsers have better protections)
- `Referrer-Policy: no-referrer` - Controls referrer information
- `Strict-Transport-Security` - Forces HTTPS in production

### 2. Rate Limiting

Protects against brute force and DoS attacks:

```typescript
export const rateLimitConfig = {
  max: 100, // Maximum requests per window
  timeWindow: '15 minutes',
  allowList: ['127.0.0.1'], // Localhost exempted
  skipSuccessfulRequests: false,
  keyGenerator: (request: any) => {
    return request.headers['x-forwarded-for'] || 
           request.connection.remoteAddress || 
           request.ip;
  },
};
```

**Features:**
- 100 requests per 15 minutes per IP (default)
- 500 requests for authenticated users
- Custom headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Configurable per endpoint

### 3. CORS Configuration

Controlled Cross-Origin Resource Sharing:

```typescript
export const corsConfig = {
  origin: (origin: string | undefined, callback: Function) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
    
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
};
```

### 4. Input Sanitization

All input is sanitized to prevent XSS and injection attacks:

```typescript
// SanitizeMiddleware
- Removes script tags
- Strips event handlers (onclick, onerror, etc.)
- Prevents SQL injection patterns
- Blocks NoSQL operators ($ne, $gt, etc.)
- Sanitizes query parameters, body, and route params
```

**Example Sanitization:**
```javascript
// Input
{ title: '<script>alert("xss")</script>Hello' }

// Output
{ title: 'Hello' }
```

### 5. Correlation ID Tracking

Every request gets a unique correlation ID for tracing:

```typescript
// CorrelationMiddleware
- Generates UUID v4 for each request
- Accepts client-provided IDs (validated)
- Added to response headers
- Used in logging for request tracing
```

## Authentication & Authorization

### JWT Implementation

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Tokens signed with secure secret
- Payload includes user ID and email only

### Auth Guard

```typescript
@UseGuards(AuthGuard)
```

Protects endpoints requiring authentication:
- Validates JWT token
- Extracts user information
- Adds user to request object
- Returns 401 for invalid/expired tokens

## File Upload Security

### MIME Type Validation

```typescript
// Allowed MIME types strictly defined
const allowedMimeTypes = [
  'audio/midi',
  'audio/x-midi',
  'application/x-midi',
  'text/xml',
  'application/xml',
];
```

### File Size Limits

- Maximum file size: 10MB
- Configurable per endpoint
- Returns 413 for oversized files

### File Storage

- Files stored in Supabase (secure cloud storage)
- Access controlled by storage policies
- Public URLs generated on-demand
- File paths sanitized

## Database Security

### Parameterized Queries

All database queries use Supabase client which:
- Prevents SQL injection
- Uses parameterized queries
- Validates data types
- Enforces RLS (Row Level Security)

### Connection Security

- SSL/TLS for database connections
- Service role key for admin operations
- Anon key for public operations
- Keys stored in environment variables

## API Security

### Request Validation

Using Zod schemas for:
- Type validation
- Data sanitization  
- Required field enforcement
- Format validation (email, UUID, etc.)

### Error Handling

- Generic error messages to users
- Detailed errors only in logs
- Stack traces hidden in production
- Correlation IDs for debugging

## Session Security

### Cookie Settings (when implemented)

```typescript
{
  httpOnly: true,      // No JavaScript access
  secure: true,        // HTTPS only (production)
  sameSite: 'strict',  // CSRF protection
  maxAge: 86400000,    // 24 hours
}
```

## Content Security

### Headers

```typescript
// Prevents content type sniffing
'X-Content-Type-Options': 'nosniff'

// Blocks site in iframes
'X-Frame-Options': 'DENY'

// Disables Flash cross-domain
'X-Permitted-Cross-Domain-Policies': 'none'
```

### Response Sanitization

- HTML entities encoded in responses
- JSON responses properly escaped
- Content-Type headers enforced

## Monitoring & Alerting

### Sentry Integration

- Captures security-related errors
- Monitors rate limit violations
- Tracks authentication failures
- Alerts on suspicious patterns

### Health Checks

- Monitors service availability
- Checks database connectivity
- Validates security middleware
- Reports system metrics

## Testing Security

### Integration Tests

```bash
# Run security tests
pnpm test apps/backend/src/shared/middleware/__tests__/
```

Tests cover:
- XSS prevention
- SQL injection blocking
- Rate limiting
- CORS configuration
- Security headers

### Manual Testing

1. **XSS Testing:**
   ```bash
   curl -X POST http://localhost:3000/api/exercises \
     -H "Content-Type: application/json" \
     -d '{"title":"<script>alert(1)</script>"}'
   ```

2. **Rate Limit Testing:**
   ```bash
   for i in {1..101}; do
     curl http://localhost:3000/api/health
   done
   ```

3. **CORS Testing:**
   ```bash
   curl -H "Origin: http://evil.com" \
     http://localhost:3000/api/health -v
   ```

## Security Best Practices

### For Developers

1. **Never trust user input** - Always validate and sanitize
2. **Use parameterized queries** - Never concatenate SQL
3. **Implement least privilege** - Minimum required permissions
4. **Keep dependencies updated** - Regular security patches
5. **Use HTTPS everywhere** - Even in development
6. **Log security events** - But not sensitive data
7. **Review security regularly** - Quarterly audits

### Environment Variables

```bash
# Required for security
NODE_ENV=production
SUPABASE_SERVICE_ROLE_KEY=secret
JWT_SECRET=complex-random-string
ALLOWED_ORIGINS=https://app.bassnotion.com
SENTRY_DSN=https://...

# Never commit:
- API keys
- Database passwords
- JWT secrets
- Service role keys
```

### Deployment Security

1. **Use environment variables** - Never hardcode secrets
2. **Enable HTTPS** - With valid certificates
3. **Configure firewalls** - Restrict unnecessary ports
4. **Update regularly** - OS and dependency patches
5. **Monitor logs** - Watch for suspicious activity
6. **Backup data** - Encrypted and tested

## Incident Response

### If Security Breach Detected

1. **Immediate Actions:**
   - Revoke compromised tokens
   - Reset affected passwords
   - Enable emergency rate limits
   - Notify security team

2. **Investigation:**
   - Check logs with correlation IDs
   - Review Sentry alerts
   - Analyze attack patterns
   - Document timeline

3. **Recovery:**
   - Patch vulnerabilities
   - Update security rules
   - Notify affected users
   - Post-mortem analysis

## Security Checklist

Before deploying:

- [ ] All endpoints have appropriate authentication
- [ ] Input validation on all user data
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] HTTPS enforced
- [ ] Secrets in environment variables
- [ ] Dependencies updated
- [ ] Security tests passing
- [ ] Error messages sanitized
- [ ] Logs reviewed for sensitive data
- [ ] Backup and recovery tested

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)