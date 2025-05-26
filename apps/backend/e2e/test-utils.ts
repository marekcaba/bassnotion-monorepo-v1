import type { User } from '@bassnotion/contracts';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

import {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '../src/shared/types/api.types.js';

import {
  AuthData,
  AuthResponse,
  AuthSession,
} from '../src/domains/user/auth/types/auth.types.js';

export const createTestRequest = (app: NestFastifyApplication) => {
  return {
    signup: async (data: {
      email: string;
      password: string;
    }): Promise<AuthResponse> => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signup',
        payload: data,
      });
      return JSON.parse(response.payload);
    },
    signin: async (data: {
      email: string;
      password: string;
    }): Promise<AuthResponse> => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/signin',
        payload: data,
      });
      return JSON.parse(response.payload);
    },
  };
};

export const mockUser: User = {
  id: '123',
  email: 'test@example.com',
  displayName: 'Test User',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockSession: AuthSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

export function mockAuthResponse(
  success: boolean,
  message: string,
  data?: AuthData,
): AuthResponse {
  if (success && data) {
    return {
      success: true,
      message,
      data,
    } satisfies ApiSuccessResponse<AuthData>;
  }

  return {
    success: false,
    message,
    error: {
      code: 'AUTH_ERROR',
      details: message || undefined,
    },
  } satisfies ApiErrorResponse;
}
