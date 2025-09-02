# Security Implementation Guide

## Overview

This document details the security measures implemented in the BassNotion platform as part of Phase 1 improvements.

## Security Headers (Helmet)

We use `@fastify/helmet` to set various HTTP headers that help protect against common attacks:

### Headers Configured:
- **Content-Security-Policy**: Restricts sources for scripts, styles, images, etc.
- **X-Frame-Options**: SAMEORIGIN - Prevents clickjacking
- **X-Content-Type-Options**: nosniff - Prevents MIME type sniffing
- **Strict-Transport-Security**: Forces HTTPS connections
- **X-XSS-Protection**: Basic XSS protection for older browsers
- **Referrer-Policy**: Controls referrer information sent with requests

### Configuration Location:
- `/apps/backend/src/config/security.config.ts`
- Applied in `/apps/backend/src/main.ts`

## Rate Limiting

### Global Rate Limiting
- **Package**: `@fastify/rate-limit`
- **Default Limits**: 100 requests per 15 minutes per IP
- **Disabled in Development**: For easier testing

### Endpoint-Specific Rate Limiting
Different endpoints have different limits:
- **Auth endpoints**: 5 requests per 15 minutes
- **Upload endpoints**: 10 requests per hour  
- **Public API**: 200 requests per 15 minutes

### Custom Rate Limit Decorators
```typescript
@AuthRateLimit() // 5 req/15 min
@UploadRateLimit() // 10 req/hour
@PublicApiRateLimit() // 200 req/15 min
```

### Auth-Specific Security
The auth module has additional security:
- **Account Lockout**: Progressive lockout after failed attempts
  - 3 attempts: 2-minute lockout
  - 5 attempts: 15-minute lockout
  - 8 attempts: 1-hour lockout
  - 10 attempts: 24-hour lockout
- **IP-based Rate Limiting**: 20 attempts per IP per 15 minutes
- **Email-based Rate Limiting**: 5 attempts per email per 15 minutes

## Input Sanitization

### Sanitization Middleware
Location: `/apps/backend/src/shared/middleware/sanitize.middleware.ts`

Protects against:
- **SQL Injection**: Removes SQL keywords and patterns
- **NoSQL Injection**: Escapes MongoDB operators starting with $
- **XSS**: Removes script tags and event handlers
- **Deep Object Attacks**: Limits object nesting to 10 levels
- **Long Input Attacks**: Limits parameter length to 200 chars

### What Gets Sanitized:
- Query parameters
- Route parameters  
- Request body (additional safety layer beyond Zod validation)
- URL length (max 2048 characters)

## Correlation IDs

### Purpose:
Track requests across services for debugging and monitoring

### Implementation:
- Middleware: `/apps/backend/src/shared/middleware/correlation.middleware.ts`
- Applied globally to all requests
- Adds `x-correlation-id` header to responses
- Creates structured logger with correlation context

### Usage in Code:
```typescript
// Correlation ID is automatically available in request
const correlationId = (req as any).correlationId;
const logger = (req as any).logger;

logger.info('Processing request', { data });
```

## CORS Configuration

### Centralized CORS Config:
- Development: Allows all origins
- Production: Validates against whitelist from `ALLOWED_ORIGINS` env var
- Credentials: Always enabled for auth cookies
- Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Custom Headers: Allows `x-correlation-id`

## Password Security

### Features:
- **Breach Checking**: Uses HaveIBeenPwned API with k-anonymity
- **Strength Requirements**: Enforced via Zod schemas
- **Force Change Policy**: After 1 year or if found in breaches
- **Recommendations**: Real-time password strength feedback

## Environment Variables

### Required Security Variables:
```env
NODE_ENV=production
ALLOWED_ORIGINS=https://app.bassnotion.com,https://bassnotion.com
FRONTEND_URL=https://app.bassnotion.com
```

## Testing Security

### Manual Testing:
1. **Rate Limiting**: 
   ```bash
   # Test global rate limit
   for i in {1..101}; do curl http://localhost:3000/api/health; done
   
   # Test auth rate limit
   for i in {1..6}; do curl -X POST http://localhost:3000/auth/signin -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"wrong"}'; done
   ```

2. **Input Sanitization**:
   ```bash
   # Test SQL injection
   curl "http://localhost:3000/api/users?name='; DROP TABLE users;--"
   
   # Test NoSQL injection  
   curl "http://localhost:3000/api/users?filter[$ne]=null"
   ```

3. **Security Headers**:
   ```bash
   curl -I http://localhost:3000/api/health
   ```

### Automated Tests:
- Run security tests: `pnpm vitest run apps/backend/src/shared/middleware/__tests__/`

## Monitoring & Alerts

### What to Monitor:
1. **Rate Limit Violations**: Log and alert on repeated violations
2. **Failed Login Attempts**: Track patterns for potential attacks
3. **Sanitization Blocks**: Log blocked malicious input
4. **Correlation IDs**: Use for request tracing in logs

### Log Examples:
```json
{
  "timestamp": "2024-08-25T10:30:00Z",
  "level": "warn",
  "service": "rate-limit-guard",
  "message": "Rate limit exceeded",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "context": {
    "key": "192.168.1.1:/auth/signin",
    "limit": 5,
    "current": 6,
    "remainingTime": 890
  }
}
```

## Future Enhancements

### Phase 2:
- Redis-backed rate limiting for distributed systems
- API key authentication for public endpoints
- Request signing for sensitive operations
- Web Application Firewall (WAF) rules

### Phase 3:
- OAuth2 provider implementation
- Hardware token support (FIDO2/WebAuthn)
- Anomaly detection with ML
- Security audit logging to separate storage

## Quick Reference

### Adding Security to New Endpoints:
```typescript
import { AuthRateLimit } from '@/shared/decorators/rate-limit.decorator';
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';
import { UseGuards } from '@nestjs/common';

@Controller('api/sensitive')
@UseGuards(RateLimitGuard)
export class SensitiveController {
  @Post('action')
  @AuthRateLimit() // 5 requests per 15 minutes
  async sensitiveAction() {
    // Your code here
  }
}
```

### Getting Correlation ID in Service:
```typescript
@Injectable()
export class MyService {
  private logger = createStructuredLogger('my-service');
  
  async processRequest(correlationId: string, data: any) {
    const contextLogger = this.logger.child({ correlationId });
    contextLogger.info('Processing started', { data });
    // Your logic here
  }
}
```

## Security Checklist for New Features

- [ ] Apply appropriate rate limiting
- [ ] Validate all inputs with Zod schemas
- [ ] Use parameterized queries for database operations
- [ ] Log security-relevant events with correlation IDs
- [ ] Test with malicious input
- [ ] Document security considerations
- [ ] Review auth requirements
- [ ] Check for sensitive data exposure