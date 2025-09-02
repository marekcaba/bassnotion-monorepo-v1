# Middleware Guide

## Overview

This guide explains the middleware architecture in BassNotion and how to create, apply, and test middleware.

## What is Middleware?

Middleware are functions that run **between** receiving a request and sending a response. Think of them as checkpoints that every request must pass through.

```
Request → Middleware 1 → Middleware 2 → Controller → Response
```

## Core Middleware

### 1. Correlation Middleware

**Purpose**: Adds tracking IDs to every request

**Location**: `/apps/backend/src/shared/middleware/correlation.middleware.ts`

**What it does**:
- Generates or extracts correlation ID
- Adds it to request object
- Adds it to response headers
- Creates a logger with correlation context

**Applied**: Globally to all routes

### 2. Sanitization Middleware

**Purpose**: Cleans dangerous input before it reaches your code

**Location**: `/apps/backend/src/shared/middleware/sanitize.middleware.ts`

**What it does**:
- Removes SQL injection attempts
- Escapes MongoDB operators
- Blocks XSS attempts
- Limits object nesting depth
- Validates input length

**Applied**: Globally to all routes

### 3. Rate Limit Middleware

**Purpose**: Prevents abuse by limiting requests

**Types**:
- **Global**: Via `@fastify/rate-limit` (100 req/15 min)
- **Endpoint-specific**: Via decorators and guards

**Applied**: 
- Global: All routes
- Specific: Using decorators on controllers

## How Middleware Works

### Execution Order

Middleware runs in the order it's applied:

```typescript
// In main.ts
app.use(correlationMiddleware);  // Runs 1st
app.use(sanitizeMiddleware);     // Runs 2nd
app.use(authMiddleware);         // Runs 3rd
```

### Request Flow

```typescript
// 1. Correlation Middleware adds ID
req.correlationId = '123-456-789';

// 2. Sanitize Middleware cleans input  
req.body.name = sanitize(req.body.name);

// 3. Your controller gets clean, tracked request
@Post()
create(@Req() req, @Body() data) {
  console.log(req.correlationId); // '123-456-789'
  console.log(data.name);         // Sanitized!
}
```

## Creating Custom Middleware

### Basic Middleware

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class TimingMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Record start time
    const start = Date.now();
    
    // Add cleanup that runs after response
    res.addHook('onSend', async (request, reply, payload) => {
      const duration = Date.now() - start;
      reply.header('X-Response-Time', `${duration}ms`);
      return payload;
    });
    
    // Continue to next middleware
    next();
  }
}
```

### Middleware with Dependencies

```typescript
@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(
    private auditService: AuditService,
    private logger: Logger
  ) {}
  
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Log request
    this.auditService.logRequest({
      path: req.url,
      method: req.method,
      ip: req.ip,
      timestamp: new Date()
    });
    
    next();
  }
}
```

## Applying Middleware

### Global Middleware (All Routes)

In `main.ts`:
```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter()
);

// Apply globally
app.use(new CorrelationMiddleware().use);
app.use(new SanitizeMiddleware().use);
```

### Module-Specific Middleware

In a module:
```typescript
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(UserController);
      
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes({ path: 'users/upload', method: RequestMethod.POST });
  }
}
```

### Route-Specific Middleware

Using guards (recommended for auth/permissions):
```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  // All routes require auth + admin
}
```

## Middleware vs Guards vs Interceptors

### Use Middleware For:
- Request/Response modification
- Logging and metrics
- CORS, compression, parsing
- Adding data to request

### Use Guards For:
- Authentication checks
- Authorization/permissions
- Conditional route access
- Throwing 401/403 errors

### Use Interceptors For:
- Response transformation
- Response caching
- Exception mapping
- Performance monitoring

## Common Middleware Patterns

### 1. Conditional Middleware

```typescript
@Injectable()
export class ConditionalMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    // Only run in production
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
    
    // Production-only logic
    // ...
    
    next();
  }
}
```

### 2. Async Middleware

```typescript
@Injectable()
export class AsyncMiddleware implements NestMiddleware {
  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      // Async operation
      const data = await this.fetchSomeData();
      (req as any).extraData = data;
      
