import { Test, TestingModule } from '@nestjs/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserRepository } from '../user.repository.js';
import { UserId } from '../../value-objects/user-id.vo.js';
import { Email } from '../../value-objects/email.vo.js';
import { UserRole } from '../../value-objects/user-role.vo.js';
import { User } from '../../entities/user.entity.js';

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockSupabaseClient: any;

  const mockUser = User.create(
    UserId.create('123e4567-e89b-12d3-a456-426614174000'),
    Email.create('test@example.com'),
    'Test User',
    UserRole.create('user'),
    'https://example.com/avatar.jpg',
  );

  beforeEach(async () => {
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };

    const mockRequestContextService = {
      getLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      }),
      getCorrelationId: vi.fn().mockReturnValue('test-correlation-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: UserRepository,
          useFactory: () =>
            new UserRepository(
              mockSupabaseClient,
              mockRequestContextService as any,
            ),
        },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      const mockData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        display_name: 'Test User',
        role: 'user',
        avatar_url: 'https://example.com/avatar.jpg',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repository.findById(
        UserId.create('123e4567-e89b-12d3-a456-426614174000'),
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result?.email).toBe('test@example.com');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'id',
        '123e4567-e89b-12d3-a456-426614174000',
      );
    });

    it('should return null when user not found', async () => {
      mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });

      const result = await repository.findById(
        UserId.create('123e4567-e89b-12d3-a456-426614174000'),
      );

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const mockData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        display_name: 'Test User',
        role: 'user',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repository.findByEmail(
        Email.create('test@example.com'),
      );

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'email',
        'test@example.com',
      );
    });
  });

  describe('save', () => {
    it('should save a new user', async () => {
      mockSupabaseClient.insert.mockReturnValue({
        error: null,
      });

      await expect(repository.save(mockUser)).resolves.not.toThrow();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          display_name: 'Test User',
          role: 'user',
        }),
      );
    });

    it('should throw error when save fails', async () => {
      mockSupabaseClient.insert.mockReturnValue({
        error: { message: 'Database error' },
      });

      await expect(repository.save(mockUser)).rejects.toThrow(
        'Failed to save user: Database error',
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockData = [
        {
          id: '123',
          email: 'user1@example.com',
          display_name: 'User 1',
          role: 'user',
        },
        {
          id: '456',
          email: 'user2@example.com',
          display_name: 'User 2',
          role: 'admin',
        },
      ];

      mockSupabaseClient.range.mockResolvedValue({
        data: mockData,
        error: null,
        count: 10,
      });

      const result = await repository.findAll({ page: 1, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(mockSupabaseClient.range).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('batch operations', () => {
    it('should save multiple users', async () => {
      const users = [
        User.create(
          UserId.create('111e4567-e89b-12d3-a456-426614174111'),
          Email.create('user1@example.com'),
          'User 1',
          UserRole.create('user'),
        ),
        User.create(
          UserId.create('222e4567-e89b-12d3-a456-426614174222'),
          Email.create('user2@example.com'),
          'User 2',
          UserRole.create('user'),
        ),
      ];

      mockSupabaseClient.insert.mockReturnValue({ error: null });

      await expect(repository.saveMany(users)).resolves.not.toThrow();

      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ email: 'user1@example.com' }),
          expect.objectContaining({ email: 'user2@example.com' }),
        ]),
      );
    });
  });
});
