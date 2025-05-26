import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import { beforeAll, afterAll, afterEach } from 'vitest';

import { testDb } from './database.js';
import { UserModule } from '../src/domains/user/user.module.js';
import { DatabaseModule } from '../src/infrastructure/database/database.module.js';

const logger = new Logger('E2E Setup');

// Load test environment variables first
const envResult = dotenv.config({ path: '.env.test' });
if (envResult.error) {
  throw new Error(
    `Error loading test environment variables: ${envResult.error.message}`,
  );
}

// Set test environment
process.env['NODE_ENV'] = 'test';

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'PORT',
  'API_PREFIX',
  'JWT_SECRET',
] as const;

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`,
  );
}

// Create a type for our test context
interface TestContext {
  app: NestFastifyApplication;
  moduleFixture: TestingModule;
}

// Declare global test context
declare global {
  // eslint-disable-next-line no-var
  var __TEST_CONTEXT__: TestContext;
}

// Add retry logic for database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(
        `Operation failed (attempt ${attempt}/${maxRetries}):`,
        error,
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError || new Error('Operation failed after all retries');
}

beforeAll(async () => {
  logger.debug('Setting up E2E test application');

  try {
    // Initialize test database first with retry
    await retryOperation(async () => {
      await testDb.resetDatabase();
      logger.debug('Test database initialized');
    });

    // Create test module
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [
            () => ({
              SUPABASE_URL: process.env['SUPABASE_URL'],
              SUPABASE_ANON_KEY: process.env['SUPABASE_ANON_KEY'],
              SUPABASE_SERVICE_ROLE_KEY:
                process.env['SUPABASE_SERVICE_ROLE_KEY'],
              DATABASE_URL: process.env['DATABASE_URL'],
              PORT: process.env['PORT'],
              API_PREFIX: process.env['API_PREFIX'],
              JWT_SECRET: process.env['JWT_SECRET'],
            }),
          ],
          cache: true,
          validate: (config) => {
            const requiredKeys = [
              'SUPABASE_URL',
              'SUPABASE_ANON_KEY',
              'SUPABASE_SERVICE_ROLE_KEY',
              'DATABASE_URL',
              'JWT_SECRET',
            ];
            const missingKeys = requiredKeys.filter((key) => !config[key]);
            if (missingKeys.length > 0) {
              throw new Error(
                `Missing required config keys: ${missingKeys.join(', ')}`,
              );
            }
            return config;
          },
        }),
        DatabaseModule,
        UserModule,
      ],
    }).compile();

    // Create Fastify application
    const app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: false, // Disable Fastify logger in tests
      }),
    );

    // Apply global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      }),
    );

    // Start application with retry
    await retryOperation(async () => {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      logger.debug('Test application initialized');
    });

    // Store test context
    global.__TEST_CONTEXT__ = {
      app,
      moduleFixture,
    };
  } catch (error) {
    logger.error('Failed to setup E2E test application:', error);
    throw error;
  }
}, 30000); // Increase timeout to 30s for setup

afterEach(async () => {
  logger.debug('Cleaning up after each test');
  try {
    // Clean database with retry
    await retryOperation(async () => {
      await testDb.cleanDatabase();
    });
  } catch (error) {
    logger.error('Error during test cleanup:', error);
    throw error;
  }
});

afterAll(async () => {
  logger.debug('Cleaning up E2E test application');
  try {
    const { app, moduleFixture } = global.__TEST_CONTEXT__ || {};

    if (app) {
      // Close app with retry
      await retryOperation(async () => {
        await app.close();
        logger.debug('Application closed');
      });
    }

    if (moduleFixture) {
      // Close module fixture with retry
      await retryOperation(async () => {
        await moduleFixture.close();
        logger.debug('Module fixture closed');
      });
    }

    // Final database cleanup with retry
    await retryOperation(async () => {
      await testDb.resetDatabase();
      logger.debug('Database reset completed');
    });
  } catch (error) {
    logger.error('Error during E2E test application cleanup:', error);
    throw error;
  }
}, 30000); // Increase timeout to 30s for cleanup
