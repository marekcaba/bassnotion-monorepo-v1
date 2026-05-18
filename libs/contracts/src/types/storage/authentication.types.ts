/**
 * Storage Authentication Types
 * Authentication, session management, and security types.
 *
 * @module storage/authentication
 */

import type { StorageError, DeviceInfo, LocationInfo } from './base.types.js';

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Security alert thresholds
 */
export interface SecurityAlertThresholds {
  failedAttemptsPerMinute: number;
  suspiciousActivityScore: number;
  multipleSessionsThreshold: number;
  unusualLocationAccess: boolean;
}

/**
 * Token refresh configuration
 */
export interface TokenRefreshConfig {
  enabled: boolean;
  refreshThresholdMinutes: number; // Refresh token X minutes before expiry
  maxRetryAttempts: number;
  retryBackoffMs: number;
  proactiveRefreshEnabled: boolean;
  refreshOnFailureEnabled: boolean;
  tokenValidationInterval: number; // ms
}

/**
 * Session management configuration
 */
export interface SessionManagementConfig {
  enabled: boolean;
  persistSession: boolean;
  sessionTimeoutMinutes: number;
  multiTabSyncEnabled: boolean;
  sessionValidationInterval: number; // ms
  autoExtendSession: boolean;
  sessionStorageKey: string;
}

/**
 * Security monitoring configuration
 */
export interface SecurityMonitoringConfig {
  enabled: boolean;
  trackAuthAttempts: boolean;
  trackSuspiciousActivity: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  reportToBackend: boolean;
  backendReportingUrl?: string;
  alertThresholds: SecurityAlertThresholds;
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  enabled: boolean;
  tokenRefreshEnabled: boolean;
  sessionManagementEnabled: boolean;
  securityMonitoringEnabled: boolean;
  tokenRefreshConfig: TokenRefreshConfig;
  sessionConfig: SessionManagementConfig;
  securityConfig: SecurityMonitoringConfig;
}

// ============================================================================
// State and Status Interfaces
// ============================================================================

/**
 * Token information and status
 */
export interface TokenInfo {
  accessToken?: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: number;
  issuedAt: number;
  isValid: boolean;
  needsRefresh: boolean;
  refreshInProgress: boolean;
  lastRefreshAttempt?: number;
  refreshFailureCount: number;
}

/**
 * Session state information
 */
export interface SessionState {
  isActive: boolean;
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivity: number;
  expiresAt: number;
  isValid: boolean;
  deviceInfo: DeviceInfo;
  location?: LocationInfo;
  multiTabSessions: number;
}

/**
 * Security context for error reporting
 */
export interface SecurityContext {
  attemptCount: number;
  lastAttemptTime: number;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  suspiciousActivityFlags: string[];
  riskScore: number; // 0-100
}

/**
 * Authentication metrics
 */
export interface AuthenticationMetrics {
  totalAuthAttempts: number;
  successfulAuths: number;
  failedAuths: number;
  tokenRefreshCount: number;
  sessionExtensions: number;
  securityIncidents: number;
  averageSessionDuration: number; // ms
  lastAuthTime: number;
  lastTokenRefresh: number;
  suspiciousActivityScore: number;
}

// ============================================================================
// Error and Event Interfaces
// ============================================================================

/**
 * Authentication error types
 */
export interface AuthenticationError extends StorageError {
  authErrorType:
    | 'token_expired'
    | 'token_invalid'
    | 'session_expired'
    | 'session_invalid'
    | 'refresh_failed'
    | 'security_violation'
    | 'rate_limited'
    | 'account_locked';
  tokenInfo?: TokenInfo;
  sessionInfo?: SessionState;
  securityContext?: SecurityContext;
  canRetry: boolean;
  retryAfter?: number; // seconds
}

/**
 * Authentication event for logging and monitoring
 */
export interface AuthenticationEvent {
  eventId: string;
  eventType:
    | 'auth_attempt'
    | 'auth_success'
    | 'auth_failure'
    | 'token_refresh'
    | 'session_start'
    | 'session_end'
    | 'security_incident';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  details: Record<string, unknown>;
  riskScore: number;
}

/**
 * Security incident report
 */
export interface SecurityIncident {
  incidentId: string;
  incidentType:
    | 'multiple_failed_attempts'
    | 'suspicious_location'
    | 'unusual_device'
    | 'token_abuse'
    | 'session_hijacking'
    | 'rate_limit_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  userId?: string;
  sessionId?: string;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  evidence: Record<string, unknown>;
  actionTaken: string;
  resolved: boolean;
}
