import { describe, it, expect } from 'vitest';

import { User } from '../../../entities/user.entity.js';
import { Email } from '../../../value-objects/email.vo.js';
import { UserId } from '../../../value-objects/user-id.vo.js';
import { UserRole } from '../../../value-objects/user-role.vo.js';

describe('User Entity', () => {
  const validId = UserId.create('test-id');
  const validEmail = Email.create('test@example.com');
  const validDisplayName = 'Test User';

  describe('create', () => {
    it('should create a valid user', () => {
      const user = User.create(validId, validEmail, validDisplayName);

      expect(user.id).toBe('test-id');
      expect(user.email).toBe('test@example.com');
      expect(user.displayName).toBe('Test User');
      expect(user.role).toBe('user');
    });

    it('should create a user with custom role', () => {
      const adminRole = UserRole.create('admin');
      const user = User.create(
        validId,
        validEmail,
        validDisplayName,
        adminRole,
      );

      expect(user.role).toBe('admin');
    });
  });

  describe('updateProfile', () => {
    it('should update display name and avatar', () => {
      const user = User.create(validId, validEmail, validDisplayName);
      const newDisplayName = 'Updated Name';
      const newAvatarUrl = 'https://example.com/avatar.jpg';

      user.updateProfile(newDisplayName, newAvatarUrl);

      expect(user.displayName).toBe(newDisplayName);
      expect(user.avatarUrl).toBe(newAvatarUrl);
    });
  });

  describe('updateEmail', () => {
    it('should update email', () => {
      const user = User.create(validId, validEmail, validDisplayName);
      const newEmail = Email.create('new@example.com');

      user.updateEmail(newEmail);

      expect(user.email).toBe('new@example.com');
    });
  });

  describe('updateRole', () => {
    it('should update role', () => {
      const user = User.create(validId, validEmail, validDisplayName);
      const newRole = UserRole.create('admin');

      user.updateRole(newRole);

      expect(user.role).toBe('admin');
    });
  });

  describe('recordLogin', () => {
    it('should update last login timestamp', () => {
      const user = User.create(validId, validEmail, validDisplayName);
      const before = new Date();

      user.recordLogin();

      const after = new Date();
      expect(user.lastLoginAt).toBeDefined();
      const lastLoginAt = user.lastLoginAt;
      if (!lastLoginAt) {
        throw new Error('Last login timestamp not set');
      }
      expect(lastLoginAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastLoginAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
