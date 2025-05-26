import type { User } from '@bassnotion/contracts' with { "resolution-mode": "require" };

import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from '../../../../shared/types/api.types.js';

/**
 * Basic session information
 */
export interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  userId: string;
}

/**
 * Auth session data - used for internal auth flow
 */
export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Authenticated user type that extends the base User type
 */
export interface AuthUser extends User {
  isConfirmed: boolean;
  lastLoginAt?: string;
  session?: AuthSession;
}

/**
 * Auth result data containing user and session information
 */
export interface AuthResultData {
  user: User | null;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}

/**
 * Auth data containing user and session
 */
export interface AuthData {
  user: User;
  session: AuthSession;
}

/**
 * Auth tokens data
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Auth response data containing user and tokens
 */
export interface AuthResponseData {
  user: AuthUser;
  tokens: AuthTokens;
}

/**
 * Auth token response type
 */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Auth error type
 */
export interface AuthError {
  code: string;
  message: string;
  status?: number;
}

/**
 * JWT payload type
 */
export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Auth credentials type
 */
export interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * User registration DTO type
 */
export interface RegisterUserDto {
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * User login DTO type
 */
export interface LoginUserDto {
  email: string;
  password: string;
}

/**
 * Refresh token response data
 */
export interface RefreshTokenResponseData {
  session: AuthSession;
}

/**
 * Logout response data
 */
export interface LogoutResponseData {
  success: boolean;
}

// Response types
export type AuthResponse = ApiSuccessResponse<AuthData> | ApiErrorResponse;
export type RefreshTokenResponse =
  | ApiSuccessResponse<RefreshTokenResponseData>
  | ApiErrorResponse;
export type LogoutResponse =
  | ApiSuccessResponse<LogoutResponseData>
  | ApiErrorResponse;

// Type guards
export const isAuthSuccessResponse = (
  response: AuthResponse,
): response is ApiSuccessResponse<AuthData> => {
  return response.success === true;
};

export const isAuthErrorResponse = (
  response: AuthResponse,
): response is ApiErrorResponse => {
  return response.success === false;
};

export const isRefreshTokenSuccessResponse = (
  response: RefreshTokenResponse,
): response is ApiSuccessResponse<RefreshTokenResponseData> => {
  return response.success === true;
};

export const isLogoutSuccessResponse = (
  response: LogoutResponse,
): response is ApiSuccessResponse<LogoutResponseData> => {
  return response.success === true;
};
