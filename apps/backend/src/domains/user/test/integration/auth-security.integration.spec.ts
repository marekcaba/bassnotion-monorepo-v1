import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Logger } from '@nestjs/common';

import { DatabaseModule } from '../../../../infrastructure/database/database.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { AuthService } from '../../auth/auth.service.js';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';
import { AuthSecurityService } from '../../auth/services/auth-security.service.js';
import { PasswordSecurityService } from '../../auth/services/password-security.service.js';

const testConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-super-secret-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret',
  NODE_ENV: 'test',
  RATE_LIMIT_TTL: 60,
  RATE_LIMIT_MAX: 20,
  DATABASE_URL: 'postgresql://test',
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => testConfig],
    }),
  ],
})
class TestConfigModule {}

describe('Auth Security Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let databaseService: DatabaseService;
  let authSecurityService: AuthSecurityService;
  let passwordSecurityService: PasswordSecurityService;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestConfigModule, DatabaseModule, AuthModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Get service instances
    authService = moduleFixture.get<AuthService>(AuthService);
    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    authSecurityService =
      moduleFixture.get<AuthSecurityService>(AuthSecurityService);
    passwordSecurityService = moduleFixture.get<PasswordSecurityService>(
      PasswordSecurityService,
    );
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Log service initialization state
    const logger = moduleFixture.get(Logger);
    logger.debug('Test module initialized with services:', {
      hasAuthService: !!authService,
      hasDatabaseService: !!databaseService,
      hasAuthSecurityService: !!authSecurityService,
      hasPasswordSecurityService: !!passwordSecurityService,
      hasConfigService: !!configService,
      databaseServiceType: databaseService?.constructor?.name,
      isSupabaseInitialized: !!databaseService?.supabase,
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    if (databaseService?.supabase) {
      await databaseService.supabase
        .from('login_attempts')
        .delete()
        .neq('id', 0); // Delete all records
    }
  });

  describe('🔐 HaveIBeenPwned Password Security Integration', () => {
    describe('Registration Flow Security', () => {
      it('should block registration with commonly compromised password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'password123',
            displayName: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('commonly used password');
      });

      it('should block registration with weak password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'weak',
            displayName: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('password requirements');
      });

      it('should allow registration with strong, uncompromised password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'vK9#mP2$nL5@xR8',
            displayName: 'Test User',
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
      });
    });

    describe('Login Flow Security', () => {
      it('should handle login attempts properly', async () => {
        // First create a user
        await request(app.getHttpServer()).post('/auth/signup').send({
          email: 'login-test@example.com',
          password: 'vK9#mP2$nL5@xR8',
          displayName: 'Login Test User',
        });

        // Test successful login
        const successResponse = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: 'login-test@example.com',
            password: 'vK9#mP2$nL5@xR8',
          });

        expect(successResponse.status).toBe(200);
        expect(successResponse.body.success).toBe(true);
        expect(successResponse.body.data.session).toBeDefined();

        // Test failed login
        const failedResponse = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: 'login-test@example.com',
            password: 'wrongpassword',
          });

        expect(failedResponse.status).toBe(401);
        expect(failedResponse.body.success).toBe(false);
      });
    });
  });

  describe('🛡️ Rate Limiting & Account Lockout Security', () => {
    it('should enforce rate limiting on login attempts', async () => {
      const testEmail = 'ratelimit@example.com';
      const testPassword = 'wrongpassword';

      // Make multiple login attempts
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: testEmail,
            password: testPassword,
          });

        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error).toContain('Too many login attempts');
        }
      }
    });

    it('should implement progressive account lockout', async () => {
      const testEmail = 'lockout@example.com';
      const testPassword = 'wrongpassword';

      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        const response = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: testEmail,
            password: testPassword,
          });

        if (i < 5) {
          expect(response.status).toBe(401);
        } else {
          expect(response.status).toBe(423);
          expect(response.body.error).toContain(
            'Account is temporarily locked',
          );
        }
      }
    });
  });

  describe('🔒 Authentication & Authorization Security', () => {
    it('should protect endpoints with AuthGuard', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .send();

      expect(response.status).toBe(401);
    });

    it('should validate JWT tokens properly', async () => {
      // First create and login a user
      await request(app.getHttpServer()).post('/auth/signup').send({
        email: 'jwt-test@example.com',
        password: 'vK9#mP2$nL5@xR8',
        displayName: 'JWT Test User',
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'jwt-test@example.com',
          password: 'vK9#mP2$nL5@xR8',
        });

      const token = loginResponse.body.data.session.access_token;

      // Test protected endpoint with valid token
      const validResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(validResponse.status).toBe(200);

      // Test with invalid token
      const invalidResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidResponse.status).toBe(401);
    });
  });

  describe('⚡ Input Validation Security', () => {
    it('should validate email format in registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'invalid-email',
          password: 'vK9#mP2$nL5@xR8',
          displayName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('should validate password requirements', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: '123',
          displayName: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('password');
    });

    it('should validate display name requirements', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'vK9#mP2$nL5@xR8',
          displayName: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('display name');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{"malformed json');

      expect(response.status).toBe(400);
    });

    it('should prevent SQL injection attempts', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: "' OR '1'='1",
          password: "' OR '1'='1",
        });

      expect(response.status).toBe(401);
    });
  });

  describe('🔍 Error Handling Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'somepassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid email or password');
      expect(response.body.error).not.toContain('SQL');
      expect(response.body.error).not.toContain('database');
    });

    it('should handle database connection errors gracefully', async () => {
      // Temporarily break database connection
      const originalSupabase = databaseService.supabase;
      // @ts-expect-error Intentionally setting to null for testing
      databaseService.supabase = null;

      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('An unexpected error occurred');

      // Restore database connection
      databaseService.supabase = originalSupabase;
    });
  });

  describe('🌐 Security Headers & CORS', () => {
    it('should set security headers on responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .send();

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should handle CORS properly', async () => {
      const response = await request(app.getHttpServer())
        .options('/auth/signin')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});
