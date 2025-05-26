import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { AuthModule } from '../../src/domains/user/auth/auth.module.js';
import { DatabaseModule } from '../../src/infrastructure/database/database.module.js';
import { testDb } from '../database.js';

interface AuthResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      role?: string;
    };
    tokens: {
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
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    // Create test module
    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        DatabaseModule,
        AuthModule,
      ],
    }).compile();

    // Create and configure app
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Clean database before each test
    await testDb.cleanDatabase();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /auth/signup', () => {
    const validSignupData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      confirmPassword: 'ValidPass123!',
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
      expect(body.data?.tokens).toBeDefined();
      expect(body.data?.tokens.accessToken).toBeDefined();
      expect(body.data?.tokens.refreshToken).toBeDefined();
    });

    it('should not allow duplicate email registration', async () => {
      // Create first user
      await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: validSignupData,
      });

      // Try to create second user with same email
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: validSignupData,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(false);
      expect(body.error?.message).toContain('User already exists');
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
      expect(body.error?.message).toContain('email must be an email');
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
      expect(body.error?.message).toContain('password is too weak');
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
      expect(body.error?.message).toContain('passwords do not match');
    });
  });

  describe('POST /auth/signin', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'ValidPass123!',
    };

    beforeEach(async () => {
      // Create test user
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
        payload: testUser,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload) as AuthResponse;
      expect(body.success).toBe(true);
      expect(body.data?.user.email).toBe(testUser.email);
      expect(body.data?.tokens.accessToken).toBeDefined();
      expect(body.data?.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: {
          ...testUser,
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
      expect(body.error?.message).toContain('email should not be empty');
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
      expect(body.error?.message).toContain('password should not be empty');
    });
  });
});
