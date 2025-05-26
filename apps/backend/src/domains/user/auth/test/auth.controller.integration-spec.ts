import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  User as SupabaseUser,
  Session,
  AuthResponse,
  AuthTokenResponse,
} from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { isApiSuccessResponse } from '../../../../shared/types/api.types.js';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service.js';

import { AuthController } from '../auth.controller.js';
import { AuthService } from '../auth.service.js';
import { AuthUser, AuthTokens, AuthData } from '../types/auth.types.js';

describe('AuthController (Integration)', () => {
  let app: INestApplication;
  let authController: AuthController;
  const mockSupabaseClient = {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  };

  beforeEach(async () => {
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
          provide: SupabaseService,
          useValue: {
            getClient: () => mockSupabaseClient,
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());

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

      const mockAuthUser: AuthUser = {
        id: mockSupabaseUser.id,
        email: mockSupabaseUser.email ?? '',
        displayName: 'Test User',
        createdAt: mockSupabaseUser.created_at,
        updatedAt: mockSupabaseUser.updated_at ?? mockSupabaseUser.created_at,
        isConfirmed: true,
        lastLoginAt: mockSupabaseUser.last_sign_in_at,
        session: undefined,
      };

      const mockResponse = {
        data: { user: mockSupabaseUser },
        error: null,
      } as AuthResponse;

      mockSupabaseClient.auth.signUp.mockResolvedValueOnce(mockResponse);

      const result = await authController.signup({
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test User',
        confirmPassword: 'Password123!',
        bio: 'Test bio',
      });

      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse<AuthData>(result)) {
        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!',
        });
        expect(result.data.user).toEqual(mockAuthUser);
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

      const mockAuthUser: AuthUser = {
        id: mockSupabaseUser.id,
        email: mockSupabaseUser.email ?? '',
        displayName: 'Test User',
        createdAt: mockSupabaseUser.created_at,
        updatedAt: mockSupabaseUser.updated_at ?? mockSupabaseUser.created_at,
        isConfirmed: true,
        lastLoginAt: mockSupabaseUser.last_sign_in_at,
        session: {
          accessToken: mockSession.access_token,
          refreshToken: mockSession.refresh_token,
          expiresIn: mockSession.expires_in,
        },
      };

      const mockTokens: AuthTokens = {
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresIn: mockSession.expires_in,
      };

      const mockResponse = {
        data: {
          session: mockSession,
          user: mockSession.user,
        },
        error: null,
      } as AuthTokenResponse;

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce(
        mockResponse,
      );

      const result = await authController.signin({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse<AuthData>(result)) {
        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith(
          {
            email: 'test@example.com',
            password: 'Password123!',
          },
        );
        expect(result.data.session).toEqual(mockTokens);
        expect(result.data.user).toEqual(mockAuthUser);
      }
    });
  });
});
