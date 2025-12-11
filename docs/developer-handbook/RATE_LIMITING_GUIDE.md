# Rate Limiting Guide

## Overview

Rate limiting protects your API from abuse by limiting how many requests a client can make in a given time period. BassNotion uses multiple layers of rate limiting for comprehensive protection.

## Rate Limiting Layers

### 1. Global Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Applies to**: All routes
- **Configured in**: `security.config.ts`

### 2. Endpoint-Specific Rate Limiting

- **Auth endpoints**: 5 requests per 15 minutes
- **Upload endpoints**: 10 requests per hour
- **Public API**: 200 requests per 15 minutes

### 3. Auth-Specific Security

- **IP-based**: 20 attempts per IP per 15 minutes
- **Email-based**: 5 attempts per email per 15 minutes
- **Account lockout**: Progressive delays after failures

## How Rate Limiting Works

```
Client Request → Global Rate Limit → Endpoint Rate Limit → Controller
                     ↓                      ↓
                 429 Error              429 Error
```

## Using Rate Limit Decorators

### Basic Usage

```typescript
import { AuthRateLimit } from '@/shared/decorators/rate-limit.decorator';
import { RateLimitGuard } from '@/shared/guards/rate-limit.guard';

@Controller('api/sensitive')
@UseGuards(RateLimitGuard)
export class SensitiveController {
  @Post('action')
  @AuthRateLimit() // 5 requests per 15 minutes
  async performAction() {
    // Your code
  }

  @Post('upload')
  @UploadRateLimit() // 10 requests per hour
  async uploadFile() {
    // Your code
  }
}
```

### Custom Rate Limits

```typescript
import { RateLimit } from '@/shared/decorators/rate-limit.decorator';

@Post('custom')
@RateLimit({
  max: 3,
  timeWindow: '5 minutes'
})
async customEndpoint() {
  // Only 3 requests per 5 minutes allowed
}
```

### Rate Limit by User Instead of IP

```typescript
@Post('user-action')
@RateLimit({
  max: 10,
  timeWindow: '1 hour',
  keyGenerator: (req) => {
    // Use user ID instead of IP
    return req.user?.id || req.ip;
  }
})
async userSpecificAction() {
  // Rate limited per user
}
```

## Rate Limit Responses

### Standard Response

When rate limit is exceeded:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please retry after 890 seconds.",
  "rateLimit": {
    "limit": 5,
    "current": 6,
    "remaining": 0,
    "resetTime": "2024-08-25T10:45:00.000Z"
  }
}
```

### Response Headers

Rate limit information is included in headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1692959100
Retry-After: 890
```

## Auth Security Features

### Progressive Account Lockout

Failed login attempts trigger increasing delays:

- 3 attempts → 2 minute lockout
- 5 attempts → 15 minute lockout
- 8 attempts → 1 hour lockout
- 10 attempts → 24 hour lockout

### Example Auth Flow

```typescript
// In auth.service.ts
async authenticateUser(credentials, ip, userAgent) {
  // 1. Check rate limits
  const { rateLimitInfo, lockoutInfo } =
    await this.authSecurity.getSecurityInfo(email, ip);

  if (lockoutInfo.isLocked) {
    throw new ForbiddenException(
      `Account locked for ${lockoutInfo.remainingTime} seconds`
    );
  }

  if (rateLimitInfo.isRateLimited) {
    throw new TooManyRequestsException(
      `Too many attempts. Retry in ${rateLimitInfo.remainingTime} seconds`
    );
  }

  // 2. Attempt login
  const success = await this.verifyCredentials(credentials);

  // 3. Record attempt
  await this.authSecurity.recordLoginAttempt(
    email, ip, success, userAgent
  );

  // 4. Return result
  if (!success) {
    throw new UnauthorizedException('Invalid credentials');
  }

  return { token, user };
}
```

## Configuration

### Global Rate Limit Config

```typescript
// In security.config.ts
export const rateLimitConfig: RateLimitOptions = {
  global: true,
  max: 100,
  timeWindow: '15 minutes',

  // Skip in development
  skip: isDevelopment ? () => true : undefined,

  // Custom error message
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Retry after ${context.ttl}ms`,
    rateLimit: {
      limit: context.max,
      current: context.current,
      remaining: context.remaining,
      resetTime: new Date(context.ttl).toISOString(),
    },
  }),
};
```

### Environment Variables

```env
# Disable rate limiting (development only!)
DISABLE_RATE_LIMIT=true

# Custom limits
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=900000  # 15 minutes in ms
```

## Testing Rate Limits

### Manual Testing

```bash
# Test global rate limit (need 101 requests)
for i in {1..101}; do
  curl -X GET http://localhost:3000/api/health \
    -H "X-Forwarded-For: 192.168.1.100"
  echo " - Request $i"
done

# Test auth rate limit (need 6 requests)
for i in {1..6}; do
  curl -X POST http://localhost:3000/auth/signin \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 192.168.1.100" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo " - Attempt $i"
