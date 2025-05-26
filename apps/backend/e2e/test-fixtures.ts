import {
  AuthResponse,
  AuthUser,
} from '../src/domains/user/auth/types/auth.types.js';

// Test user data
export const TEST_USER_DATA = {
  VALID_USER: {
    email: 'test@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
  },
  UNCONFIRMED_USER: {
    email: 'unconfirmed@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
  },
  EXISTING_USER: {
    email: 'existing@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
  },
  INVALID_EMAIL_USER: {
    email: 'notanemail',
    password: 'ValidPassword123!',
    confirmPassword: 'ValidPassword123!',
  },
  WEAK_PASSWORD_USER: {
    email: 'test@example.com',
    password: 'weak',
    confirmPassword: 'weak',
  },
  PASSWORD_MISMATCH_USER: {
    email: 'test@example.com',
    password: 'ValidPassword123!',
    confirmPassword: 'DifferentPassword123!',
  },
};

// Mock Supabase responses
export const createMockSupabaseResponse = (
  email: string,
  options: {
    isError?: boolean;
    errorMessage?: string;
    errorCode?: string;
    requiresEmailConfirmation?: boolean;
    userId?: string;
    sessionExpiry?: number;
  } = {},
) => {
  const now = new Date().toISOString();
  const userId = options.userId || 'test-user-id';

  if (options.isError) {
    return {
      data: { user: null, session: null },
      error: {
        message: options.errorMessage || 'An error occurred',
        code: options.errorCode || 'UNKNOWN_ERROR',
      },
    };
  }

  const user = {
    id: userId,
    email,
    created_at: now,
    updated_at: now,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
  };

  const session = options.requiresEmailConfirmation
    ? null
    : {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: options.sessionExpiry || 3600,
        expires_at:
          Math.floor(Date.now() / 1000) + (options.sessionExpiry || 3600),
        refresh_token_expires_in: 3600 * 24 * 7,
        token_type: 'bearer',
        user,
      };

  return {
    data: {
      user,
      session,
    },
    error: null,
  };
};

// Mock API responses
export const createMockAuthResponse = (
  email: string,
  options: {
    success?: boolean;
    errorCode?: string;
    errorDetails?: string;
    requiresEmailConfirmation?: boolean;
    userId?: string;
  } = {},
): AuthResponse => {
  const {
    success = true,
    errorCode,
    errorDetails,
    requiresEmailConfirmation,
    userId,
  } = options;

  if (!success) {
    return {
      success: false,
      message: errorDetails || 'An error occurred',
      error: {
        code: errorCode || 'AUTH_ERROR',
        details: errorDetails,
      },
    };
  }

  const user: AuthUser = {
    id: userId || 'test-user-id',
    email,
    displayName: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isConfirmed: !requiresEmailConfirmation,
    lastLoginAt: requiresEmailConfirmation
      ? undefined
      : new Date().toISOString(),
    session: requiresEmailConfirmation
      ? undefined
      : {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 3600,
        },
  };

  return {
    success: true,
    message: requiresEmailConfirmation
      ? 'Registration successful. Please check your email for confirmation.'
      : 'Operation successful',
    data: {
      user,
      session: {
        accessToken: requiresEmailConfirmation ? '' : 'mock-access-token',
        refreshToken: requiresEmailConfirmation ? '' : 'mock-refresh-token',
        expiresIn: requiresEmailConfirmation ? 0 : 3600,
      },
    },
  };
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email format',
  WEAK_PASSWORD:
    'Password must be at least 8 characters long and contain uppercase, lowercase, number and special character',
  PASSWORD_MISMATCH: 'Password and confirmation password do not match',
  USER_EXISTS: 'User already registered',
  INVALID_CREDENTIALS: 'Invalid credentials',
  EMAIL_CONFIRMATION_REQUIRED: 'Please check your email for confirmation',
  RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later',
  NETWORK_ERROR: 'Network error occurred',
  INTERNAL_ERROR: 'Internal server error',
};
