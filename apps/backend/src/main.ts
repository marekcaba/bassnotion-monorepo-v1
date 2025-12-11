import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as dotenv from 'dotenv';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';

import { AppModule } from './app.module.js';
import { ZodValidationPipe } from './shared/pipes/zod-validation.pipe.js';
import {
  helmetConfig,
  rateLimitConfig,
  corsConfig,
} from './config/security.config.js';
import { initializeSentry } from './config/sentry.config.js';
import { setupSwagger } from './config/swagger.config.js';
// TODO: Fix LogTransportService initialization issue
// import { LogTransportService } from './infrastructure/logging/log-transport.service.js';
// import { initializeLogging } from './infrastructure/logging/log-initializer.js';

// Load environment variables from .env file in monorepo root
// Try multiple paths for different deployment scenarios
dotenv.config({ path: '.env.local' }); // Local development override
dotenv.config({ path: '../../.env' }); // Local development
dotenv.config({ path: '.env' }); // Railway deployment
dotenv.config(); // Default .env loading

// Import reflect-metadata for NestJS decorators
import 'reflect-metadata';
import { createStructuredLogger } from '@bassnotion/contracts';

// Initialize Sentry before app starts
initializeSentry();

const logger = createStructuredLogger('Main');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 10 * 1024 * 1024, // 10MB limit
    }),
  );

  // Set allowed origins in environment for security config
  process.env.ALLOWED_ORIGINS =
    process.env.ALLOWED_ORIGINS ||
    (process.env['FRONTEND_URL']
      ? process.env['FRONTEND_URL'].replace(/\/$/, '')
      : '*');

  // Get Fastify instance for registering plugins
  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Register security plugins
  await fastifyInstance.register(fastifyHelmet as any, helmetConfig);
  await fastifyInstance.register(fastifyRateLimit as any, rateLimitConfig);

  // Register multipart plugin for file uploads
  await fastifyInstance.register(fastifyMultipart as any, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  // Enable global validation pipes
  app.useGlobalPipes(new ZodValidationPipe());

  // Note: Correlation ID handling is now done by CorrelationMiddleware
  // which provides request-scoped logging and consistent correlation tracking

  // Initialize logging aggregation
  // TODO: Fix LogTransportService initialization issue
  // const logTransport = app.get(LogTransportService);
  // initializeLogging(logTransport);
  logger.info(
    'Log aggregation temporarily disabled due to initialization issue',
    {
      aggregationEnabled: false,
      correlationId: 'system',
    },
  );

  // Enable CORS with centralized config
  app.enableCors(corsConfig);

  // Setup Swagger documentation (only in development/staging)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SWAGGER === 'true'
  ) {
    setupSwagger(app);
  }

  // Get port from environment variable or use default
  const port = process.env['PORT'] || 3000;
  const host = '0.0.0.0'; // Listen on all network interfaces

  await app.listen(port, host);

  logger.info(`Application is running on: http://localhost:${port}`);
}

// Handle bootstrap errors properly
bootstrap().catch((error) => {
  logger.error('Failed to start application:', error as Error);
  process.exit(1);
});
