import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../user.repository';
import { CachedUserRepository } from '../cached-user.repository';
import { User } from '../../entities/user.entity';
import { UserId } from '../../value-objects/user-id.vo';
import { Email } from '../../value-objects/email.vo';
import { UserRole } from '../../value-objects/user-role.vo';

// Mock the API client
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock Supabase client
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(() => {
    repository = new UserRepository();
    vi.clearAllMocks();
  });

  describe('Entity and Value Objects', () => {
    it('should create a user entity with value objects', () => {
      const userId = UserId.create('123');
      const email = Email.create('test@example.com');
      const role = UserRole.create('user');

      const user = User.create(userId, email, 'Test User', role);

      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('user');
      expect(user.displayName).toBe('Test User');
    });

    it('should validate email format', () => {
      expect(() => Email.create('invalid-email')).toThrow(
        'Invalid email format',
      );
      expect(() => Email.create('valid@email.com')).not.toThrow();
    });

    it('should validate user roles', () => {
      expect(() => UserRole.create('invalid')).toThrow('Invalid user role');
      expect(() => UserRole.create('admin')).not.toThrow();
      expect(() => UserRole.create('moderator')).not.toThrow();
      expect(() => UserRole.create('user')).not.toThrow();
    });

    it('should check role permissions', () => {
      const adminRole = UserRole.create('admin');
      const moderatorRole = UserRole.create('moderator');
      const userRole = UserRole.create('user');

      expect(adminRole.hasPermission('user')).toBe(true);
      expect(adminRole.hasPermission('moderator')).toBe(true);
      expect(adminRole.hasPermission('admin')).toBe(true);

      expect(moderatorRole.hasPermission('user')).toBe(true);
      expect(moderatorRole.hasPermission('moderator')).toBe(true);
      expect(moderatorRole.hasPermission('admin')).toBe(false);

      expect(userRole.hasPermission('user')).toBe(true);
      expect(userRole.hasPermission('moderator')).toBe(false);
      expect(userRole.hasPermission('admin')).toBe(false);
    });
  });

  describe('Business Logic', () => {
    it('should determine if user can access admin panel', () => {
      const adminUser = User.create(
        UserId.create('1'),
        Email.create('admin@example.com'),
        'Admin',
        UserRole.create('admin'),
      );

      const regularUser = User.create(
        UserId.create('2'),
        Email.create('user@example.com'),
        'User',
        UserRole.create('user'),
      );

      expect(adminUser.canAccessAdminPanel()).toBe(true);
      expect(regularUser.canAccessAdminPanel()).toBe(false);
    });

    it('should check if user is active', () => {
      const activeUser = User.reconstitute(
        UserId.create('1'),
        Email.create('active@example.com'),
        UserRole.create('user'),
        'Active User',
        undefined,
        new Date(), // Last login today
      );

      const inactiveUser = User.reconstitute(
        UserId.create('2'),
        Email.create('inactive@example.com'),
        UserRole.create('user'),
        'Inactive User',
        undefined,
        new Date('2020-01-01'), // Last login years ago
      );

      expect(activeUser.isActive()).toBe(true);
      expect(inactiveUser.isActive()).toBe(false);
    });

    it('should update user properties', () => {
      const user = User.create(
        UserId.create('1'),
        Email.create('test@example.com'),
        'Test User',
        UserRole.create('user'),
      );

      user.updateProfile('New Name', 'https://avatar.url');
      expect(user.displayName).toBe('New Name');
      expect(user.avatarUrl).toBe('https://avatar.url');

      user.updateEmail(Email.create('newemail@example.com'));
      expect(user.email).toBe('newemail@example.com');

      user.updateRole(UserRole.create('moderator'));
      expect(user.role).toBe('moderator');
    });
  });

  describe('Caching', () => {
    it('should cache user lookups', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user',
      };

      const { apiClient } = await import('@/shared/api/client');
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUser);

      const cachedRepository = new CachedUserRepository(repository);

      // First call - should hit the API
      const user1 = await cachedRepository.findById(UserId.create('123'));
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const user2 = await cachedRepository.findById(UserId.create('123'));
      expect(apiClient.get).toHaveBeenCalledTimes(1); // Still 1, not 2

      expect(user1?.id).toBe(user2?.id);
    });

    it('should invalidate cache on update', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user',
      };

      const { apiClient } = await import('@/shared/api/client');
      vi.mocked(apiClient.get).mockResolvedValue(mockUser);
      vi.mocked(apiClient.put).mockResolvedValue({});

      const cachedRepository = new CachedUserRepository(repository);

      // Load user into cache
      const user = await cachedRepository.findById(UserId.create('123'));
      expect(user).not.toBeNull();

      // Update user - should invalidate cache
      await cachedRepository.update(user!);

      // Next fetch should hit API again
      vi.mocked(apiClient.get).mockClear();
      await cachedRepository.findById(UserId.create('123'));
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
