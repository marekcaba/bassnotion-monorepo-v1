# Structured Logging Patterns Guide

This guide provides common patterns and best practices for using structured logging with correlation IDs in the BassNotion codebase.

## Table of Contents

- [Quick Start](#quick-start)
- [React Components](#react-components)
- [NestJS Services](#nestjs-services)
- [API Calls](#api-calls)
- [Error Handling](#error-handling)
- [Performance Monitoring](#performance-monitoring)
- [Testing](#testing)
- [VS Code Snippets](#vs-code-snippets)

## Quick Start

### React Component

```typescript
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function MyComponent() {
  const { correlationId, logger } = useCorrelation('MyComponent');

  const handleClick = () => {
    logger.info('Button clicked', { buttonId: 'submit', correlationId });
  };

  return <button onClick={handleClick}>Submit</button>;
}
```

### NestJS Service

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { createStructuredLogger } from '@bassnotion/contracts';
import { RequestContextService } from '@/shared/services/request-context.service';

@Injectable()
export class MyService {
  private readonly staticLogger = createStructuredLogger(MyService.name);

  constructor(
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async doSomething() {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Doing something', { correlationId });
  }
}
```

## React Components

### Basic Component Logging

```typescript
export function UserProfile() {
  const { correlationId, logger } = useCorrelation('UserProfile');

  useEffect(() => {
    logger.info('UserProfile mounted', { correlationId });

    return () => {
      logger.info('UserProfile unmounted', { correlationId });
    };
  }, []);

  return <div>Profile</div>;
}
```

### Logging User Actions

```typescript
export function AudioPlayer() {
  const { correlationId, logger } = useCorrelation('AudioPlayer');

  const play = useCallback(async () => {
    logger.info('Play button clicked', { correlationId });

    try {
      await audioEngine.play();
      logger.info('Playback started successfully', { correlationId });
    } catch (error) {
      logger.error('Playback failed', error, { correlationId });
    }
  }, [correlationId, logger]);

  return <button onClick={play}>Play</button>;
}
```

### Component with Error Boundary

```typescript
export function ProtectedComponent() {
  const { correlationId, logger } = useCorrelation('ProtectedComponent');

  return (
    <ErrorBoundary correlationId={correlationId}>
      <RiskyComponent />
    </ErrorBoundary>
  );
}
```

## NestJS Services

### Service with Database Operations

```typescript
@Injectable()
export class UserService {
  private readonly staticLogger = createStructuredLogger(UserService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async findUser(id: string) {
    const logger = this.requestContext?.getLogger() || this.staticLogger;
    const correlationId = this.requestContext?.getCorrelationId();

    logger.info('Finding user', { userId: id, correlationId });

    try {
      const user = await this.db.users.findById(id);

      if (!user) {
        logger.warn('User not found', { userId: id, correlationId });
        return null;
      }

      logger.info('User found', { userId: id, correlationId });
      return user;
    } catch (error) {
      logger.error('Database error finding user', error, {
        userId: id,
        correlationId,
      });
      throw error;
    }
  }
}
```

### Controller with Request Logging

```typescript
@Controller('users')
export class UserController {
  private readonly staticLogger = createStructuredLogger(UserController.name);

  @Get(':id')
  async getUser(@Param('id') id: string, @Req() request: FastifyRequest) {
    const logger = (request as any).logger || this.staticLogger;
    const correlationId = (request as any).correlationId;

    logger.info('GET /users/:id request', { userId: id, correlationId });

    const user = await this.userService.findUser(id);

    if (!user) {
      logger.warn('User not found response', { userId: id, correlationId });
      throw new NotFoundException('User not found');
    }

    logger.info('User response sent', { userId: id, correlationId });
    return user;
  }
}
```

## API Calls

### Frontend API Call

```typescript
export function useUserData(userId: string) {
  const { correlationId, logger } = useCorrelation('useUserData');

  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      logger.info('Fetching user data', { userId, correlationId });

      try {
        const response = await apiClient.get(`/api/users/${userId}`, {
          correlationId,
        });

        logger.info('User data received', { userId, correlationId });
        return response.data;
      } catch (error) {
        logger.error('Failed to fetch user data', error, {
          userId,
          correlationId,
        });
        throw error;
      }
    },
  });
}
```

### Batch API Operations

```typescript
async function syncExercises(exercises: Exercise[]) {
  const { correlationId, logger } = useCorrelation('syncExercises');

  logger.info('Starting exercise sync', {
    count: exercises.length,
    correlationId,
  });

  const results = await Promise.allSettled(
    exercises.map(async (exercise) => {
      try {
        const result = await apiClient.post('/api/exercises', exercise, {
          correlationId,
        });

        logger.debug('Exercise synced', {
          exerciseId: exercise.id,
          correlationId,
        });

        return result;
      } catch (error) {
        logger.error('Exercise sync failed', error, {
          exerciseId: exercise.id,
          correlationId,
        });
        throw error;
      }
    }),
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info('Exercise sync completed', {
    successful,
    failed,
    total: exercises.length,
    correlationId,
  });
}
```

## Error Handling

### Try-Catch with Context

```typescript
async function processPayment(orderId: string) {
  const logger = this.requestContext?.getLogger() || this.staticLogger;
  const correlationId = this.requestContext?.getCorrelationId();

  logger.info('Processing payment', { orderId, correlationId });

  try {
    const result = await paymentGateway.charge(orderId);
    logger.info('Payment successful', { orderId, correlationId });
    return result;
  } catch (error) {
    // Log full error details internally
    logger.error('Payment processing failed', error, {
      orderId,
      errorCode: error.code,
      errorType: error.constructor.name,
      correlationId,
    });

    // Return sanitized error to user
    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new BadRequestException('Insufficient funds');
    }

    throw new InternalServerErrorException('Payment processing failed');
  }
}
```

### Graceful Degradation

```typescript
async function loadUserPreferences(userId: string) {
  const logger = this.requestContext?.getLogger() || this.staticLogger;
  const correlationId = this.requestContext?.getCorrelationId();

  try {
    return await this.preferencesService.load(userId);
  } catch (error) {
    logger.error('Failed to load user preferences, using defaults', error, {
      userId,
      correlationId,
    });

    // Return default preferences instead of failing
    return this.getDefaultPreferences();
  }
}
```

## Performance Monitoring

### Operation Timing

```typescript
async function generateReport(reportId: string) {
  const logger = this.requestContext?.getLogger() || this.staticLogger;
  const correlationId = this.requestContext?.getCorrelationId();

  const startTime = performance.now();
  logger.info('Report generation started', { reportId, correlationId });

  try {
    const report = await this.reportEngine.generate(reportId);

    const duration = performance.now() - startTime;
    logger.info('Report generation completed', {
      reportId,
      duration,
      pageCount: report.pages.length,
      correlationId,
    });

    return report;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('Report generation failed', error, {
      reportId,
      duration,
      correlationId,
    });
    throw error;
  }
}
```

### Resource Usage Tracking

```typescript
export function HeavyComponent() {
  const { correlationId, logger } = useCorrelation('HeavyComponent');

  useEffect(() => {
    const startMemory = performance.memory?.usedJSHeapSize;
    logger.info('Heavy component mounting', {
      startMemory,
      correlationId
    });

    return () => {
      const endMemory = performance.memory?.usedJSHeapSize;
      const memoryDelta = endMemory - startMemory;

      logger.info('Heavy component unmounting', {
        endMemory,
        memoryDelta,
        correlationId
      });
    };
  }, []);

  return <div>Heavy content</div>;
}
```

## Testing

### Mocking Correlation in Tests

```typescript
// test-utils.ts
export function mockCorrelation() {
  return {
    correlationId: 'test-correlation-id',
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
}

// Component test
test('logs user action', () => {
  const mockLog = mockCorrelation();
  jest.mocked(useCorrelation).mockReturnValue(mockLog);

  const { getByText } = render(<MyComponent />);
  fireEvent.click(getByText('Submit'));

  expect(mockLog.logger.info).toHaveBeenCalledWith(
    'Button clicked',
    expect.objectContaining({ correlationId: 'test-correlation-id' })
  );
});
```

### Service Test with Logger

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockRequestContext = {
      getLogger: () => mockLogger,
      getCorrelationId: () => 'test-correlation-id',
    };

    service = new UserService(mockDb, mockRequestContext);
  });

  test('logs user not found', async () => {
    mockDb.users.findById.mockResolvedValue(null);

    const result = await service.findUser('123');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'User not found',
      expect.objectContaining({ userId: '123' }),
    );
  });
});
```

## VS Code Snippets

Install the BassNotion snippets by:

1. Open VS Code
2. Go to Code > Preferences > Configure User Snippets
3. Select "New Global Snippets file" or open existing `.vscode/bassnotion.code-snippets`

### Available Snippets

| Prefix     | Description                    | Example                                                          |
| ---------- | ------------------------------ | ---------------------------------------------------------------- |
| `ucorr`    | Use correlation hook           | `const { correlationId, logger } = useCorrelation('Component');` |
| `logi`     | Log info                       | `logger.info('message', { data, correlationId });`               |
| `loge`     | Log error                      | `logger.error('error', error, { context, correlationId });`      |
| `logw`     | Log warning                    | `logger.warn('warning', { data, correlationId });`               |
| `logd`     | Log debug                      | `logger.debug('debug', { data, correlationId });`                |
| `nslg`     | NestJS service logger setup    | Service constructor with logger                                  |
| `getlog`   | Get logger in method           | Logger instance for service methods                              |
| `apicorr`  | API call with correlation      | `apiClient.get('/api/endpoint', { correlationId })`              |
| `tclog`    | Try-catch with logging         | Try-catch block with error logging                               |
| `rclog`    | React component with logging   | Component template with correlation                              |
| `zslog`    | Zustand store with logging     | Store with correlation middleware                                |
| `logperf`  | Performance logging            | Operation timing pattern                                         |
| `ctrllog`  | Controller method with logging | NestJS controller with logging                                   |
| `audiolog` | Audio debug logging            | Audio-specific debug logging                                     |
| `errbound` | Error boundary logging         | Error boundary error logging                                     |

## Best Practices

1. **Always include correlation ID** in all log statements
2. **Log at appropriate levels**:
   - `debug`: Detailed information for debugging
   - `info`: General information about application flow
   - `warn`: Warning conditions that might need attention
   - `error`: Error conditions that need immediate attention

3. **Include relevant context** in log messages:

   ```typescript
   // Good
   logger.info('User login successful', {
     userId: user.id,
     email: user.email,
     loginMethod: 'google',
     correlationId,
   });

   // Bad
   logger.info('Login successful');
   ```

4. **Sanitize sensitive data**:

   ```typescript
   logger.info('User created', {
     userId: user.id,
     email: user.email,
     // Don't log passwords, tokens, or PII
     correlationId,
   });
   ```

5. **Use structured data** instead of string concatenation:

   ```typescript
   // Good
   logger.error('Database connection failed', error, {
     host: config.db.host,
     port: config.db.port,
     correlationId,
   });

   // Bad
   logger.error(
     `Database connection failed to ${config.db.host}:${config.db.port}: ${error.message}`,
   );
   ```

6. **Log both start and end** of long operations:

   ```typescript
   logger.info('Export started', { format: 'pdf', correlationId });
   // ... operation ...
   logger.info('Export completed', { format: 'pdf', duration, correlationId });
   ```

7. **Use consistent message formats** within a domain:
   ```typescript
   // User domain
   logger.info('User created', { userId, correlationId });
   logger.info('User updated', { userId, correlationId });
   logger.info('User deleted', { userId, correlationId });
   ```

## Troubleshooting

### Finding Related Logs

```bash
# Find all logs for a specific correlation ID
grep "correlation-123" logs/*.log

# Find all errors for a correlation ID
grep -E "ERROR.*correlation-123" logs/*.log

# Find logs for a specific component
grep "ComponentName.*correlation-123" logs/*.log
```

### Common Issues

1. **Missing correlation ID**: Ensure `useCorrelation` is called at component level
2. **Logger is undefined**: Check that `RequestContextService` is properly injected
3. **Logs not appearing**: Verify log level configuration in environment
4. **Performance impact**: Use `debug` level for high-frequency logs

## Additional Resources

- [Correlation ID Architecture](../CORRELATION_ID_ARCHITECTURE.md)
- [Debugging Guide](./DEBUGGING_GUIDE.md)
- [Monitoring Dashboard](./MONITORING_GUIDE.md)
