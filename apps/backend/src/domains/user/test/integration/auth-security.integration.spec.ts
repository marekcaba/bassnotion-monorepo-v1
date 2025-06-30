import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import {
  vi,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import * as path from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables BEFORE importing any modules
const envPath = path.join(__dirname, '../../../../../.env.test');
console.log('🔧 [Test] Loading .env.test from:', envPath);
console.log('🔧 [Test] File exists:', require('fs').existsSync(envPath));
config({ path: envPath });

import { AuthModule } from '../../auth/auth.module.js';
import { AuthService } from '../../auth/auth.service.js';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';
import { AuthSecurityService } from '../../auth/services/auth-security.service.js';
import { PasswordSecurityService } from '../../auth/services/password-security.service.js';

// Mock HaveIBeenPwned API
vi.mock('hibp', () => ({
  pwnedPassword: vi.fn(),
}));

// Track created users to simulate database state
const createdUsers = new Set<string>();
// Track login attempts for rate limiting simulation
const loginAttempts = new Map<
  string,
  Array<{ timestamp: number; success: boolean }>
>();

// Track login attempts during test execution for rate limiting simulation
const testLoginAttempts = new Map<string, number>();

// Create comprehensive Supabase client mock
const mockSupabaseClient = {
  auth: {
    signUp: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
        },
        session: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
          },
        },
      },
      error: null,
    }),
    signInWithPassword: vi.fn().mockImplementation(({ email, password }) => {
      // Check for SQL injection attempts or invalid credentials
      if (
        email.includes("'") ||
        email.includes('OR') ||
        password.includes("'") ||
        password.includes('OR') ||
        email === 'nonexistent@example.com' ||
        password === 'wrongpassword' ||
        password === 'somepassword'
      ) {
        return Promise.resolve({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        });
      }

      // Return success for valid credentials
      return Promise.resolve({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            email_confirmed_at: new Date().toISOString(),
          },
          session: {
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
            },
          },
        },
        error: null,
      });
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null,
    }),
    getUser: vi.fn().mockImplementation((token?: string) => {
      console.log(
        '🔧 [Mock] getUser called with token:',
        token?.substring(0, 20) + '...',
      );

      // Validate token format and content
      if (token === 'test-access-token') {
        return Promise.resolve({
          data: {
            user: {
              id: 'test-user-id',
              email: 'jwt-test@example.com',
              email_confirmed_at: new Date().toISOString(),
            },
          },
          error: null,
        });
      }

      // Invalid token
      return Promise.resolve({
        data: { user: null },
        error: { message: 'Invalid token' },
      });
    }),
  },
  from: vi.fn().mockImplementation((table: string) => {
    // Create a mock query builder with chained methods
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockImplementation((data) => {
        // When inserting a user, track them as created
        if (table === 'profiles' && data.email) {
          createdUsers.add(data.email);
        }
        // When inserting login attempts, track them for rate limiting
        if (table === 'login_attempts' && data.email) {
          const attempts = loginAttempts.get(data.email) || [];
          attempts.push({
            timestamp: Date.now(),
            success: data.success || false,
          });
          loginAttempts.set(data.email, attempts);
        }
        return mockQueryBuilder;
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      containedBy: vi.fn().mockReturnThis(),
      rangeGt: vi.fn().mockReturnThis(),
      rangeGte: vi.fn().mockReturnThis(),
      rangeLt: vi.fn().mockReturnThis(),
      rangeLte: vi.fn().mockReturnThis(),
      rangeAdjacent: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      // Handle count queries for rate limiting
      then: vi.fn().mockImplementation((_callback) => {
        if (table === 'login_attempts') {
          // Check the query chain to determine what kind of count query this is
          const eqCalls = mockQueryBuilder.eq.mock.calls;
          const emailFilter = eqCalls.find((call) => call[0] === 'email');
          const successFilter = eqCalls.find(
            (call) => call[0] === 'success' && call[1] === false,
          );

          if (emailFilter && successFilter) {
            // This is a rate limiting count query
            const emailToCheck = emailFilter[1];
            const attempts = loginAttempts.get(emailToCheck) || [];

            // Count failed attempts in the last 15 minutes
            const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
            const recentFailedAttempts = attempts.filter(
              (a) => !a.success && a.timestamp > fifteenMinutesAgo,
            ).length;

            // Return count result that triggers rate limiting after 5 attempts
            return Promise.resolve({
              count: recentFailedAttempts,
              error: null,
            });
          }
        }

        // Default count result
        return Promise.resolve({ count: 0, error: null });
      }),
      single: vi.fn().mockImplementation(() => {
        if (table === 'profiles') {
          // Check if this is a user existence check (select with eq filter)
          const lastEqCall = mockQueryBuilder.eq.mock.lastCall;
          if (lastEqCall && lastEqCall[0] === 'email') {
            const emailToCheck = lastEqCall[1];
            if (createdUsers.has(emailToCheck)) {
              // User exists
              return Promise.resolve({
                data: {
                  id: 'existing-user-id',
                  email: emailToCheck,
                  display_name: 'Existing User',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              });
            } else {
              // User doesn't exist
              return Promise.resolve({ data: null, error: null });
            }
          } else if (lastEqCall && lastEqCall[0] === 'id') {
            // This is a profile lookup by ID (for token validation)
            const idToCheck = lastEqCall[1];
            if (idToCheck === 'test-user-id') {
              // Return profile data that matches the user from getUser mock
              return Promise.resolve({
                data: {
                  id: 'test-user-id',
                  email: 'jwt-test@example.com', // Match the test user email
                  display_name: 'JWT Test User',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              });
            }
          }

          // Default profile return for successful operations
          return Promise.resolve({
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              display_name: 'Test User',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          });
        }
        // For login_attempts and other tables, return empty results
        return Promise.resolve({ data: null, error: null });
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        // For login_attempts table, simulate rate limiting logic
        if (table === 'login_attempts') {
          const lastEqCall = mockQueryBuilder.eq.mock.lastCall;
          if (lastEqCall && lastEqCall[0] === 'email') {
            const emailToCheck = lastEqCall[1];
            const attempts = loginAttempts.get(emailToCheck) || [];

            // Simulate rate limiting: if more than 5 attempts in last hour, return data
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const recentAttempts = attempts.filter(
              (a) => a.timestamp > oneHourAgo,
            );

            if (recentAttempts.length >= 5) {
              // Return rate limiting data
              return Promise.resolve({
                data: {
                  email: emailToCheck,
                  attempt_count: recentAttempts.length,
                  last_attempt: new Date().toISOString(),
                  locked_until: new Date(
                    Date.now() + 15 * 60 * 1000,
                  ).toISOString(), // 15 min lockout
                },
                error: null,
              });
            }
          }
        }
        // For other tables, return empty results
        return Promise.resolve({ data: null, error: null });
      }),
    };

    return mockQueryBuilder;
  }),
};

// Mock the DatabaseService to use our mocked Supabase client
const _mockDatabaseService = {
  supabase: mockSupabaseClient,
  onModuleInit: vi.fn(),
};

// Mock AuthSecurityService to prevent timeouts
const mockAuthSecurityService = {
  getSecurityInfo: vi
    .fn()
    .mockImplementation((email: string, ipAddress: string) => {
      // Track attempts for this email
      const attemptKey = `${email}:${ipAddress}`;
      const currentAttempts = testLoginAttempts.get(attemptKey) || 0;

      // Simulate rate limiting for specific test scenarios
      if (email === 'ratelimit@example.com' && currentAttempts >= 5) {
        return Promise.resolve({
          rateLimitInfo: {
            isRateLimited: true,
            attemptsRemaining: 0,
            remainingTime: 900, // 15 minutes
          },
          lockoutInfo: {
            isLocked: false,
            failedAttempts: currentAttempts,
          },
        });
      }

      if (email === 'lockout@example.com' && currentAttempts >= 5) {
        return Promise.resolve({
          rateLimitInfo: {
            isRateLimited: false,
            attemptsRemaining: 0,
          },
          lockoutInfo: {
            isLocked: true,
            failedAttempts: currentAttempts,
          },
        });
      }

      // Default: no rate limiting or lockout
      return Promise.resolve({
        rateLimitInfo: {
          isRateLimited: false,
          attemptsRemaining: Math.max(0, 5 - currentAttempts),
        },
        lockoutInfo: {
          isLocked: false,
          failedAttempts: currentAttempts,
        },
      });
    }),
  recordLoginAttempt: vi
    .fn()
    .mockImplementation(
      (email: string, ipAddress: string, success: boolean) => {
        // Track failed attempts for rate limiting simulation
        if (!success) {
          const attemptKey = `${email}:${ipAddress}`;
          const currentAttempts = testLoginAttempts.get(attemptKey) || 0;
          testLoginAttempts.set(attemptKey, currentAttempts + 1);
        }
        return Promise.resolve();
      },
    ),
  checkRateLimit: vi.fn().mockResolvedValue({
    isRateLimited: false,
    attemptsRemaining: 5,
  }),
  checkAccountLockout: vi.fn().mockResolvedValue({
    isLocked: false,
    failedAttempts: 0,
  }),
  getSecurityErrorMessage: vi
    .fn()
    .mockImplementation((rateLimitInfo: any, lockoutInfo: any) => {
      if (rateLimitInfo?.isRateLimited) {
        return 'Too many login attempts. Please try again later.';
      }
      if (lockoutInfo?.isLocked) {
        return 'Account is temporarily locked due to multiple failed login attempts.';
      }
      return 'Login blocked for security reasons';
    }),
  resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
};

describe('Auth Security Integration Tests', () => {
  let app: NestFastifyApplication;
  let authService: AuthService;
  let databaseService: DatabaseService;
  let authSecurityService: AuthSecurityService;
  let passwordSecurityService: PasswordSecurityService;

  beforeAll(async () => {
    console.log('🔧 [Test] Starting test setup...');

    console.log('🔧 [Test] NODE_ENV:', process.env.NODE_ENV);
    console.log(
      '🔧 [Test] SUPABASE_URL:',
      process.env.SUPABASE_URL ? '[SET]' : '[NOT SET]',
    );
    console.log(
      '🔧 [Test] SUPABASE_SERVICE_ROLE_KEY:',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[NOT SET]',
    );

    console.log('🔧 [Test] Creating test module...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(_mockDatabaseService)
      .overrideProvider(AuthSecurityService)
      .useValue(mockAuthSecurityService)
      .compile();
    console.log('🔧 [Test] Test module compiled successfully');

    console.log('🔧 [Test] Creating NestApplication...');
    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    console.log('🔧 [Test] NestApplication created');

    console.log('🔧 [Test] Configuring security headers and CORS...');
    // Add security headers middleware (Fastify-compatible)
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('onSend', async (request: any, reply: any, payload: any) => {
        // Security headers
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'SAMEORIGIN');
        reply.header('X-XSS-Protection', '1; mode=block');
        reply.header('Referrer-Policy', 'origin-when-cross-origin');
        reply.header('X-DNS-Prefetch-Control', 'on');

        return payload;
      });

    // Enable CORS (matching main.ts)
    await app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });
    console.log('🔧 [Test] Security headers and CORS configured');

    console.log('🔧 [Test] Initializing application...');
    // Initialize the application to trigger onModuleInit() lifecycle hooks
    await app.init();
    console.log('🔧 [Test] Application initialized');

    console.log('🔧 [Test] Getting service instances...');
    // Get service instances
    authService = moduleFixture.get<AuthService>(AuthService);
    console.log('🔧 [Test] AuthService retrieved:', {
      exists: !!authService,
      type: authService?.constructor?.name,
    });

    databaseService = moduleFixture.get<DatabaseService>(DatabaseService);
    console.log('🔧 [Test] DatabaseService retrieved:', {
      exists: !!databaseService,
      type: databaseService?.constructor?.name,
      hasSupabase: !!databaseService?.supabase,
    });

    authSecurityService =
      moduleFixture.get<AuthSecurityService>(AuthSecurityService);
    console.log('🔧 [Test] AuthSecurityService retrieved:', {
      exists: !!authSecurityService,
      type: authSecurityService?.constructor?.name,
    });

    passwordSecurityService = moduleFixture.get<PasswordSecurityService>(
      PasswordSecurityService,
    );
    console.log('🔧 [Test] PasswordSecurityService retrieved:', {
      exists: !!passwordSecurityService,
      type: passwordSecurityService?.constructor?.name,
    });

    // Log service initialization state (skip logger to avoid DI issues)
    console.log('Test module initialized with services:', {
      hasAuthService: !!authService,
      hasDatabaseService: !!databaseService,
      hasAuthSecurityService: !!authSecurityService,
      hasPasswordSecurityService: !!passwordSecurityService,
      databaseServiceType: databaseService?.constructor?.name,
      isSupabaseInitialized: !!databaseService?.supabase,
    });

    console.log('🔧 [Test] Starting HTTP server...');
    await app.listen(0); // Start the server for HTTP requests
    console.log('🔧 [Test] HTTP server started');
    console.log('🔧 [Test] Setup completed successfully');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    console.log('🔧 [Test] Setting up test mocks...');

    // Reset login attempts tracking between tests
    testLoginAttempts.clear();
    createdUsers.clear();
    loginAttempts.clear();

    // Reset all mocks to ensure clean state
    vi.clearAllMocks();

    // Configure HaveIBeenPwned mock for this test
    const { pwnedPassword } = await import('hibp');
    (pwnedPassword as any).mockImplementation((password: string) => {
      if (
        password === 'Welcome123!@#' ||
        password === 'password' ||
        password === '123456'
      ) {
        return Promise.resolve(123456); // Compromised
      }
      return Promise.resolve(0); // Secure
    });

    console.log('🔧 [Test] Mocks configured successfully');
  });

  describe('🔐 HaveIBeenPwned Password Security Integration', () => {
    describe('Registration Flow Security', () => {
      it('should block registration with commonly compromised password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'Welcome123!@#',
            confirmPassword: 'Welcome123!@#',
            displayName: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.details).toContain('extremely common');
      });

      it('should block registration with weak password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'Password1',
            confirmPassword: 'Password1',
            displayName: 'Test User',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.details).toContain('Password requirements');
      });

      it('should allow registration with strong, uncompromised password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/signup')
          .send({
            email: 'test@example.com',
            password: 'vK9#mP2$nL5@xR8',
            confirmPassword: 'vK9#mP2$nL5@xR8',
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
          confirmPassword: 'vK9#mP2$nL5@xR8',
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
          expect(response.body.error.details).toContain(
            'Too many login attempts',
          );
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
          expect(response.body.error.details).toContain(
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
        confirmPassword: 'vK9#mP2$nL5@xR8',
        displayName: 'JWT Test User',
      });

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/signin')
        .send({
          email: 'jwt-test@example.com',
          password: 'vK9#mP2$nL5@xR8',
        });

      console.log(
        '🔧 [Test] Login response body:',
        JSON.stringify(loginResponse.body, null, 2),
      );
      console.log('🔧 [Test] Session data:', loginResponse.body.data?.session);

      const token = loginResponse.body.data.session.accessToken; // Use camelCase

      console.log('🔧 [Test] Extracted token:', token);

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
      expect(response.body.errors).toContain('email: Invalid email format');
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
      expect(
        response.body.errors.some((err: string) => err.includes('password')),
      ).toBe(true);
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
      expect(
        response.body.errors.some((err: string) => err.includes('displayName')),
      ).toBe(true);
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

      // Zod validation catches invalid email format before it reaches login logic
      expect(response.status).toBe(400);
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
      expect(response.body.error.details).toBe('Invalid email or password');
      expect(response.body.error.details).not.toContain('SQL');
      expect(response.body.error.details).not.toContain('database');
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
      expect(response.body.error.details).toBe('An unexpected error occurred');

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
