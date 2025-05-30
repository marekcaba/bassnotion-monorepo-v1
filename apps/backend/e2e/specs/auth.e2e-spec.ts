import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

import { AppModule } from '../../src/app.module.js';
import { testDb } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL: Load environment variables BEFORE any module imports
config({ path: path.join(__dirname, '../.env.test') });
config({ path: path.join(__dirname, '../../.env.local'), override: false });

// Set required environment variables if not present
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'test-anon-key';

interface AuthResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      displayName?: string;
    };
    session: {
      accessToken: string;
      refreshToken: string;
    };
  };
  error?: {
    message: string;
    details?: string;
  };
}

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    // Initialize test database
    await testDb.resetDatabase();

    // Create a test module with EXPLICIT ConfigModule setup
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // ConfigModule MUST be first and properly configured
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            path.join(__dirname, '../.env.test'),
            path.join(__dirname, '../../.env.local'),
          ],
          expandVariables: true,
          load: [
            () => ({
              SUPABASE_URL: process.env.SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
              SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            }),
          ],
        }),
        AppModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string): string | undefined => {
          const envVars: Record<string, string> = {
            SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
            SUPABASE_SERVICE_ROLE_KEY:
              process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
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
      })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /auth/signup', () => {
    const validSignupData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      confirmPassword: 'ValidPass123!',
      displayName: 'Test User',
    };

    it('should create a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: validSignupData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(true);
      expect(body.data?.user.email).toBe(validSignupData.email);
      expect(body.data?.session).toBeDefined();
      expect(body.data?.session.accessToken).toBeDefined();
      expect(body.data?.session.refreshToken).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          ...validSignupData,
          email: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBeDefined();
    });

    it('should validate password strength', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          ...validSignupData,
          password: 'weak',
          confirmPassword: 'weak',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBeDefined();
    });

    it('should validate password match', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          ...validSignupData,
          confirmPassword: 'DifferentPass123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBeDefined();
    });
  });

  describe('POST /auth/signin', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      displayName: 'Test User',
    };

    beforeEach(async () => {
      // Create test user first
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: {
          ...testUser,
          confirmPassword: testUser.password,
        },
      });
    });

    it('should authenticate valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(true);
      expect(body.data?.user.email).toBe(testUser.email);
      expect(body.data?.session.accessToken).toBeDefined();
      expect(body.data?.session.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          email: testUser.email,
          password: 'WrongPass123!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          email: 'nonexistent@example.com',
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toContain('Invalid credentials');
    });

    it('should require email field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          password: testUser.password,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBeDefined();
    });

    it('should require password field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          email: testUser.email,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toBeDefined();
    });
  });
});
