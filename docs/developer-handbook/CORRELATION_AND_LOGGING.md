# Correlation IDs and Structured Logging Guide

## Overview

This guide explains how to use correlation IDs and structured logging in the BassNotion platform for better debugging and request tracking.

## What are Correlation IDs?

Think of correlation IDs as "detective badges" for requests. Each request gets a unique badge that follows it everywhere:
- From frontend to backend
- Through all services
- Into all log entries
- Back in response headers

This helps you trace a single user action through the entire system.

## How to Use Correlation IDs

### In Frontend Code

```typescript
// Correlation IDs are automatically added by our API client
// But you can access them if needed:
import { generateCorrelationId } from '@bassnotion/contracts';

const correlationId = generateCorrelationId();
console.log(`Starting operation ${correlationId}`);
```

### In Backend Controllers

```typescript
@Controller('api/users')
export class UserController {
  @Get(':id')
  async getUser(@Req() req: FastifyRequest) {
    // Correlation ID is automatically available
    const correlationId = (req as any).correlationId;
    const logger = (req as any).logger;
    
    logger.info('Fetching user', { userId: id });
    // Logs will include correlationId automatically
  }
}
```

### In Backend Services

```typescript
import { createStructuredLogger } from '@bassnotion/contracts';

@Injectable()
export class UserService {
  private logger = createStructuredLogger('user-service');
  
  async findUser(userId: string, correlationId: string) {
    // Create child logger with correlation context
    const log = this.logger.child({ correlationId });
    
    log.info('Starting user lookup', { userId });
    
    try {
      const user = await this.db.findUser(userId);
      log.info('User found', { userId });
      return user;
    } catch (error) {
      log.error('User lookup failed', { userId, error });
      throw error;
    }
  }
}
```

## Structured Logging

### Why Structured Logging?

Instead of this:
```typescript
console.log('User login failed for user@example.com at 2024-08-25 10:30:00');
```

We do this:
```typescript
logger.warn('User login failed', {
  email: 'user@example.com',
  timestamp: '2024-08-25T10:30:00Z',
  ip: '192.168.1.1',
  reason: 'invalid_password',
  correlationId: '123e4567-e89b-12d3-a456-426614174000'
});
```

### Benefits
- **Searchable**: Find all logs for a specific user or IP
- **Filterable**: Show only errors or warnings
- **Analyzable**: Track patterns and metrics
- **Correlatable**: Follow a request through the system

## Log Levels

Use the appropriate log level:

```typescript
// DEBUG: Detailed information for debugging
logger.debug('Calculating user permissions', { userId, roles });

// INFO: General information about normal operations
logger.info('User logged in', { userId, method: 'google' });

// WARN: Something unexpected but handled
logger.warn('Rate limit approaching', { ip, current: 95, limit: 100 });

// ERROR: Something failed but the app continues
logger.error('Failed to send email', { error, userId });

// FATAL: Application-breaking error
logger.fatal('Database connection lost', { error });
```

## Best Practices

### 1. Always Include Context

```typescript
// ❌ Bad
logger.info('Processing payment');

// ✅ Good
logger.info('Processing payment', {
  paymentId,
  amount,
  currency,
  userId,
  method: 'stripe'
});
```

### 2. Use Child Loggers for Context

```typescript
class PaymentProcessor {
  async processPayment(payment: Payment, correlationId: string) {
    // Create a child logger with payment context
    const log = this.logger.child({
      correlationId,
      paymentId: payment.id,
      userId: payment.userId
    });
    
    log.info('Starting payment processing');
    // All subsequent logs include the context
  }
}
```

### 3. Don't Log Sensitive Data

```typescript
// ❌ Bad
logger.info('User login', { 
  email: user.email,
  password: user.password // NEVER LOG PASSWORDS!
});

// ✅ Good
logger.info('User login', { 
  email: user.email,
  method: 'password'
});
```

### 4. Use Consistent Field Names

Always use the same field names across the application:
- `userId` (not `user_id`, `uid`, `userID`)
- `correlationId` (not `correlation_id`, `requestId`)
- `timestamp` (not `time`, `date`, `created_at`)

## Viewing Logs

### Development

In development, logs appear in the console with formatting:

```
[2024-08-25 10:30:00] INFO (user-service): User login successful
  correlationId: "123e4567-e89b-12d3-a456-426614174000"
  userId: "usr_123"
  method: "google"
```

### Production

In production, logs are JSON for parsing:

```json
{
  "timestamp": "2024-08-25T10:30:00Z",
  "level": "info",
  "service": "user-service",
  "message": "User login successful",
  "correlationId": "123e4567-e89b-12d3-a456-426614174000",
  "userId": "usr_123",
  "method": "google"
}
```

## Debugging with Correlation IDs

### Following a Request

1. User reports an issue
2. Get the approximate time or any identifying info
3. Search logs for their userId or email
4. Find the correlationId
5. Search all logs with that correlationId
6. See the complete request flow

### Example Search Queries

```bash
# Find all logs for a correlation ID
grep "123e4567-e89b-12d3-a456-426614174000" *.log

# Find all errors for a user
jq 'select(.userId == "usr_123" and .level == "error")' app.log

# Find all failed logins today
jq 'select(.message == "Login failed" and .timestamp > "2024-08-25T00:00:00Z")' app.log
```

## Testing with Logs

### In Tests

```typescript
describe('UserService', () => {
  it('should log user creation', async () => {
    const logSpy = jest.spyOn(logger, 'info');
    
    await userService.createUser(userData);
    
    expect(logSpy).toHaveBeenCalledWith(
      'User created',
      expect.objectContaining({
        userId: expect.any(String),
        email: userData.email
      })
    );
  });
});
```

## Common Patterns

### API Request Logging

```typescript
// Middleware logs all requests automatically
// But you can add endpoint-specific logs:

@Post('upload')
async uploadFile(@Req() req, @Body() data) {
  const log = (req as any).logger;
  
  log.info('File upload started', {
    fileName: data.name,
    size: data.size,
    type: data.mimeType
  });
  
  // Process upload...
  
  log.info('File upload completed', {
    fileName: data.name,
    storageUrl: result.url
  });
}
```

### Error Logging

```typescript
try {
  const result = await riskyOperation();
  logger.info('Operation succeeded', { result });
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    input: sanitizedInput, // Don't log sensitive data
    correlationId
  });
  
  // Re-throw or handle
  throw new ServiceException('Operation failed', error);
}
```

### Performance Logging

```typescript
const startTime = Date.now();
logger.debug('Starting expensive operation');

const result = await expensiveOperation();

const duration = Date.now() - startTime;
logger.info('Operation completed', {
  duration,
  resultSize: result.length,
  ...(duration > 1000 && { warning: 'Slow operation' })
});
```

## Troubleshooting

### Logs Not Appearing

1. Check log level - DEBUG logs don't show in production
2. Verify logger initialization
3. Check if logs are being written to file instead of console

### Missing Correlation IDs

1. Ensure middleware is applied globally
2. Check if custom API calls include the header
3. Verify frontend is sending correlation IDs

### Performance Impact

- Use appropriate log levels
- Don't log in tight loops
- Consider sampling for high-frequency operations
- Use conditional logging for debug info

## Summary

- Every request gets a correlation ID
- Use structured logging with context
- Follow consistent naming conventions
- Don't log sensitive information
- Use appropriate log levels
- Leverage correlation IDs for debugging