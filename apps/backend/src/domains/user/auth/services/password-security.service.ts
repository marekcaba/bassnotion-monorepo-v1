import { Injectable, Logger } from '@nestjs/common';
import { pwnedPassword } from 'hibp';

export interface PasswordSecurityCheck {
  isCompromised: boolean;
  breachCount?: number;
  recommendation?: string;
}

@Injectable()
export class PasswordSecurityService {
  private readonly logger = new Logger(PasswordSecurityService.name);

  constructor() {
    console.log('🔧 [PasswordSecurityService] Constructor called');
  }

  /**
   * Check if a password has been compromised in known data breaches
   * Uses HaveIBeenPwned API with k-anonymity (only first 5 chars of hash sent)
   */
  async checkPasswordSecurity(
    password: string,
  ): Promise<PasswordSecurityCheck> {
    try {
      // HaveIBeenPwned uses k-anonymity - only sends first 5 chars of SHA-1 hash
      const breachCount = await pwnedPassword(password);

      if (breachCount > 0) {
        this.logger.warn(
          `Password found in ${breachCount} data breaches (hash prefix only logged for security)`,
        );

        let recommendation: string;
        if (breachCount > 1000) {
          recommendation =
            'This password is extremely common and has been seen in many breaches. Please choose a completely different password.';
        } else if (breachCount > 100) {
          recommendation =
            'This password has been compromised in multiple breaches. Please choose a different password.';
        } else {
          recommendation =
            'This password has been found in a data breach. For your security, please choose a different password.';
        }

        return {
          isCompromised: true,
          breachCount,
          recommendation,
        };
      }

      return {
        isCompromised: false,
      };
    } catch (error) {
      this.logger.error('Error checking password security:', error);

      // Fail open for password checking to avoid blocking legitimate users
      // if the service is temporarily unavailable
      return {
        isCompromised: false,
      };
    }
  }

  /**
   * Check if a user should be forced to change their password
   * Based on various security criteria
   */
  async shouldForcePasswordChange(
    password: string,
    lastPasswordChange?: Date,
  ): Promise<{
    shouldForce: boolean;
    reason?: string;
  }> {
    // Check if password is compromised
    const securityCheck = await this.checkPasswordSecurity(password);

    if (
      securityCheck.isCompromised &&
      securityCheck.breachCount &&
      securityCheck.breachCount > 100
    ) {
      return {
        shouldForce: true,
        reason: 'Password found in multiple data breaches',
      };
    }

    // Check password age (force change after 1 year)
    if (lastPasswordChange) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      if (lastPasswordChange < oneYearAgo) {
        return {
          shouldForce: true,
          reason: 'Password is over one year old',
        };
      }
    }

    return {
      shouldForce: false,
    };
  }

  /**
   * Get password strength recommendations
   */
  getPasswordStrengthRecommendations(password: string): string[] {
    const recommendations: string[] = [];

    if (password.length < 12) {
      recommendations.push('Use at least 12 characters');
    }

    if (!/[a-z]/.test(password)) {
      recommendations.push('Include lowercase letters');
    }

    if (!/[A-Z]/.test(password)) {
      recommendations.push('Include uppercase letters');
    }

    if (!/[0-9]/.test(password)) {
      recommendations.push('Include numbers');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      recommendations.push('Include special characters (!@#$%^&*)');
    }

    // Check for common patterns
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        recommendations.push('Avoid common words and patterns');
        break;
      }
    }

    return recommendations;
  }
}
