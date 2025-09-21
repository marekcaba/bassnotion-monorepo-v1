/**
 * Authentication Types for Storage
 * 
 * Types for managing authentication, sessions, and security
 * in the storage infrastructure.
 */

export interface TokenConfig {
  refreshThresholdMinutes: number;
  maxRetryAttempts: number;
  retryBackoffMs: number;
  proactiveRefreshEnabled: boolean;
  tokenValidationInterval: number;
}

export interface SessionConfig {
  persistSession: boolean;
  sessionTimeoutMinutes: number;
  multiTabSyncEnabled: boolean;
  sessionValidationInterval: number;
}

export interface SecurityConfig {
  monitoringEnabled: boolean;
  alertingEnabled: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  trustedDevices: boolean;
  deviceFingerprintEnabled: boolean;
}

export interface StorageAuthConfig {
  enabled: boolean;
  tokenRefreshEnabled: boolean;
  sessionManagementEnabled: boolean;
  securityMonitoringEnabled: boolean;
  tokenConfig?: TokenConfig;
  sessionConfig?: SessionConfig;
  securityConfig?: SecurityConfig;
}

export interface StorageSession {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  isActive: boolean;
  createdAt: number;
  lastActivityAt: number;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    deviceId: string;
  };
}

export interface StorageToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope?: string[];
  issuedAt: number;
}

export interface AuthEvent {
  id: string;
  type: 'login' | 'logout' | 'refresh' | 'expired' | 'failed' | 'locked';
  timestamp: number;
  userId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export interface SecurityIncident {
  id: string;
  type: 'suspicious_login' | 'brute_force' | 'token_theft' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  details: Record<string, any>;
  resolved: boolean;
}

export interface IStorageAuthService {
  /**
   * Initialize authentication
   */
  initialize(): Promise<void>;

  /**
   * Get current session
   */
  getSession(): StorageSession | null;

  /**
   * Get current token
   */
  getToken(): StorageToken | null;

  /**
   * Refresh token
   */
  refreshToken(): Promise<StorageToken>;

  /**
   * Validate session
   */
  validateSession(): Promise<boolean>;

  /**
   * Sign out
   */
  signOut(): Promise<void>;

  /**
   * Get authentication events
   */
  getAuthEvents(limit?: number): AuthEvent[];

  /**
   * Get security incidents
   */
  getSecurityIncidents(): SecurityIncident[];

  /**
   * Cleanup and dispose
   */
  dispose(): void;
}