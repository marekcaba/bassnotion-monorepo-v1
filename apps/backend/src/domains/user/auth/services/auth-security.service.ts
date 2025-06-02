import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';

export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  user_agent?: string;
  success: boolean;
  attempted_at: string;
  created_at: string;
}

export interface AccountLockoutInfo {
  isLocked: boolean;
  lockoutUntil?: Date;
  failedAttempts: number;
  remainingTime?: number; // in seconds
}

export interface RateLimitInfo {
  isRateLimited: boolean;
  remainingTime?: number; // in seconds
  attemptsRemaining: number;
}

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);

  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_ATTEMPTS_PER_IP = 20; // Per IP in 15 minutes
  private readonly MAX_ATTEMPTS_PER_EMAIL = 5; // Per email in 15 minutes

  // Account lockout configuration
  private readonly LOCKOUT_THRESHOLDS = [
    { attempts: 3, duration: 2 * 60 * 1000 }, // 2 minutes after 3 attempts
    { attempts: 5, duration: 15 * 60 * 1000 }, // 15 minutes after 5 attempts
    { attempts: 8, duration: 60 * 60 * 1000 }, // 1 hour after 8 attempts
    { attempts: 10, duration: 24 * 60 * 60 * 1000 }, // 24 hours after 10 attempts
  ];

  constructor(private readonly db: DatabaseService) {
    // Defensive check for DatabaseService
    if (!this.db) {
      this.logger.error(
        'DatabaseService is undefined in AuthSecurityService constructor!',
      );
    }
  }

  /**
   * Check if IP or email is rate limited
   */
  async checkRateLimit(
    email: string,
    ipAddress: string,
  ): Promise<RateLimitInfo> {
    try {
      // Validate input parameters
      if (!email || typeof email !== 'string') {
        this.logger.warn('Invalid email provided to checkRateLimit, failing open');
        return {
          isRateLimited: false,
          attemptsRemaining: this.MAX_ATTEMPTS_PER_EMAIL,
        };
      }

      // Defensive check for DatabaseService
      if (!this.db || !this.db.supabase) {
        this.logger.warn(
          'DatabaseService unavailable - failing open for rate limiting',
        );
        return {
          isRateLimited: false,
          attemptsRemaining: this.MAX_ATTEMPTS_PER_EMAIL,
        };
      }

      const now = new Date();
      const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW);

      // Check IP-based rate limiting
      const { count: ipAttempts } = await this.db.supabase
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ipAddress)
        .eq('success', false)
        .gte('attempted_at', windowStart.toISOString());

      // Check email-based rate limiting
      const { count: emailAttempts } = await this.db.supabase
        .from('login_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .gte('attempted_at', windowStart.toISOString());

      const ipRateLimited = (ipAttempts || 0) >= this.MAX_ATTEMPTS_PER_IP;
      const emailRateLimited =
        (emailAttempts || 0) >= this.MAX_ATTEMPTS_PER_EMAIL;

      if (ipRateLimited || emailRateLimited) {
        // Get the oldest attempt to calculate remaining time
        const { data: oldestAttempt } = await this.db.supabase
          .from('login_attempts')
          .select('attempted_at')
          .or(`ip_address.eq.${ipAddress},email.eq.${email.toLowerCase()}`)
          .eq('success', false)
          .gte('attempted_at', windowStart.toISOString())
          .order('attempted_at', { ascending: true })
          .limit(1)
          .single();

        const remainingTime = oldestAttempt
          ? Math.max(
              0,
              Math.ceil(
                (new Date(oldestAttempt.attempted_at).getTime() +
                  this.RATE_LIMIT_WINDOW -
                  now.getTime()) /
                  1000,
              ),
            )
          : 0;

        return {
          isRateLimited: true,
          remainingTime,
          attemptsRemaining: 0,
        };
      }

      return {
        isRateLimited: false,
        attemptsRemaining: Math.min(
          this.MAX_ATTEMPTS_PER_IP - (ipAttempts || 0),
          this.MAX_ATTEMPTS_PER_EMAIL - (emailAttempts || 0),
        ),
      };
    } catch (error) {
      this.logger.error('Error checking rate limit:', error);
      // Fail open for rate limiting to avoid blocking legitimate users
      return {
        isRateLimited: false,
        attemptsRemaining: this.MAX_ATTEMPTS_PER_EMAIL,
      };
    }
  }

  /**
   * Check if account is locked out
   */
  async checkAccountLockout(email: string): Promise<AccountLockoutInfo> {
    try {
      // Validate input parameters
      if (!email || typeof email !== 'string') {
        this.logger.warn('Invalid email provided to checkAccountLockout, failing open');
        return {
          isLocked: false,
          failedAttempts: 0,
        };
      }

      // Defensive check for DatabaseService
      if (!this.db || !this.db.supabase) {
        this.logger.warn(
          'DatabaseService unavailable - failing open for account lockout',
        );
        return {
          isLocked: false,
          failedAttempts: 0,
        };
      }

      const now = new Date();

      // Get recent failed attempts for this email
      const { data: attempts, error } = await this.db.supabase
        .from('login_attempts')
        .select('attempted_at, success')
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .order('attempted_at', { ascending: false })
        .limit(20); // Get last 20 attempts

      if (error || !attempts || attempts.length === 0) {
        return {
          isLocked: false,
          failedAttempts: 0,
        };
      }

      // Count consecutive failed attempts (stop at first success)
      let consecutiveFailures = 0;
      for (const attempt of attempts) {
        if (!attempt.success) {
          consecutiveFailures++;
        } else {
          break; // Stop at first successful login
        }
      }

      // Find applicable lockout threshold
      let applicableThreshold = null;
      for (let i = this.LOCKOUT_THRESHOLDS.length - 1; i >= 0; i--) {
        if (consecutiveFailures >= this.LOCKOUT_THRESHOLDS[i].attempts) {
          applicableThreshold = this.LOCKOUT_THRESHOLDS[i];
          break;
        }
      }

      if (!applicableThreshold) {
        return {
          isLocked: false,
          failedAttempts: consecutiveFailures,
        };
      }

      // Check if lockout period has expired
      const lastAttempt = new Date(attempts[0].attempted_at);
      const lockoutUntil = new Date(
        lastAttempt.getTime() + applicableThreshold.duration,
      );

      if (now < lockoutUntil) {
        const remainingTime = Math.ceil(
          (lockoutUntil.getTime() - now.getTime()) / 1000,
        );

        return {
          isLocked: true,
          lockoutUntil,
          failedAttempts: consecutiveFailures,
          remainingTime,
        };
      }

      return {
        isLocked: false,
        failedAttempts: consecutiveFailures,
      };
    } catch (error) {
      this.logger.error('Error checking account lockout:', error);
      // Fail open for lockout to avoid permanently blocking users
      return {
        isLocked: false,
        failedAttempts: 0,
      };
    }
  }

  /**
   * Record a login attempt
   */
  async recordLoginAttempt(
    email: string,
    ipAddress: string,
    success: boolean,
    userAgent?: string,
  ): Promise<void> {
    try {
      // Validate input parameters
      if (!email || typeof email !== 'string') {
        this.logger.warn('Invalid email provided to recordLoginAttempt, skipping record');
        return;
      }

      // Defensive check for DatabaseService
      if (!this.db || !this.db.supabase) {
        this.logger.warn(
          'DatabaseService unavailable - cannot record login attempt',
        );
        return;
      }

      const { error } = await this.db.supabase.from('login_attempts').insert({
        email: email.toLowerCase(),
        ip_address: ipAddress,
        user_agent: userAgent,
        success,
        attempted_at: new Date().toISOString(),
      });

      if (error) {
        this.logger.error('Error recording login attempt:', error);
      }

      // Clean up old attempts (older than 7 days) periodically
      if (Math.random() < 0.01) {
        // 1% chance to trigger cleanup
        await this.cleanupOldAttempts();
      }
    } catch (error) {
      this.logger.error('Error recording login attempt:', error);
    }
  }

  /**
   * Reset failed attempts for an email (called on successful login)
   */
  async resetFailedAttempts(_email: string): Promise<void> {
    // We don't delete records, just record the successful attempt
    // The lockout check looks for consecutive failures, so a success naturally resets it
  }

  /**
   * Get security info for an email/IP combination
   */
  async getSecurityInfo(
    email: string,
    ipAddress: string,
  ): Promise<{
    rateLimitInfo: RateLimitInfo;
    lockoutInfo: AccountLockoutInfo;
  }> {
    const [rateLimitInfo, lockoutInfo] = await Promise.all([
      this.checkRateLimit(email, ipAddress),
      this.checkAccountLockout(email),
    ]);

    return { rateLimitInfo, lockoutInfo };
  }

  /**
   * Get formatted error message for security blocks
   */
  getSecurityErrorMessage(
    rateLimitInfo: RateLimitInfo,
    lockoutInfo: AccountLockoutInfo,
  ): string {
    if (lockoutInfo.isLocked) {
      const minutes = Math.ceil((lockoutInfo.remainingTime || 0) / 60);
      return `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
    }

    if (rateLimitInfo.isRateLimited) {
      const minutes = Math.ceil((rateLimitInfo.remainingTime || 0) / 60);
      return `Too many login attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
    }

    return 'Login attempt blocked for security reasons.';
  }

  /**
   * Clean up old login attempts
   */
  private async cleanupOldAttempts(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { error } = await this.db.supabase
        .from('login_attempts')
        .delete()
        .lt('attempted_at', sevenDaysAgo.toISOString());

      if (error) {
        this.logger.error('Error cleaning up old login attempts:', error);
      } else {
        this.logger.debug('Cleaned up old login attempts');
      }
    } catch (error) {
      this.logger.error('Error in cleanup job:', error);
    }
  }
}
