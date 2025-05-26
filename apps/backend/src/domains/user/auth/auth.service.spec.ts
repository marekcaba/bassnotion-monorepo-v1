import type { User } from '@bassnotion/contracts' with { "resolution-mode": "require" };
import {
  AuthError,
  Session,
  SupabaseClient,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ApiErrorResponse,
  ApiSuccessResponse,
  isApiErrorResponse,
  isApiSuccessResponse,
} from '../../../shared/types/api.types.js';

import { DatabaseService } from '../../../infrastructure/database/database.service.js';

import { AuthService } from './auth.service.js';
import { SignInDto } from './dto/sign-in.dto.js';
import { SignUpDto } from './dto/sign-up.dto.js';
import { AuthData } from './types/auth.types.js';

interface MockSupabaseClient {
  auth: {
    signUp: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
}

interface MockPostgrestQueryBuilder {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

interface MockDatabaseResponse<T> {
  data: T | null;
  error: Error | null;
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockSupabaseClient: MockSupabaseClient;
  let mockDatabaseService: DatabaseService;
  let mockPostgrestQueryBuilder: MockPostgrestQueryBuilder;

  beforeEach(() => {
    vi.clearAllMocks();

    // Vytvoříme základní query builder s řetězitelnými metodami
    mockPostgrestQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }), // Výchozí hodnota pro všechny testy
    };

    mockSupabaseClient = {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
        getSession: vi.fn(),
      },
      // from vždy vrací náš připravený builder
      from: vi.fn().mockImplementation(() => mockPostgrestQueryBuilder),
    };

    mockDatabaseService = {
      supabase: mockSupabaseClient as unknown as SupabaseClient,
    } as DatabaseService;

