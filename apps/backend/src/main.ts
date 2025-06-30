import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as dotenv from 'dotenv';

import { AppModule } from './app.module.js';
import { ZodValidationPipe } from './shared/pipes/zod-validation.pipe.js';

// Load environment variables from .env file in monorepo root
// Try multiple paths for different deployment scenarios
dotenv.config({ path: '../../.env' }); // Local development
dotenv.config({ path: '.env' }); // Railway deployment
dotenv.config(); // Default .env loading

// Import reflect-metadata for NestJS decorators
import 'reflect-metadata';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Normalize frontend URL by removing trailing slash for CORS
  const frontendUrl = process.env['FRONTEND_URL']?.replace(/\/$/, '') || '*';

  // Create array of allowed origins to handle both with and without trailing slash
  const allowedOrigins =
    frontendUrl === '*'
      ? '*'
      : [
          frontendUrl,
          frontendUrl + '/', // Allow both with and without trailing slash
        ];

  // Enable global validation pipes
  app.useGlobalPipes(new ZodValidationPipe());

  // Add security headers middleware
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (request, reply, payload) => {
      // Security headers
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'SAMEORIGIN');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', 'origin-when-cross-origin');
      reply.header('X-DNS-Prefetch-Control', 'on');

      // CORS headers will be handled by the CORS middleware below
      return payload;
    });

  // Enable CORS
  await app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Get port from environment variable or use default
  const port = process.env['PORT'] || 3000;
  const host = '0.0.0.0'; // Listen on all network interfaces

  await app.listen(port, host);

  console.log(`Application is running on: http://localhost:${port}`);
}

// Handle bootstrap errors properly
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
