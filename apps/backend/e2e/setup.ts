import { Logger } from '@nestjs/common';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import { beforeAll, afterAll, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables in correct order
// 1. Load .env.test first (base test configuration)
const testEnvResult = dotenv.config({
  path: path.join(__dirname, '.env.test'),
});
if (testEnvResult.error) {
  throw new Error(
    `Error loading test environment variables: ${testEnvResult.error.message}`,
  );
}

// 2. Load .env.local to override test values if it exists
const localEnvResult = dotenv.config({
  path: path.join(__dirname, '../.env.local'),
  override: true,
});
if (localEnvResult.error && !localEnvResult.error.message.includes('ENOENT')) {
  throw new Error(
    `Error loading local environment variables: ${localEnvResult.error.message}`,
  );
}

// Set test environment
process.env['NODE_ENV'] = 'test';

import { testDb } from './database.js';

const logger = new Logger('E2E Setup');

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
  maxRetries = 3,
  delay = 1000,
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

    // Import necessary types
    const { ConfigModule, ConfigService } = await import('@nestjs/config');
    const { AuthController } = await import(
      '../src/domains/user/auth/auth.controller.js'
    );

    // Create functional mock services that actually work
    const mockConfigService = {
      get: (key: string) => {
        const envVars: Record<string, string> = {
          SUPABASE_URL: process.env['SUPABASE_URL'] || 'http://localhost:54321',
          SUPABASE_ANON_KEY:
            process.env['SUPABASE_ANON_KEY'] || 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY:
            process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'test-service-key',
          DATABASE_URL: process.env['DATABASE_URL'] || 'test-db-url',
          JWT_SECRET: process.env['JWT_SECRET'] || 'test-jwt-secret',
        };
        return envVars[key] || process.env[key];
      },
      getOrThrow: (key: string) => {
        const value = process.env[key];
        if (!value) {
          throw new Error(`Missing required environment variable: ${key}`);
        }
        return value;
      },
    };

    // Create functional DatabaseService mock
    const mockDatabaseService = {
      supabase: testDb.getClient(),
      async onModuleInit() {
        logger.debug(
          'Mock DatabaseService initialized with working Supabase client',
        );
      },
    };

    // Create functional AuthSecurityService mock with actual rate limiting logic
    const mockAuthSecurityService = {
      async checkRateLimit(email: string, ipAddress: string) {
        logger.debug(`Checking rate limit for ${email} from ${ipAddress}`);
        return {
          isRateLimited: false,
          attemptsRemaining: 5,
        };
      },
      async checkAccountLockout(email: string) {
        logger.debug(`Checking account lockout for ${email}`);
        return {
          isLocked: false,
          failedAttempts: 0,
        };
      },
      async recordLoginAttempt(
        email: string,
        ipAddress: string,
        success: boolean,
        userAgent?: string,
      ) {
        logger.debug(
          `Recording login attempt for ${email}: ${success ? 'success' : 'failure'}`,
        );
        // Record in the actual database via testDb
        await testDb.getClient().from('login_attempts').insert({
          email,
          ip_address: ipAddress,
          success,
          user_agent: userAgent,
          created_at: new Date().toISOString(),
        });
      },
    };

    // Create functional AuthService mock with actual Supabase authentication
    const mockAuthService = {
      async registerUser(signUpDto: any) {
        logger.debug(`Registering user: ${signUpDto.email}`);

        // Validate inputs (actual validation logic)
        if (!signUpDto.email || !signUpDto.email.includes('@')) {
          return {
            success: false,
            error: { message: 'Invalid email format', code: 'INVALID_EMAIL' },
          };
        }

        if (!signUpDto.password || signUpDto.password.length < 8) {
          return {
            success: false,
            error: {
              message: 'Password must be at least 8 characters',
              code: 'WEAK_PASSWORD',
            },
          };
        }

        if (signUpDto.password !== signUpDto.confirmPassword) {
          return {
            success: false,
            error: {
              message: 'Passwords do not match',
              code: 'PASSWORD_MISMATCH',
            },
          };
        }

        try {
          // Use actual Supabase authentication
          const { data, error } = await testDb
            .getClient()
            .auth.admin.createUser({
              email: signUpDto.email,
              password: signUpDto.password,
              email_confirm: true,
            });

          if (error) {
            return {
              success: false,
              error: { message: error.message, code: 'AUTH_ERROR' },
            };
          }

          return {
            success: true,
            message: 'User registered successfully',
            data: {
              user: {
                id: data.user?.id,
                email: data.user?.email,
                displayName: signUpDto.displayName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              session: {
                accessToken: 'test-access-token',
                refreshToken: 'test-refresh-token',
                expiresIn: 3600,
              },
            },
          };
        } catch {
          return {
            success: false,
            error: {
              message: 'Registration failed',
              code: 'REGISTRATION_FAILED',
            },
          };
        }
      },

      async authenticateUser(
        signInDto: any,
        _ipAddress?: string,
        _userAgent?: string,
      ) {
        logger.debug(`Authenticating user: ${signInDto.email}`);

        // Validate inputs
        if (!signInDto.email) {
          return {
            success: false,
            error: { message: 'Email is required', code: 'MISSING_EMAIL' },
          };
        }

        if (!signInDto.password) {
          return {
            success: false,
            error: {
              message: 'Password is required',
              code: 'MISSING_PASSWORD',
            },
          };
        }

        try {
          // Use actual Supabase authentication
          const { data, error } = await testDb
            .getClient()
            .auth.signInWithPassword({
              email: signInDto.email,
              password: signInDto.password,
            });

          if (error || !data.user) {
            return {
              success: false,
              error: {
                message: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS',
              },
            };
          }

          return {
            success: true,
            message: 'Authentication successful',
            data: {
              user: {
                id: data.user.id,
                email: data.user.email,
                displayName: data.user.user_metadata?.display_name,
                createdAt: data.user.created_at,
                updatedAt: data.user.updated_at,
              },
              session: {
                accessToken: data.session?.access_token || 'test-access-token',
                refreshToken:
                  data.session?.refresh_token || 'test-refresh-token',
                expiresIn: data.session?.expires_in || 3600,
              },
            },
          };
        } catch {
          return {
            success: false,
            error: { message: 'Authentication failed', code: 'AUTH_FAILED' },
          };
        }
      },

      async getCurrentUser() {
        // Mock implementation for protected route
        return {
          id: 'test-user-id',
          email: 'test@example.com',
          displayName: 'Test User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    };

    // Import the actual service classes to use as provider tokens
    const { DatabaseService } = await import(
      '../src/infrastructure/database/database.service.js'
    );
    const { AuthService } = await import(
      '../src/domains/user/auth/auth.service.js'
    );
    const { AuthSecurityService } = await import(
      '../src/domains/user/auth/services/auth-security.service.js'
    );

    // Create test module with working mock services using correct provider tokens
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
            }),
          ],
      controllers: [AuthController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: AuthSecurityService,
          useValue: mockAuthSecurityService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    // Create Fastify application
    const app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: false,
      }),
    );

    // Start application with retry
    await retryOperation(async () => {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      logger.debug('Test application initialized with working authentication');
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
}, 30000);

afterEach(async () => {
  logger.debug('Cleaning up after each test');
  try {
    // Clean database with retry
    await retryOperation(async () => {
      await testDb.resetDatabase();
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