    authService = new AuthService(mockDatabaseService);
  });

  describe('authenticateUser', () => {
    it('should successfully authenticate a user with valid credentials', async () => {
      const signInDto: SignInDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const createdAt = new Date().toISOString();

      const mockSupabaseUser: SupabaseUser = {
        id: '123',
        email: signInDto.email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: createdAt,
      };

      const mockSession: Session = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      // Mock auth signInWithPassword
      const signInSpy = vi.spyOn(mockDatabaseService.supabase.auth, 'signInWithPassword')
        .mockResolvedValue({
          data: {
            user: mockSupabaseUser,
            session: mockSession,
          },
          error: null,
        } as unknown as {
          data: { user: SupabaseUser; session: Session };
          error: null;
        });

      // Mock profile fetch
      // AuthService volá: .from('profiles').select().eq('id', auth.user.id).single()
      const mockProfileResponse = {
        data: {
          id: mockSupabaseUser.id,
          email: mockSupabaseUser.email,
          display_name: 'Test User',
          created_at: createdAt,
          updated_at: createdAt,
        },
        error: null,
      } as MockDatabaseResponse<{
        id: string;
        email: string;
        display_name: string;
        created_at: string;
        updated_at: string;
      }>;

      // Přepíšeme single() pro tento konkrétní test
      mockPostgrestQueryBuilder.single.mockResolvedValueOnce(mockProfileResponse);

      const result = (await authService.authenticateUser(
        signInDto,
      )) as ApiSuccessResponse<AuthData>;

      const expectedUser: User = {
        id: '123',
        email: signInDto.email,
        displayName: 'Test User',
        createdAt,
        updatedAt: createdAt,
      };

      const expectedSession = {
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresIn: mockSession.expires_in,
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully authenticated');
      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data).toEqual({
          user: expectedUser,
          session: expectedSession,
        });
      }

      // Ověříme volání Supabase metod
      expect(signInSpy).toHaveBeenCalledWith({
        email: signInDto.email,
        password: signInDto.password,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockPostgrestQueryBuilder.select).toHaveBeenCalled();
      expect(mockPostgrestQueryBuilder.eq).toHaveBeenCalledWith('id', mockSupabaseUser.id);
      expect(mockPostgrestQueryBuilder.single).toHaveBeenCalled();
    });

    it('should handle sign in failure with invalid credentials', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';

      const mockError = new AuthError('Invalid credentials');
      mockError.status = 400;
      mockError.name = 'invalid_credentials';

      const mockSignInResponse = {
        data: { user: null, session: null },
        error: mockError,
      };

      const signInSpy = vi
        .spyOn(mockSupabaseClient.auth, 'signInWithPassword')
        .mockResolvedValue(
          mockSignInResponse as unknown as { data: null; error: AuthError },
        );

      const result = (await authService.authenticateUser({
        email,
        password,
      })) as ApiErrorResponse;

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error).toEqual({
          code: '400',
          details: 'Invalid credentials',
        });
      }
      expect(signInSpy).toHaveBeenCalledWith({
        email,
        password,
      });
    });

    it('should handle sign in with missing session', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const mockSupabaseUser: SupabaseUser = {
        id: '123',
        email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      };

      const mockSession: Session = {
        access_token: 'token123',
        refresh_token: 'refresh123',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      // Mock successful auth but null profile
      const mockSignInResponse = {
        data: {
          user: mockSupabaseUser,
          session: mockSession,
        },
        error: null,
      };

      const signInSpy = vi
        .spyOn(mockSupabaseClient.auth, 'signInWithPassword')
        .mockResolvedValue(mockSignInResponse);

      // Mock profile fetch returning null
      const mockProfileResponse = {
        data: null,
        error: null,
      };

      mockPostgrestQueryBuilder.single.mockResolvedValueOnce(mockProfileResponse);

      const result = await authService.authenticateUser({ email, password });

      expect(result.success).toBe(false);
      expect(result.message).toBe('User profile data missing');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error).toEqual({
          code: 'PROFILE_DATA_MISSING',
          details: 'User profile data missing.',
        });
      }

      expect(signInSpy).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockPostgrestQueryBuilder.select).toHaveBeenCalled();
      expect(mockPostgrestQueryBuilder.eq).toHaveBeenCalledWith('id', mockSupabaseUser.id);
      expect(mockPostgrestQueryBuilder.single).toHaveBeenCalled();
    });
  });

  describe('registerUser', () => {
    it('should successfully register a new user with immediate session', async () => {
      const signUpDto: SignUpDto = {
        email: 'newuser@example.com',
        password: 'password123',
        displayName: 'Test User',
        confirmPassword: 'password123',
        bio: 'Test bio',
      };
      const createdAt = new Date().toISOString();

      const mockSupabaseUser: SupabaseUser = {
        id: '456',
        email: signUpDto.email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: createdAt,
      };

      const mockSession: Session = {
        access_token: 'token456',
        refresh_token: 'refresh456',
        expires_in: 3600,
        token_type: 'bearer',
        user: mockSupabaseUser,
      };

      // Mock auth signUp
      const signUpSpy = vi.spyOn(mockDatabaseService.supabase.auth, 'signUp')
        .mockResolvedValue({
          data: {
            user: mockSupabaseUser,
            session: mockSession,
          },
          error: null,
        } as unknown as {
          data: { user: SupabaseUser; session: Session };
          error: null;
        });

      // Mock profile creation
      // AuthService volá: .from('profiles').insert({...}).select().single()
      const mockProfileResponse = {
        data: {
          id: mockSupabaseUser.id,
          email: signUpDto.email,
          display_name: signUpDto.displayName,
          bio: signUpDto.bio,
          created_at: createdAt,
          updated_at: createdAt,
        },
        error: null,
      } as MockDatabaseResponse<{
        id: string;
        email: string;
        display_name: string;
        bio: string;
        created_at: string;
        updated_at: string;
      }>;

      // Přepíšeme single() pro tento konkrétní test
      mockPostgrestQueryBuilder.single.mockResolvedValueOnce(mockProfileResponse);

      const result = await authService.registerUser(signUpDto);

      const expectedUser: User = {
        id: mockSupabaseUser.id,
        email: signUpDto.email,
        displayName: signUpDto.displayName,
        createdAt,
        updatedAt: createdAt,
      };

      const expectedSession = {
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresIn: mockSession.expires_in,
      };

      expect(result.success).toBe(true);
      expect(result.message).toBe('User registered successfully');
      expect(isApiSuccessResponse(result)).toBe(true);
      if (isApiSuccessResponse(result)) {
        expect(result.data).toEqual({
          user: expectedUser,
          session: expectedSession,
        });
      }

      // Ověříme volání Supabase metod
      expect(signUpSpy).toHaveBeenCalledWith({
        email: signUpDto.email,
        password: signUpDto.password,
      });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockPostgrestQueryBuilder.insert).toHaveBeenCalledWith({
        id: mockSupabaseUser.id,
        email: mockSupabaseUser.email,
        display_name: signUpDto.displayName,
        bio: signUpDto.bio,
      });
      expect(mockPostgrestQueryBuilder.select).toHaveBeenCalled();
      expect(mockPostgrestQueryBuilder.single).toHaveBeenCalled();
    });

    it('should handle registration failure for existing user', async () => {
      const signUpDto: SignUpDto = {
        email: 'existing@example.com',
        password: 'password123',
        displayName: 'Test User',
        confirmPassword: 'password123',
        bio: 'Test bio',
      };

      const mockError = new AuthError('User already registered');
      mockError.status = 400;
      mockError.name = 'user_exists';

      const mockSignUpResponse = {
        data: { user: null, session: null },
        error: mockError,
      };

      const signUpSpy = vi
        .spyOn(mockSupabaseClient.auth, 'signUp')
        .mockResolvedValue(
          mockSignUpResponse as unknown as { data: null; error: AuthError },
        );

      const result = await authService.registerUser(signUpDto);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User already registered');
      expect(isApiErrorResponse(result)).toBe(true);
      if (isApiErrorResponse(result)) {
        expect(result.error).toEqual({
          code: '400',
          details: 'User already registered',
        });
      }
      expect(signUpSpy).toHaveBeenCalledWith({
        email: signUpDto.email,
        password: signUpDto.password,
      });
    });
  });
});