done
```

### Automated Testing

```typescript
describe('Rate Limiting', () => {
  it('should enforce auth rate limit', async () => {
    const requests = [];

    // Make 5 requests (the limit)
    for (let i = 0; i < 5; i++) {
      requests.push(
        request(app.getHttpServer())
          .post('/auth/signin')
          .send({ email: 'test@example.com', password: 'wrong' }),
      );
    }

    await Promise.all(requests);

    // 6th request should fail
    const response = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: 'test@example.com', password: 'wrong' })
      .expect(429);

    expect(response.body.error).toBe('Too Many Requests');
    expect(response.body.rateLimit.remaining).toBe(0);
  });
});
```

## Monitoring Rate Limits

### Key Metrics to Track

1. **Rate Limit Hits**: How often limits are reached
2. **Top Limited IPs**: Potential attackers or misconfigured clients
3. **Endpoint Distribution**: Which endpoints get rate limited most
4. **Reset Patterns**: When clients retry after limits

### Logging Rate Limit Events

```typescript
// Automatically logged by our implementation
logger.warn('Rate limit exceeded', {
  key: '192.168.1.1:/auth/signin',
  limit: 5,
  current: 6,
  remainingTime: 890,
  endpoint: '/auth/signin',
  ip: '192.168.1.1',
});
```

### Monitoring Queries

```sql
-- Find IPs hitting rate limits
SELECT
  json_extract(context, '$.ip') as ip,
  COUNT(*) as limit_hits,
  json_extract(context, '$.endpoint') as endpoint
FROM logs
WHERE
  message = 'Rate limit exceeded'
  AND timestamp > datetime('now', '-1 day')
GROUP BY ip, endpoint
ORDER BY limit_hits DESC;

-- Account lockout patterns
SELECT
  json_extract(context, '$.email') as email,
  json_extract(context, '$.failedAttempts') as attempts,
  COUNT(*) as lockout_count
FROM logs
WHERE
  message LIKE '%Account locked%'
  AND timestamp > datetime('now', '-7 days')
GROUP BY email
ORDER BY lockout_count DESC;
```

## Best Practices

### 1. Choose Appropriate Limits

```typescript
// Consider your use case
@RateLimit({
  max: 1,        // Very restrictive
  timeWindow: '1 minute'
})
async sendExpensiveEmail() {}

@RateLimit({
  max: 1000,     // Very permissive
  timeWindow: '1 minute'
})
async getPublicData() {}
```

### 2. Provide Clear Error Messages

```typescript
// Help users understand the limit
throw new TooManyRequestsException({
  message: 'Daily report limit reached (3 per day)',
  nextResetTime: tomorrow.toISOString(),
  upgradeUrl: '/pricing',
});
```

### 3. Consider Different Keys

```typescript
// Rate limit by API key for B2B
@RateLimit({
  max: 10000,
  timeWindow: '1 hour',
  keyGenerator: (req) => req.headers['x-api-key']
})

// Rate limit by user + action
@RateLimit({
  max: 5,
  timeWindow: '1 day',
  keyGenerator: (req) => `${req.user.id}:password-reset`
})
```

### 4. Implement Gradual Backoff

```typescript
// For sensitive operations
const attempts = await this.getFailedAttempts(userId);
const delay = Math.min(Math.pow(2, attempts) * 1000, 300000); // Max 5 min

if (Date.now() < lastAttempt + delay) {
  throw new TooManyRequestsException({
    message: 'Please wait before trying again',
    retryAfter: Math.ceil(delay / 1000),
  });
}
```

## Bypassing Rate Limits

### For Testing

```typescript
// In development/test environments
if (process.env.NODE_ENV === 'test') {
  return true; // Skip rate limit
}
```

### For Trusted Sources

```typescript
@RateLimit({
  max: 100,
  timeWindow: '15 minutes',
  skip: (req) => {
    // Skip for internal services
    const internalIPs = ['10.0.0.0/8', '172.16.0.0/12'];
    return isIPInRange(req.ip, internalIPs);
  }
})
```

### For Premium Users

```typescript
@RateLimit({
  max: 100,
  timeWindow: '15 minutes',
  keyGenerator: (req) => {
    // Different limits for different tiers
    const tier = req.user?.subscription?.tier || 'free';
    return `${tier}:${req.ip}`;
  }
})
```

## Troubleshooting

### Common Issues

1. **"Rate limit hit immediately"**
   - Check if multiple users share an IP (corporate network)
   - Verify the key generator is working correctly
   - Check for retry loops in client code

2. **"Rate limits not working"**
   - Ensure RateLimitGuard is applied
   - Check if development mode is skipping limits
   - Verify middleware order in main.ts

3. **"Different limits than configured"**
   - Check for multiple rate limit decorators
   - Verify global vs endpoint-specific limits
   - Check if custom key generator is grouping unexpectedly

### Debug Mode

Enable rate limit debugging:

```typescript
// In rate-limit.guard.ts
const DEBUG_RATE_LIMIT = process.env.DEBUG_RATE_LIMIT === 'true';

if (DEBUG_RATE_LIMIT) {
  console.log('Rate limit check:', {
    key,
    current: entry.count,
    limit: options.max,
    resetTime: new Date(entry.resetTime),
  });
}
```

## Summary

- Use multiple layers of rate limiting for defense in depth
- Configure appropriate limits for each endpoint
- Provide clear error messages with retry information
- Monitor rate limit hits to identify issues
- Test rate limits in your test suite
- Consider different rate limit strategies for different user types
