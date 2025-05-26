import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as dotenv from 'dotenv';

import { AppModule } from './app.module.js';

// Load environment variables from .env file in monorepo root
dotenv.config({ path: '../../.env' });

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

  // Enable CORS
  await app.enableCors({
    origin: process.env['FRONTEND_URL'] || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Get port from environment variable or use default
  const port = process.env['PORT'] || 3000;
  const host = '0.0.0.0'; // Listen on all network interfaces

  await app.listen(port, host);

  console.warn(`Application is running on: http://localhost:${port}`);
}

// Handle bootstrap errors properly
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
