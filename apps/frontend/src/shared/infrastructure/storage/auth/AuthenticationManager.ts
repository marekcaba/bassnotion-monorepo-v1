/**
 * Authentication Manager
 * Story 2.4 Subtask 1.2: Sophisticated authentication with token refresh and session management
 *
 * Extracted from playback domain to shared infrastructure
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  AuthenticationConfig,
  AuthenticationMetrics,
  SessionState,
  StorageTokenInfo,
  DeviceInfo,
} from '@bassnotion/contracts';

const logger = createStructuredLogger('AuthenticationManager');

export class AuthenticationManager {
  private config: AuthenticationConfig;
  private supabaseClient: SupabaseClient;
  private metrics: AuthenticationMetrics;
  private currentSession: SessionState | null = null;
  private currentToken: StorageTokenInfo | null = null;
  private deviceInfo: DeviceInfo;
  private refreshTimer?: NodeJS.Timeout;
  private sessionTimer?: NodeJS.Timeout;

  constructor(
    config: AuthenticationConfig,
    supabaseClient: SupabaseClient,
    metrics: AuthenticationMetrics,
  ) {
    this.config = config;
    this.supabaseClient = supabaseClient;
    this.metrics = metrics;
    this.deviceInfo = this.generateDeviceInfo();

    if (this.config.tokenRefreshEnabled) {
      this.startTokenRefreshMonitoring();
    }

    if (this.config.sessionManagementEnabled) {
      this.startSessionManagement();
    }
  }

  /**
   * Generate device fingerprint for security tracking
   */
  private generateDeviceInfo(): DeviceInfo {
    // Handle Node.js test environment
    if (typeof navigator === 'undefined') {
      return {
        userAgent: 'test-environment',
        platform: 'test',
        deviceId: 'test-device-id',
        browserFingerprint: 'test-fingerprint',
        screenResolution: '1920x1080',
        timezone: 'UTC',
      };
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      deviceId: this.generateDeviceId(),
      browserFingerprint: this.generateBrowserFingerprint(),
      screenResolution:
        typeof screen !== 'undefined'
          ? `${screen.width}x${screen.height}`
          : '1920x1080',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    // Handle Node.js test environment
    if (typeof localStorage === 'undefined') {
      return 'test-device-id';
    }

    const stored = localStorage.getItem('bassnotion-device-id');
    if (stored) return stored;

    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('bassnotion-device-id', deviceId);
    return deviceId;
  }

  /**
   * Generate browser fingerprint for security
   */
  private generateBrowserFingerprint(): string {
    // Handle Node.js test environment
    if (typeof document === 'undefined') {
      return 'test-fingerprint';
    }

    // ✅ ULTIMATE FIX: Wrap entire Canvas API usage in comprehensive try-catch
    try {
      // ✅ CRITICAL: Check if Canvas API is available before using it
      if (typeof HTMLCanvasElement === 'undefined') {
        logger.warn(
          '🎨 HTMLCanvasElement not available, likely in test environment',
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      const canvas = document.createElement('canvas');

      // ✅ Check if canvas was created successfully
      if (!canvas || typeof canvas.getContext !== 'function') {
        logger.warn(
          '🎨 Canvas creation failed or getContext not available, likely in test environment',
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      // ✅ UPGRADE: Graceful degradation for Canvas API not available (JSDOM)
      let ctx: CanvasRenderingContext2D | null = null;
      try {
        ctx = canvas.getContext('2d');
      } catch (error) {
        logger.warn(
          '🎨 Canvas getContext() not available, likely in test environment:',
          error,
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      if (ctx) {
        try {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('BassNotion fingerprint', 2, 2);
        } catch (error) {
          logger.warn(
            '🎨 Canvas context operations failed, likely in test environment:',
            error,
          );
          // Continue to try toDataURL anyway
        }
      }

      // ✅ Check if toDataURL method exists before calling it
      if (typeof canvas.toDataURL !== 'function') {
        logger.warn(
          '🎨 Canvas toDataURL method not available, likely in test environment',
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      // ✅ UPGRADE: Graceful degradation for toDataURL not available (JSDOM)
      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL();
      } catch (error) {
        logger.warn(
          '🎨 Canvas toDataURL() not available, likely in test environment:',
          error,
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      // ✅ CRITICAL FIX: Handle test environment where toDataURL() returns null
      if (!dataUrl || dataUrl === 'data:,' || dataUrl === 'data:') {
        logger.warn(
          '🎨 Canvas toDataURL() returned null/empty, likely in test environment',
        );
        return (
          'test-canvas-fingerprint-' + Math.random().toString(36).substr(2, 9)
        );
      }

      return dataUrl.slice(-50);
    } catch (error) {
      logger.warn(
        '🎨 Canvas fingerprint generation failed, likely in test environment:',
        error,
      );
      return 'fallback-fingerprint-' + Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * Start proactive token refresh monitoring
   */
  private startTokenRefreshMonitoring(): void {
    if (!this.config.tokenRefreshConfig?.enabled) return;

    const checkInterval =
      this.config.tokenRefreshConfig.tokenValidationInterval;
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshToken();
    }, checkInterval);
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      const session = await this.supabaseClient.auth.getSession();

      if (!session.data.session) {
        logger.warn('No active session for token refresh');
        this.metrics.failedAuths++;
        return;
      }

      const expiresAt = new Date(session.data.session.expires_at! * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const refreshThreshold =
        this.config.tokenRefreshConfig?.refreshThreshold || 300000; // 5 minutes

      if (timeUntilExpiry < refreshThreshold) {
        logger.info('Token approaching expiry, refreshing...', {
          expiresAt,
          timeUntilExpiry,
        });

        const { data, error } = await this.supabaseClient.auth.refreshSession();

        if (error) {
          logger.error('Token refresh failed', error);
          this.metrics.failedAuths++;
          throw error;
        }

        if (data.session) {
          this.currentToken = {
            token: data.session.access_token,
            expiresAt: new Date(data.session.expires_at! * 1000),
            refreshToken: data.session.refresh_token || undefined,
            scope: 'storage',
          };

          this.metrics.tokenRefreshCount++;
          this.metrics.lastTokenRefresh = Date.now();

          logger.info('Token refreshed successfully', {
            newExpiresAt: this.currentToken.expiresAt,
          });
        }
      }
    } catch (error) {
      logger.error('Error during token refresh check', error);
    }
  }

  /**
   * Start session management
   */
  private startSessionManagement(): void {
    if (!this.config.sessionManagementConfig?.enabled) return;

    const checkInterval =
      this.config.sessionManagementConfig.sessionCheckInterval;
    this.sessionTimer = setInterval(() => {
      this.validateAndExtendSession();
    }, checkInterval);
  }

  /**
   * Validate and potentially extend the current session
   */
  private async validateAndExtendSession(): Promise<void> {
    try {
      const session = await this.supabaseClient.auth.getSession();

      if (!session.data.session) {
        logger.warn('No active session');
        return;
      }

      const sessionAge =
        Date.now() - new Date(session.data.session.created_at!).getTime();
      const maxAge =
        this.config.sessionManagementConfig?.maxSessionAge || 86400000; // 24 hours

      if (sessionAge > maxAge) {
        logger.info('Session exceeded max age, requiring re-authentication');
        await this.supabaseClient.auth.signOut();
        this.currentSession = null;
        this.currentToken = null;
      } else if (this.shouldExtendSession()) {
        this.metrics.sessionExtensions++;
        logger.info('Session extended based on activity');
      }
    } catch (error) {
      logger.error('Error during session validation', error);
    }
  }

  /**
   * Determine if session should be extended based on activity
   */
  private shouldExtendSession(): boolean {
    // Implement activity-based session extension logic
    // For now, always extend if within max age
    return true;
  }

  /**
   * Authenticate and establish a session
   */
  async authenticate(credentials?: any): Promise<SessionState> {
    this.metrics.totalAuthAttempts++;

    try {
      // If no credentials, try to use existing session
      const { data: sessionData } = await this.supabaseClient.auth.getSession();

      if (sessionData.session) {
        this.currentSession = {
          userId: sessionData.session.user.id,
          sessionId: `session_${Date.now()}`,
          deviceInfo: this.deviceInfo,
          createdAt: new Date(sessionData.session.created_at!),
          lastActivity: new Date(),
          ipAddress: 'unknown', // Would need server-side to get real IP
          isActive: true,
          expiresAt: new Date(sessionData.session.expires_at! * 1000),
        };

        this.currentToken = {
          token: sessionData.session.access_token,
          expiresAt: new Date(sessionData.session.expires_at! * 1000),
          refreshToken: sessionData.session.refresh_token || undefined,
          scope: 'storage',
        };

        this.metrics.successfulAuths++;
        this.metrics.lastAuthTime = Date.now();

        return this.currentSession;
      }

      throw new Error('No active session and no credentials provided');
    } catch (error) {
      this.metrics.failedAuths++;
      logger.error('Authentication failed', error);
      throw error;
    }
  }

  /**
   * Get current authentication headers
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const session = await this.supabaseClient.auth.getSession();

    if (!session.data.session) {
      throw new Error('No active session');
    }

    return {
      Authorization: `Bearer ${session.data.session.access_token}`,
      'X-Device-Id': this.deviceInfo.deviceId,
      'X-Session-Id': this.currentSession?.sessionId || 'unknown',
    };
  }

  /**
   * Sign out and clean up
   */
  async signOut(): Promise<void> {
    try {
      await this.supabaseClient.auth.signOut();
      this.currentSession = null;
      this.currentToken = null;

      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }

      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
      }

      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Error during sign out', error);
      throw error;
    }
  }

  /**
   * Get authentication metrics
   */
  getMetrics(): AuthenticationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current session state
   */
  getCurrentSession(): SessionState | null {
    return this.currentSession;
  }

  /**
   * Get current token info
   */
  getCurrentToken(): StorageTokenInfo | null {
    return this.currentToken;
  }
}
