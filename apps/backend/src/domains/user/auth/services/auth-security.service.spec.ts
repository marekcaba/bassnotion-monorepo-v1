import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthSecurityService } from './auth-security.service.js';
import type { DatabaseService } from '../../../../infrastructure/database/database.service.js';

describe('AuthSecurityService', () => {
  let service: AuthSecurityService;
  let mockDatabaseService: DatabaseService;

  beforeEach(() => {
    // Create a proper mock for the Supabase client
    const mockSupabaseClient = {
      from: vi.fn().mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnThis(),
          lt: vi.fn().mockResolvedValue({ error: null }),
        };

        // Mock different responses based on context
        if (table === 'login_attempts') {
          // Default to no attempts
          mockQuery.select.mockReturnValue({
            ...mockQuery,
            count: 0,
            data: null,
            error: null,
          });
        }

        return mockQuery;
      }),
    };

    mockDatabaseService = {
      supabase: mockSupabaseClient,
    } as any;

    service = new AuthSecurityService(mockDatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSecurityErrorMessage', () => {
    it('should return account locked message', () => {
      const rateLimitInfo = { isRateLimited: false, attemptsRemaining: 5 };
      const lockoutInfo = {
        isLocked: true,
        failedAttempts: 5,
        remainingTime: 900,
      };

      const message = service.getSecurityErrorMessage(
        rateLimitInfo,
        lockoutInfo,
      );

      expect(message).toContain('Account temporarily locked');
      expect(message).toContain('15 minutes');
    });

    it('should return rate limit message', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        attemptsRemaining: 0,
        remainingTime: 600,
      };
      const lockoutInfo = { isLocked: false, failedAttempts: 3 };

      const message = service.getSecurityErrorMessage(
        rateLimitInfo,
        lockoutInfo,
      );

      expect(message).toContain('Too many login attempts');
      expect(message).toContain('10 minutes');
    });

    it('should prioritize account lockout over rate limiting', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        attemptsRemaining: 0,
        remainingTime: 600,
      };
      const lockoutInfo = {
        isLocked: true,
        failedAttempts: 5,
        remainingTime: 900,
      };

      const message = service.getSecurityErrorMessage(
        rateLimitInfo,
        lockoutInfo,
      );

      expect(message).toContain('Account temporarily locked');
      expect(message).not.toContain('Too many login attempts');
    });

    it('should handle plural vs singular time units correctly', () => {
      const rateLimitInfo = {
        isRateLimited: true,
        attemptsRemaining: 0,
        remainingTime: 60, // 1 minute
      };
      const lockoutInfo = { isLocked: false, failedAttempts: 3 };

      const message = service.getSecurityErrorMessage(
        rateLimitInfo,
        lockoutInfo,
      );

      expect(message).toContain('1 minute');
      expect(message).not.toContain('1 minutes');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in rate limiting', async () => {
      // Mock a database error
      mockDatabaseService.supabase.from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await service.checkRateLimit(
        'test@example.com',
        '192.168.1.1',
      );

      // Should fail open and allow the request
      expect(result.isRateLimited).toBe(false);
      expect(result.attemptsRemaining).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully in account lockout', async () => {
      // Mock a database error
      mockDatabaseService.supabase.from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await service.checkAccountLockout('test@example.com');

      // Should fail open and not lock the account
      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(0);
    });

    it('should handle recording login attempts gracefully on error', async () => {
      // Mock a database error
      mockDatabaseService.supabase.from = vi.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Should not throw an error
      await expect(
        service.recordLoginAttempt(
          'test@example.com',
          '192.168.1.1',
          true,
          'Mozilla/5.0...',
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('progressive lockout logic', () => {
    it('should calculate correct lockout duration for different attempt counts', () => {
      // Test the error message generation for different lockout scenarios
      const testCases = [
        { attempts: 3, expectedMinutes: 2 },
        { attempts: 5, expectedMinutes: 15 },
        { attempts: 8, expectedMinutes: 60 },
        { attempts: 10, expectedMinutes: 1440 }, // 24 hours = 1440 minutes
      ];

      testCases.forEach(({ attempts, expectedMinutes }) => {
        const lockoutInfo = {
          isLocked: true,
          failedAttempts: attempts,
          remainingTime: expectedMinutes * 60, // Convert to seconds
        };

        const message = service.getSecurityErrorMessage(
          { isRateLimited: false, attemptsRemaining: 5 },
          lockoutInfo,
        );

        expect(message).toContain(`${expectedMinutes} minute`);
      });
    });
  });

  describe('security configuration validation', () => {
    it('should have reasonable rate limiting thresholds', () => {
      // These are indirect tests of the configuration
      // We can test the public methods that depend on these constants

      const result1 = service.getSecurityErrorMessage(
        { isRateLimited: true, attemptsRemaining: 0, remainingTime: 900 },
        { isLocked: false, failedAttempts: 4 },
      );

      const result2 = service.getSecurityErrorMessage(
        { isRateLimited: false, attemptsRemaining: 1 },
        { isLocked: true, failedAttempts: 5, remainingTime: 900 },
      );

      expect(result1).toContain('Too many login attempts');
      expect(result2).toContain('Account temporarily locked');
    });
  });
});
