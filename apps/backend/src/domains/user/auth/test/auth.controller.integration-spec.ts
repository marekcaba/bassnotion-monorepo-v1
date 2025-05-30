import {
  AuthResponse,
  AuthTokenResponse,
  Session,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyRequest } from 'fastify';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { isApiSuccessResponse } from '../../../../shared/types/api.types.js';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service.js';

import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { AuthData } from '../types/auth.types.js';
import { AuthSecurityService } from '../services/auth-security.service.js';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let authController: AuthController;
  let mockDatabaseService: any;

  beforeEach(async () => {
    // Create a proper mock for DatabaseService
    mockDatabaseService = {
      supabase: {
        auth: {
          signUp: vi.fn(),
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockReturnThis(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
          load: [
            () => ({
              SUPABASE_URL: 'http://localhost:54321',
              SUPABASE_ANON_KEY: 'test-key',
            }),
          ],
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => mockDatabaseService.supabase,
          },
        },
        {
          provide: AuthSecurityService,
          useValue: {
            getSecurityInfo: vi.fn().mockResolvedValue({
              rateLimitInfo: { isRateLimited: false, attemptsRemaining: 5 },
              lockoutInfo: { isLocked: false, failedAttempts: 0 },
            }),
            getSecurityErrorMessage: vi.fn(),
            recordLoginAttempt: vi.fn(),
            resetFailedAttempts: vi.fn(),
            logger: new Logger('MockAuthSecurityService'),
            RATE_LIMIT_WINDOW: 15 * 60 * 1000,
            MAX_ATTEMPTS_PER_IP: 20,
            MAX_ATTEMPTS_PER_EMAIL: 5,
            LOCKOUT_THRESHOLDS: [
              { attempts: 3, duration: 2 * 60 * 1000 },
              { attempts: 5, duration: 15 * 60 * 1000 },
              { attempts: 8, duration: 60 * 60 * 1000 },
              { attempts: 10, duration: 24 * 60 * 60 * 1000 },
            ],
            db: mockDatabaseService,
            checkRateLimit: vi.fn().mockResolvedValue({
              isRateLimited: false,
              attemptsRemaining: 5,
            }),
            checkAccountLockout: vi
              .fn()
              .mockResolvedValue({ isLocked: false, failedAttempts: 0 }),
            cleanupOldAttempts: vi.fn(),
          } as unknown as AuthSecurityService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    authController = moduleFixture.get<AuthController>(AuthController);

    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('signup', () => {
    it('should be defined', () => {
      expect(authController.signup).toBeDefined();
    });

    it('should register a new user successfully', async () => {
      const mockSupabaseUser: SupabaseUser = {
        id: 'test-id',
        email: 'test@example.com',
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        identities: [],
        updated_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: undefined,
        last_sign_in_at: new Date().toISOString(),
        factors: [],
      };

      const mockProfile = {
        id: 'test-id',
        email: 'test@example.com',
        display_name: 'Test User',
        bio: 'Test bio',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockAuthResponse = {
        data: {
          user: mockSupabaseUser,
          session: {
            access_token: 'test-token',
            refresh_token: 'test-refresh-token',
            expires_in: 3600,
          },
        },
        error: null,
      } as AuthResponse;

      // Mock the auth signup
      mockDatabaseService.supabase.auth.signUp.mockResolvedValueOnce(
        mockAuthResponse,
      );

      // Mock the profile creation
      mockDatabaseService.supabase.single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      const result = await authController.signup({
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test User',
        confirmPassword: 'Password123!',
        bio: 'Test bio',
      });

      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse<AuthData>(result)) {
        expect(mockDatabaseService.supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect(result.data.user.email).toBe('test@example.com');
        expect(result.data.user.displayName).toBe('Test User');
      }
    });
  });

  describe('signin', () => {
    it('should be defined', () => {
      expect(authController.signin).toBeDefined();
    });

    it('should login user successfully', async () => {
      const mockSupabaseUser: SupabaseUser = {
        id: 'test-id',
        email: 'test@example.com',
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        role: 'authenticated',
        app_metadata: {},
        user_metadata: {},
        identities: [],
        updated_at: new Date().toISOString(),
        phone: '',
        confirmed_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(),
        phone_confirmed_at: undefined,
        last_sign_in_at: new Date().toISOString(),
        factors: [],
      };

      const mockSession: Session = {
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      const mockProfile = {
        id: 'test-id',
        email: 'test@example.com',
        display_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockAuthResponse = {
        data: {
          session: mockSession,
          user: mockSession.user,
        },
        error: null,
      } as AuthTokenResponse;

      // Mock the auth signin
      mockDatabaseService.supabase.auth.signInWithPassword.mockResolvedValueOnce(
        mockAuthResponse,
      );

      // Mock the profile fetch
      mockDatabaseService.supabase.single.mockResolvedValueOnce({
        data: mockProfile,
        error: null,
      });

      const result = await authController.signin(
        {
          email: 'test@example.com',
          password: 'Password123!',
        },
        {
          headers: { 'user-agent': 'test-agent' },
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
        } as FastifyRequest,
      );

      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse<AuthData>(result)) {
        expect(
          mockDatabaseService.supabase.auth.signInWithPassword,
        ).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect(result.data.user.email).toBe('test@example.com');
        expect(result.data.session.accessToken).toBe('test-token');
      }
    });
  });
});
