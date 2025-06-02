import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as dotenv from 'dotenv';

import { AppModule } from './app.module.js';

// Load environment variables from .env file in monorepo root
// Try multiple paths for different deployment scenarios
dotenv.config({ path: '../../.env' }); // Local development
dotenv.config({ path: '.env' }); // Railway deployment
dotenv.config(); // Default .env loading

// Import reflect-metadata for NestJS decorators
import 'reflect-metadata';

// --- DEBUG LINES ---
console.warn('DEBUG: Process CWD:', process.cwd());
console.warn('DEBUG: Loaded SUPABASE_URL:', process.env['SUPABASE_URL']);
console.warn('DEBUG: Loaded SUPABASE_KEY:', process.env['SUPABASE_KEY']);
// --- END DEBUG LINES ---

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // Normalize frontend URL by removing trailing slash for CORS
  const frontendUrl = process.env['FRONTEND_URL']?.replace(/\/$/, '') || '*';
  
  // Create array of allowed origins to handle both with and without trailing slash
  const allowedOrigins = frontendUrl === '*' ? '*' : [
    frontendUrl,
    frontendUrl + '/'  // Allow both with and without trailing slash
  ];

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

  // Debug: Log all registered routes
  console.warn(`Application is running on: http://localhost:${port}`);
  console.warn('DEBUG: Registered routes:');
  console.warn('- GET /api/health (AppController)');
  console.warn('- POST /auth/signin (AuthController)');  
  console.warn('- POST /auth/signup (AuthController)');
  console.warn('- GET /auth/me (AuthController)');
  console.warn('- PUT /user/profile (UserController)');
  console.warn('- DELETE /user/account (UserController)');
  console.warn('DEBUG: If UserController routes are missing, check module imports');
}

// Handle bootstrap errors properly
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
