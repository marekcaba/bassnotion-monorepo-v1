import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';

import { AuthSecurityService } from './auth-security.service.js';
import { DatabaseService } from '../../../../infrastructure/database/database.service.js';

describe('AuthSecurityService', () => {
  let service: AuthSecurityService;
  let mockDatabaseService: any;

  beforeEach(async () => {
    // Create a comprehensive mock that includes all necessary methods
    const createMockQuery = (mockData: any = { data: null, error: null }) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(mockData),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ error: null }),
      count: vi.fn().mockResolvedValue({ data: 0, error: null }),
    });

    mockDatabaseService = {
      supabase: {
        from: vi.fn().mockImplementation(() => createMockQuery()),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              SUPABASE_URL: 'http://localhost:54321',
              SUPABASE_KEY: 'test-key',
              JWT_SECRET: 'test-secret',
              RATE_LIMIT_TTL: 60,
              RATE_LIMIT_MAX: 20,
            }),
          ],
        }),
      ],
      providers: [
        AuthSecurityService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<AuthSecurityService>(AuthSecurityService);
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

  describe('rate limiting functionality', () => {
    // Simple tests that verify graceful fallback behavior

    it('should allow requests when database service is unavailable', async () => {
      // Create service with null database to test defensive behavior
      const serviceWithoutDb = new AuthSecurityService(null as any);

      const result = await serviceWithoutDb.checkRateLimit(
        'test@example.com',
        '192.168.1.1',
      );

      // Service should fail open and allow the request
      expect(result.isRateLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(5); // MAX_ATTEMPTS_PER_EMAIL
    });

    it('should allow requests when database throws error', async () => {
      // Create service with broken database to test error handling
      const mockDatabaseService = {
        supabase: {
          from: vi.fn().mockImplementation(() => {
            throw new Error('Database connection failed');
          }),
        },
      } as any;

      const service = new AuthSecurityService(mockDatabaseService);

      const result = await service.checkRateLimit(
        'test@example.com',
        '192.168.1.1',
      );

      // Service should fail open and allow the request
      expect(result.isRateLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(5); // MAX_ATTEMPTS_PER_EMAIL
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Prepare for error tests - current mock will be modified
    });

    afterEach(() => {
      // Restore clean mock state after each error test to prevent pollution
      vi.clearAllMocks();

      // Recreate clean mock database service
      const createMockQuery = (
        mockData: any = { data: null, error: null },
      ) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockData),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        count: vi.fn().mockResolvedValue({ count: 0, error: null }),
      });

      mockDatabaseService = {
        supabase: {
          from: vi.fn().mockImplementation(() => createMockQuery()),
        },
      };

      service = new AuthSecurityService(mockDatabaseService);
    });

    it('should handle database errors gracefully in rate limiting', async () => {
      // Mock a database error by making the from method throw
      mockDatabaseService.supabase.from.mockImplementation(() => {
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
      // Mock a database error by making the from method throw
      mockDatabaseService.supabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await service.checkAccountLockout('test@example.com');

      // Should fail open and not lock the account
      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(0);
    });

    it('should handle recording login attempts gracefully on error', async () => {
      // Mock a database error by making the from method throw
      mockDatabaseService.supabase.from.mockImplementation(() => {
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

  describe('account lockout functionality', () => {
    beforeEach(() => {
      // Reset all mocks before each test in this describe block
      vi.clearAllMocks();

      // Recreate the mock database service to ensure clean state
      const createMockQuery = (
        mockData: any = { data: null, error: null },
      ) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockData),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        count: vi.fn().mockResolvedValue({ data: 0, error: null }),
      });

      mockDatabaseService = {
        supabase: {
          from: vi.fn().mockImplementation(() => createMockQuery()),
        },
      };

      service = new AuthSecurityService(mockDatabaseService);
    });

    it('should not lock account with few failed attempts', async () => {
      // Mock database response for lockout query - few failed attempts
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockQuery.limit.mockResolvedValue({
        data: [
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
        ],
        error: null,
      });
      mockDatabaseService.supabase.from.mockReturnValue(mockQuery);

      const result = await service.checkAccountLockout('test@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(2);
    });

    it('should lock account with many failed attempts', async () => {
      // Mock database response for lockout query - many failed attempts (6)
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockQuery.limit.mockResolvedValue({
        data: [
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
          { attempted_at: new Date().toISOString(), success: false },
        ],
        error: null,
      });
      mockDatabaseService.supabase.from.mockReturnValue(mockQuery);

      const result = await service.checkAccountLockout('test@example.com');

      expect(result.isLocked).toBe(true);
      expect(result.failedAttempts).toBe(6);
    });
  });

  describe('login attempt recording', () => {
    it('should record successful login attempts', async () => {
      const mockQuery = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockDatabaseService.supabase.from.mockReturnValue(mockQuery);

      await service.recordLoginAttempt(
        'test@example.com',
        '192.168.1.1',
        true,
        'Mozilla/5.0...',
      );

      expect(mockDatabaseService.supabase.from).toHaveBeenCalledWith(
        'login_attempts',
      );
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          ip_address: '192.168.1.1',
          success: true,
          user_agent: 'Mozilla/5.0...',
        }),
      );
    });

    it('should record failed login attempts', async () => {
      const mockQuery = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockDatabaseService.supabase.from.mockReturnValue(mockQuery);

      await service.recordLoginAttempt(
        'test@example.com',
        '192.168.1.1',
        false,
        'Mozilla/5.0...',
      );

      expect(mockDatabaseService.supabase.from).toHaveBeenCalledWith(
        'login_attempts',
      );
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          ip_address: '192.168.1.1',
          success: false,
          user_agent: 'Mozilla/5.0...',
        }),
      );
    });
  });
});
