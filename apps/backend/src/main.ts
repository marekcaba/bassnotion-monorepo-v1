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
// LogTransportService — disabled. Logs flow to Railway stdout
// (default Nest logger) and to Sentry (initializeSentry above) for
// errors. LogTransportService was a custom batched-shipper that
// hit an initialization-order issue and is not needed: Railway logs
// + Sentry already cover the use case for go-LIVE. Re-enable later
// only if we add a dedicated log-aggregation backend (Logflare,
// Datadog, etc).

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
    {
      // Preserve the raw request body for routes that need to verify
      // signatures over the exact bytes received (e.g. POST
      // /api/v1/webhooks/stripe — Stripe signs the precise byte sequence,
      // and signature verification fails if Nest's body parser
      // re-stringifies the payload first).
      rawBody: true,
    },
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

  // Logging architecture:
  // - Application logs → Railway stdout (Nest's default logger).
  // - Errors / exceptions → Sentry (initializeSentry above).
  // - No custom LogTransportService at this time. See the comment at
  //   the top of this file for details.
  logger.info('Logging: Railway stdout + Sentry (no custom aggregator)', {
    correlationId: 'system',
  });

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
