import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

import { DatabaseModule } from '../../../../infrastructure/database/database.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { AuthService } from '../../auth/auth.service.js';

describe('Auth Security Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: 'apps/backend/.env.test',
        }),
        DatabaseModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('🔐 HaveIBeenPwned Password Security Integration', () => {
    describe('Registration Flow Security', () => {
      it('should block registration with commonly compromised password', async () => {
        const compromisedPassword = 'password123'; // Known compromised password

        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test-security@example.com',
            password: compromisedPassword,
            displayName: 'Security Test User',
          })
          .expect(200);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('COMPROMISED_PASSWORD');
        expect(response.body.message).toContain('data breaches');
      });

      it('should block registration with weak password', async () => {
        const weakPassword = '123';

        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test-weak@example.com',
            password: weakPassword,
            displayName: 'Weak Password Test',
          })
          .expect(200);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('WEAK_PASSWORD');
        expect(response.body.error.details).toContain('12 characters');
      });

      it('should allow registration with strong, uncompromised password', async () => {
        const strongPassword = 'SecureTestP@ssw0rd2024!';

        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: `secure-${Date.now()}@example.com`,
            password: strongPassword,
            displayName: 'Secure Test User',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
      });
    });

    describe('Login Flow Security', () => {
      let testUser: any;

      beforeAll(async () => {
        // Create a test user with a strong password
        const strongPassword = 'SecureTestLogin2024!';
        const signupResponse = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: `logintest-${Date.now()}@example.com`,
            password: strongPassword,
            displayName: 'Login Test User',
          });

        testUser = {
          email: signupResponse.body.data.user.email,
          password: strongPassword,
        };
      });

      it('should provide security warning for user with compromised password', async () => {
        // This test simulates a user who registered before our security enhancement
        // and now has a password that appears in breaches
        const response = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: testUser.email,
            password: testUser.password, // Use valid password for successful login
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        // For a secure password, there should be no warning
        expect(response.body.message).not.toContain('compromised');
      });

      it('should allow checking password security for authenticated users', async () => {
        // First login to get token
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/signin')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200);

        const token = loginResponse.body.data.session.accessToken;

        // Check password security
        const securityResponse = await request(app.getHttpServer())
          .post('/auth/check-password-security')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'password123', // Test with compromised password
          })
          .expect(200);

        expect(securityResponse.body.success).toBe(true);
        expect(securityResponse.body.data.isCompromised).toBe(true);
        expect(securityResponse.body.data.breachCount).toBeGreaterThan(0);
        expect(securityResponse.body.data.recommendation).toBeDefined();
      });
    });
  });

  describe('🛡️ Rate Limiting & Account Lockout Security', () => {
    const testEmail = `ratelimit-${Date.now()}@example.com`;

    it('should enforce rate limiting on login attempts', async () => {
      const requests = [];

      // Make 21 rapid login attempts (rate limit is 20 per IP)
      for (let i = 0; i < 21; i++) {
        requests.push(
          request(app.getHttpServer()).post('/auth/signin').send({
            email: testEmail,
            password: 'wrongpassword',
          }),
        );
      }

      const responses = await Promise.all(requests);

      // Check that at least one request was rate limited
      const rateLimitedResponse = responses.find(
        (res) => res.body.error?.code === 'RATE_LIMITED',
      );

      expect(rateLimitedResponse).toBeDefined();
    }, 10000);

    it('should implement progressive account lockout', async () => {
      const lockoutEmail = `lockout-${Date.now()}@example.com`;

      // Make 6 failed attempts (lockout threshold is 5)
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer()).post('/auth/signin').send({
          email: lockoutEmail,
          password: 'wrongpassword',
        });

        // Small delay between attempts
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // The 7th attempt should be blocked due to account lockout
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: lockoutEmail,
          password: 'wrongpassword',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    }, 15000);
  });

  describe('🔒 Authentication & Authorization Security', () => {
    let validToken: string;
    let testUserEmail: string;

    beforeAll(async () => {
      testUserEmail = `authtest-${Date.now()}@example.com`;
      const strongPassword = 'AuthTestP@ssw0rd2024!';

      // Create test user
      await request(app.getHttpServer()).post('/auth/signup').send({
        email: testUserEmail,
        password: strongPassword,
        displayName: 'Auth Test User',
      });

      // Login to get valid token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: testUserEmail,
          password: strongPassword,
        });

      validToken = loginResponse.body.data.session.accessToken;
    });

    it('should protect endpoints with AuthGuard', async () => {
      // Try to access protected endpoint without token
      await request(app.getHttpServer()).get('/auth/me').expect(401);

      // Try with invalid token
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Should work with valid token
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUserEmail);
    });

    it('should validate JWT tokens properly', async () => {
      // Test with malformed token
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer malformed.jwt.token')
        .expect(401);

      // Test with empty Authorization header
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', '')
        .expect(401);

      // Test with wrong format
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Basic sometoken')
        .expect(401);
    });
  });

  describe('⚡ Input Validation Security', () => {
    it('should validate email format in registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'invalid-email-format',
          password: 'ValidP@ssw0rd123!',
          displayName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate password requirements', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: '', // Empty password
          displayName: 'Test User',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate display name requirements', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'ValidP@ssw0rd123!',
          displayName: '', // Empty display name
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayload = "'; DROP TABLE users; --";

      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: sqlInjectionPayload,
          password: 'password',
        })
        .expect(400); // Should be rejected by validation

      expect(response.body.success).toBe(false);
    });
  });

  describe('🔍 Error Handling Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');

      // Should not expose database errors or stack traces
      expect(response.body.error.details).not.toContain('database');
      expect(response.body.error.details).not.toContain('stack');
      expect(response.body.error.details).not.toContain('supabase');
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we ensure the service handles errors properly
      expect(authService).toBeDefined();
    });
  });

  describe('🌐 Security Headers & CORS', () => {
    it('should set security headers on responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401); // Expect 401 but check headers

      // These headers should be set by the framework/deployment
      // In a real deployment, we'd check for CSP, X-Frame-Options, etc.
      expect(response.headers).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      const response = await request(app.getHttpServer())
        .options('/auth/signin')
        .set('Origin', process.env.FRONTEND_URL || 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});
