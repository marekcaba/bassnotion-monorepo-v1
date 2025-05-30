import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';
import { AuthSecurityService } from '../services/auth-security.service.js';
import {
  isAuthSuccessResponse,
  isAuthErrorResponse,
} from '../types/auth.types.js';
import { SignUpDto } from '../dto/sign-up.dto.js';
import { SignInDto } from '../dto/sign-in.dto.js';

describe('AuthController (Integration)', () => {
  let controller: AuthController;
  let mockDatabaseService: any;
  let mockAuthSecurityService: any;

  beforeEach(async () => {
    // Create mocks for dependencies (like the working integration test)
    mockDatabaseService = {
      supabase: {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
              },
              session: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                expires_in: 3600,
              },
            },
            error: null,
          }),
          signInWithPassword: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
              },
              session: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token',
                expires_in: 3600,
              },
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null, // No existing user by default
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-user-id',
                  email: 'test@example.com',
                  display_name: 'Test User',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      },
    };

    mockAuthSecurityService = {
      getSecurityInfo: vi.fn().mockResolvedValue({
        rateLimitInfo: { isRateLimited: false, attemptsRemaining: 5 },
        lockoutInfo: { isLocked: false, failedAttempts: 0 },
      }),
      recordLoginAttempt: vi.fn(),
      resetFailedAttempts: vi.fn(),
      checkRateLimit: vi.fn().mockResolvedValue({
        isRateLimited: false,
        attemptsRemaining: 5,
      }),
      checkAccountLockout: vi.fn().mockResolvedValue({
        isLocked: false,
        failedAttempts: 0,
      }),
    };

    // Create test module (like the working integration test)
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
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
          provide: AuthSecurityService,
          useValue: mockAuthSecurityService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('signup', () => {
    const validSignupData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
      confirmPassword: 'ValidPass123!',
      displayName: 'Test User',
    };

    it('should create a new user successfully', async () => {
      const signUpDto = new SignUpDto(validSignupData);
      const result = await controller.signup(signUpDto);

      expect(isAuthSuccessResponse(result)).toBe(true);
      if (isAuthSuccessResponse(result)) {
        expect(result.data.user.email).toBe(validSignupData.email);
        expect(result.data.session.accessToken).toBeDefined();
        expect(result.data.session.refreshToken).toBeDefined();
      }
      expect(mockDatabaseService.supabase.auth.signUp).toHaveBeenCalledWith({
        email: validSignupData.email,
        password: validSignupData.password,
      });
    });

    it('should handle duplicate email registration', async () => {
      // Mock duplicate user error
      mockDatabaseService.supabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'User already registered',
          status: 422,
        },
      });

      const signUpDto = new SignUpDto(validSignupData);
      const result = await controller.signup(signUpDto);

      expect(isAuthErrorResponse(result)).toBe(true);
      if (isAuthErrorResponse(result)) {
        expect(result.message).toContain('User already');
      }
    });

    it('should validate email format', async () => {
      const invalidData = {
        ...validSignupData,
        email: 'invalid-email',
      };

      // Mock validation error
      mockDatabaseService.supabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Invalid email',
          status: 422,
        },
      });

      const signUpDto = new SignUpDto(invalidData);
      const result = await controller.signup(signUpDto);

      expect(isAuthErrorResponse(result)).toBe(true);
      if (isAuthErrorResponse(result)) {
        expect(result.message).toBeDefined();
      }
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validSignupData,
        password: 'weak',
        confirmPassword: 'weak',
      };

      // Mock weak password error
      mockDatabaseService.supabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          message: 'Password should be at least 6 characters',
          status: 422,
        },
      });

      const signUpDto = new SignUpDto(weakPasswordData);
      const result = await controller.signup(signUpDto);

      expect(isAuthErrorResponse(result)).toBe(true);
      if (isAuthErrorResponse(result)) {
        expect(result.message).toBeDefined();
      }
    });
  });

  describe('signin', () => {
    const validSigninData = {
      email: 'test@example.com',
      password: 'ValidPass123!',
    };

    it('should authenticate valid credentials', async () => {
      const signInDto = new SignInDto(validSigninData);
      const result = await controller.signin(signInDto, {} as any);

      expect(isAuthSuccessResponse(result)).toBe(true);
      if (isAuthSuccessResponse(result)) {
        expect(result.data.user.email).toBe(validSigninData.email);
        expect(result.data.session.accessToken).toBeDefined();
        expect(result.data.session.refreshToken).toBeDefined();
      }
      expect(
        mockDatabaseService.supabase.auth.signInWithPassword,
      ).toHaveBeenCalledWith({
        email: validSigninData.email,
        password: validSigninData.password,
      });
    });

    it('should reject invalid credentials', async () => {
      // Mock invalid credentials error
      mockDatabaseService.supabase.auth.signInWithPassword.mockResolvedValueOnce(
        {
          data: { user: null, session: null },
          error: {
            message: 'Invalid login credentials',
            status: 400,
          },
        },
      );

      const signInDto = new SignInDto(validSigninData);
      const result = await controller.signin(signInDto, {} as any);

      expect(isAuthErrorResponse(result)).toBe(true);
      if (isAuthErrorResponse(result)) {
        expect(result.message).toContain('Invalid');
      }
    });
  });
});