      next();
    } catch (error) {
      // Handle error
      res.code(500).send({ error: 'Middleware failed' });
    }
  }
}
```

### 3. Error Handling Middleware

```typescript
@Injectable()
export class ErrorMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    try {
      next();
    } catch (error) {
      this.logger.error('Request failed', {
        error: error.message,
        path: req.url,
        method: req.method
      });
      
      res.code(500).send({
        error: 'Internal Server Error',
        correlationId: (req as any).correlationId
      });
    }
  }
}
```

## Testing Middleware

### Unit Testing

```typescript
describe('CorrelationMiddleware', () => {
  let middleware: CorrelationMiddleware;
  let mockReq: Partial<FastifyRequest>;
  let mockRes: Partial<FastifyReply>;
  let nextFn: jest.Mock;
  
  beforeEach(() => {
    middleware = new CorrelationMiddleware();
    mockReq = { headers: {} };
    mockRes = { header: jest.fn() };
    nextFn = jest.fn();
  });
  
  it('should add correlation ID to request', () => {
    middleware.use(
      mockReq as FastifyRequest,
      mockRes as FastifyReply,
      nextFn
    );
    
    expect(mockReq.correlationId).toBeDefined();
    expect(mockRes.header).toHaveBeenCalledWith(
      'x-correlation-id',
      expect.any(String)
    );
    expect(nextFn).toHaveBeenCalled();
  });
  
  it('should use existing correlation ID', () => {
    mockReq.headers['x-correlation-id'] = 'existing-id';
    
    middleware.use(
      mockReq as FastifyRequest,
      mockRes as FastifyReply,
      nextFn
    );
    
    expect(mockReq.correlationId).toBe('existing-id');
  });
});
```

### Integration Testing

```typescript
describe('Middleware Integration', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleRef.createNestApplication();
    await app.init();
  });
  
  it('should include correlation ID in response', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
      
    expect(response.headers['x-correlation-id']).toBeDefined();
  });
  
  it('should sanitize malicious input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/users')
      .send({
        name: "'; DROP TABLE users; --",
        email: 'test@example.com'
      })
      .expect(201);
      
    // Name should be sanitized
    expect(response.body.name).not.toContain('DROP TABLE');
  });
});
```

## Performance Considerations

### 1. Keep Middleware Light

```typescript
// ❌ Bad - Heavy computation in middleware
use(req, res, next) {
  const result = expensiveCalculation(req.body);
  req.computed = result;
  next();
}

// ✅ Good - Defer heavy work
use(req, res, next) {
  req.getComputed = () => expensiveCalculation(req.body);
  next();
}
```

### 2. Avoid Blocking Operations

```typescript
// ❌ Bad - Blocking I/O
use(req, res, next) {
  const data = fs.readFileSync('large-file.json');
  req.config = JSON.parse(data);
  next();
}

// ✅ Good - Non-blocking
async use(req, res, next) {
  req.config = await this.configService.get();
  next();
}
```

### 3. Short-Circuit When Possible

```typescript
use(req, res, next) {
  // Skip middleware for health checks
  if (req.url === '/health') {
    return next();
  }
  
  // Normal processing
  // ...
  next();
}
```

## Security Middleware Best Practices

### 1. Fail Securely

```typescript
use(req, res, next) {
  try {
    // Security check
    if (!this.isRequestSafe(req)) {
      return res.code(400).send({ error: 'Bad Request' });
    }
    next();
  } catch (error) {
    // Fail closed - reject on error
    this.logger.error('Security check failed', { error });
    res.code(500).send({ error: 'Internal Server Error' });
  }
}
```

### 2. Don't Leak Information

```typescript
// ❌ Bad - Reveals internal info
if (!authorized) {
  res.code(403).send({ 
    error: 'User lacks admin_write permission on resource /api/users/123' 
  });
}

// ✅ Good - Generic message
if (!authorized) {
  res.code(403).send({ 
    error: 'Forbidden' 
  });
}
```

### 3. Rate Limit Early

Apply rate limiting before expensive operations:

```typescript
// Middleware order matters!
app.use(rateLimitMiddleware);    // Check rate limit first
app.use(authMiddleware);         // Then authenticate
app.use(parseBodyMiddleware);    // Then parse body
app.use(validateMiddleware);     // Then validate
```

## Debugging Middleware

### 1. Add Debug Logs

```typescript
use(req, res, next) {
  const debug = process.env.DEBUG_MIDDLEWARE === 'true';
  
  if (debug) {
    console.log(`[${this.constructor.name}] Processing ${req.method} ${req.url}`);
  }
  
  // Process...
  
  if (debug) {
    console.log(`[${this.constructor.name}] Completed`);
  }
  
  next();
}
```

### 2. Use Correlation IDs

```typescript
use(req, res, next) {
  const correlationId = (req as any).correlationId;
  
  this.logger.debug('Middleware executing', {
    correlationId,
    middleware: this.constructor.name,
    path: req.url
  });
  
  next();
}
```

### 3. Time Middleware Execution

```typescript
use(req, res, next) {
  const start = performance.now();
  
  res.addHook('onSend', async () => {
    const duration = performance.now() - start;
    if (duration > 100) {
      this.logger.warn('Slow middleware', {
        middleware: this.constructor.name,
        duration,
        path: req.url
      });
    }
  });
  
  next();
}
```

## Summary

- Middleware processes every request
- Order matters - plan your middleware stack
- Keep middleware focused and fast
- Use appropriate tool (middleware vs guard vs interceptor)
- Always handle errors gracefully
- Test both success and failure cases
- Monitor middleware performance